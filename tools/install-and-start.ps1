# Codex++ Voice Input one-command installer and launcher.

param(
    [string]$RepoUrl = "https://github.com/whishi47/codex-voice-input.git",
    [string]$InstallDir = (Join-Path $env:APPDATA "Codex++\codex-voice-input"),
    [int]$Port = 17420,
    [string]$Model = "small",
    [switch]$Foreground,
    [switch]$SkipDependencyInstall,
    [switch]$SkipStart
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[Codex Voice Input] $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-ProjectDir {
    param([string]$Path)
    return (
        (Test-Path (Join-Path $Path "codex-voice-input.js")) -and
        (Test-Path (Join-Path $Path "tools\voice-helper.py"))
    )
}

function Get-LocalProjectDir {
    if ($PSScriptRoot) {
        $fromScript = Resolve-Path (Join-Path $PSScriptRoot "..") -ErrorAction SilentlyContinue
        if ($fromScript -and (Test-ProjectDir $fromScript.Path)) {
            return @{
                Path = $fromScript.Path
                Managed = $false
            }
        }
    }

    $fromCwd = (Get-Location).Path
    if (Test-ProjectDir $fromCwd) {
        return @{
            Path = $fromCwd
            Managed = $false
        }
    }

    return @{
        Path = $InstallDir
        Managed = $true
    }
}

function Get-PythonCommand {
    $candidates = @(
        (Join-Path $env:USERPROFILE ".workbuddy\binaries\python\envs\voice-mcp\Scripts\python.exe"),
        (Join-Path $env:USERPROFILE ".workbuddy\binaries\python\versions\3.13.12\python.exe"),
        "python",
        "python3",
        "py"
    )

    foreach ($candidate in $candidates) {
        try {
            & $candidate --version *> $null
            if ($LASTEXITCODE -eq 0) {
                return $candidate
            }
        } catch {}
    }

    throw "Python 3.9+ was not found. Install Python first, then run this command again."
}

function Sync-Project {
    param([string]$ProjectDir, [bool]$Managed)

    if (Test-ProjectDir $ProjectDir) {
        if ($Managed -and (Test-Path (Join-Path $ProjectDir ".git")) -and (Test-Command "git")) {
            Write-Step "Updating existing project: $ProjectDir"
            & git -C $ProjectDir pull --ff-only
        } else {
            Write-Step "Using existing project: $ProjectDir"
        }
        return
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ProjectDir) | Out-Null

    if (Test-Command "git") {
        Write-Step "Cloning GitHub project to: $ProjectDir"
        & git clone $RepoUrl $ProjectDir
        return
    }

    $zipUrl = $RepoUrl -replace "\.git$", "/archive/refs/heads/master.zip"
    $tempRoot = Join-Path $env:TEMP ("codex-voice-input-" + [guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tempRoot "source.zip"
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

    Write-Step "Downloading GitHub project archive"
    Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath

    Write-Step "Extracting project archive"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $tempRoot -Force
    $expanded = Get-ChildItem -LiteralPath $tempRoot -Directory | Select-Object -First 1
    if (-not $expanded) {
        throw "Downloaded archive did not contain a project directory."
    }

    if (Test-Path $ProjectDir) {
        throw "InstallDir already exists but is not a Codex Voice Input project: $ProjectDir"
    }
    Move-Item -LiteralPath $expanded.FullName -Destination $ProjectDir
}

function Install-UserScript {
    param([string]$ProjectDir)

    $scriptSource = Join-Path $ProjectDir "codex-voice-input.js"
    $targetDir = Join-Path $env:APPDATA "Codex++\user_scripts"
    $scriptTarget = Join-Path $targetDir "codex-voice-input.js"

    if (-not (Test-Path $scriptSource)) {
        throw "Missing codex-voice-input.js in $ProjectDir"
    }

    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -LiteralPath $scriptSource -Destination $scriptTarget -Force
    Write-Step "Installed user script: $scriptTarget"
}

function Ensure-HelperEnvironment {
    param([string]$ProjectDir, [string]$PythonCommand)

    if ($SkipDependencyInstall) {
        Write-Step "Skipping helper environment setup"
        return $PythonCommand
    }

    $venvPath = Join-Path $ProjectDir ".venv"
    $venvPython = Join-Path $venvPath "Scripts\python.exe"

    if (-not (Test-Path $venvPython)) {
        Write-Step "Creating Python virtual environment"
        & $PythonCommand -m venv $venvPath
    }

    $pipPath = Join-Path $venvPath "Scripts\pip.exe"
    $requirements = Join-Path $ProjectDir "requirements.txt"

    Write-Step "Installing voice helper dependencies"
    if (Test-Path $requirements) {
        & $pipPath install -r $requirements
    } else {
        & $pipPath install flask faster-whisper numpy
    }

    return $venvPython
}

function Start-VoiceHelper {
    param([string]$ProjectDir, [string]$PythonCommand)

    $helper = Join-Path $ProjectDir "tools\voice-helper.py"
    if (-not (Test-Path $helper)) {
        throw "Missing voice helper: $helper"
    }

    $healthUrl = "http://127.0.0.1:$Port/health"
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Step "Voice helper is already running: $healthUrl"
            return
        }
    } catch {}

    Write-Step "Starting voice helper on port $Port"
    if ($Foreground) {
        & $PythonCommand $helper --port $Port --model $Model
    } else {
        Start-Process -FilePath $PythonCommand `
            -ArgumentList @($helper, "--port", $Port, "--model", $Model) `
            -WorkingDirectory $ProjectDir `
            -WindowStyle Hidden
    }
}

$project = Get-LocalProjectDir
$projectDir = $project.Path
Sync-Project -ProjectDir $projectDir -Managed $project.Managed
Install-UserScript -ProjectDir $projectDir
$python = Get-PythonCommand
$helperPython = Ensure-HelperEnvironment -ProjectDir $projectDir -PythonCommand $python
if ($SkipStart) {
    Write-Step "Skipping voice helper start"
} else {
    Start-VoiceHelper -ProjectDir $projectDir -PythonCommand $helperPython
}

Write-Step "Done. Restart Codex/Codex++ if the user script was just installed."

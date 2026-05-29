const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const installScript = read("tools/install-and-start.ps1");
assert(
  installScript.includes("https://github.com/whishi47/codex-voice-input.git"),
  "install-and-start.ps1 should know the GitHub repository URL"
);
assert(
  /git\s+clone/i.test(installScript) || /Invoke-WebRequest/i.test(installScript),
  "install-and-start.ps1 should download the full project when missing"
);
assert(
  installScript.includes("Codex++\\user_scripts") &&
    installScript.includes("codex-voice-input.js") &&
    installScript.includes("Copy-Item"),
  "install-and-start.ps1 should deploy the Codex++ user script"
);
assert(
  installScript.includes("Start-Process"),
  "install-and-start.ps1 should start the voice helper as a process"
);
assert(
  installScript.includes("Start-Process -FilePath $PythonCommand"),
  "install-and-start.ps1 should start the voice helper using only the resolved Python executable"
);
assert(
  /(?:& \$pipPath install -r \$requirements|& \$pipPath install flask faster-whisper numpy)\s*\|\s*Out-Host/.test(installScript),
  "install-and-start.ps1 should stream pip output to the host so it cannot pollute the returned Python path"
);
assert(
  /(?:& \$PythonCommand -m venv \$venvPath)\s*\|\s*Out-Host/.test(installScript),
  "install-and-start.ps1 should stream venv output to the host so it cannot pollute the returned Python path"
);
assert(
  !/Remove-Item\s+-LiteralPath\s+\$ProjectDir\s+-Recurse/i.test(installScript),
  "install-and-start.ps1 should not recursively delete the selected install directory"
);
assert(
  installScript.includes("Unable to update from GitHub") &&
    installScript.includes("using cached project"),
  "install-and-start.ps1 should clearly fall back to the cached project when GitHub update fails"
);

function testInstallerUsesCachedProjectWhenGitFails() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cvi-offline-"));
  const fakeBin = path.join(tempRoot, "bin");
  const appData = path.join(tempRoot, "appdata");
  const projectDir = path.join(appData, "Codex++", "codex-voice-input");
  const toolsDir = path.join(projectDir, "tools");
  const downloadedInstaller = path.join(tempRoot, "downloaded-install.ps1");

  fs.mkdirSync(fakeBin, { recursive: true });
  fs.mkdirSync(toolsDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(projectDir, "codex-voice-input.js"), "// cached script\n");
  fs.writeFileSync(path.join(toolsDir, "voice-helper.py"), "print('helper')\n");
  fs.copyFileSync(path.join(root, "tools", "install-and-start.ps1"), downloadedInstaller);
  fs.writeFileSync(
    path.join(fakeBin, "git.cmd"),
    "@echo off\r\necho simulated github timeout 1>&2\r\nexit /b 1\r\n"
  );

  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") || "Path";
  const env = {
    ...process.env,
    APPDATA: appData,
    [pathKey]: fakeBin + path.delimiter + process.env[pathKey],
  };
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      downloadedInstaller,
      "-InstallDir",
      projectDir,
      "-SkipDependencyInstall",
      "-SkipStart",
    ],
    { cwd: tempRoot, env, encoding: "utf8" }
  );
  const output = (result.stdout || "") + (result.stderr || "");
  assert(result.status === 0, "installer should exit 0 when cached project exists and git update fails: " + output);
  assert(
    output.includes("Unable to update from GitHub") && output.includes("using cached project"),
    "installer should explain cached fallback when git update fails: " + output
  );
  assert(
    fs.existsSync(path.join(appData, "Codex++", "user_scripts", "codex-voice-input.js")),
    "installer should still deploy the cached user script when offline"
  );
}

testInstallerUsesCachedProjectWhenGitFails();

const userScript = read("codex-voice-input.js");
const packageJson = JSON.parse(read("package.json"));
const marketEntry = JSON.parse(read("market-entry.json"));
const readmeZh = read("README.md");
const readmeEn = read("README.en.md");
const contributing = read("CONTRIBUTING.md");
const prTemplate = read(".github/pull_request_template.md");
const codeowners = read(".github/CODEOWNERS");

function buildInstallCommandFromUserScript() {
  const snippet = userScript.match(/const INSTALL_SCRIPT_URL[\s\S]*?const INSTALL_COMMAND = ([^;]+);/);
  assert(snippet, "codex-voice-input.js should keep INSTALL_COMMAND in the expected generated form");
  const context = {};
  vm.runInNewContext(`
const REPO_URL = "https://github.com/whishi47/codex-voice-input";
function quotePowerShellCommand(command) {
  return "'" + String(command).replace(/'/g, "''") + "'";
}
${snippet[0]}
globalThis.INSTALL_COMMAND = INSTALL_COMMAND;
`, context);
  return context.INSTALL_COMMAND;
}

function extractFirstPowershellBlock(markdown) {
  const match = markdown.match(/```powershell\r?\n([\s\S]*?)```/);
  assert(match, "README should contain a PowerShell install block");
  return match[1].trim();
}

function testLauncherFallsBackToCompleteCachedInstaller() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cvi-launcher-"));
  const appData = path.join(tempRoot, "appdata");
  const cachedRoot = path.join(appData, "Codex++", "codex-voice-input");
  const cachedTools = path.join(cachedRoot, "tools");
  const staleTempInstaller = path.join(os.tmpdir(), "codex-voice-input-install.ps1");
  const command = buildInstallCommandFromUserScript().replace(
    "https://github.com/whishi47/codex-voice-input/raw/master/tools/install-and-start.ps1",
    "http://127.0.0.1:9/missing/install-and-start.ps1"
  );

  fs.mkdirSync(cachedTools, { recursive: true });
  fs.writeFileSync(path.join(cachedRoot, "codex-voice-input.js"), "// cached script\n");
  fs.writeFileSync(path.join(cachedTools, "voice-helper.py"), "print('helper')\n");
  fs.writeFileSync(
    path.join(cachedTools, "install-and-start.ps1"),
    "Write-Host '[cached installer executed]'; exit 0\n"
  );
  fs.writeFileSync(staleTempInstaller, "throw 'stale temp installer should not run'\n");

  const env = { ...process.env, APPDATA: appData };
  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    cwd: tempRoot,
    env,
    encoding: "utf8",
  });
  const output = (result.stdout || "") + (result.stderr || "");
  assert(result.status === 0, "launcher should run cached installer when download fails: " + output);
  assert(output.includes("[cached installer executed]"), "launcher should execute the complete cached installer: " + output);
  assert(
    !output.includes("stale temp installer should not run"),
    "launcher should never execute the old fixed temp installer path: " + output
  );
}

function testLauncherRejectsIncompleteCacheWhenDownloadFails() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cvi-launcher-incomplete-"));
  const appData = path.join(tempRoot, "appdata");
  const cachedTools = path.join(appData, "Codex++", "codex-voice-input", "tools");
  const command = buildInstallCommandFromUserScript().replace(
    "https://github.com/whishi47/codex-voice-input/raw/master/tools/install-and-start.ps1",
    "http://127.0.0.1:9/missing/install-and-start.ps1"
  );

  fs.mkdirSync(cachedTools, { recursive: true });
  fs.writeFileSync(path.join(cachedTools, "install-and-start.ps1"), "Write-Host '[incomplete cached installer]'; exit 0\n");

  const env = { ...process.env, APPDATA: appData };
  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    cwd: tempRoot,
    env,
    encoding: "utf8",
  });
  const output = (result.stdout || "") + (result.stderr || "");
  assert(result.status !== 0, "launcher should fail when download fails and cache is incomplete");
  assert(
    output.includes("没有找到完整的本地缓存项目") && !output.includes("[incomplete cached installer]"),
    "launcher should reject incomplete cached projects without running them: " + output
  );
}

assert(packageJson.version === "1.1.3", "package.json should be bumped to 1.1.2");
assert(marketEntry.version === "1.1.3", "market-entry.json should be bumped to 1.1.2");

assert(
  userScript.includes("INSTALL_COMMAND"),
  "codex-voice-input.js should expose the one-command installer"
);
assert(
  userScript.includes("const SCRIPT_VERSION = 104"),
  "codex-voice-input.js should bump SCRIPT_VERSION for the 1.1.3 release"
);
assert(
  userScript.includes("PROJECT_URL") &&
    userScript.includes("openProjectGuide") &&
    userScript.includes("GitHub / 使用说明"),
  "codex-voice-input.js should include a menu item that opens the GitHub usage guide"
);
assert(
  userScript.includes("showSetupHelp"),
  "codex-voice-input.js should show setup help when helper is offline"
);
assert(
  userScript.includes("navigator.clipboard.writeText(INSTALL_COMMAND)"),
  "codex-voice-input.js should copy the install command for the user"
);
assert(
  userScript.includes("quotePowerShellCommand") &&
    userScript.includes('-Command " + quotePowerShellCommand(INSTALL_POWERSHELL)') &&
    !userScript.includes('-Command " + INSTALL_POWERSHELL'),
  "codex-voice-input.js should quote the PowerShell installer so parent shells do not expand variables"
);
assert(
  userScript.includes("$ErrorActionPreference='Stop'") &&
    userScript.includes("$cachedRoot=Join-Path $env:APPDATA") &&
    userScript.includes("$cachedUserScript=Join-Path $cachedRoot") &&
    userScript.includes("$cachedHelper=Join-Path $cachedRoot") &&
    userScript.includes("[guid]::NewGuid()") &&
    userScript.includes("catch {"),
  "codex-voice-input.js install command should avoid stale temp scripts and fall back to cached installer when GitHub is unreachable"
);
assert(
  userScript.includes("$localInstaller=Join-Path (Get-Location) 'tools\\\\install-and-start.ps1'") &&
    userScript.includes("Test-Path $localInstaller"),
  "codex-voice-input.js should prefer the local installer when the user is already in the repository"
);
assert(
  /mode:\s*"floating"/.test(userScript),
  "codex-voice-input.js should default new installs to floating mode"
);
assert(
  userScript.includes("Floating mode always moves root under body"),
  "codex-voice-input.js should move the floating root back under document.body when switching modes"
);
assert(
  userScript.includes('b.closest("#" + ROOT_ID)'),
  "codex-voice-input.js should not use its own mic button as the inline mount target"
);
assert(
  userScript.includes('root.dataset.placement !== "floating"'),
  "codex-voice-input.js drag should check actual floating placement, not only saved UI mode"
);
assert(
  userScript.includes("suppressNextClick") && userScript.includes("state.suppressNextClick = true"),
  "codex-voice-input.js should suppress the button click produced after a drag"
);
assert(
  userScript.includes("clearTimeout(state.hoverOpenTimer)") &&
    userScript.includes('closeVoiceMenu("hover")'),
  "codex-voice-input.js should not open the hover menu while dragging"
);
assert(
  userScript.includes("installHoverMenu"),
  "codex-voice-input.js should install a hover action menu for the floating button"
);
assert(
  userScript.includes("showVoiceMenu") && userScript.includes("buildVoiceMenuItems"),
  "codex-voice-input.js should reuse one menu implementation for hover and context menus"
);
assert(
  userScript.includes('showVoiceMenu(rect.right + 8, rect.top, "hover")') &&
    userScript.includes('closeVoiceMenu("hover")'),
  "codex-voice-input.js should mark hover menus so they can close independently"
);
assert(
  userScript.includes("cvi-float-enter") &&
    userScript.includes("cvi-hover-pop") &&
    userScript.includes("cvi-menu-in"),
  "codex-voice-input.js should animate floating entry, hover affordance, and menus"
);
assert(
  userScript.includes("cvi-record-ring") &&
    userScript.includes("cvi-processing-sheen") &&
    userScript.includes("cvi-done-spark"),
  "codex-voice-input.js should animate recording, processing, and completed states"
);
assert(
  userScript.includes("@media (prefers-reduced-motion:reduce)") &&
    userScript.includes("animation:none!important"),
  "codex-voice-input.js should respect reduced-motion preferences"
);
assert(
  readmeZh.includes("一键安装并启动") &&
    readmeZh.includes("悬浮菜单") &&
    readmeZh.includes("贡献与审核"),
  "README.md should document one-stop install, hover menu, and contribution review"
);
assert(
  readmeEn.includes("One-Command Install") &&
    readmeEn.includes("Floating Menu") &&
    readmeEn.includes("Contribution Review"),
  "README.en.md should document one-stop install, hover menu, and contribution review"
);
const generatedInstallCommand = buildInstallCommandFromUserScript();
assert(
  extractFirstPowershellBlock(readmeZh) === generatedInstallCommand &&
    extractFirstPowershellBlock(readmeEn) === generatedInstallCommand,
  "README install commands should match the command copied by codex-voice-input.js"
);
testLauncherFallsBackToCompleteCachedInstaller();
testLauncherRejectsIncompleteCacheWhenDownloadFails();
assert(
  contributing.includes("maintainer review") &&
    contributing.includes("npm test") &&
    contributing.includes("API keys"),
  "CONTRIBUTING.md should document maintainer review, tests, and privacy rules"
);
assert(
  prTemplate.includes("Review Checklist") &&
    prTemplate.includes("maintainer review") &&
    prTemplate.includes("npm test"),
  "pull_request_template.md should require review checklist and tests"
);
assert(
  codeowners.includes("@whishi47"),
  "CODEOWNERS should request maintainer review"
);

console.log("smoke tests passed");

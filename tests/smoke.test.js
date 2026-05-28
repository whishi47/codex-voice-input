const fs = require("fs");
const path = require("path");

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
  !/Remove-Item\s+-LiteralPath\s+\$ProjectDir\s+-Recurse/i.test(installScript),
  "install-and-start.ps1 should not recursively delete the selected install directory"
);

const userScript = read("codex-voice-input.js");
const packageJson = JSON.parse(read("package.json"));
const marketEntry = JSON.parse(read("market-entry.json"));
const readmeZh = read("README.md");
const readmeEn = read("README.en.md");
const contributing = read("CONTRIBUTING.md");
const prTemplate = read(".github/pull_request_template.md");
const codeowners = read(".github/CODEOWNERS");

assert(packageJson.version === "1.1.0", "package.json should be bumped to 1.1.0");
assert(marketEntry.version === "1.1.0", "market-entry.json should be bumped to 1.1.0");

assert(
  userScript.includes("INSTALL_COMMAND"),
  "codex-voice-input.js should expose the one-command installer"
);
assert(
  userScript.includes("const SCRIPT_VERSION = 102"),
  "codex-voice-input.js should bump SCRIPT_VERSION for the 1.1.0 release"
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

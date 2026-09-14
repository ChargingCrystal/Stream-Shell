$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $Root
$Target = Join-Path $ProjectRoot "background.js"
$Chunks = @(
  "../shared/resume-utils.js"
  "src/00-config-home.js"
  "src/00a-flight-recorder.js"
  "src/00b-display-profile.js"
  "src/01-window-utils.js"
  "src/02-providers.js"
  "src/03-landing-window.js"
  "src/04-dashboard-window.js"
  "src/05-discord.js"
  "src/05a-twitch.js"
  "src/06-titlebar.js"
  "src/06a-volume-capture.js"
  "src/06b-crunchyroll-skip-events.js"
  "src/06c-sleep-timer.js"
  "src/07-shutdown.js"
  "src/08-subscriptions.js"
  "src/09-message-helpers.js"
  "src/09-message-router.js"
  "src/10-window-visibility.js"
  "src/10a-resource-governor.js"
  "src/11-playback-state-events.js"
  "src/12-direct-links.js"
  "src/12a-stale-link-resolver.js"
  "src/13-self-test.js"
  "src/14-repair.js"
)

$Stream = New-Object System.IO.MemoryStream
try {
  foreach ($RelativePath in $Chunks) {
    $Path = if ($RelativePath.StartsWith("../shared/")) {
      Join-Path $ProjectRoot $RelativePath.Substring(3)
    } else {
      Join-Path $Root $RelativePath
    }
    $Bytes = [System.IO.File]::ReadAllBytes($Path)
    $Stream.Write($Bytes, 0, $Bytes.Length)
  }
  [System.IO.File]::WriteAllBytes($Target, $Stream.ToArray())
}
finally {
  $Stream.Dispose()
}

$Hash = (Get-FileHash -Algorithm SHA256 $Target).Hash.ToLowerInvariant()
Write-Host "Built background.js"
Write-Host "SHA-256: $Hash"

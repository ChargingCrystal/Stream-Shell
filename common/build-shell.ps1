$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceRoot = Join-Path $Root "src"
$ProjectRoot = Split-Path -Parent $Root
$Output = Join-Path $Root "shell.js"

$Files = @(
    "bootstrap-state.js"
    "../shared/resume-utils.js"
    "now-playing-base.js"
    "now-playing-netflix.js"
    "now-playing-playback.js"
    "now-playing-providers.js"
    "provider-api-core.js"
    "provider-safe-mode.js"
    "provider-resource-governor.js"
    "provider-api-self-test.js"
    "provider-api-resume.js"
    "provider-api-start.js"
    "now-playing-tracker.js"
    "windowed-player-core.js"
    "windowed-player-youtube.js"
    "windowed-player-crunchyroll.js"
    "windowed-player-sync.js"
    "playback-utilities-core.js"
    "playback-anarchy.js"
    "playback-utilities.js"
    "provider-adapter-disney.js"
    "netflix-enhancements.js"
    "provider-adapter-netflix.js"
    "crunchyroll-enhancements.js"
    "provider-adapter-crunchyroll.js"
    "prime-enhancements.js"
    "provider-adapter-prime.js"
    "youtube-utilities-base.js"
    "youtube-quality.js"
    "youtube-upload-date.js"
    "youtube-auto-like.js"
    "youtube-shorts-like-icon.js"
    "youtube-loop-keep-playing.js"
    "youtube-runtime.js"
    "youtube-utilities-start.js"
    "provider-adapter-youtube.js"
    "provider-repair.js"
    "provider-diagnostics.js"
    "windowed-player-start.js"
    "start.js"
)

$stream = [System.IO.File]::Open($Output, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
    foreach ($file in $Files) {
        $path = if ($file.StartsWith("../shared/")) {
            Join-Path $ProjectRoot $file.Substring(3)
        } else {
            Join-Path $SourceRoot $file
        }
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Missing common source file: $path"
        }

        $bytes = [System.IO.File]::ReadAllBytes($path)
        $stream.Write($bytes, 0, $bytes.Length)
    }
}
finally {
    $stream.Dispose()
}

$Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Output).Hash.ToLowerInvariant()
Write-Host "Built common/shell.js from $($Files.Count) source chunks."
Write-Host "SHA-256: $Hash"

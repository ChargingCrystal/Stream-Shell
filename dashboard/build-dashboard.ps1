$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceRoot = Join-Path $Root "src"
$ProjectRoot = Split-Path -Parent $Root
$LandingSourceRoot = Join-Path $ProjectRoot "landing/src"
$Output = Join-Path $Root "dashboard.js"
$CompactOutput = Join-Path $Root "compact-home.js"

$Files = @(
    "state.js"
    "contextual-motion.js"
    "now-playing-ui.js"
    "now-playing-artwork.js"
    "now-playing-progress.js"
    "now-playing-render.js"
    "clock.js"
    "svg-helpers.js"
    "availability.js"
    "provider-search.js"
    "provider-open.js"
    "selected-media.js"
    "settings-config.js"
    "settings-controls.js"
    "settings-diagnostics.js"
    "settings-provider-pages.js"
    "settings-runtime.js"
    "click-router.js"
    "compact-home-loader.js"
    "shell-state.js"
)

$LandingFiles = @(
    "state.js"
    "subscriptions.js"
    "media-ui.js"
    "token.js"
    "availability.js"
    "media-items.js"
    "library.js"
    "search.js"
    "selection.js"
    "watchlist-transfer.js"
    "orchestrator.js"
)

function Write-Bundle($OutputPath, $Paths) {
    $stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    try {
        foreach ($path in $Paths) {
            if (-not (Test-Path -LiteralPath $path)) { throw "Missing source file: $path" }
            $bytes = [System.IO.File]::ReadAllBytes($path)
            $stream.Write($bytes, 0, $bytes.Length)
        }
    }
    finally {
        $stream.Dispose()
    }
}

$DashboardPaths = @($Files | ForEach-Object { Join-Path $SourceRoot $_ })
Write-Bundle $Output $DashboardPaths

$CompactPaths = @(
    (Join-Path $SourceRoot "compact-home-prefix.js")
) + @($LandingFiles | ForEach-Object { Join-Path $LandingSourceRoot $_ }) + @(
    (Join-Path $SourceRoot "compact-home-suffix.js")
)
Write-Bundle $CompactOutput $CompactPaths

$DashboardHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Output).Hash.ToLowerInvariant()
$CompactHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $CompactOutput).Hash.ToLowerInvariant()
Write-Host "Built dashboard.js from $($Files.Count) dashboard chunks."
Write-Host "Dashboard SHA-256: $DashboardHash"
Write-Host "Built compact-home.js from 2 wrappers + $($LandingFiles.Count) Landing chunks."
Write-Host "Compact SHA-256: $CompactHash"

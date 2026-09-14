$ErrorActionPreference = "Stop"

$LandingRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceRoot = Join-Path $LandingRoot "src"
$Target = Join-Path $LandingRoot "landing.js"

$Order = @(
    "state.js",
    "subscriptions.js",
    "media-ui.js",
    "token.js",
    "availability.js",
    "media-items.js",
    "library.js",
    "search.js",
    "selection.js",
    "watchlist-transfer.js",
    "orchestrator.js"
)

$Content = [System.Text.StringBuilder]::new()
foreach ($File in $Order) {
    $Path = Join-Path $SourceRoot $File
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing landing source file: $Path"
    }

    [void]$Content.Append([System.IO.File]::ReadAllText($Path))
}

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($Target, $Content.ToString(), $Utf8NoBom)

$Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Target).Hash
Write-Host "Generated landing.js"
Write-Host "SHA256: $Hash"

# One-time migration after applying PATCH v0.21.2 on v0.21.1.
# Removes only the OLD source files already relocated to integrations/.
# Does not touch installed EXEs, registry or personal custom assets.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$files = @(
    @{ Old = "native/StreamShellDiscordHost.cs"; New = "integrations/discord/StreamShellDiscordHost.cs" }
    @{ Old = "native/install-discord-helper.ps1"; New = "integrations/discord/install-discord-helper.ps1" }
    @{ Old = "native/uninstall-discord-helper.ps1"; New = "integrations/discord/uninstall-discord-helper.ps1" }
    @{ Old = "native/StreamShellMangayomiHost.cs"; New = "integrations/mangayomi/StreamShellMangayomiHost.cs" }
    @{ Old = "native/install-mangayomi-helper.ps1"; New = "integrations/mangayomi/install-mangayomi-helper.ps1" }
    @{ Old = "native/uninstall-mangayomi-helper.ps1"; New = "integrations/mangayomi/uninstall-mangayomi-helper.ps1" }
    @{ Old = "native/tests/compile-mangayomi-host.ps1"; New = "integrations/mangayomi/tests/compile-mangayomi-host.ps1" }
)
foreach ($pair in $files) {
    $old = Join-Path $root $pair.Old
    $new = Join-Path $root $pair.New
    if (!(Test-Path -LiteralPath $new -PathType Leaf)) {
        throw "Migration refused: missing replacement file '$new'. Run this AFTER applying v0.21.2 PATCH."
    }
}
foreach ($pair in $files) {
    $old = Join-Path $root $pair.Old
    if (Test-Path -LiteralPath $old -PathType Leaf) {
        Remove-Item -LiteralPath $old -Force
        Write-Host "Removed historical source: $($pair.Old)"
    }
}
Write-Host "Stream Shell v0.21.2 integration source migration complete." -ForegroundColor Green

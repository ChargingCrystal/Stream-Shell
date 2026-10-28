# Opt-in ONLY after compiling and installing a Mangayomi Windows build with
# fork-patches/0001-global-search-uri.patch (or an equivalent upstream handler).
# This does not modify Mangayomi's source or make a stock build compatible.
param(
    [string]$ExecutablePath = "",
    [switch]$IInstalledPatchedBuild,
    [switch]$Disable
)
$ErrorActionPreference = 'Stop'
$capabilityKey = 'HKCU:\Software\StreamShell\MangayomiBridge'
$markerDir = Join-Path $env:LOCALAPPDATA 'StreamShell'
$markerPath = Join-Path $markerDir 'mangayomi-bridge.enabled'
if ($Disable) {
    if (Test-Path $capabilityKey) {
        Remove-ItemProperty -Path $capabilityKey -Name 'DirectSearchEnabled' -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $markerPath -Force -ErrorAction SilentlyContinue
    Write-Host 'Stream Shell Mangayomi source-search bridge disabled.'
    exit 0
}
if (-not $IInstalledPatchedBuild) {
    throw 'Refusing to enable: confirm that your Mangayomi.exe was built with global-search URI support by passing -IInstalledPatchedBuild.'
}
if ([string]::IsNullOrWhiteSpace($ExecutablePath)) {
    throw 'Pass -ExecutablePath pointing to your custom-built Mangayomi.exe.'
}
$full = [System.IO.Path]::GetFullPath($ExecutablePath)
if ([System.IO.Path]::GetFileName($full) -ne 'Mangayomi.exe' -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
    throw 'Only an existing Mangayomi.exe is accepted.'
}
# Register the same per-user mangayomi:// handler the patched app expects.
# Stream Shell refuses ShellExecute when this association/capability is absent.
$schemeKey = 'HKCU:\Software\Classes\mangayomi'
$commandKey = Join-Path $schemeKey 'shell\open\command'
New-Item -Path $schemeKey -Force | Out-Null
Set-Item -Path $schemeKey -Value 'URL:Mangayomi'
New-ItemProperty -Path $schemeKey -Name 'URL Protocol' -PropertyType String -Value '' -Force | Out-Null
New-Item -Path $commandKey -Force | Out-Null
Set-Item -Path $commandKey -Value ('"' + $full + '" "%1"')
New-Item -Path $capabilityKey -Force | Out-Null
New-ItemProperty -Path $capabilityKey -Name 'DirectSearchEnabled' -PropertyType DWord -Value 1 -Force | Out-Null
New-Item -ItemType Directory -Path $markerDir -Force | Out-Null
Set-Content -LiteralPath $markerPath -Value 'Enabled by Stream Shell user; requires patched Mangayomi build.' -Encoding UTF8
Write-Host 'Patched Mangayomi source-search bridge enabled for this Windows user.'
Write-Host 'Open the patched Mangayomi app once before testing Shift+click.'
Write-Host 'Disable later with: .\integrations\mangayomi\enable-patched-search.ps1 -Disable'

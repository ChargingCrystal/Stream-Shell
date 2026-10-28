$ErrorActionPreference = "SilentlyContinue"
$HostName = "com.streamshell.mangayomi"
$InstallRoot = Join-Path $env:LOCALAPPDATA "StreamShell\NativeHost"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"' + $PSCommandPath + '"')
    )
    exit
}

Remove-Item "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName" -Recurse -Force
Remove-Item "HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$HostName" -Recurse -Force
# Keep other native hosts installed: remove only this integration's files.
Remove-Item -LiteralPath (Join-Path $InstallRoot "StreamShellMangayomiHost.exe") -Force
Remove-Item -LiteralPath (Join-Path $InstallRoot "$HostName.json") -Force

Write-Host "Stream Shell Mangayomi helper removed." -ForegroundColor Green
Read-Host "Press Enter to close"

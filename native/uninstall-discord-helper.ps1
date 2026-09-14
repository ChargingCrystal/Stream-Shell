$ErrorActionPreference = "SilentlyContinue"
$HostName = "com.streamshell.discord"
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
Remove-Item -LiteralPath $InstallRoot -Recurse -Force

Write-Host "Stream Shell Discord helper removed." -ForegroundColor Green
Read-Host "Press Enter to close"

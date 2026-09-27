$ErrorActionPreference = "Stop"

$HostName = "com.streamshell.finance"
$InstallRoot = Join-Path $env:LOCALAPPDATA "StreamShell\FinanceHost"
$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
    "HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$HostName"
)

Get-Process -Name "StreamShellFinanceHost" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

foreach ($registryPath in $registryPaths) {
    Remove-Item -Path $registryPath -Recurse -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $InstallRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Stream Shell COBOL finance integration removed." -ForegroundColor Green

param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$HostName = "com.streamshell.discord"
$ExtensionRoot = Split-Path $PSScriptRoot -Parent
$InstallRoot = Join-Path $env:LOCALAPPDATA "StreamShell\NativeHost"
$SourcePath = Join-Path $PSScriptRoot "StreamShellDiscordHost.cs"
$ExePath = Join-Path $InstallRoot "StreamShellDiscordHost.exe"
$ManifestPath = Join-Path $InstallRoot "$HostName.json"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-StreamShellExtensionId {
    param([string]$ExpectedPath)

    $candidateProfiles = @(
        (Join-Path $env:APPDATA "Opera Software\Opera Stable\Preferences"),
        (Join-Path $env:APPDATA "Opera Software\Opera GX Stable\Preferences"),
        (Join-Path $env:APPDATA "Opera Software\Opera Developer\Preferences"),
        (Join-Path $env:APPDATA "Opera Software\Opera Next\Preferences")
    ) | Where-Object { Test-Path $_ }

    $expected = [IO.Path]::GetFullPath($ExpectedPath).TrimEnd('\')

    foreach ($preferencesPath in $candidateProfiles) {
        try {
            $preferences = Get-Content -LiteralPath $preferencesPath -Raw | ConvertFrom-Json
            $settings = $preferences.extensions.settings
            if (-not $settings) { continue }

            foreach ($property in $settings.PSObject.Properties) {
                $entry = $property.Value
                $pathMatches = $false

                if ($entry.path) {
                    try {
                        $entryPath = [IO.Path]::GetFullPath([string]$entry.path).TrimEnd('\')
                        $pathMatches = $entryPath.Equals($expected, [StringComparison]::OrdinalIgnoreCase)
                    } catch {}
                }

                $nameMatches = $entry.manifest -and ([string]$entry.manifest.name -eq "Stream Shell")

                if ($pathMatches -or $nameMatches) {
                    return $property.Name
                }
            }
        } catch {
        }
    }

    return $null
}

if (-not (Test-Administrator)) {
    $arguments = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"' + $PSCommandPath + '"')
    )

    if ($ExtensionId) {
        $arguments += @("-ExtensionId", $ExtensionId)
    }

    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
    exit
}

if (-not $ExtensionId) {
    $ExtensionId = Find-StreamShellExtensionId -ExpectedPath $ExtensionRoot
}

if (-not $ExtensionId) {
    Write-Host ""
    Write-Host "Stream Shell extension ID could not be detected automatically." -ForegroundColor Yellow
    Write-Host "Open opera://extensions, enable Developer mode and copy the ID shown for Stream Shell." -ForegroundColor Yellow
    $ExtensionId = Read-Host "Extension ID"
}

$ExtensionId = $ExtensionId.Trim()
if ($ExtensionId -notmatch '^[a-p]{32}$') {
    throw "The extension ID '$ExtensionId' is not a valid Chromium extension ID."
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

if (Test-Path $ExePath) {
    Remove-Item -LiteralPath $ExePath -Force
}

$source = Get-Content -LiteralPath $SourcePath -Raw
Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $ExePath -OutputType ConsoleApplication

$manifest = [ordered]@{
    name = $HostName
    description = "Stream Shell native window helper"
    path = $ExePath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
    "HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$HostName"
)

foreach ($registryPath in $registryPaths) {
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -Path $registryPath -Value $ManifestPath
}

Write-Host ""
Write-Host "Stream Shell native helper installed." -ForegroundColor Green
Write-Host "Native host: $ExePath"
Write-Host "Extension ID: $ExtensionId"
Write-Host ""
Write-Host "Reload Stream Shell once in opera://extensions, then use the Discord button on the Landing page."
Read-Host "Press Enter to close"

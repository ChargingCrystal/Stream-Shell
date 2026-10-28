param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$HostName = "com.streamshell.mangayomi"
$ExtensionRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$InstallRoot = Join-Path $env:LOCALAPPDATA "StreamShell\NativeHost"
$SourcePath = Join-Path $PSScriptRoot "StreamShellMangayomiHost.cs"
$ExePath = Join-Path $InstallRoot "StreamShellMangayomiHost.exe"
$ManifestPath = Join-Path $InstallRoot "$HostName.json"
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

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
                if ($pathMatches -or $nameMatches) { return $property.Name }
            }
        } catch {}
    }
    return $null
}

function Get-RegisteredExtensionId {
    if (-not (Test-Path -LiteralPath $ManifestPath)) { return $null }
    try {
        $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        foreach ($origin in $manifest.allowed_origins) {
            if ([string]$origin -match '^chrome-extension://([a-p]{32})/$') {
                return $Matches[1]
            }
        }
    } catch {}
    return $null
}

# This host is installed entirely under HKCU and LOCALAPPDATA. Do not elevate:
# an elevated session can use a different Windows profile / HKCU hive.
if (-not $ExtensionId) { $ExtensionId = Get-RegisteredExtensionId }
if (-not $ExtensionId) { $ExtensionId = Find-StreamShellExtensionId -ExpectedPath $ExtensionRoot }
if (-not $ExtensionId) {
    Write-Host "Could not detect the Stream Shell extension ID." -ForegroundColor Yellow
    Write-Host "Open opera://extensions, enable Developer mode and copy the ID for Stream Shell." -ForegroundColor Yellow
    $ExtensionId = Read-Host "Extension ID"
}
$ExtensionId = $ExtensionId.Trim()
if ($ExtensionId -notmatch '^[a-p]{32}$') {
    throw "Invalid Stream Shell extension ID: $ExtensionId"
}
if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "Mangayomi native helper C# source missing: $SourcePath"
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
$StagePath = Join-Path $env:TEMP ("StreamShellMangayomiHost-" + [guid]::NewGuid().ToString('N') + ".exe")
$BackupPath = Join-Path $env:TEMP ("StreamShellMangayomiHost-backup-" + [guid]::NewGuid().ToString('N') + ".exe")
$backupCreated = $false

try {
    Write-Host "Compiling Mangayomi Native Messaging host (staged)..." -ForegroundColor Cyan
    $source = [IO.File]::ReadAllText($SourcePath)
    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $StagePath -OutputType ConsoleApplication -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $StagePath -PathType Leaf)) {
        throw "Compiler produced no EXE. Check compiler output and Windows Security protection history."
    }
    $size = (Get-Item -LiteralPath $StagePath).Length
    if ($size -lt 1024) { throw "Compiler output is suspiciously small: $size bytes" }

    # Never destroy the working host before a verified replacement exists.
    if (Test-Path -LiteralPath $ExePath -PathType Leaf) {
        Copy-Item -LiteralPath $ExePath -Destination $BackupPath -ErrorAction Stop
        $backupCreated = $true
    }
    try {
        Copy-Item -LiteralPath $StagePath -Destination $ExePath -Force -ErrorAction Stop
        if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
            throw "Installed host EXE disappeared after copy (possible Windows Security quarantine)."
        }
        if ((Get-Item -LiteralPath $ExePath).Length -ne $size) {
            throw "Installed host EXE size differs from compiled output."
        }
    } catch {
        if ($backupCreated) {
            try { Copy-Item -LiteralPath $BackupPath -Destination $ExePath -Force -ErrorAction Stop } catch {}
        }
        throw
    }

    $manifest = [ordered]@{
        name = $HostName
        description = "Stream Shell Mangayomi native helper"
        path = $ExePath
        type = "stdio"
        allowed_origins = @("chrome-extension://$ExtensionId/")
    }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($ManifestPath, ($manifest | ConvertTo-Json -Depth 4), $utf8NoBom)
    New-Item -Path $RegistryPath -Force | Out-Null
    Set-Item -Path $RegistryPath -Value $ManifestPath

    $registered = (Get-Item -LiteralPath $RegistryPath).GetValue('')
    if ($registered -ne $ManifestPath) { throw "Native Messaging registry registration did not persist." }
    if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) { throw "Native host EXE is missing after registration." }

    Write-Host "`nMangayomi Native Messaging host installed successfully." -ForegroundColor Green
    Write-Host "Native host: $ExePath"
    Write-Host "Manifest: $ManifestPath"
    Write-Host "Extension ID: $ExtensionId"
    Write-Host "Registration: HKCU (no administrator privileges required)"
    Write-Host "Reload Stream Shell in opera://extensions."
} catch {
    Write-Host "`nMangayomi host installation FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "The manifest/registration may remain; the executable must exist for Opera to connect." -ForegroundColor Yellow
    throw
} finally {
    Remove-Item -LiteralPath $StagePath -Force -ErrorAction SilentlyContinue
    if ($backupCreated) { Remove-Item -LiteralPath $BackupPath -Force -ErrorAction SilentlyContinue }
}

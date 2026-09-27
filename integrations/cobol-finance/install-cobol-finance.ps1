param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"

$HostName = "com.streamshell.finance"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$InstallRoot = Join-Path $env:LOCALAPPDATA "StreamShell\FinanceHost"
$HostSource = Join-Path $PSScriptRoot "StreamShellFinanceHost.cs"
$CobolSource = Join-Path $PSScriptRoot "subscription-reconcile.cob"
$HostExe = Join-Path $InstallRoot "StreamShellFinanceHost.exe"
$CobolExe = Join-Path $InstallRoot "StreamShellFinanceCobol.exe"
$RuntimePathFile = Join-Path $InstallRoot "cobol-runtime-path.txt"
$ManifestPath = Join-Path $InstallRoot "$HostName.json"
$TitlebarManifestPath = Join-Path $env:LOCALAPPDATA "StreamShell\TitlebarHost\com.streamshell.titlebar.json"

function Resolve-ExtensionId {
    param([string]$RequestedId)

    if (-not [string]::IsNullOrWhiteSpace($RequestedId)) {
        return $RequestedId.Trim()
    }

    if (Test-Path -LiteralPath $TitlebarManifestPath) {
        try {
            $titlebarManifest = Get-Content -LiteralPath $TitlebarManifestPath -Raw | ConvertFrom-Json
            foreach ($origin in @($titlebarManifest.allowed_origins)) {
                if ($origin -match '^chrome-extension://([a-z]{32})/$') {
                    return $Matches[1]
                }
            }
        }
        catch {
        }
    }

    throw "Stream Shell extension ID could not be inferred. Install the titlebar helper first or pass -ExtensionId <id>."
}

function Resolve-CobolCompiler {
    foreach ($candidate in @("cobc.exe", "cobc")) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    $knownPaths = @(
        "C:\msys64\ucrt64\bin\cobc.exe"
    )

    foreach ($candidate in $knownPaths) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "GnuCOBOL compiler 'cobc' was not found. Install GnuCOBOL (MSYS2 UCRT64 is supported) and run this installer again."
}

function Configure-CobolEnvironment {
    param([string]$CompilerPath)

    $binDir = Split-Path -Parent $CompilerPath
    if ([string]::IsNullOrWhiteSpace($binDir) -or -not (Test-Path -LiteralPath $binDir)) {
        throw "Could not resolve the GnuCOBOL runtime directory from $CompilerPath."
    }

    if (($env:Path -split ';') -notcontains $binDir) {
        $env:Path = "$binDir;$env:Path"
    }

    $prefix = Split-Path -Parent $binDir
    $configDir = Join-Path $prefix "share\gnucobol\config"
    $copyDir = Join-Path $prefix "share\gnucobol\copy"
    $libraryDir = Join-Path $prefix "lib\gnucobol"

    if (Test-Path -LiteralPath $configDir) {
        $env:COB_CONFIG_DIR = $configDir
    }

    if (Test-Path -LiteralPath $copyDir) {
        $env:COB_COPY_DIR = $copyDir
    }

    if (Test-Path -LiteralPath $libraryDir) {
        $env:COB_LIBRARY_PATH = $libraryDir
    }

    return $binDir
}

# Remove the two root-level preview wrappers from the broken pre-0.18.14 attempt.
foreach ($legacyPreview in @("apply-cobol-finance.cmd", "apply-cobol-finance.ps1")) {
    $legacyPath = Join-Path $ProjectRoot $legacyPreview
    Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
}

$manifestSource = Join-Path $ProjectRoot "manifest.json"
if (-not (Test-Path -LiteralPath $manifestSource)) {
    throw "Stream Shell manifest.json was not found at $ProjectRoot."
}

$streamShellManifest = Get-Content -LiteralPath $manifestSource -Raw | ConvertFrom-Json
$StreamShellVersion = [string]$streamShellManifest.version
if ([string]::IsNullOrWhiteSpace($StreamShellVersion)) {
    throw "Stream Shell manifest does not contain a valid version."
}

$ExtensionId = Resolve-ExtensionId $ExtensionId
$Cobc = Resolve-CobolCompiler
$CobolRuntimeBin = Configure-CobolEnvironment $Cobc

if (-not (Test-Path -LiteralPath $HostSource)) {
    throw "Missing native host source: $HostSource"
}

if (-not (Test-Path -LiteralPath $CobolSource)) {
    throw "Missing COBOL source: $CobolSource"
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

Get-Process -Name "StreamShellFinanceHost" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 100

Remove-Item -LiteralPath $HostExe -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $CobolExe -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $RuntimePathFile -Force -ErrorAction SilentlyContinue

Write-Host "Compiling native finance bridge..."
$hostCode = Get-Content -LiteralPath $HostSource -Raw
Add-Type `
    -TypeDefinition $hostCode `
    -Language CSharp `
    -ReferencedAssemblies @("System.dll", "System.Core.dll") `
    -OutputAssembly $HostExe `
    -OutputType ConsoleApplication

if (-not (Test-Path -LiteralPath $HostExe)) {
    throw "Native finance host executable was not created."
}

Write-Host "Compiling COBOL reconciliation engine..."
& $Cobc -x -free -O2 -o $CobolExe $CobolSource
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $CobolExe)) {
    throw "GnuCOBOL failed to build StreamShellFinanceCobol.exe."
}

# Persist the runtime bin directory for Opera-launched native messaging sessions.
[System.IO.File]::WriteAllText(
    $RuntimePathFile,
    $CobolRuntimeBin,
    [System.Text.Encoding]::ASCII
)

$testInput = Join-Path $env:TEMP ("stream-shell-finance-test-" + [guid]::NewGuid().ToString("N") + ".ledger")
$testOutput = [System.IO.Path]::ChangeExtension($testInput, ".report")

try {
    [System.IO.File]::WriteAllText(
        $testInput,
        "YOUTUBE     AM000001299G`n",
        [System.Text.UTF8Encoding]::new($false)
    )

    & $CobolExe $testInput $testOutput
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $testOutput)) {
        throw "COBOL reconciliation self-test did not produce a report."
    }

    $testReport = Get-Content -LiteralPath $testOutput -Raw
    if ($testReport -notmatch 'STATUS=OK' -or $testReport -notmatch 'MONTHLY_CENTS=000000001299') {
        throw "COBOL reconciliation self-test returned an unexpected report."
    }
}
finally {
    Remove-Item -LiteralPath $testInput -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $testOutput -Force -ErrorAction SilentlyContinue
}

$manifest = [ordered]@{
    name = $HostName
    description = "Stream Shell COBOL subscription finance reconciliation host"
    path = $HostExe
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $ManifestPath

Write-Host ""
Write-Host "Stream Shell $StreamShellVersion COBOL finance integration installed." -ForegroundColor Green
Write-Host "Native host: $HostExe"
Write-Host "COBOL worker: $CobolExe"
Write-Host "Compiler: $Cobc"
Write-Host "COBOL runtime: $CobolRuntimeBin"
Write-Host "Extension ID: $ExtensionId"
Write-Host "Reload Stream Shell once in opera://extensions."

param(
    [switch]$ElevatedRetry
)

$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-ElevatedRetry {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -ElevatedRetry' -f $PSCommandPath
    $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
    exit $process.ExitCode
}

$source = Join-Path $PSScriptRoot 'Remotes\Custom\Stream Shell'
$customRoot = Join-Path $env:ProgramData 'Unified Remote\Remotes\Custom'
$target = Join-Path $customRoot 'Stream Shell'

if (-not (Test-Path -LiteralPath (Join-Path $source 'remote.lua'))) {
    throw "Bundled Stream Shell remote not found: $source"
}

try {
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
} catch {
    if (-not $ElevatedRetry -and -not (Test-IsAdministrator)) {
        Write-Host 'Unified Remote data directory is not writable; requesting elevation...'
        Invoke-ElevatedRetry
    }
    throw
}

Write-Host "Installed Stream Shell Unified Remote to: $target"
Write-Host 'Restart Unified Remote Server so it reloads the custom remote.'
exit 0

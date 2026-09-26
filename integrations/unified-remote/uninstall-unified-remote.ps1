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

$target = Join-Path $env:ProgramData 'Unified Remote\Remotes\Custom\Stream Shell'

try {
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
        Write-Host "Removed Stream Shell Unified Remote from: $target"
    } else {
        Write-Host "Stream Shell Unified Remote is not installed at: $target"
    }
} catch {
    if (-not $ElevatedRetry -and -not (Test-IsAdministrator)) {
        Write-Host 'Unified Remote data directory is not writable; requesting elevation...'
        Invoke-ElevatedRetry
    }
    throw
}

Write-Host 'Restart Unified Remote Server so it drops the removed custom remote.'
exit 0

# Build smoke test only: no registry writes, processes killed, or helper installation.
# Keep this compiler invocation in sync with native/install-titlebar-helper.ps1.
$ErrorActionPreference = 'Stop'
$nativeDir = Split-Path -Parent $PSScriptRoot
$coreFile = Join-Path $nativeDir 'StreamShellTitlebarHost.cs'
$partsDir = Join-Path $nativeDir 'titlebar-src'
$parts = @(Get-ChildItem -LiteralPath $partsDir -Filter '*.cs' -File | Sort-Object Name)
if ($parts.Count -ne 19) { throw "Expected 19 native source modules, found $($parts.Count)." }
$marker = 'internal static partial class StreamShellTitlebarHost'
$source = Get-Content -LiteralPath $coreFile -Raw
foreach ($part in $parts) {
    $fragment = Get-Content -LiteralPath $part.FullName -Raw
    $offset = $fragment.IndexOf($marker, [StringComparison]::Ordinal)
    if ($offset -lt 0) { throw "Missing partial class in $($part.Name)" }
    $source += "`r`n" + $fragment.Substring($offset)
}
$temporaryExe = Join-Path $env:TEMP ("StreamShellNativeSmoke-" + [guid]::NewGuid().ToString('N') + '.exe')
try {
    Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies @('System.dll', 'System.Core.dll', 'System.Drawing.dll') -OutputAssembly $temporaryExe -OutputType ConsoleApplication -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $temporaryExe)) { throw 'Compiler did not produce a native EXE.' }
    Write-Host "PASS: Native host compiles (1 core + $($parts.Count) modules). No execution or installation."
}
finally {
    Remove-Item -LiteralPath $temporaryExe -Force -ErrorAction SilentlyContinue
}

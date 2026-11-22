# Real Windows runtime diagnostics test; no registration or browser modifications.
$ErrorActionPreference = 'Stop'
$nativeDir = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $nativeDir 'StreamShellTitlebarHost.cs') -Raw
$marker = 'internal static partial class StreamShellTitlebarHost'
foreach ($part in (Get-ChildItem (Join-Path $nativeDir 'titlebar-src') -Filter '*.cs' | Sort-Object Name)) {
    $text = Get-Content -LiteralPath $part.FullName -Raw
    $source += "`r`n" + $text.Substring($text.IndexOf($marker, [StringComparison]::Ordinal))
}
$id = [guid]::NewGuid().ToString('N')
$source = $source.Replace('public static int Main(string[] args)', 'public static int HostMain(string[] args)')
$source = $source.Replace('"StreamShell", "Logs"', ('"StreamShellDiagnosticsTest", "' + $id + '"'))
$source += "`r`n" + (Get-Content (Join-Path $PSScriptRoot 'hang-diagnostics-harness.cs') -Raw)
$exe = Join-Path $env:TEMP ("StreamShellDiagnosticsTest-" + $id + '.exe')
$logs = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ("StreamShellDiagnosticsTest\" + $id)
try {
    Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies @('System.dll', 'System.Core.dll', 'System.Drawing.dll') -OutputAssembly $exe -OutputType ConsoleApplication
    & $exe
    if ($LASTEXITCODE -ne 0) { throw "Diagnostic runtime tests failed: $LASTEXITCODE" }
    $records = @(Get-ChildItem $logs -Filter '*.jsonl' | ForEach-Object {
        Get-Content $_.FullName | ForEach-Object { ConvertFrom-Json -InputObject $_ -ErrorAction Stop }
    })
    if (-not ($records | Where-Object { $_.kind -eq 'native-dump' -and $_.result -eq 'saved' })) {
        throw 'Missing successful dump JSONL record.'
    }
    Write-Host "PASS: $($records.Count) diagnostic records parsed as JSON. All tests used isolated files."
}
finally {
    Remove-Item -LiteralPath $exe -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $logs -Recurse -Force -ErrorAction SilentlyContinue
}

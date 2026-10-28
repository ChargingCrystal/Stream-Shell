$ErrorActionPreference = "Stop"
$source = Join-Path (Split-Path $PSScriptRoot -Parent) "StreamShellMangayomiHost.cs"
$target = Join-Path $env:TEMP "StreamShellMangayomiHost-CI.exe"
if (Test-Path $target) { Remove-Item -LiteralPath $target -Force }
Add-Type -TypeDefinition ([IO.File]::ReadAllText($source)) -Language CSharp -OutputAssembly $target -OutputType ConsoleApplication
if (-not (Test-Path $target)) { throw "Mangayomi native helper not compiled" }
Remove-Item -LiteralPath $target -Force
Write-Host "Mangayomi C# native helper compiles on Windows: PASS"

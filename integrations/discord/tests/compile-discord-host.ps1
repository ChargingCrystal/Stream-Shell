$ErrorActionPreference = "Stop"
$source = Join-Path (Split-Path $PSScriptRoot -Parent) "StreamShellDiscordHost.cs"
$target = Join-Path $env:TEMP "StreamShellDiscordHost-CI.exe"
if (Test-Path $target) { Remove-Item -LiteralPath $target -Force }
Add-Type -TypeDefinition ([IO.File]::ReadAllText($source)) -Language CSharp -OutputAssembly $target -OutputType ConsoleApplication
if (-not (Test-Path $target)) { throw "Discord integration helper not compiled" }
Remove-Item -LiteralPath $target -Force
Write-Host "Discord C# integration helper compiles on Windows: PASS"

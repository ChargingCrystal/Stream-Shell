# Builds a separate Mangayomi Windows fork with a local Stream Shell source-search bridge.
# Does NOT replace the user's currently installed Mangayomi or modify the Stream Shell Git repo.
param(
    [string]$SourceDir = "$HOME\Mangayomi-StreamShell-Source",
    [string]$FlutterCommand = 'flutter'
)
$ErrorActionPreference = 'Stop'
$Here = $PSScriptRoot
$SourceDir = [System.IO.Path]::GetFullPath($SourceDir)
# Fail fast before Dart/Rust codegen when the currently running fork would
# lock WebView2Loader.dll (MSB3027/MSB3021). Do not kill user processes or
# mistake an independently installed stock Mangayomi for the fork.
$releaseExe = [System.IO.Path]::GetFullPath((Join-Path $SourceDir 'build\windows\x64\runner\Release\mangayomi.exe'))
$runningFork = @(Get-CimInstance Win32_Process -Filter "Name = 'mangayomi.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and
        [string]::Equals($_.ExecutablePath, $releaseExe, [System.StringComparison]::OrdinalIgnoreCase) })
if ($runningFork.Count -gt 0) {
    $pids = ($runningFork | ForEach-Object { $_.ProcessId }) -join ', '
    throw "Patched Mangayomi is still running (PID: $pids). Close the fork and verify it has exited before rebuilding: $releaseExe"
}
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { throw 'Python 3 is required to apply the checked source changes.' }
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    throw 'Rust toolchain missing. Mangayomi requires rustc/cargo and flutter_rust_bridge_codegen.'
}
if (-not (Get-Command flutter_rust_bridge_codegen -ErrorAction SilentlyContinue)) {
    throw "flutter_rust_bridge_codegen missing. Install it with: cargo install flutter_rust_bridge_codegen"
}
if (-not (Get-Command $FlutterCommand -ErrorAction SilentlyContinue)) {
    throw 'Flutter not found. Install Flutter for Windows Desktop with Visual Studio C++ build tools first.'
}
if (-not (Test-Path (Join-Path $SourceDir 'pubspec.yaml'))) {
    if (Test-Path $SourceDir) { throw 'SourceDir exists but is not a Mangayomi checkout. Use an empty path.' }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git not found.' }
    & git clone --depth 1 https://github.com/kodjodevf/mangayomi.git $SourceDir
    if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
}
& $py.Source (Join-Path $Here 'apply-bridge-to-source.py') $SourceDir
if ($LASTEXITCODE -ne 0) { throw 'Mangayomi bridge source patch failed' }
Push-Location $SourceDir
try {
    & $FlutterCommand pub get
    if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed' }
    & flutter_rust_bridge_codegen generate
    if ($LASTEXITCODE -ne 0) { throw 'flutter_rust_bridge_codegen generate failed' }

    # Upstream Mangayomi uses generated .g.dart parts (Isar / Riverpod / etc.).
    # Flutter itself does not generate these parts during `flutter build windows`.
    # Running build_runner before Flutter avoids thousands of cascade errors.
    Write-Host 'Generating Mangayomi Dart files (build_runner)...' -ForegroundColor Cyan
    & dart run build_runner build --delete-conflicting-outputs
    if ($LASTEXITCODE -ne 0) { throw 'dart build_runner failed; inspect code generation errors before running Flutter' }

    $requiredGenerated = @(
        'lib/models/manga.g.dart',
        'lib/models/settings.g.dart',
        'lib/services/search.g.dart',
        'lib/router/router.g.dart'
    )
    $missingGenerated = @($requiredGenerated | Where-Object { -not (Test-Path $_) })
    if ($missingGenerated.Count -gt 0) {
        throw ('Dart codegen completed but required generated parts are still missing: ' + ($missingGenerated -join ', '))
    }

    & $FlutterCommand build windows --release
    if ($LASTEXITCODE -ne 0) {
        # Some Visual Studio Build Tools 2026 configurations generate the
        # CMake install target with C:/Program Files/mangayomi as the prefix.
        # Never elevate or write to Program Files. Reconfigure the existing
        # CMake tree and build INSTALL incrementally in the user checkout.
        $buildDir = Join-Path $SourceDir 'build\windows\x64'
        $cache = Join-Path $buildDir 'CMakeCache.txt'
        if (-not (Test-Path $cache) -or
            -not (Select-String -Path $cache -Pattern '^CMAKE_INSTALL_PREFIX:PATH=C:/Program Files/mangayomi$' -Quiet)) {
            throw 'flutter build windows failed (not the known CMake install-prefix issue)'
        }
        $cmake = Get-Command cmake -ErrorAction SilentlyContinue
        $vsCmake = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
        if (Test-Path $vsCmake) { $cmakeExe = $vsCmake }
        elseif ($cmake) { $cmakeExe = $cmake.Source }
        else { throw 'CMake unavailable for install-prefix recovery' }
        $releasePath = (Join-Path $buildDir 'runner\Release').Replace('\','/')
        Write-Host 'Recovering CMake install prefix without admin rights...' -ForegroundColor Yellow
        & $cmakeExe -S (Join-Path $SourceDir 'windows') -B $buildDir "-DCMAKE_INSTALL_PREFIX=$releasePath"
        if ($LASTEXITCODE -ne 0) { throw 'CMake reconfigure failed' }
        & $cmakeExe --build $buildDir --config Release --target INSTALL
        if ($LASTEXITCODE -ne 0) { throw 'CMake incremental INSTALL failed' }
    }
} finally { Pop-Location }
$out = Join-Path $SourceDir 'build\windows\x64\runner\Release'
if (-not (Test-Path (Join-Path $out 'Mangayomi.exe'))) {
    throw "Windows build finished but Mangayomi.exe was not found under $out"
}
Write-Host 'Built from Mangayomi commit:' (& git -C $SourceDir rev-parse HEAD)
Write-Host 'Build ready:' $out -ForegroundColor Green
Write-Host 'Keep the ENTIRE Release directory (exe plus data/DLLs); do not copy just the EXE.'
Write-Host 'Set the exe in Stream Shell Settings > General > Providers > Mangayomi.'
Write-Host 'After verifying it starts normally, opt in with enable-patched-search.ps1 -IInstalledPatchedBuild.'

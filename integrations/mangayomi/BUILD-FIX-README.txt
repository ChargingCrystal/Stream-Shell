Stream Shell v0.21.17 Mangayomi Windows build helper fix

Extract this ZIP into your Stream Shell root, overwriting integrations/mangayomi/build-patched-mangayomi.ps1.
The fix runs `dart run build_runner build --delete-conflicting-outputs` before the Flutter Windows release build and checks that generated .g.dart files exist.

Then rerun the existing build command. No Python, Rust, Visual Studio, or Flutter reinstallation is required.
The patch does not modify an already-installed stock Mangayomi app.

Note: Windows compilation of the experimental Dart bridge is still unverified; further compilation issues may appear.

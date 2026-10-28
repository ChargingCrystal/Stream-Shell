STREAM SHELL — SHARED WINDOWS NATIVE / TITLEBAR
================================================

The native/ tree contains Stream Shell's SHARED Windows Titlebar and shell
infrastructure, its compiler/installer and titlebar artwork. It does not
contain the Discord or Mangayomi application-specific native messaging hosts.

Install/update the Titlebar helper:
    native\install-titlebar-helper.ps1
or  native\install-titlebar-helper.cmd

Native Titlebar source modules:
    native\StreamShellTitlebarHost.cs
    native\titlebar-src\*.cs

Independent desktop app integrations:
    integrations\discord\README.md
    integrations\discord\install-discord-helper.ps1
    integrations\mangayomi\README.md
    integrations\mangayomi\install-mangayomi-helper.ps1

The Mangayomi-specific Wide titlebar visibility exception is implemented
in the shared titlebar overlay's foreground/visibility state machine, not
by moving the shared overlay outside native/.

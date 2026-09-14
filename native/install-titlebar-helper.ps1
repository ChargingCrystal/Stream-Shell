param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$HostName = "com.streamshell.titlebar"
$ExtensionRoot = Split-Path $PSScriptRoot -Parent
$InstallRoot = Join-Path $env:LOCALAPPDATA "StreamShell\TitlebarHost"
$SourcePath = Join-Path $PSScriptRoot "StreamShellTitlebarHost.cs"
$ExePath = Join-Path $InstallRoot "StreamShellTitlebarHost.exe"
$ManifestPath = Join-Path $InstallRoot "$HostName.json"
$InstallLogPath = Join-Path $InstallRoot "install.log"
$DiscordManifestPath = Join-Path $env:LOCALAPPDATA "StreamShell\NativeHost\com.streamshell.discord.json"
$IconSourceRoot = Join-Path $PSScriptRoot "titlebar-icons"
$IconInstallRoot = Join-Path $InstallRoot "icons"
$TaskbarIconSourceRoot = Join-Path $PSScriptRoot "taskbar-icons"
$TaskbarIconInstallRoot = Join-Path $InstallRoot "taskbar-icons"
$OperaAppIdPath = Join-Path $InstallRoot "opera-appid.txt"

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

function Write-InstallLog {
    param([string]$Message)
    try {
        Add-Content -LiteralPath $InstallLogPath -Value ((Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff") + "  " + $Message) -Encoding UTF8
    } catch {}
}

Write-InstallLog "installer started"
Write-InstallLog ("extension root=" + $ExtensionRoot)
Write-InstallLog ("local app data=" + $env:LOCALAPPDATA)

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ExtensionIdFromDiscordHost {
    if (-not (Test-Path -LiteralPath $DiscordManifestPath)) {
        return $null
    }

    try {
        $manifest = Get-Content -LiteralPath $DiscordManifestPath -Raw | ConvertFrom-Json
        foreach ($origin in @($manifest.allowed_origins)) {
            $value = [string]$origin
            if ($value -match '^chrome-extension://([a-p]{32})/$') {
                return $Matches[1]
            }
        }
    } catch {
        Write-InstallLog ("Discord manifest read failed: " + $_.Exception.Message)
    }

    return $null
}

function Find-StreamShellExtensionId {
    param([string]$ExpectedPath)

    $candidateProfiles = @(
        (Join-Path $env:APPDATA "Opera Software\Opera Stable\Preferences"),
        (Join-Path $env:APPDATA "Opera Software\Opera GX Stable\Preferences"),
        (Join-Path $env:APPDATA "Opera Software\Opera Developer\Preferences"),
        (Join-Path $env:APPDATA "Opera Software\Opera Next\Preferences")
    ) | Where-Object { Test-Path $_ }

    $expected = [IO.Path]::GetFullPath($ExpectedPath).TrimEnd('\')

    foreach ($preferencesPath in $candidateProfiles) {
        try {
            $preferences = Get-Content -LiteralPath $preferencesPath -Raw | ConvertFrom-Json
            $settings = $preferences.extensions.settings
            if (-not $settings) { continue }

            foreach ($property in $settings.PSObject.Properties) {
                $entry = $property.Value
                $pathMatches = $false

                if ($entry.path) {
                    try {
                        $entryPath = [IO.Path]::GetFullPath([string]$entry.path).TrimEnd('\')
                        $pathMatches = $entryPath.Equals($expected, [StringComparison]::OrdinalIgnoreCase)
                    } catch {}
                }

                $nameMatches = $entry.manifest -and ([string]$entry.manifest.name -eq "Stream Shell")
                if ($pathMatches -or $nameMatches) {
                    return $property.Name
                }
            }
        } catch {}
    }

    return $null
}

function Get-OperaShortcutAppId {
    $roots = @(
        (Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"),
        (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
        (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
    ) | Where-Object { Test-Path -LiteralPath $_ }

    $wsh = $null
    $shell = $null

    try {
        $wsh = New-Object -ComObject WScript.Shell
        $shell = New-Object -ComObject Shell.Application

        $candidates = @()

        foreach ($root in $roots) {
            foreach ($link in Get-ChildItem -LiteralPath $root -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue) {
                try {
                    $shortcut = $wsh.CreateShortcut($link.FullName)
                    $target = [string]$shortcut.TargetPath
                    if ([string]::IsNullOrWhiteSpace($target)) { continue }

                    $leaf = [IO.Path]::GetFileName($target)
                    if (-not $leaf.Equals("opera.exe", [StringComparison]::OrdinalIgnoreCase)) {
                        continue
                    }

                    $score = 0
                    if ($target -match '(?i)Opera GX') { $score += 20 }
                    if ($link.Name -match '(?i)Opera GX') { $score += 10 }
                    if ($root -match '(?i)User Pinned\\TaskBar') { $score += 5 }

                    $candidates += [pscustomobject]@{
                        Link = $link
                        Target = $target
                        Score = $score
                    }
                } catch {}
            }
        }

        foreach ($candidate in ($candidates | Sort-Object Score -Descending)) {
            try {
                $folder = $shell.Namespace($candidate.Link.DirectoryName)
                if (-not $folder) { continue }

                $item = $folder.ParseName($candidate.Link.Name)
                if (-not $item) { continue }

                $appId = [string]$item.ExtendedProperty("System.AppUserModel.ID")
                if (-not [string]::IsNullOrWhiteSpace($appId)) {
                    Write-InstallLog ("Opera GX shortcut AppID found: " + $appId + " via " + $candidate.Link.FullName)
                    return $appId.Trim()
                }
            } catch {}
        }
    } catch {
        Write-InstallLog ("Opera GX AppID discovery failed: " + $_.Exception.Message)
    } finally {
        if ($wsh) {
            try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wsh) } catch {}
        }
        if ($shell) {
            try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) } catch {}
        }
    }

    return $null
}


try {
    # Resolve and validate the extension ID before elevation. The original CMD
    # console therefore remains the stable parent throughout installation.
    if (-not $ExtensionId) {
        $ExtensionId = Get-ExtensionIdFromDiscordHost
        if ($ExtensionId) {
            Write-InstallLog "extension ID recovered from Discord native host"
        }
    }

    if (-not $ExtensionId) {
        $ExtensionId = Find-StreamShellExtensionId -ExpectedPath $ExtensionRoot
        if ($ExtensionId) {
            Write-InstallLog "extension ID recovered from Opera preferences"
        }
    }

    if (-not $ExtensionId) {
        Write-Host ""
        Write-Host "Stream Shell extension ID could not be detected automatically." -ForegroundColor Yellow
        Write-Host "Open opera://extensions, enable Developer mode and copy the ID shown for Stream Shell." -ForegroundColor Yellow
        $ExtensionId = Read-Host "Extension ID"
    }

    $ExtensionId = ([string]$ExtensionId).Trim()
    if ($ExtensionId -notmatch '^[a-p]{32}$') {
        throw "The extension ID '$ExtensionId' is not a valid Chromium extension ID."
    }

    Write-InstallLog ("using extension ID=" + $ExtensionId)

    if (-not (Test-Administrator)) {
        Write-InstallLog "requesting elevation (synchronous)"

        $arguments = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", ('"' + $PSCommandPath + '"'),
            "-ExtensionId", $ExtensionId
        )

        $elevated = Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -Wait -PassThru
        $elevatedExitCode = $elevated.ExitCode
        Write-InstallLog ("elevated installer exit code=" + $elevatedExitCode)

        if ($elevatedExitCode -ne 0) {
            throw "The elevated titlebar installer failed with exit code $elevatedExitCode. See install-error.txt for the original elevated error."
        }

        Write-Host ""
        Write-Host "Elevated titlebar installation completed successfully." -ForegroundColor Green
        exit 0
    }

    Get-Process -Name "StreamShellTitlebarHost" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 150

    if (Test-Path -LiteralPath $ExePath) {
        Remove-Item -LiteralPath $ExePath -Force
    }

    if (-not (Test-Path -LiteralPath $IconSourceRoot)) {
        throw "Titlebar icon source directory is missing: $IconSourceRoot"
    }

    New-Item -ItemType Directory -Force -Path $IconInstallRoot | Out-Null
    Get-ChildItem -LiteralPath $IconInstallRoot -Filter "*.png" -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "landing.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "volume.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "youtube.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "netflix.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "prime.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "disney.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "crunchyroll.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "dashboard.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "settings.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "discord.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "twitch.png") -Destination $IconInstallRoot -Force
    Copy-Item -LiteralPath (Join-Path $IconSourceRoot "kill.png") -Destination $IconInstallRoot -Force
    Write-InstallLog "titlebar icon assets copied"

    if (-not (Test-Path -LiteralPath $TaskbarIconSourceRoot)) {
        throw "Taskbar icon source directory is missing: $TaskbarIconSourceRoot"
    }

    New-Item -ItemType Directory -Force -Path $TaskbarIconInstallRoot | Out-Null
    Get-ChildItem -LiteralPath $TaskbarIconInstallRoot -Filter "*.ico" -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $TaskbarIconSourceRoot -Filter "*.ico" |
        Copy-Item -Destination $TaskbarIconInstallRoot -Force
    Write-InstallLog "taskbar identity icon assets copied"

    $OperaAppId = Get-OperaShortcutAppId
    if ($OperaAppId) {
        Set-Content -LiteralPath $OperaAppIdPath -Value $OperaAppId -Encoding ASCII
        Write-InstallLog ("Opera GX AppID hint written=" + $OperaAppId)
    } else {
        Remove-Item -LiteralPath $OperaAppIdPath -Force -ErrorAction SilentlyContinue
        Write-InstallLog "Opera GX AppID hint not found; normal-window anchoring will use runtime fallback only"
    }

    Write-InstallLog "compiling native host"
    $source = Get-Content -LiteralPath $SourcePath -Raw
    Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies @("System.dll", "System.Core.dll", "System.Drawing.dll") -OutputAssembly $ExePath -OutputType ConsoleApplication

    if (-not (Test-Path -LiteralPath $ExePath)) {
        throw "Native host executable was not created."
    }

    Write-InstallLog "native host compiled"

    $manifest = [ordered]@{
        name = $HostName
        description = "Stream Shell native titlebar toolbar"
        path = $ExePath
        type = "stdio"
        allowed_origins = @("chrome-extension://$ExtensionId/")
    }

    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
    Write-InstallLog "native host manifest written"

    $registryPaths = @(
        "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
        "HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\$HostName"
    )

    foreach ($registryPath in $registryPaths) {
        New-Item -Path $registryPath -Force | Out-Null
        Set-Item -Path $registryPath -Value $ManifestPath
        Write-InstallLog ("registered " + $registryPath)
    }

    Write-InstallLog "installation complete"

    Remove-Item -LiteralPath (Join-Path $InstallRoot "install-error.txt") -Force -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "Stream Shell titlebar helper installed." -ForegroundColor Green
    Write-Host "Native host: $ExePath"
    Write-Host "Extension ID: $ExtensionId"
    Write-Host "Reload Stream Shell once in opera://extensions, then open it from the extension as before."
    exit 0
}
catch {
    $errorText = $_.Exception.ToString()
    Write-InstallLog ("INSTALL FAILED: " + $_.Exception.GetType().Name + ": " + $_.Exception.Message)
    try {
        $errorPath = Join-Path $InstallRoot "install-error.txt"
        if (Test-Path -LiteralPath $errorPath) {
            Add-Content -LiteralPath $errorPath -Value ("`r`n--- installer wrapper ---`r`n" + $errorText) -Encoding UTF8
        } else {
            Set-Content -LiteralPath $errorPath -Value $errorText -Encoding UTF8
        }
    } catch {}

    Write-Host ""
    Write-Host "Titlebar helper installation failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Install log: $InstallLogPath" -ForegroundColor Yellow
    exit 1
}

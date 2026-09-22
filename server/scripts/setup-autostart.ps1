# ==============================================================================
# Lawyer Office Management Server - Full Autostart & Service Setup
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Lawyer Office Management System - Automatic Startup Configuration" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $PSCommandPath
$ServerDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ServerDir

Write-Host "[*] Configuring Lawyer Office Management Autostart..." -ForegroundColor Cyan

# 1. Create Silent Launch VBScripts
$ServerLauncherPath = Join-Path $ScriptDir "run-server-hidden.vbs"
$ServerVbs = "Set WshShell = CreateObject(`"WScript.Shell`")`r`nWshShell.CurrentDirectory = `"$ServerDir`"`r`nWshShell.Run `"cmd /c node index.js`", 0, False"
[IO.File]::WriteAllText($ServerLauncherPath, $ServerVbs)

$TrayLauncherPath = Join-Path $ScriptDir "run-tray-hidden.vbs"
$TrayVbs = "Set WshShell = CreateObject(`"WScript.Shell`")`r`nWshShell.CurrentDirectory = `"$ServerDir`"`r`nWshShell.Run `"cmd /c npx electron trayApp.js`", 0, False"
[IO.File]::WriteAllText($TrayLauncherPath, $TrayVbs)

# 2. Add to User Startup Folder
$WshShell = New-Object -ComObject WScript.Shell
$UserStartup = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)
if ($UserStartup -and (Test-Path $UserStartup)) {
    $TrayLnk = $WshShell.CreateShortcut((Join-Path $UserStartup "LawyerOfficeTray.lnk"))
    $TrayLnk.TargetPath = "wscript.exe"
    $TrayLnk.Arguments = "`"$TrayLauncherPath`""
    $TrayLnk.WorkingDirectory = $ServerDir
    $TrayLnk.Description = "Lawyer Office Tray Monitor"
    $TrayLnk.Save()

    $ServerLnk = $WshShell.CreateShortcut((Join-Path $UserStartup "LawyerOfficeServer.lnk"))
    $ServerLnk.TargetPath = "wscript.exe"
    $ServerLnk.Arguments = "`"$ServerLauncherPath`""
    $ServerLnk.WorkingDirectory = $ServerDir
    $ServerLnk.Description = "Lawyer Office Server"
    $ServerLnk.Save()
    Write-Host "[+] Added shortcuts to User Startup folder." -ForegroundColor Green
}

# 3. Add to User Registry Run key (Guaranteed on every login)
try {
    $RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $RegPath -Name "LawyerOfficeTray" -Value "wscript.exe `"$TrayLauncherPath`""
    Set-ItemProperty -Path $RegPath -Name "LawyerOfficeServer" -Value "wscript.exe `"$ServerLauncherPath`""
    Write-Host "[+] Registered in Windows Registry (Run on Startup)." -ForegroundColor Green
} catch {
    Write-Host "[!] Registry note: $_" -ForegroundColor Yellow
}

# 4. Check Administrator Privileges for Firewall & Service
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Requesting Administrator privileges for Firewall & System Service..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    
    # Launch for current session
    Start-Process "wscript.exe" -ArgumentList "`"$ServerLauncherPath`"" -WorkingDirectory $ServerDir
    Start-Process "wscript.exe" -ArgumentList "`"$TrayLauncherPath`"" -WorkingDirectory $ServerDir
    exit
}

# Create Task in Task Scheduler to run at startup / logon with highest privileges
$TaskName = "LawyerOfficeServer"
$ActionCommand = "wscript.exe"
$ActionArg = "`"$ServerLauncherPath`""

try {
    # Remove existing task if any
    schtasks /delete /tn $TaskName /f 2>$null | Out-Null
    
    # Create task triggered ONLOGON (guarantees environment & network are ready) with highest privileges
    schtasks /create /tn $TaskName /tr "$ActionCommand $ActionArg" /sc ONLOGON /rl HIGHEST /f | Out-Null
    Write-Host "      Server registered in Windows Task Scheduler (runs automatically on login)." -ForegroundColor White
} catch {
    Write-Host "      Warning: Task scheduler setup: $_" -ForegroundColor Yellow
}

# 4. Create Windows Service (Optional extra layer via WinSW daemon)
Write-Host "[3/5] Checking Windows Service (Daemon layer)..." -ForegroundColor Green
$DaemonExe = Join-Path $ServerDir "daemon\lawyerofficeserver.exe"
if (Test-Path $DaemonExe) {
    try {
        & $DaemonExe stop 2>$null | Out-Null
        & $DaemonExe uninstall 2>$null | Out-Null
        & $DaemonExe install | Out-Null
        & $DaemonExe start 2>$null | Out-Null
        Write-Host "      Windows Service (LawyerOfficeServer) installed and started." -ForegroundColor White
    } catch {
        Write-Host "      Daemon service note: Scheduled task will handle startup." -ForegroundColor Gray
    }
}

# 5. Create Tray Monitor Shortcut in Windows Startup Folders & Registry
Write-Host "[4/5] Adding Tray Monitor Icon to Windows Startup..." -ForegroundColor Green
$TrayLauncherPath = Join-Path $ScriptDir "run-tray-hidden.vbs"
$TrayVbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$ServerDir"
WshShell.Run "cmd /c npx electron trayApp.js", 0, False
"@
Set-Content -Path $TrayLauncherPath -Value $TrayVbsContent -Encoding ASCII

# Shortcut creation helper
$WshShell = New-Object -ComObject WScript.Shell

# Path A: Current User Startup Folder
$UserStartupFolder = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)
if ($UserStartupFolder -and (Test-Path $UserStartupFolder)) {
    $UserShortcut = $WshShell.CreateShortcut((Join-Path $UserStartupFolder "LawyerOfficeTray.lnk"))
    $UserShortcut.TargetPath = "wscript.exe"
    $UserShortcut.Arguments = "`"$TrayLauncherPath`""
    $UserShortcut.WorkingDirectory = $ServerDir
    $UserShortcut.Description = "Lawyer Office Tray Monitor"
    $UserShortcut.Save()
    Write-Host "      Added to User Startup: $UserStartupFolder" -ForegroundColor White
}

# Path B: All Users (Common) Startup Folder
$CommonStartupFolder = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonStartup)
if ($CommonStartupFolder -and (Test-Path $CommonStartupFolder)) {
    $CommonShortcut = $WshShell.CreateShortcut((Join-Path $CommonStartupFolder "LawyerOfficeTray.lnk"))
    $CommonShortcut.TargetPath = "wscript.exe"
    $CommonShortcut.Arguments = "`"$TrayLauncherPath`""
    $CommonShortcut.WorkingDirectory = $ServerDir
    $CommonShortcut.Description = "Lawyer Office Tray Monitor"
    $CommonShortcut.Save()
    Write-Host "      Added to Common Startup: $CommonStartupFolder" -ForegroundColor White
}

# Path C: Windows Registry Run Key (The most reliable autostart mechanism in Windows)
try {
    $RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $RegPath -Name "LawyerOfficeTray" -Value "wscript.exe `"$TrayLauncherPath`""
    Write-Host "      Registered in Windows Registry (HKCU Run)." -ForegroundColor White
} catch {
    Write-Host "      Warning: Registry registration: $_" -ForegroundColor Yellow
}

# 6. Launch Server & Tray Icon Now
Write-Host "[5/5] Starting Server and Tray Monitor Icon now..." -ForegroundColor Green
# Start server
Start-Process "wscript.exe" -ArgumentList "`"$ServerLauncherPath`"" -WorkingDirectory $ServerDir
Start-Sleep -Seconds 2

# Start tray
Start-Process "wscript.exe" -ArgumentList "`"$TrayLauncherPath`"" -WorkingDirectory $ServerDir
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete! The server and tray icon are now permanently set up." -ForegroundColor Green
Write-Host "  They will automatically start every time you restart your computer." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

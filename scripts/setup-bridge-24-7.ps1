# ==============================================================================
# Darse Burhani - Hikvision Cloud Bridge 24/7 Setup
# ==============================================================================

$repoPath = "c:\Users\Hatim Bhai Mithai\Documents\Darse-Burhani"
$batPath = Join-Path $repoPath "scripts\start-hikvision-cloud-bridge.bat"
$startupDir = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$startupLnk = Join-Path $startupDir "Hikvision-Cloud-Bridge.lnk"
$desktopDir = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktopDir "Hikvision Cloud Bridge (24-7).lnk"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   DARSE BURHANI - HIKVISION BRIDGE 24/7 AUTO-START SETUP" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Create Windows Startup Shortcut
try {
    $wsh = New-Object -ComObject WScript.Shell
    $scStartup = $wsh.CreateShortcut($startupLnk)
    $scStartup.TargetPath = $batPath
    $scStartup.WorkingDirectory = $repoPath
    $scStartup.Description = "Darse Burhani Hikvision 24/7 Cloud Attendance Bridge"
    $scStartup.Save()
    Write-Host "[OK] Windows Startup shortcut created:" -ForegroundColor Green
    Write-Host "     $startupLnk" -ForegroundColor Gray
} catch {
    Write-Host "[WARN] Could not create startup shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Create Desktop Shortcut
try {
    $scDesktop = $wsh.CreateShortcut($desktopLnk)
    $scDesktop.TargetPath = $batPath
    $scDesktop.WorkingDirectory = $repoPath
    $scDesktop.Description = "Darse Burhani Hikvision 24/7 Cloud Attendance Bridge"
    $scDesktop.Save()
    Write-Host "[OK] Desktop shortcut created:" -ForegroundColor Green
    Write-Host "     $desktopLnk" -ForegroundColor Gray
} catch {
    Write-Host "[WARN] Could not create desktop shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 3. Register Windows Scheduled Task (if Administrator)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    try {
        $taskAction = New-ScheduledTaskAction -Execute $batPath -WorkingDirectory $repoPath
        $taskTrigger = New-ScheduledTaskTrigger -AtLogOn
        $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 365)
        Register-ScheduledTask -TaskName "DarseBurhaniHikvisionBridge" -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description "Darse Burhani 24/7 Hikvision Attendance Bridge" -Force | Out-Null
        Write-Host "[OK] Windows Scheduled Task 'DarseBurhaniHikvisionBridge' registered." -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Scheduled Task registration: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] User startup folder configured (Administrator privileges not needed)." -ForegroundColor Gray
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE! The bridge is configured to run 24/7." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan

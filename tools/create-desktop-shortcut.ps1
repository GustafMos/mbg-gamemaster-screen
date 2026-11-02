# Creates (or refreshes) the MBG's GameMaster Screen desktop shortcut.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop "MBG's GameMaster Screen.lnk"

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($link)
$sc.TargetPath = Join-Path $root 'start.cmd'
$sc.WorkingDirectory = $root
$sc.IconLocation = (Join-Path $root 'assets\mbg-gamemaster.ico') + ',0'
$sc.Description = "Open the MBG's GameMaster Screen"
# 7 = minimized: the local server keeps running in a minimized console window.
$sc.WindowStyle = 7
$sc.Save()

Write-Host "Created $link"
Write-Host "Double-click it to launch the DM screen."

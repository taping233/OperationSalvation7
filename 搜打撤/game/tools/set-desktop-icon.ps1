$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
$name = [string]::Join('', [char]0x4EE3, [char]0x53F7, [char]0xFF1A, [char]0x67D2, '.lnk')
$lnkPath = Join-Path $desktop $name
$icon = 'C:\Users\' + [char]0x592A + [char]0x5E73 + '\Documents\ChatGPT\' + [char]0x4EE3 + [char]0x53F7 + [char]0x67D2 + '\' + [char]0x641C + [char]0x6253 + [char]0x64A4 + '\desktop-app\app.ico'
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.IconLocation = "$icon,0"
$lnk.Save()
Write-Host ("Icon set to: " + $lnk.IconLocation)
# 通知 shell 刷新图标缓存
$sh = New-Object -ComObject Shell.Application
$sh.ShellExecute('ie4uinit.exe', '-show')
Write-Host 'Icon cache refresh requested.'

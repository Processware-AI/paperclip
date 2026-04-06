@echo off
cd /d "%~dp0"
echo Stopping Paperclip...
pnpm dev:stop 2>nul

powershell -NoProfile -Command "
function Kill-Tree([int]\$procId) {
  Get-WmiObject Win32_Process -Filter \"ParentProcessId=\$procId\" | ForEach-Object { Kill-Tree \$_.ProcessId }
  Stop-Process -Id \$procId -Force -ErrorAction SilentlyContinue
}
\$conn = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue
if (\$conn) {
  \$p3 = \$conn.OwningProcess
  \$p2 = (Get-WmiObject Win32_Process -Filter \"ProcessId=\$p3\").ParentProcessId
  \$p1 = (Get-WmiObject Win32_Process -Filter \"ProcessId=\$p2\").ParentProcessId
  Write-Host \"Killing Paperclip process tree from PID \$p1...\"
  Kill-Tree \$p1
  Write-Host 'Done.'
} else {
  Write-Host 'Paperclip is not running.'
}
"

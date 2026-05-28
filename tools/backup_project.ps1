# backup_project.ps1 — 物理完整备份
# 调用：.\backup_project.ps1 [-Reason "before_writer"]
param([string]$Reason = "manual")

$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$backupName = "zhan_backup_${timestamp}"
if ($Reason -ne "manual") { $backupName += "_$Reason" }

$src = "C:\Users\kyzha\.openclaw\projects\zhan"
$dst = "C:\Users\kyzha\.openclaw\projects\zhan_backups\$backupName"

# Create backup directory
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# Copy everything except node_modules, .git, backups themselves
$exclude = @('.git', 'node_modules', 'zhan_backups', '__pycache__', '.claude')
$items = Get-ChildItem $src -Exclude $exclude
foreach ($item in $items) {
    Copy-Item $item.FullName $dst -Recurse -Force
}

Write-Output "Backup created: $dst"

# Keep only last 10 backups
$backupDir = "C:\Users\kyzha\.openclaw\projects\zhan_backups"
$allBackups = Get-ChildItem $backupDir -Directory | Sort-Object Name -Descending
if ($allBackups.Count -gt 10) {
    $toDelete = $allBackups | Select-Object -Skip 10
    foreach ($d in $toDelete) {
        Remove-Item $d.FullName -Recurse -Force
        Write-Output "Cleaned old backup: $($d.Name)"
    }
}

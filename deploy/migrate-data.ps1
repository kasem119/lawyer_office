# =============================================================================
# ترحيل بيانات المكتب الحالية إلى حزمة جاهزة للرفع على VPS
# ينتج: deploy/data_migration.zip  (قاعدة البيانات + كل المرفقات)
# الاستخدام: powershell -ExecutionPolicy Bypass -File deploy\migrate-data.ps1
# =============================================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$serverDir = "$root\server"

Write-Host "📦 ترحيل بيانات منظومة مكتب المحاماة" -ForegroundColor Cyan

# 1) إنشاء نسخة احتياطية شاملة عبر الخادم إن كان يعمل، وإلا ضغط مباشر
$backupZip = $null
try {
    Write-Host "[1/3] طلب نسخة احتياطية من الخادم المحلي..." -ForegroundColor Cyan
    $token = Read-Host "ادخل توكن مدير (access_token من localStorage) أو اضغط Enter للضغط المباشر"
    if ($token -ne "") {
        $resp = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/backups/create" `
            -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 600
        if ($resp.success) {
            $backupZip = Join-Path $serverDir "backups\$($resp.backup.backupFileName)"
            Write-Host "  → تم إنشاء: $($resp.backup.backupFileName)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  → الخادم غير متاح أو التوكن غير صالح، سنستخدم الضغط المباشر" -ForegroundColor Yellow
}

if (-not $backupZip -or -not (Test-Path $backupZip)) {
    Write-Host "[1/3] الضغط المباشر (أوقف الخادم أولاً لسلامة القاعدة)..." -ForegroundColor Cyan
    $answer = Read-Host "هل الخادم متوقف الآن؟ (y/N)"
    if ($answer -ne "y") {
        Write-Host "أوقف الخادم أولاً ثم أعد المحاولة (نسخة قاعدة SQLite أثناء العمل قد تكون تالفة)" -ForegroundColor Red
        exit 1
    }
    $temp = New-Item -ItemType Directory -Path "$env:TEMP\lawyer_migrate_$(Get-Date -Format 'yyyyMMddHHmmss')" -Force
    Compress-Archive -Path "$serverDir\database\lawyer_office.db", "$serverDir\uploads" -DestinationPath "$($temp.FullName)\backup_direct.zip" -Force
    $backupZip = "$($temp.FullName)\backup_direct.zip"
}

# 2) تجهيز حزمة الترحيل
Write-Host "[2/3] تجهيز حزمة الترحيل..." -ForegroundColor Cyan
$zip = "$root\deploy\data_migration.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

# نمرر ملف النسخة الاحتياطية كما هو
Copy-Item $backupZip $zip -Force

$size = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "✅ حزمة الترحيل جاهزة: deploy\data_migration.zip ($size MB)" -ForegroundColor Green

# 3) تعليمات الرفع
Write-Host ""
Write-Host "الخطوات على الخادم (VPS):" -ForegroundColor Yellow
Write-Host "  scp deploy\data_migration.zip root@SERVER_IP:/tmp/"
Write-Host "  ثم على الخادم:"
Write-Host "    systemctl stop lawyer-office"
Write-Host "    cd /opt/lawyer_office/server"
Write-Host "    unzip -o /tmp/data_migration.zip -d /tmp/migrate"
Write-Host "    # نسخ القاعدة والمرفقات من النسخة الاحتياطية:"
Write-Host "    unzip -o /tmp/migrate/backup_*.zip -d /tmp/migrate/full   # إن كانت ZIP الشاملة"
Write-Host "    cp /tmp/migrate/full/database.db /opt/lawyer_office/server/database/lawyer_office.db"
Write-Host "    rm -rf /opt/lawyer_office/server/uploads && cp -r /tmp/migrate/full/uploads /opt/lawyer_office/server/uploads"
Write-Host "    chown -R lawyer:lawyer /opt/lawyer_office/server"
Write-Host "    systemctl start lawyer-office"
Write-Host "    curl -s http://127.0.0.1:3000/api/health"

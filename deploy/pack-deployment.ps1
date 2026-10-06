# =============================================================================
# تجهيز حزمة النشر من جهاز المكتب (ويندوز)
# الاستخدام: powershell -ExecutionPolicy Bypass -File deploy\pack-deployment.ps1
# الناتج: deploy/lawyer_office.zip  ← يُرفع على الـ VPS إلى /tmp/lawyer_office.zip
# =============================================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "[1/3] بناء واجهة React..." -ForegroundColor Cyan
Push-Location "$root\client"
npm run build
Pop-Location

Write-Host "[2/3] تجهيز محتويات الحزمة..." -ForegroundColor Cyan
$staging = "$root\deploy\staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path "$staging\server" -Force | Out-Null
New-Item -ItemType Directory -Path "$staging\client" -Force | Out-Null

# الخادم (بدون node_modules — تُثبّت على الخادم)
Copy-Item "$root\server\*.js" "$staging\server\" -ErrorAction SilentlyContinue
Copy-Item "$root\server\package.json" "$staging\server\"
Copy-Item "$root\server\package-lock.json" "$staging\server\" -ErrorAction SilentlyContinue
# مجلدات الخادم المطلوبة (بدون قاعدة بيانات محلية ولا نسخ احتياطية)
foreach ($dir in @("database","routes","middleware","services","templates","scripts","tests","daemon")) {
    if (Test-Path "$root\server\$dir") {
        Copy-Item "$root\server\$dir" "$staging\server\" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# الواجهة المبنية
Copy-Item "$root\client\dist" "$staging\client\dist" -Recurse -Force

# متغيرات البيئة: نموذج فقط (الخادم يولّد ملف .env حقيقي بمفاتيح جديدة)
Copy-Item "$root\server\.env.example" "$staging\server\.env.example" -ErrorAction SilentlyContinue

Write-Host "[3/3] ضغط الحزمة..." -ForegroundColor Cyan
$zip = "$root\deploy\lawyer_office.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$staging\*" -DestinationPath $zip -Force
Remove-Item $staging -Recurse -Force

$size = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "✅ الحزمة جاهزة: deploy\lawyer_office.zip ($size MB)" -ForegroundColor Green
Write-Host "الخطوة التالية: ارفعها إلى الخادم:"  -ForegroundColor Yellow
Write-Host '  scp deploy\lawyer_office.zip root@SERVER_IP:/tmp/lawyer_office.zip'

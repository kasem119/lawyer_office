# =============================================================
# prepare-flash.ps1 - Prepare delivery copy on a flash drive
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/windows/prepare-flash.ps1 -Destination E:\LawOffice-Delivery
# =============================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "=== Preparing delivery copy ===" -ForegroundColor Cyan
Write-Host "From: $projectRoot"
Write-Host "To:   $Destination"

if (Test-Path $Destination) {
    Write-Host "Destination already exists - contents will be refreshed." -ForegroundColor Yellow
} else {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

# --- 1. Project code and configs (excluding node_modules and .git) ---
robocopy $projectRoot $Destination /E /XD node_modules .git backups uploads win-unpacked /XF *.blockmap builder-debug.yml /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

# --- 2. Essential data: uploads, backups, and .env ---
New-Item -ItemType Directory -Path (Join-Path $Destination 'server\uploads') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Destination 'server\backups') -Force | Out-Null

Copy-Item (Join-Path $projectRoot 'server\uploads\*') (Join-Path $Destination 'server\uploads\') -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $projectRoot 'server\backups\*') (Join-Path $Destination 'server\backups\') -Force -ErrorAction SilentlyContinue

if (Test-Path (Join-Path $projectRoot 'server\.env')) {
    Copy-Item (Join-Path $projectRoot 'server\.env') (Join-Path $Destination 'server\.env') -Force
    Write-Host "[OK] server\.env copied" -ForegroundColor Green
} else {
    Write-Host "[WARN] server\.env NOT FOUND - server will not run without it!" -ForegroundColor Red
}

# --- 3. Verification checklist ---
Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan

$checks = @(
    'package.json',
    'client\dist\index.html',
    'server\package.json',
    'server\.env',
    'server\index.js',
    'server\database\schema.sql'
)

$allOk = $true
foreach ($c in $checks) {
    if (Test-Path (Join-Path $Destination $c)) {
        Write-Host "[OK]   $c" -ForegroundColor Green
    } else {
        Write-Host "[MISS] $c" -ForegroundColor Red
        $allOk = $false
    }
}

# Database check: either the live db or at least a backup zip must exist
$liveDb  = Test-Path (Join-Path $Destination 'server\database\lawyer_office.db')
$backups = Get-ChildItem (Join-Path $Destination 'server\backups') -Filter *.zip -ErrorAction SilentlyContinue
if ($liveDb) {
    Write-Host "[OK]   live database (lawyer_office.db)" -ForegroundColor Green
} elseif ($backups) {
    Write-Host "[OK]   database backups found: $($backups.Count) zip file(s)" -ForegroundColor Green
} else {
    Write-Host "[MISS] no database and no backups found!" -ForegroundColor Red
    $allOk = $false
}

Write-Host ""
if ($allOk) {
    Write-Host "=== Delivery copy is READY: $Destination ===" -ForegroundColor Green
} else {
    Write-Host "=== COPY INCOMPLETE - review the [MISS] items above ===" -ForegroundColor Red
    exit 1
}

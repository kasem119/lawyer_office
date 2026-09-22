# ==============================================================================
# Lawyer Office Management Server - Windows Firewall Setup
# ==============================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Configuring Windows Firewall for Lawyer Office Management Server" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Administrator privileges required. Elevating..." -ForegroundColor Red
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$RuleName = "LawyerOffice-Server-Port3000"
$UdpRuleName = "LawyerOffice-Discovery-Port41234"

try {
    Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName $UdpRuleName -ErrorAction SilentlyContinue
} catch {}

Write-Host "[1/2] Opening TCP port 3000 for LAN devices..." -ForegroundColor Green
New-NetFirewallRule -DisplayName $RuleName `
                    -Description "Lawyer Office Management Server HTTP/API Port" `
                    -Direction Inbound `
                    -Action Allow `
                    -Protocol TCP `
                    -LocalPort 3000 `
                    -Profile Private,Domain `
                    -Enabled True | Out-Null

Write-Host "[2/2] Opening UDP port 41234 for LAN auto-discovery..." -ForegroundColor Green
New-NetFirewallRule -DisplayName $UdpRuleName `
                    -Description "Lawyer Office Management Server Discovery Port" `
                    -Direction Inbound `
                    -Action Allow `
                    -Protocol UDP `
                    -LocalPort 41234 `
                    -Profile Private,Domain `
                    -Enabled True | Out-Null

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Firewall successfully configured! Office devices can now connect." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan


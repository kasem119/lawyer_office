@echo off
chcp 65001 >nul
title تهيئة جدار حماية ويندوز - منظومة مكتب المحاماة

echo ======================================================================
echo    تهيئة جدار حماية ويندوز (Windows Firewall) لخادم المنظومة
echo ======================================================================

:: Check for administrative permissions
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] يتطلب تشغيل هذا السكربت صلاحيات المسؤول (Run as Administrator).
    echo     جاري طلب الإذن بصلاحية كمسؤول...
    powershell -Command "Start-Process '%~0' -Verb runAs"
    exit /b
)

echo [1/2] فتح المنفذ TCP 3000 لاتصال الأجهزة...
netsh advfirewall firewall delete rule name="LawyerOffice-Server-Port3000" >nul 2>&1
netsh advfirewall firewall add rule name="LawyerOffice-Server-Port3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul

echo [2/2] فتح المنفذ UDP 41234 لخدمة الاكتشاف التلقائي...
netsh advfirewall firewall delete rule name="LawyerOffice-Discovery-Port41234" >nul 2>&1
netsh advfirewall firewall add rule name="LawyerOffice-Discovery-Port41234" dir=in action=allow protocol=UDP localport=41234 profile=private,domain >nul

echo.
echo ======================================================================
echo    تمت تهيئة جدار الحماية بنجاح! الخادم جاهز لاستقبال اتصالات الأجهزة.
echo ======================================================================
echo.
pause

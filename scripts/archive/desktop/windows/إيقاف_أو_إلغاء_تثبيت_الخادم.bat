@echo off
chcp 65001 >nul
title إلغاء تثبيت خدمة خادم مكتب المحاماة
color 0c

echo ======================================================================
echo    إلغاء تثبيت خدمة خادم مكتب المحاماة (Windows Service)
echo ======================================================================
echo.

:: التحقق من صلاحيات المسؤول
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] يتطلب هذا الإجراء صلاحيات المسؤول (Administrator).
    echo [i] جاري طلب الإذن بصلاحية كمسؤول...
    powershell -Command Start-Process '%~0' -Verb runAs
    exit /b
)

set ROOT_DIR=%~dp0
cd /d %ROOT_DIR%server

echo [1/2] إيقاف وحذف خدمة ويندوز...
node windowsService.js uninstall

echo.
echo [2/2] إزالة اختصار التشغيل التلقائي...
powershell -Command Remove-Item ([Environment]::GetFolderPath('Startup') + '\LawyerOfficeTray.lnk') -ErrorAction SilentlyContinue

echo.
echo ======================================================================
echo    ✅ تم إلغاء تثبيت الخدمة بنجاح.
echo ======================================================================
echo.
pause

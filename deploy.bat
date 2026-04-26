@echo off
chcp 65001 >nul
title EduManage Pro - Firebase Deploy
color 0A

echo.
echo  =====================================================
echo     EduManage Pro - النشر على Firebase Hosting
echo  =====================================================
echo.

:: ======================================================
:: الخطوة 1: التحقق من تثبيت Node.js
:: ======================================================
echo  [1/4] التحقق من Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [خطأ] Node.js غير مثبت على جهازك!
    echo  يرجى تحميله وتثبيته من:
    echo  https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js مثبت - الإصدار: %NODE_VER%
echo.

:: ======================================================
:: الخطوة 2: تثبيت Firebase CLI إذا لم يكن مثبتاً
:: ======================================================
echo  [2/4] التحقق من Firebase CLI...
where firebase >nul 2>&1
if %errorlevel% neq 0 (
    echo  جاري تثبيت Firebase CLI... قد يستغرق هذا دقيقة
    echo.
    call npm install -g firebase-tools
    if %errorlevel% neq 0 (
        echo.
        echo  [خطأ] فشل تثبيت Firebase CLI
        echo  جرب تشغيل الملف كـ Administrator
        pause
        exit /b 1
    )
    echo  [OK] تم تثبيت Firebase CLI بنجاح
) else (
    for /f "tokens=*" %%i in ('firebase --version') do set FB_VER=%%i
    echo  [OK] Firebase CLI مثبت - الإصدار: %FB_VER%
)
echo.

:: ======================================================
:: الخطوة 3: تسجيل الدخول إلى Firebase
:: ======================================================
echo  [3/4] تسجيل الدخول إلى Firebase...
echo  سيفتح المتصفح لتسجيل الدخول بحساب Google الخاص بك
echo  إذا كنت مسجلاً مسبقاً سيتم تخطي هذه الخطوة
echo.
call firebase login --no-localhost 2>nul || call firebase login
echo.

:: ======================================================
:: الخطوة 4: النشر على Firebase Hosting
:: ======================================================
echo  [4/4] جاري رفع التطبيق على Firebase...
echo  المشروع: edumanage-sms-2026
echo.
call firebase deploy --only hosting --project edumanage-sms-2026

if %errorlevel% equ 0 (
    echo.
    echo  =====================================================
    echo   تم النشر بنجاح!
    echo.
    echo   روابط التطبيق:
    echo   https://edumanage-sms-2026.web.app
    echo   https://edumanage-sms-2026.firebaseapp.com
    echo  =====================================================
    echo.
    :: فتح التطبيق في المتصفح تلقائياً
    start https://edumanage-sms-2026.web.app
) else (
    echo.
    echo  =====================================================
    echo   [خطأ] فشل النشر
    echo   تحقق من:
    echo   1. اتصال الإنترنت
    echo   2. صلاحيات مشروع Firebase
    echo   3. تسجيل الدخول بالحساب الصحيح
    echo  =====================================================
)

echo.
pause

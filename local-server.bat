@echo off
chcp 65001 >nul
title EduManage Pro - Local Server
color 0B

echo.
echo  =====================================================
echo     EduManage Pro - تشغيل محلي للاختبار
echo  =====================================================
echo  ملاحظة: هذا الخادم للاختبار المحلي فقط
echo  للنشر الفعلي استخدم: deploy.bat
echo  =====================================================
echo.

set PORT=3000

:: ======================================================
:: جرب npx serve أولاً (يأتي مع Node.js)
:: ======================================================
where node >nul 2>&1
if %errorlevel% equ 0 (
    where npx >nul 2>&1
    if %errorlevel% equ 0 (
        echo  [OK] تم اكتشاف Node.js
        echo  جاري تشغيل الخادم على المنفذ %PORT%...
        echo.
        echo  افتح المتصفح على: http://localhost:%PORT%
        echo.
        echo  لإيقاف الخادم اضغط: Ctrl + C
        echo.
        start "" "http://localhost:%PORT%"
        npx serve . -p %PORT% -s
        goto :end
    )
)

:: ======================================================
:: جرب Python إذا لم يكن Node.js متاحاً
:: ======================================================
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] تم اكتشاف Python
    echo  جاري تشغيل الخادم على المنفذ %PORT%...
    echo.
    echo  افتح المتصفح على: http://localhost:%PORT%
    echo.
    echo  لإيقاف الخادم اضغط: Ctrl + C
    echo.
    start "" "http://localhost:%PORT%"
    python -m http.server %PORT%
    goto :end
)

where python3 >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] تم اكتشاف Python3
    echo  جاري تشغيل الخادم على المنفذ %PORT%...
    echo.
    echo  افتح المتصفح على: http://localhost:%PORT%
    echo.
    start "" "http://localhost:%PORT%"
    python3 -m http.server %PORT%
    goto :end
)

:: ======================================================
:: لا يوجد خادم - إرشادات التثبيت
:: ======================================================
echo  [خطأ] لم يتم العثور على Node.js أو Python
echo.
echo  يرجى تثبيت أحد التاليين:
echo  - Node.js: https://nodejs.org  (موصى به)
echo  - Python:  https://python.org
echo.
echo  ملاحظة: لا يمكن فتح index.html مباشرة بدون خادم
echo  بسبب قيود المتصفح على ملفات JavaScript المحلية

:end
echo.
pause

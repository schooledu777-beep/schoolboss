@echo off
chcp 65001 >nul
echo =======================================
echo     EduManage Pro - GitHub Auto Sync
echo =======================================
echo.

echo 1. Adding files...
git add .

echo 2. Committing changes...
git commit -m "Auto sync: %date% %time%"

echo 3. Pushing to GitHub...
git push

echo.
echo =======================================
echo  تمت المزامنة بنجاح! يمكنك إغلاق هذه النافذة.
echo =======================================
pause

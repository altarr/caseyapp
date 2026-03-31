@echo off
:: Installs CaseyApp services to start automatically on Windows login.
:: Run this ONCE on each demo PC.

echo Installing CaseyApp auto-start...

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "APP_DIR=%~dp0.."

:: Create the VBS launcher (runs node silently, no cmd window)
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%APP_DIR%\packager"
echo WshShell.Run "cmd /c set PATH=C:\Program Files\nodejs;%%LOCALAPPDATA%%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin;C:\Program Files\Amazon\AWSCLIV2;%%PATH%% && set S3_BUCKET=boothapp-sessions-752266476357 && set AWS_REGION=us-east-1 && node server.js > %APP_DIR%\logs\packager.log 2>&1", 0, False
echo WshShell.CurrentDirectory = "%APP_DIR%"
echo WshShell.Run "cmd /c set PATH=C:\Program Files\nodejs;C:\Program Files\Amazon\AWSCLIV2;%%PATH%% && set S3_BUCKET=boothapp-sessions-752266476357 && set AWS_REGION=us-east-1 && node presenter/server.js > %APP_DIR%\logs\presenter.log 2>&1", 0, False
) > "%STARTUP%\CaseyApp.vbs"

:: Create logs directory
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"

echo.
echo Done! CaseyApp will start automatically on next login.
echo Services: packager (port 9222) + presenter (port 3000)
echo Logs: %APP_DIR%\logs\
echo.
echo To uninstall: delete "%STARTUP%\CaseyApp.vbs"
pause

@echo off
title CaseyApp Demo PC
echo ============================================================
echo   CaseyApp Demo PC Startup
echo ============================================================
echo.

:: Set PATH for tools installed via winget
set "PATH=C:\Program Files\nodejs;%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin;C:\Program Files\Amazon\AWSCLIV2;%PATH%"

:: Set environment variables
set S3_BUCKET=boothapp-sessions-752266476357
set AWS_REGION=us-east-1

:: Verify tools
echo Checking tools...
node --version >nul 2>&1 && echo   [OK] Node.js || echo   [!!] Node.js NOT FOUND
ffmpeg -version >nul 2>&1 && echo   [OK] ffmpeg || echo   [!!] ffmpeg NOT FOUND
aws --version >nul 2>&1 && echo   [OK] AWS CLI || echo   [!!] AWS CLI NOT FOUND
echo.

:: Start packager
echo Starting Packager (port 9222)...
start "CaseyApp Packager" cmd /k "set PATH=C:\Program Files\nodejs;%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin;C:\Program Files\Amazon\AWSCLIV2;%PATH% && set S3_BUCKET=boothapp-sessions-752266476357 && set AWS_REGION=us-east-1 && cd /d C:\code\caseyapp\packager && node server.js"

:: Start presenter
echo Starting Presenter (port 3000)...
start "CaseyApp Presenter" cmd /k "set PATH=C:\Program Files\nodejs;C:\Program Files\Amazon\AWSCLIV2;%PATH% && set S3_BUCKET=boothapp-sessions-752266476357 && set AWS_REGION=us-east-1 && cd /d C:\code\caseyapp && node presenter/server.js"

:: Wait a moment
timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo   Services Started!
echo ============================================================
echo.
echo   Packager:       http://localhost:9222/status
echo   Presenter:      http://localhost:3000
echo   Create Session: http://localhost:3000/create-session.html
echo   Management:     https://caseyapp.trendcyberrange.com
echo.
echo   Next steps:
echo   1. Open Chrome with the CaseyApp extension loaded
echo   2. Configure extension with Management URL
echo   3. Scan QR code with Android app
echo.
echo   Press any key to exit (services keep running in their windows)
pause >nul

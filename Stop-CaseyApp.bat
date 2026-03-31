@echo off
echo Stopping CaseyApp services...
taskkill /f /fi "WINDOWTITLE eq CaseyApp Packager" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq CaseyApp Presenter" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo Done.
pause

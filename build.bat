@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Huzaifa Pharmacy - Build Installer
echo ========================================
echo.

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Building Windows installer...
call npm run dist
if errorlevel 1 (
    echo.
    echo ERROR: npm run dist failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD COMPLETED SUCCESSFULLY
echo Installer is in the release folder.
echo ========================================
echo.
pause

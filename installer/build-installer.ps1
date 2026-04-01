# Builds the PhantomRecall installer package.
# Creates a self-contained zip with app code + install script.
# The user extracts the zip and runs install.ps1.

$ErrorActionPreference = "Stop"
$BuildDir = "$PSScriptRoot\build"
$OutputFile = "$PSScriptRoot\PhantomRecall-Installer.zip"

Write-Host "Building PhantomRecall installer..." -ForegroundColor Cyan

# Clean
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir | Out-Null

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path

# Copy app components
$dirs = @("packager", "presenter", "extension", "audio", "brand")
foreach ($dir in $dirs) {
    $src = Join-Path $RepoRoot $dir
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination "$BuildDir\$dir" -Recurse
        # Remove node_modules (will be installed fresh)
        $nm = Join-Path "$BuildDir\$dir" "node_modules"
        if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
    }
}

# Strip brand folder — keep only digital essentials (logos, qrcode.min.js, favicon)
if (Test-Path "$BuildDir\brand") {
    # Remove everything non-digital
    @("physical", "imagery", ".git") | ForEach-Object {
        $p = Join-Path "$BuildDir\brand" $_
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
    # Remove PDFs, AI files, large images, templates
    Get-ChildItem "$BuildDir\brand" -Recurse -Include "*.pdf","*.ai","*.tif","*.eps","*.otf","*.psd" | Remove-Item -Force
    # Remove stock photos and large imagery
    @("digital\imagery\stock", "digital\imagery", "digital\templates", "digital\gradients", "digital\fonts") | ForEach-Object {
        $p = Join-Path "$BuildDir\brand" $_
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}

# Copy root files
Copy-Item "$RepoRoot\package.json" "$BuildDir\package.json"
if (Test-Path "$RepoRoot\package-lock.json") {
    Copy-Item "$RepoRoot\package-lock.json" "$BuildDir\package-lock.json"
}

# Remove root node_modules if copied
$rootNm = Join-Path $BuildDir "node_modules"
if (Test-Path $rootNm) { Remove-Item -Recurse -Force $rootNm }

# Copy installer script
Copy-Item "$PSScriptRoot\install.ps1" "$BuildDir\install.ps1"

# Create the launcher batch file (double-click to install)
@"
@echo off
echo Starting PhantomRecall installer...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
echo -----------------------------------------------
echo Installer finished. Review output above.
echo -----------------------------------------------
pause
"@ | Out-File -FilePath "$BuildDir\Install-PhantomRecall.bat" -Encoding ascii

# Create zip
if (Test-Path $OutputFile) { Remove-Item $OutputFile }
Compress-Archive -Path "$BuildDir\*" -DestinationPath $OutputFile -CompressionLevel Optimal

$size = (Get-Item $OutputFile).Length / 1MB
Write-Host ""
Write-Host "Installer built: $OutputFile ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
Write-Host "Distribute this zip. User extracts and double-clicks Install-PhantomRecall.bat" -ForegroundColor Gray

# Clean build dir
Remove-Item -Recurse -Force $BuildDir

# Builds the CaseyApp installer package.
# Creates a self-contained zip with app code + install script.
# The user extracts the zip and runs install.ps1.

$ErrorActionPreference = "Stop"
$BuildDir = "$PSScriptRoot\build"
$OutputFile = "$PSScriptRoot\CaseyApp-Installer.zip"

Write-Host "Building CaseyApp installer..." -ForegroundColor Cyan

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

# Copy root files
Copy-Item "$RepoRoot\package.json" "$BuildDir\package.json"
if (Test-Path "$RepoRoot\package-lock.json") {
    Copy-Item "$RepoRoot\package-lock.json" "$BuildDir\package-lock.json"
}

# Copy installer script
Copy-Item "$PSScriptRoot\install.ps1" "$BuildDir\install.ps1"

# Create the launcher batch file (double-click to install)
@"
@echo off
echo Starting CaseyApp installer...
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
"@ | Out-File -FilePath "$BuildDir\Install-CaseyApp.bat" -Encoding ascii

# Create zip
if (Test-Path $OutputFile) { Remove-Item $OutputFile }
Compress-Archive -Path "$BuildDir\*" -DestinationPath $OutputFile -CompressionLevel Optimal

$size = (Get-Item $OutputFile).Length / 1MB
Write-Host ""
Write-Host "Installer built: $OutputFile ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
Write-Host "Distribute this zip. User extracts and double-clicks Install-CaseyApp.bat" -ForegroundColor Gray

# Clean build dir
Remove-Item -Recurse -Force $BuildDir

# CaseyApp Demo PC Installer
# Self-contained: bundles Node.js, ffmpeg, and app code.
# Prompts for management server URL and pairing code.

$ErrorActionPreference = "Continue"
$InstallDir = "C:\CaseyApp"

trap {
    Write-Host ""
    Write-Host "  [ERROR] $_" -ForegroundColor Red
    Write-Host "  Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Red
Write-Host "    CaseyApp Demo PC Installer" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Red
Write-Host ""

# ── Step 1: Get management server URL and pairing code ───────────────────────

$MgmtUrl = Read-Host "  Management Server URL (e.g., https://caseyapp.trendcyberrange.com)"
$MgmtUrl = $MgmtUrl.TrimEnd('/')

if (-not $MgmtUrl) {
    Write-Host "  [ERROR] Management URL is required." -ForegroundColor Red
    exit 1
}

# Test connection
Write-Host "  Connecting to $MgmtUrl ..." -ForegroundColor Gray
try {
    $health = Invoke-RestMethod -Uri "$MgmtUrl/api/health" -TimeoutSec 10
    if ($health.status -eq "ok") {
        Write-Host "  [OK] Connected to management server" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERROR] Cannot reach $MgmtUrl - check the URL" -ForegroundColor Red
    exit 1
}

$PairingCode = Read-Host "  Pairing Code (from management dashboard)"

if (-not $PairingCode) {
    Write-Host "  [ERROR] Pairing code is required." -ForegroundColor Red
    exit 1
}

# ── Step 2: Activate with management server ──────────────────────────────────

Write-Host "  Activating with pairing code $PairingCode ..." -ForegroundColor Gray
try {
    $body = @{ code = $PairingCode.ToUpper() } | ConvertTo-Json
    $activation = Invoke-RestMethod -Uri "$MgmtUrl/api/demo-pcs/activate" -Method POST -Body $body -ContentType "application/json"

    if (-not $activation.activated) {
        Write-Host "  [ERROR] Activation failed." -ForegroundColor Red
        exit 1
    }

    Write-Host "  [OK] Activated as '$($activation.demo_pc.name)' for event '$($activation.event.name)'" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Invalid or expired pairing code." -ForegroundColor Red
    exit 1
}

# ── Step 3: Install files ────────────────────────────────────────────────────

Write-Host ""
Write-Host "  Installing to $InstallDir ..." -ForegroundColor Gray

# Create install directory
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\logs" -Force | Out-Null

# Install Node.js if not present
$nodePath = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
    Write-Host "  Installing Node.js ..." -ForegroundColor Yellow
    winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent 2>$null
    Write-Host "  [OK] Node.js installed" -ForegroundColor Green
} else {
    Write-Host "  [OK] Node.js already installed" -ForegroundColor Green
}

# Install ffmpeg if not present
$ffmpegSearch = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $ffmpegSearch) {
    Write-Host "  Installing ffmpeg ..." -ForegroundColor Yellow
    winget install --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements --silent 2>$null
    Write-Host "  [OK] ffmpeg installed" -ForegroundColor Green
} else {
    Write-Host "  [OK] ffmpeg already installed" -ForegroundColor Green
}

# Copy app files (installer is run from the extracted archive which contains the app)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path "$scriptDir\packager") {
    Copy-Item -Path "$scriptDir\packager" -Destination "$InstallDir\packager" -Recurse -Force
    Copy-Item -Path "$scriptDir\presenter" -Destination "$InstallDir\presenter" -Recurse -Force
    Copy-Item -Path "$scriptDir\extension" -Destination "$InstallDir\extension" -Recurse -Force
    Copy-Item -Path "$scriptDir\audio" -Destination "$InstallDir\audio" -Recurse -Force
    Copy-Item -Path "$scriptDir\brand" -Destination "$InstallDir\brand" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "$scriptDir\package.json" -Destination "$InstallDir\package.json" -Force
    Copy-Item -Path "$scriptDir\package-lock.json" -Destination "$InstallDir\package-lock.json" -Force -ErrorAction SilentlyContinue
}

# ── Step 4: Install npm dependencies ─────────────────────────────────────────

Write-Host "  Installing dependencies ..." -ForegroundColor Gray

# Refresh PATH
$env:Path = "C:\Program Files\nodejs;" + $env:Path

Push-Location "$InstallDir"
& npm install --production 2>$null | Out-Null
Pop-Location

Push-Location "$InstallDir\packager"
& npm install --production 2>$null | Out-Null
Pop-Location

Push-Location "$InstallDir\presenter"
& npm install --production 2>$null | Out-Null
Pop-Location

Write-Host "  [OK] Dependencies installed" -ForegroundColor Green

# ── Step 5: Write configuration ──────────────────────────────────────────────

$s3Config = $activation.s3_config

@"
MANAGEMENT_URL=$MgmtUrl
DEMO_PC_NAME=$($activation.demo_pc.name)
DEMO_PC_ID=$($activation.demo_pc.id)
EVENT_ID=$($activation.event.id)
EVENT_NAME=$($activation.event.name)
S3_BUCKET=$($s3Config.bucket)
AWS_REGION=$($s3Config.region)
AWS_ACCESS_KEY_ID=$($s3Config.access_key_id)
AWS_SECRET_ACCESS_KEY=$($s3Config.secret_access_key)
AWS_SESSION_TOKEN=$($s3Config.session_token)
"@ | Out-File -FilePath "$InstallDir\.env" -Encoding utf8

Write-Host "  [OK] Configuration saved" -ForegroundColor Green

# ── Step 6: Create Windows service (auto-start on login) ─────────────────────

$ffmpegDir = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).DirectoryName

$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$InstallDir\packager"
WshShell.Run "cmd /c set PATH=C:\Program Files\nodejs;$ffmpegDir;C:\Program Files\Amazon\AWSCLIV2;%PATH% && cd /d $InstallDir\packager && node server.js > $InstallDir\logs\packager.log 2>&1", 0, False
WshShell.CurrentDirectory = "$InstallDir"
WshShell.Run "cmd /c set PATH=C:\Program Files\nodejs;C:\Program Files\Amazon\AWSCLIV2;%PATH% && cd /d $InstallDir && node presenter/server.js > $InstallDir\logs\presenter.log 2>&1", 0, False
"@ | Out-File -FilePath "$startup\CaseyApp.vbs" -Encoding ascii

Write-Host "  [OK] Auto-start configured" -ForegroundColor Green

# ── Step 7: Start services now ───────────────────────────────────────────────

Write-Host "  Starting services ..." -ForegroundColor Gray

# Set env vars for current session
$env:S3_BUCKET = $s3Config.bucket
$env:AWS_REGION = $s3Config.region
$env:AWS_ACCESS_KEY_ID = $s3Config.access_key_id
$env:AWS_SECRET_ACCESS_KEY = $s3Config.secret_access_key
if ($s3Config.session_token) { $env:AWS_SESSION_TOKEN = $s3Config.session_token }
$env:MANAGEMENT_URL = $MgmtUrl

$env:Path = "C:\Program Files\nodejs;$ffmpegDir;C:\Program Files\Amazon\AWSCLIV2;" + $env:Path

Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$InstallDir\packager" -RedirectStandardOutput "$InstallDir\logs\packager.log" -RedirectStandardError "$InstallDir\logs\packager-error.log"
Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "presenter/server.js" -WorkingDirectory "$InstallDir" -RedirectStandardOutput "$InstallDir\logs\presenter.log" -RedirectStandardError "$InstallDir\logs\presenter-error.log"

Start-Sleep -Seconds 3

# Verify
try {
    $status = Invoke-RestMethod -Uri "http://localhost:9222/status" -TimeoutSec 5
    Write-Host "  [OK] Packager running (port 9222)" -ForegroundColor Green
} catch {
    Write-Host "  [!!] Packager may not have started (check logs\packager.log)" -ForegroundColor Yellow
}

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    Write-Host "  [OK] Presenter running (port 3000)" -ForegroundColor Green
} catch {
    Write-Host "  [!!] Presenter may not have started (check logs\presenter.log)" -ForegroundColor Yellow
}

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "    Installation Complete!" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Demo PC: $($activation.demo_pc.name)" -ForegroundColor White
Write-Host "  Event:   $($activation.event.name)" -ForegroundColor White
Write-Host ""
Write-Host "  Services:" -ForegroundColor Gray
Write-Host "    Packager:  http://localhost:9222/status" -ForegroundColor Gray
Write-Host "    Presenter: http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  Chrome Extension:" -ForegroundColor Gray
Write-Host "    Open chrome://extensions > Load unpacked > $InstallDir\extension" -ForegroundColor Gray
Write-Host ""
Write-Host "  Logs: $InstallDir\logs\" -ForegroundColor Gray
Write-Host ""

Read-Host "  Press Enter to exit"

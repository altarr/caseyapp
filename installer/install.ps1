# Phantom Recall Demo PC Installer
# Self-contained: bundles Node.js, ffmpeg, and app code.
# Prompts for management server URL and pairing code.
param(
    [string]$ManagementUrl = "",
    [string]$Code = ""
)

$ErrorActionPreference = "Continue"
$InstallDir = "C:\Phantom Recall"

trap {
    Write-Host ""
    Write-Host "  [ERROR] $_" -ForegroundColor Red
    Write-Host "  Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Red
Write-Host "    Phantom Recall Demo PC Installer" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Red
Write-Host ""

# ── Step 1: Get management server URL and pairing code ───────────────────────

if ($ManagementUrl) { $MgmtUrl = $ManagementUrl } else { $MgmtUrl = Read-Host "  Management Server URL (e.g., https://caseyapp.trendcyberrange.com)" }
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

if ($Code) { $PairingCode = $Code } else { $PairingCode = Read-Host "  Pairing Code (from management dashboard)" }

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

# Copy app files — look in script dir (extracted zip) or parent (repo)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = $scriptDir
if (-not (Test-Path "$sourceDir\packager")) {
    $sourceDir = Split-Path -Parent $scriptDir  # repo root when running from installer/
}
if (-not (Test-Path "$sourceDir\packager")) {
    Write-Host "  [ERROR] Cannot find app files (packager/, presenter/, etc.)" -ForegroundColor Red
    Write-Host "  Script dir: $scriptDir" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}

$components = @("packager", "presenter", "extension", "audio", "infra")
foreach ($comp in $components) {
    $src = Join-Path $sourceDir $comp
    $dst = Join-Path $InstallDir $comp
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
        # Remove node_modules (will install fresh)
        $nm = Join-Path $dst "node_modules"
        if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
        Write-Host "  [OK] Copied $comp" -ForegroundColor Green
    }
}
# Copy brand digital logos only
$brandSrc = Join-Path $sourceDir "brand\digital\logos"
if (Test-Path $brandSrc) {
    New-Item -ItemType Directory -Path "$InstallDir\brand\digital\logos" -Force | Out-Null
    Copy-Item -Path "$brandSrc\*" -Destination "$InstallDir\brand\digital\logos" -Recurse -Force
}
# Copy brand qrcode.min.js
$qrSrc = Join-Path $sourceDir "brand\digital\qrcode.min.js"
if (Test-Path $qrSrc) { Copy-Item $qrSrc "$InstallDir\brand\digital\qrcode.min.js" -Force }

Copy-Item (Join-Path $sourceDir "package.json") "$InstallDir\package.json" -Force
$lockFile = Join-Path $sourceDir "package-lock.json"
if (Test-Path $lockFile) { Copy-Item $lockFile "$InstallDir\package-lock.json" -Force }

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
"@ | Out-File -FilePath "$startup\Phantom Recall.vbs" -Encoding ascii

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

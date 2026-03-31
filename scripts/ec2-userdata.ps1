<powershell>
# CaseyApp Demo PC Setup — EC2 User Data
# Installs Node.js, ffmpeg, Git, clones repo, installs deps, starts services

$ErrorActionPreference = "Continue"
Start-Transcript -Path "C:\caseyapp-setup.log" -Append

# Set admin password for RDP
$password = "CaseyApp-Demo-2026!"
net user Administrator $password
wmic useraccount where "name='Administrator'" set PasswordExpires=FALSE

# Install Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Install tools
choco install -y nodejs-lts git ffmpeg googlechrome

# Refresh PATH again
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Clone repo
cd C:\
git clone https://github.com/caseyapp/caseyapp.git caseyapp 2>$null
if (-not (Test-Path C:\caseyapp)) {
    mkdir C:\caseyapp
}

# Copy AWS credentials from instance metadata or create config
$awsDir = "C:\Users\Administrator\.aws"
mkdir $awsDir -Force
@"
[default]
region = us-east-1
"@ | Out-File -FilePath "$awsDir\config" -Encoding utf8

# Install npm deps
cd C:\caseyapp
npm install --production 2>$null
cd C:\caseyapp\packager
npm install --production 2>$null

# Create desktop shortcuts
$desktop = "C:\Users\Administrator\Desktop"

@"
@echo off
echo Starting CaseyApp Demo Environment...
echo.
cd /d C:\caseyapp
start "Packager" cmd /k "cd /d C:\caseyapp\packager && node server.js"
start "Presenter" cmd /k "cd /d C:\caseyapp && node presenter/server.js"
echo.
echo Services starting...
echo   Packager:  http://localhost:9222/status
echo   Presenter: http://localhost:3000
echo   Create Session: http://localhost:3000/create-session.html
echo.
pause
"@ | Out-File -FilePath "$desktop\Start CaseyApp.bat" -Encoding ascii

@"
@echo off
echo Stopping CaseyApp services...
taskkill /f /im node.exe 2>nul
echo Done.
pause
"@ | Out-File -FilePath "$desktop\Stop CaseyApp.bat" -Encoding ascii

# Create firewall rules
netsh advfirewall firewall add rule name="CaseyApp Presenter" dir=in action=allow protocol=tcp localport=3000
netsh advfirewall firewall add rule name="CaseyApp Packager" dir=in action=allow protocol=tcp localport=9222

# Write setup complete marker
"Setup complete at $(Get-Date)" | Out-File -FilePath "C:\caseyapp-setup-complete.txt"

Stop-Transcript
</powershell>

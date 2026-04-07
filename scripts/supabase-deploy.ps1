# Supabase CLI Deployment Script for SYNCO
# Purpose: Load local credentials and execute Supabase CLI commands securely.

$ErrorActionPreference = "Stop"
$EnvFile = ".env.supabase.cli.local"

if (-not (Test-Path $EnvFile)) {
    Write-Host "Error: $EnvFile not found. Create it from .env.supabase.cli.example" -ForegroundColor Red
    exit 1
}

# Load Environment Variables
Write-Host "Loading environment variables from $EnvFile..." -ForegroundColor Cyan
$EnvContent = Get-Content $EnvFile -Raw
$EnvLines = $EnvContent -split "[\r\n]+" | Where-Object { $_ -match "=" -and $_ -notmatch "^#" }

foreach ($Line in $EnvLines) {
    if ($Line -match "^([^=]+)=(.*)$") {
        $Name = $Matches[1].Trim()
        $Value = $Matches[2].Trim()
        if ($Value -match "^['""](.*)['""]$") { $Value = $Matches[1] } # Remove quotes if present
        [System.Environment]::SetEnvironmentVariable($Name, $Value, [System.EnvironmentVariableTarget]::Process)
        Set-Item "env:$Name" $Value
    }
}

# Validate Credentials
$ProjectRef = $env:SUPABASE_PROJECT_REF
$AccessToken = $env:SUPABASE_ACCESS_TOKEN
$DbPassword = $env:SUPABASE_DB_PASSWORD

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    Write-Host "Error: SUPABASE_ACCESS_TOKEN is missing in $EnvFile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($DbPassword)) {
    Write-Host "Error: SUPABASE_DB_PASSWORD is missing in $EnvFile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    Write-Host "Error: SUPABASE_PROJECT_REF is missing in $EnvFile" -ForegroundColor Red
    exit 1
}

Write-Host "Authenticating with Supabase CLI..." -ForegroundColor Cyan
npx supabase login --access-token "$AccessToken"

Write-Host "Linking project: $ProjectRef..." -ForegroundColor Cyan
npx supabase link --project-ref "$ProjectRef" --password "$DbPassword"

Write-Host "Running Database Migration Diagnosis (Dry Run)..." -ForegroundColor Yellow
npx supabase db push --password "$DbPassword" --dry-run

Write-Host "`nReady to push migrations? (Y/N)" -ForegroundColor Cyan
$Confirmation = Read-Host
if ($Confirmation -ne "Y" -and $Confirmation -ne "y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "Pushing migrations to remote database..." -ForegroundColor Green
npx supabase db push --password "$DbPassword"

Write-Host "`nDeployment completed successfully!" -ForegroundColor Green

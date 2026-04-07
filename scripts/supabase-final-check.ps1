# Final Validation for SYNCO
$ErrorActionPreference = "Stop"
$EnvFile = ".env.supabase.cli.local"

# Load Variables using a robust method
$EnvContent = Get-Content $EnvFile -Raw
$ProjectRef = ""
$AccessToken = ""
$DbPassword = ""

if ($EnvContent -match "SUPABASE_PROJECT_REF=([^\r\n]+)") { $ProjectRef = $Matches[1].Trim() }
if ($EnvContent -match "SUPABASE_ACCESS_TOKEN=([^\r\n]+)") { $AccessToken = $Matches[1].Trim() }
if ($EnvContent -match "SUPABASE_DB_PASSWORD=([^\r\n]+)") { $DbPassword = $Matches[1].Trim() }

Set-Item "env:SUPABASE_ACCESS_TOKEN" $AccessToken

Write-Host "Checking tables in remote project $ProjectRef..." -ForegroundColor Cyan
npx supabase db query --project-ref "$ProjectRef" --password "$DbPassword" "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"

Write-Host "`nChecking marketplaces seeds..." -ForegroundColor Cyan
npx supabase db query --project-ref "$ProjectRef" --password "$DbPassword" "SELECT name FROM public.marketplaces"

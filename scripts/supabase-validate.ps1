# Supabase Validation Script
$ErrorActionPreference = "Stop"
$EnvFile = ".env.supabase.cli.local"

# Load Variables
$EnvContent = Get-Content $EnvFile -Raw
$ProjectRef = $null; $AccessToken = $null; $DbPassword = $null;
$EnvLines = $EnvContent -split "[\r\n]+" | Where-Object { $_ -match "=" -and $_ -notmatch "^#" }

foreach ($Line in $EnvLines) {
    if ($Line -match "^([^=]+)=(.*)$") {
        $Name = $Matches[1].Trim()
        $Value = $Matches[2].Trim()
        if ($Value -match "^['""](.*)['""]$") { $Value = $Matches[1] }
        Set-Item "env:$Name" $Value
    }
}

Set-Item "env:SUPABASE_ACCESS_TOKEN" $AccessToken

Write-Host "--- Migration Status ---" -ForegroundColor Cyan
npx supabase migration list --remote --project-ref "$ProjectRef" --password "$DbPassword"

Write-Host "`n--- Database Tables ---" -ForegroundColor Cyan
# Since we don't have a direct 'query' command in some CLI versions, we can use a temporary migration or similar, 
# but usually 'npx supabase db push --dry-run' shows what's missing.
# If it shows NOTHING to push, then everything is applied.
npx supabase db push --project-ref "$ProjectRef" --password "$DbPassword" --dry-run

Write-Host "`nValidation complete." -ForegroundColor Green

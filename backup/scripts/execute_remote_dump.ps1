<#
.SYNOPSIS
    Script seguro para extração de dump estrutural e de dados do Supabase.
    Este script NÃO armazena credenciais. Solicita a Connection String em runtime.
#>

# 1. Verificar dependências
try {
    Write-Host "Verificando Supabase CLI..."
    npx supabase --version | Out-Null
}
catch {
    Write-Error "A CLI do Supabase (npx supabase) nâo foi encontrada ou falhou ao executar. Certifique-se de que o Node.js está instalado e você rodou 'npm install'."
    exit 1
}

# 2. Solicitar credenciais (Runtime)
$dbUrl = Read-Host -Prompt "Insira a sua Connection String (postgresql://postgres:senha@host:5432/postgres)"
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Error "Connection String é obrigatória."
    exit 1
}

# 3. Garantir diretório de destino
$backupDir = Join-Path $PSScriptRoot "..\supabase"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

Write-Host "Iniciando extração do ambiente remoto..." -ForegroundColor Cyan

# 4. Executar Dumps
try {
    Write-Host "Extraindo Roles..."
    npx supabase db dump --db-url $dbUrl -f (Join-Path $backupDir "roles.sql") --role-only
    
    Write-Host "Extraindo Schema (Remoto)..."
    npx supabase db dump --db-url $dbUrl -f (Join-Path $backupDir "schema.sql")
    
    Write-Host "Extraindo Dados (DML)..."
    # Adicionado exclusões de segurança padrão para evitar falhas em tabelas de sistema do Supabase
    npx supabase db dump --db-url $dbUrl -f (Join-Path $backupDir "data.sql") --data-only --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes"
    
    Write-Host "Extraindo Schema de Histórico (se existir)..."
    npx supabase db dump --db-url $dbUrl -f (Join-Path $backupDir "history_schema.sql") -s "history,audit"
    
    Write-Host "Extraindo Dados de Histórico (se existir)..."
    npx supabase db dump --db-url $dbUrl -f (Join-Path $backupDir "history_data.sql") --data-only --use-copy -s "history,audit"

    Write-Host "`nSucesso! Os arquivos foram gerados em $backupDir" -ForegroundColor Green
}
catch {
    Write-Error "Erro durante a execução do dump: $_"
}
finally {
    # Limpar variável sensitiva da memória
    Remove-Variable dbUrl -ErrorAction SilentlyContinue
}

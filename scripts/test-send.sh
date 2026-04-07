#!/bin/bash
# Teste de disparo do motor de envios (Worker)
# Define a URL base (produção ou localhost)
API_URL=${1:-http://localhost:3000}

# Pega o secret do arquivo .env.local
CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2)

if [ -z "$CRON_SECRET" ]; then
    echo "ERRO: CRON_SECRET não encontrado no .env.local"
    exit 1
fi

echo "Iniciando processamento (Worker)... URL: $API_URL/api/send-jobs/process"
echo "─────────────────────────────────────────────────────────────"

curl -X POST "$API_URL/api/send-jobs/process" \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: $CRON_SECRET" \
     -d '{}'

echo -e "\n─────────────────────────────────────────────────────────────"
echo "Feito!"

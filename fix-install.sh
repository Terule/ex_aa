#!/bin/bash
# Script para corrigir instalação do sistema Rising Steel

SYSTEM_PATH="/data/Data/systems/rising-steel"
TEMP_DIR="/tmp/rising-steel-fix"

echo "🔍 Diagnosticando instalação do Rising Steel..."
echo ""

# Verificar se a pasta existe
if [ ! -d "$SYSTEM_PATH" ]; then
    echo "❌ Pasta do sistema não existe: $SYSTEM_PATH"
    echo "📁 Criando pasta..."
    mkdir -p "$SYSTEM_PATH"
fi

# Procurar system.json
echo "🔍 Procurando system.json..."
FOUND_JSON=$(find "$SYSTEM_PATH" -name "system.json" 2>/dev/null | head -1)

if [ -z "$FOUND_JSON" ]; then
    echo "❌ system.json não encontrado!"
    echo "📦 Baixando versão limpa do GitHub..."
    
    # Criar diretório temporário
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Baixar e extrair
    wget -q https://github.com/Terule/ex_aa/archive/refs/heads/main.zip
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao baixar do GitHub"
        exit 1
    fi
    
    unzip -q main.zip
    
    # Verificar se extraiu corretamente
    if [ ! -d "ex_aa-main" ]; then
        echo "❌ Erro ao extrair ZIP"
        exit 1
    fi
    
    echo "📋 Copiando arquivos..."
    
    # Se já existir conteúdo, fazer backup
    if [ "$(ls -A $SYSTEM_PATH 2>/dev/null)" ]; then
        echo "⚠️  Pasta não está vazia. Fazendo backup..."
        BACKUP_DIR="${SYSTEM_PATH}_backup_$(date +%s)"
        mv "$SYSTEM_PATH" "$BACKUP_DIR"
        mkdir -p "$SYSTEM_PATH"
    fi
    
    # Copiar tudo
    cp -r ex_aa-main/* "$SYSTEM_PATH/"
    cp -r ex_aa-main/.* "$SYSTEM_PATH/" 2>/dev/null || true
    
    # Limpar
    cd /
    rm -rf "$TEMP_DIR"
    
elif [ "$FOUND_JSON" != "$SYSTEM_PATH/system.json" ]; then
    echo "⚠️  system.json encontrado em: $FOUND_JSON"
    echo "📋 Movendo para local correto..."
    
    # Encontrar a pasta que contém o system.json
    JSON_DIR=$(dirname "$FOUND_JSON")
    
    if [ "$JSON_DIR" != "$SYSTEM_PATH" ]; then
        echo "📦 Movendo conteúdo de $JSON_DIR para $SYSTEM_PATH"
        mv "$JSON_DIR"/* "$SYSTEM_PATH/" 2>/dev/null
        mv "$JSON_DIR"/.* "$SYSTEM_PATH/" 2>/dev/null || true
        rmdir "$JSON_DIR" 2>/dev/null || true
    fi
fi

# Verificação final
echo ""
echo "✅ Verificação final:"
if [ -f "$SYSTEM_PATH/system.json" ]; then
    echo "✅ system.json encontrado em: $SYSTEM_PATH/system.json"
    
    # Mostrar versão
    VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$SYSTEM_PATH/system.json" | cut -d'"' -f4)
    echo "✅ Versão: $VERSION"
    
    # Verificar estrutura básica
    echo ""
    echo "📁 Estrutura:"
    ls -1 "$SYSTEM_PATH" | head -10
    
    echo ""
    echo "🔄 Reinicie o Foundry VTT para aplicar as mudanças"
else
    echo "❌ ERRO: system.json ainda não está no local correto!"
    echo "Verifique manualmente a estrutura"
    exit 1
fi


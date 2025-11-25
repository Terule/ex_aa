# 🔍 Diagnóstico: Sistema instalado mas system.json não encontrado

## ❌ Erro
```
Error: [/data/Data/systems/rising-steel/system.json] 
The package does not exist to uninstall!
```

## 🔍 Problema

O Foundry registrou o sistema como instalado, mas o arquivo físico `system.json` não está no caminho esperado. Isso impede desinstalar e usar o sistema.

## ✅ Verificação e Correção

### Passo 1: Verificar Estrutura Atual

Execute no servidor:

```bash
# Verifique o que existe na pasta
ls -la /data/Data/systems/rising-steel/

# Verifique especificamente se system.json existe
ls -la /data/Data/systems/rising-steel/system.json

# Verifique a estrutura completa
find /data/Data/systems/rising-steel -name "system.json" 2>/dev/null
```

### Passo 2: Diagnosticar a Estrutura

**Se o comando acima não encontrar nada:**
- A pasta `rising-steel` pode estar vazia ou não existe

**Se encontrar system.json em uma subpasta:**
```bash
# Exemplo: se encontrar em /data/Data/systems/rising-steel/ex_aa-main/system.json
# Você precisa mover o conteúdo para a raiz
```

### Passo 3: Solução Completa

Execute este script completo:

```bash
#!/bin/bash

SYSTEM_PATH="/data/Data/systems/rising-steel"
TEMP_PATH="/tmp/rising-steel-reinstall"

echo "🔍 Verificando estrutura atual..."
ls -la "$SYSTEM_PATH"

echo ""
echo "🔍 Procurando system.json..."
find "$SYSTEM_PATH" -name "system.json" 2>/dev/null

echo ""
echo "📦 Baixando versão limpa do GitHub..."
cd /tmp
rm -rf ex_aa-main main.zip
wget -q https://github.com/Terule/ex_aa/archive/refs/heads/main.zip

echo "📂 Extraindo..."
unzip -q main.zip

echo "🧹 Removendo instalação antiga..."
rm -rf "$SYSTEM_PATH"

echo "📁 Criando estrutura correta..."
mkdir -p "$SYSTEM_PATH"

echo "📋 Movendo arquivos..."
mv ex_aa-main/* "$SYSTEM_PATH/"
mv ex_aa-main/.* "$SYSTEM_PATH/" 2>/dev/null || true

echo "🧹 Limpando..."
rmdir ex_aa-main 2>/dev/null || true
rm main.zip

echo ""
echo "✅ Verificando instalação..."
if [ -f "$SYSTEM_PATH/system.json" ]; then
    echo "✅ system.json encontrado!"
    echo "✅ Versão: $(grep '"version"' "$SYSTEM_PATH/system.json" | head -1)"
    echo ""
    echo "🔄 Reinicie o Foundry VTT para aplicar as mudanças"
else
    echo "❌ ERRO: system.json ainda não foi encontrado!"
    echo "Verifique manualmente a estrutura de pastas"
fi
```

### Passo 4: Solução Manual Rápida

Se preferir fazer manualmente:

```bash
# 1. Remova completamente a pasta
rm -rf /data/Data/systems/rising-steel

# 2. Baixe e extraia o ZIP
cd /tmp
wget https://github.com/Terule/ex_aa/archive/refs/heads/main.zip
unzip main.zip

# 3. Crie a pasta e mova TUDO da subpasta para a raiz
mkdir -p /data/Data/systems/rising-steel
mv ex_aa-main/* /data/Data/systems/rising-steel/
mv ex_aa-main/.* /data/Data/systems/rising-steel/ 2>/dev/null

# 4. Limpe
rmdir ex_aa-main
rm main.zip

# 5. Verifique
ls -la /data/Data/systems/rising-steel/system.json
```

### Passo 5: Limpar Registro no Foundry

Após corrigir a estrutura física, você pode precisar limpar o registro do sistema:

1. **No Foundry VTT:**
   - Vá em Setup → Manage Systems
   - Se `rising-steel` aparecer como instalado mas com erro, tente desinstalar
   - Se der erro, feche o Foundry

2. **No servidor, limpe o cache:**
```bash
# O Foundry pode ter cache do sistema instalado
# Procure por arquivos de configuração que listam sistemas instalados
# Geralmente em: /data/Data/Config/options.json ou similar
```

## ✅ Verificação Final

Execute:
```bash
# Verificar se system.json existe e está no lugar certo
test -f /data/Data/systems/rising-steel/system.json && echo "✅ OK" || echo "❌ FALTA"

# Verificar conteúdo do system.json
cat /data/Data/systems/rising-steel/system.json | head -5

# Verificar estrutura
ls -la /data/Data/systems/rising-steel/ | head -20
```

## 📋 Checklist

- [ ] Pasta `/data/Data/systems/rising-steel/` existe
- [ ] Arquivo `system.json` está em `/data/Data/systems/rising-steel/system.json` (raiz)
- [ ] Pasta `module/` existe com os arquivos JavaScript
- [ ] Pasta `css/` existe com os arquivos CSS
- [ ] Após correção, reiniciar Foundry VTT


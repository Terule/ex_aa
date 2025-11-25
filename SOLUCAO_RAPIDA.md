# ⚡ Solução Rápida: Sistema Registrado mas Arquivo Não Encontrado

## ❌ Erro
```
Error: [/data/Data/systems/rising-steel/system.json] 
The package does not exist to uninstall!
```

## 🔧 Solução Imediata

O sistema está registrado no Foundry, mas o arquivo físico não existe. Execute no servidor:

### Opção 1: Script Automático (Recomendado)

```bash
# 1. Torne o script executável
chmod +x fix-install.sh

# 2. Execute o script
./fix-install.sh
```

### Opção 2: Comandos Manuais

```bash
# 1. Verifique se o arquivo existe
ls -la /data/Data/systems/rising-steel/system.json

# 2. Se não existir, reinstale corretamente:
cd /tmp
rm -rf ex_aa-main main.zip rising-steel-fix
wget https://github.com/Terule/ex_aa/archive/refs/heads/main.zip
unzip main.zip

# 3. Remova a instalação atual e recrie
rm -rf /data/Data/systems/rising-steel
mkdir -p /data/Data/systems/rising-steel

# 4. Mova TODO o conteúdo da subpasta para a raiz
mv ex_aa-main/* /data/Data/systems/rising-steel/
mv ex_aa-main/.* /data/Data/systems/rising-steel/ 2>/dev/null || true
rmdir ex_aa-main

# 5. Limpe
rm main.zip

# 6. Verifique
ls -la /data/Data/systems/rising-steel/system.json
```

## ✅ Verificação

Execute:
```bash
test -f /data/Data/systems/rising-steel/system.json && echo "✅ Arquivo encontrado!" || echo "❌ Arquivo ainda não existe"
```

## 🔄 Após Corrigir

1. **Reinicie o Foundry VTT completamente**
2. Vá em **Setup → Manage Systems**
3. Se ainda aparecer o sistema com erro, tente desinstalar novamente (agora deve funcionar)
4. Reinstale usando a URL do manifest

## 📋 URL para Reinstalar

```
https://raw.githubusercontent.com/Terule/ex_aa/main/system.json
```


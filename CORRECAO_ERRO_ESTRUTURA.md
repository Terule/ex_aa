# 🔧 Correção: system.json não encontrado

## ❌ Erro
```
Error loading system "/data/Data/systems/rising-steel/system.json": 
ENOENT: no such file or directory
```

## 🔍 Causa do Problema

Quando você baixa e extrai o ZIP do GitHub, ele cria uma subpasta `ex_aa-main`. O Foundry espera que o `system.json` esteja diretamente na pasta `rising-steel`, mas ele acaba ficando dentro de `ex_aa-main`.

**Estrutura ERRADA (atual):**
```
/data/Data/systems/rising-steel/
  └── ex_aa-main/           ← Problema!
      ├── system.json
      ├── module/
      └── ...
```

**Estrutura CORRETA (esperada):**
```
/data/Data/systems/rising-steel/
  ├── system.json           ← Deve estar aqui!
  ├── module/
  └── ...
```

## ✅ Solução Rápida (Linux/Server)

Execute estes comandos no servidor:

```bash
# 1. Entre na pasta do sistema
cd /data/Data/systems/rising-steel/

# 2. Verifique o que há dentro
ls -la

# 3. Se você ver uma pasta como "ex_aa-main", mova o conteúdo:
mv ex_aa-main/* .
mv ex_aa-main/.* . 2>/dev/null  # Move arquivos ocultos
rmdir ex_aa-main

# 4. Verifique se o system.json está na raiz agora
ls -la system.json
```

## ✅ Solução Completa (Reinstalar)

Se preferir reinstalar corretamente:

```bash
# 1. Remova a instalação atual
rm -rf /data/Data/systems/rising-steel

# 2. Baixe o ZIP
cd /tmp
wget https://github.com/Terule/ex_aa/archive/refs/heads/main.zip

# 3. Extraia
unzip main.zip

# 4. Crie a pasta e mova o conteúdo corretamente
mkdir -p /data/Data/systems/rising-steel
mv ex_aa-main/* /data/Data/systems/rising-steel/
mv ex_aa-main/.* /data/Data/systems/rising-steel/ 2>/dev/null
rmdir ex_aa-main
rm main.zip

# 5. Verifique
ls -la /data/Data/systems/rising-steel/system.json
```

## ✅ Verificação

Execute para confirmar:
```bash
test -f /data/Data/systems/rising-steel/system.json && echo "✅ OK!" || echo "❌ Arquivo não encontrado"
```

## 🔄 Após corrigir

1. Reinicie o Foundry VTT
2. O sistema deve carregar corretamente

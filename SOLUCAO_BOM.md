# Solução para o Erro de BOM no system.json

## Status

✅ **Arquivo corrigido localmente** - Versão 0.0.11  
✅ **Commit e push realizados**  
⚠️ **O erro pode persistir devido ao cache do GitHub/servidor**

## Problema

O erro `SyntaxError: Unexpected token '﻿' in JSON at position 0` indica que o arquivo no servidor ainda está sendo servido com BOM, mesmo após a correção.

## Soluções

### Solução 1: Aguardar Atualização do Cache (Recomendado)

O GitHub e o servidor Foundry podem ter cache. Aguarde **10-15 minutos** e tente novamente.

### Solução 2: Forçar Atualização do Cache

1. **No navegador:**
   - Pressione `Ctrl + Shift + R` (ou `Cmd + Shift + R` no Mac)
   - Ou abra o DevTools (F12) → aba Network → marque "Disable cache"

2. **Use uma URL com timestamp para forçar atualização:**
   ```
   https://raw.githubusercontent.com/Terule/ex_aa/main/system.json?v=0.0.11
   ```
   
   Ou use a URL completa do manifest:
   ```
   https://raw.githubusercontent.com/Terule/ex_aa/main/system.json?nocache=$(date +%s)
   ```

### Solução 3: Verificar o Arquivo Diretamente

Abra no navegador:
```
https://raw.githubusercontent.com/Terule/ex_aa/main/system.json
```

O arquivo deve começar com `{` (chave de abertura). Se começar com `﻿{`, o cache ainda não foi atualizado.

### Solução 4: Usar Git Blob Direto (Bypass Cache)

Como alternativa temporária, use o hash do commit:
```
https://github.com/Terule/ex_aa/raw/8dbe1ca/system.json
```

### Solução 5: Instalação Manual

Se o erro persistir, instale manualmente:

1. Baixe o ZIP:
   ```
   https://github.com/Terule/ex_aa/archive/refs/heads/main.zip
   ```
2. Extraia o arquivo
3. Renomeie para `rising-steel`
4. Copie para a pasta de sistemas do Foundry

## Verificação do Arquivo

O arquivo `system.json` local está **100% sem BOM**:
- Primeiro byte: `0x7B` (caractere `{`)
- Encoding: UTF-8 sem BOM
- Versão: 0.0.11
- Commit: `8dbe1ca`

## Arquivos de Prevenção

✅ `.gitattributes` criado para evitar BOM no futuro:
```
*.json text eol=lf
system.json text eol=lf
```

## Próximos Passos

1. Aguarde 10-15 minutos para o cache atualizar
2. Limpe o cache do navegador
3. Tente instalar novamente

Se o problema persistir após 15 minutos, pode ser necessário:
- Verificar configurações do servidor Foundry
- Verificar se há proxy/CDN intermediário com cache


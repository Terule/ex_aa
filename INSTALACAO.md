# Como Instalar o Sistema Rising Steel no Foundry VTT

## ✅ Versão Atual: 0.0.10

## Método 1: Usando a URL do Manifest (Recomendado)

1. Abra o Foundry VTT (versão 12.331 ou superior)
2. Vá até a aba **Setup** → **Install System**
3. Cole a seguinte URL na caixa de texto "Manifest URL":

```
https://raw.githubusercontent.com/Terule/ex_aa/main/system.json
```

4. Clique em **Install System**
5. Aguarde a instalação completar

## Método 2: Instalação Manual via ZIP

1. Baixe o sistema em ZIP:
   ```
   https://github.com/Terule/ex_aa/archive/refs/heads/main.zip
   ```
2. Extraia o arquivo ZIP
3. Renomeie a pasta para `rising-steel` (sem espaços ou caracteres especiais)
4. Copie para a pasta de sistemas do Foundry:
   - Windows: `%LOCALAPPDATA%\FoundryVTT\Data\systems\`
   - Linux: `~/.local/share/FoundryVTT/Data/systems/`
   - Mac: `~/Library/Application Support/FoundryVTT/Data/systems/`

## Informações do Sistema

- **ID**: `rising-steel`
- **Título**: Rising Steel
- **Versão**: 0.0.10
- **Versão Mínima do Foundry**: 12
- **Versão Verificada**: 12.331
- **URL do Repositório**: https://github.com/Terule/ex_aa

## Correções na Versão 0.0.10

- ✅ **Removido BOM do system.json** - Correção definitiva do erro de instalação
- ✅ Adicionado `.gitattributes` para evitar BOM no futuro
- ✅ Corrigido diálogo de criação de Actor (mostra corretamente: Piloto, Criatura, Companion)
- ✅ Configuração explícita de tipos de Actor

## Após a Instalação

1. Crie um novo mundo (World) ou edite um existente
2. Selecione **"Rising Steel"** como o sistema do mundo
3. O sistema estará pronto para uso!

## Resolução de Problemas

### Erro: "Unexpected token ﻿ in JSON"

Este erro indica que o arquivo tinha BOM (Byte Order Mark). A versão 0.0.10 já corrige isso. Se ainda ocorrer:

1. Limpe o cache do navegador
2. Aguarde alguns minutos para o GitHub atualizar o cache
3. Tente instalar novamente

### O sistema não aparece na lista

1. Verifique se está na versão correta do Foundry (12+)
2. Reinicie o Foundry completamente
3. Verifique se a pasta foi copiada corretamente na instalação manual

## Suporte

- **Issues**: https://github.com/Terule/ex_aa/issues
- **Repositório**: https://github.com/Terule/ex_aa

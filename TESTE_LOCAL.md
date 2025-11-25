# Guia de Teste Local - Foundry VTT

## Por que testar localmente?

- ✅ **Sem problemas de cache do servidor remoto**
- ✅ **Atualizações mais rápidas** (arquivos locais)
- ✅ **Mais fácil debugar** (acesso direto aos arquivos)
- ✅ **Controle total** sobre o ambiente

## Como testar localmente

### 1. Iniciar o Foundry VTT Local

1. Abra o **Foundry VTT** (aplicativo desktop)
2. Inicie um servidor local
3. Acesse via navegador: `http://localhost:30000` (ou a porta configurada)

### 2. Configurar o Sistema

O sistema já está na pasta correta:
```
C:\Users\Hebert-PC\AppData\Local\FoundryVTT\Data\systems\rising-steel\
```

### 3. Testar as Mudanças

Após modificar arquivos:

1. **Hard Refresh no Navegador:**
   - Pressione **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)
   - Isso força o recarregamento sem cache

2. **Ou recarregar o sistema:**
   - No Foundry: **Game Settings** → **Configure Settings** → **Reload Application**
   - Ou pressione **F5** no navegador

3. **Verificar logs no console (F12):**
   - `[Rising Steel] Módulo carregado - Versão: 0.0.4 - Timestamp: ...`
   - `[Rising Steel] Hook init executado - Timestamp: ...`
   - `[Rising Steel] Registrando hook preRenderDialog no nível do módulo`
   - `[Rising Steel] Registrando hook renderDialog no nível do módulo`

### 4. Testar Criação de Item

1. Abra o compendium "Armadura"
2. Clique em "Create Item"
3. Verifique se o diálogo mostra apenas:
   - ✅ Armadura
   - ✅ Arma
   - ✅ Equipamento
   - ❌ **NÃO** deve mostrar: Feature, Item, Spell

## Vantagens do Teste Local

- **Sem latência de rede** - arquivos carregam instantaneamente
- **Cache mais fácil de limpar** - apenas Ctrl+Shift+R
- **Logs mais rápidos** - sem delay de rede
- **Debug mais fácil** - acesso direto aos arquivos

## Troubleshooting

### Se os logs não aparecerem:

1. **Verifique se o arquivo foi salvo:**
   - Abra `module/rising-steel.js` e verifique se os logs estão lá

2. **Force o recarregamento:**
   - Feche completamente o navegador
   - Abra novamente e acesse `http://localhost:30000`
   - Ou reinicie o servidor Foundry

3. **Verifique a versão:**
   - **Game Settings** → **General Information** → **Rising Steel 0.0.4**
   - Se a versão não mudou, o sistema não foi atualizado

### Se ainda não funcionar:

1. **Limpe o cache do navegador completamente:**
   - Chrome/Edge: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached Web Content

2. **Reinicie o servidor Foundry:**
   - Feche completamente o Foundry VTT
   - Abra novamente
   - Isso garante que todos os arquivos sejam recarregados


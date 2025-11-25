# Debug de Cache - Foundry VTT

## Problema: Servidor não está atualizando automaticamente

O Foundry VTT **NÃO tem hot reload automático**. Quando você modifica arquivos do sistema, é necessário:

## Soluções para Forçar Atualização

### 1. **Recarregar a Página (Recomendado)**
- Pressione **Ctrl+Shift+R** (Windows/Linux) ou **Cmd+Shift+R** (Mac) para hard refresh
- Isso força o navegador a ignorar o cache e recarregar todos os arquivos

### 2. **Limpar Cache do Navegador**
- **Chrome/Edge**: F12 → Network → Marque "Disable cache" → Recarregue
- **Firefox**: F12 → Network → Clique com botão direito → "Disable HTTP Cache"

### 3. **Recarregar o Sistema no Foundry**
- No Foundry VTT, vá em **Game Settings** → **Configure Settings** → **Reload Application**
- Ou simplesmente pressione **F5** no navegador

### 4. **Reiniciar o Servidor Foundry**
- Feche completamente o servidor Foundry VTT
- Abra novamente
- Isso garante que todos os arquivos sejam recarregados do disco

### 5. **Verificar Versão do Sistema**
- O sistema agora incrementa a versão automaticamente a cada commit
- Verifique em **Game Settings** → **General Information** → **Rising Steel 0.0.X**
- Se a versão não mudou, o sistema não foi atualizado

## Como Verificar se o Código Foi Atualizado

1. **Abra o Console (F12)**
2. **Procure pelos logs:**
   - `[Rising Steel] Módulo carregado - Versão: X.X.X - Timestamp: ...`
   - `[Rising Steel] Hook init executado - Timestamp: ...`
   - `[Rising Steel] Registrando hook preRenderDialog no nível do módulo`
   - `[Rising Steel] Registrando hook renderDialog no nível do módulo`

3. **Se os logs não aparecerem:**
   - O código não foi recarregado
   - Faça um hard refresh (Ctrl+Shift+R)
   - Ou reinicie o servidor Foundry

## Por Que o Cache Acontece?

- **Navegadores** cacheiam arquivos JavaScript para melhorar performance
- **Foundry VTT** carrega módulos ES6 que são cacheados pelo navegador
- **Servidor** pode estar servindo arquivos antigos se não foi reiniciado

## Solução Automática (Futuro)

Podemos adicionar cache-busting automático usando query strings com timestamp, mas isso requer modificações no `system.json` e pode não funcionar em todos os casos.


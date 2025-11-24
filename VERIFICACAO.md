# Guia de Verificação - Sistema Rising Steel

## Checklist para o sistema aparecer no Foundry VTT:

### 1. Estrutura de Arquivos ✅
- [x] `system.json` existe na raiz
- [x] `js/actor.js` existe
- [x] `js/actor-sheet.js` existe
- [x] `template/actor-sheet.hbs` existe
- [x] `css/styles.css` existe

### 2. Verificações no Foundry VTT:

1. **Recarregue o Foundry completamente:**
   - Feche o Foundry VTT completamente
   - Abra novamente
   - OU pressione F5 no navegador se estiver usando a versão web

2. **Verifique o Console:**
   - Pressione F12 para abrir o console do navegador
   - Procure por erros em vermelho
   - Verifique se há mensagens sobre o sistema "rising-steel"

3. **Verifique a Pasta:**
   - O sistema DEVE estar em: `C:\Users\Hebert-PC\AppData\Local\FoundryVTT\Data\systems\rising-steel\`
   - Certifique-se de que não há subpastas extras

4. **No Foundry:**
   - Vá em "Setup" → "Configure Settings" → "Core Settings"
   - Verifique se o sistema aparece na lista
   - Se não aparecer, tente:
     - Criar um novo mundo
     - Na tela de criação de mundo, o sistema deve aparecer na lista

### 3. Se ainda não aparecer:

1. Verifique se há erros no console (F12)
2. Verifique se o `system.json` está com encoding UTF-8
3. Tente renomear a pasta para algo sem hífen: `risingsteel`
4. Verifique se há outros sistemas instalados funcionando

### 4. Campos Obrigatórios no system.json:

O sistema precisa ter pelo menos:
- `id` ou `name` (identificador único)
- `title` (nome exibido)
- `version`
- `compatibility` (versão do Foundry)

Todos esses campos estão presentes no nosso `system.json`.


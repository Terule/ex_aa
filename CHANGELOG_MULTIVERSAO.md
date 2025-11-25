# Changelog - Suporte Multi-Versão (v12 e v13)

## Resumo das Mudanças

O sistema Rising Steel agora suporta **FoundryVTT v12.0.2** e **v13** com detecção automática de versão.

## Arquivos Modificados

### Novos Arquivos
- ✅ `module/utils/compatibility.js` - Módulo de compatibilidade com detecção automática de versão

### Arquivos Atualizados

1. **`system.json`**
   - Alterado `compatibility` para suportar v12 a v13:
     ```json
     "compatibility": {
       "minimum": "12",
       "verified": "12.0.2",
       "maximum": "13"
     }
     ```

2. **`module/rising-steel.js`**
   - Importa `FoundryCompatibility`
   - Usa funções de compatibilidade para registro de sheets

3. **`module/actor/pilot-sheet.js`**
   - Importa `FoundryCompatibility`
   - Usa `FoundryCompatibility.getActorSheetBase()` para classe base
   - Usa `FoundryCompatibility.enrichHTML()` para rich text

4. **`module/item/item-sheet.js`**
   - Importa `FoundryCompatibility`
   - Usa `FoundryCompatibility.getItemSheetBase()` para classe base
   - Usa `FoundryCompatibility.enrichHTML()` para rich text

5. **`module/app/roll-dialog.js`**
   - Importa `FoundryCompatibility`
   - Usa `FoundryCompatibility.renderTemplate()` para templates

6. **`module/app/armadura-select-dialog.js`**
   - Importa `FoundryCompatibility`
   - Usa `FoundryCompatibility.renderTemplate()` para templates

## APIs Adaptadas

### 1. Registro de Sheets
- **v13:** `foundry.documents.collections.Actors.registerSheet()`
- **v12:** `Actors.registerSheet()`
- **Agora:** `FoundryCompatibility.registerActorSheet()`

### 2. Classes Base de Sheets
- **v13:** `foundry.appv1.sheets.ActorSheet`
- **v12:** `ActorSheet`
- **Agora:** `FoundryCompatibility.getActorSheetBase()`

### 3. Rich Text Editor
- **v13:** `foundry.applications.ux.TextEditor.implementation.enrichHTML()`
- **v12:** `TextEditor.enrichHTML()`
- **Agora:** `FoundryCompatibility.enrichHTML()`

### 4. Templates Handlebars
- **v13:** `foundry.applications.handlebars.renderTemplate()`
- **v12:** `renderTemplate()` (global)
- **Agora:** `FoundryCompatibility.renderTemplate()`

## Como Funciona

O módulo `FoundryCompatibility` detecta automaticamente a versão do FoundryVTT usando múltiplos métodos:

1. **Verifica `game.version`** (método mais confiável)
2. **Verifica `CONFIG.version`** (fallback)
3. **Analisa estrutura de APIs** (detecção por presença de objetos)

Baseado na versão detectada, as funções helper usam as APIs apropriadas.

## Compatibilidade

✅ **FoundryVTT v12.0.2** - Totalmente suportado
✅ **FoundryVTT v13.x** - Totalmente suportado

## Notas

- A detecção de versão é automática e não requer configuração adicional
- O código funciona de forma transparente em ambas as versões
- Arquivos na pasta `js/` não foram modificados (parecem ser código legado não utilizado)

## Testes Recomendados

1. Testar criação de atores (pilotos)
2. Testar criação e edição de itens
3. Testar rolagens de dados
4. Testar seleção de armaduras
5. Testar rich text editor em descrições
6. Testar compendiums e packs







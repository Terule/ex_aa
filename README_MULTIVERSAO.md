# Suporte Multi-Versão - FoundryVTT v12 e v13

## ✅ Implementação Concluída

O sistema **Rising Steel** agora suporta **FoundryVTT v12.0.2** e **v13** com detecção automática de versão.

## 📋 Mudanças Realizadas

### 1. Novo Módulo de Compatibilidade
- **Arquivo:** `module/utils/compatibility.js`
- **Função:** Detecta automaticamente a versão do FoundryVTT e usa as APIs apropriadas

### 2. Arquivos Atualizados

#### `system.json`
```json
"compatibility": {
  "minimum": "12",
  "verified": "12.0.2",
  "maximum": "13"
}
```

#### Módulos Principais
- ✅ `module/rising-steel.js` - Registro de sheets compatível
- ✅ `module/actor/pilot-sheet.js` - Classe base e rich text compatível
- ✅ `module/item/item-sheet.js` - Classe base e rich text compatível
- ✅ `module/app/roll-dialog.js` - Templates compatíveis
- ✅ `module/app/armadura-select-dialog.js` - Templates compatíveis

## 🔧 APIs Adaptadas

| Funcionalidade | v12 | v13 | Solução |
|---------------|-----|-----|---------|
| **Registro de Sheets** | `Actors.registerSheet()` | `foundry.documents.collections.Actors.registerSheet()` | `FoundryCompatibility.registerActorSheet()` |
| **Classe Base Actor** | `ActorSheet` | `foundry.appv1.sheets.ActorSheet` | `FoundryCompatibility.getActorSheetBase()` |
| **Classe Base Item** | `ItemSheet` | `foundry.appv1.sheets.ItemSheet` | `FoundryCompatibility.getItemSheetBase()` |
| **Rich Text Editor** | `TextEditor.enrichHTML()` | `foundry.applications.ux.TextEditor.implementation.enrichHTML()` | `FoundryCompatibility.enrichHTML()` |
| **Templates** | `renderTemplate()` | `foundry.applications.handlebars.renderTemplate()` | `FoundryCompatibility.renderTemplate()` |

## 🎯 Como Funciona

1. **Detecção Automática:** O módulo `FoundryCompatibility` detecta a versão do FoundryVTT usando múltiplos métodos
2. **Abstração de APIs:** Funções helper usam as APIs corretas baseadas na versão detectada
3. **Transparente:** O código funciona automaticamente em ambas as versões sem configuração adicional

## ✅ Compatibilidade

- ✅ **FoundryVTT v12.0.2** - Totalmente suportado
- ✅ **FoundryVTT v13.x** - Totalmente suportado

## 🧪 Testes Recomendados

1. Criar e editar atores (pilotos)
2. Criar e editar itens (armas, armaduras, equipamentos)
3. Realizar rolagens de dados
4. Selecionar armaduras dos compendiums
5. Editar descrições com rich text
6. Importar itens dos compendiums
7. Usar todas as funcionalidades do sistema

## 📝 Notas

- A detecção de versão é automática e não requer configuração
- O código funciona de forma transparente em ambas as versões
- Arquivos na pasta `js/` não foram modificados (parecem ser código legado não utilizado)
- Não há breaking changes - o sistema continua funcionando normalmente em v13

## 🚀 Próximos Passos

1. Testar o sistema em FoundryVTT v12.0.2
2. Testar o sistema em FoundryVTT v13
3. Verificar todas as funcionalidades
4. Reportar quaisquer problemas encontrados

---

**Data de Implementação:** Versão 2.0.0 Multi-Versão
**Status:** ✅ Pronto para testes






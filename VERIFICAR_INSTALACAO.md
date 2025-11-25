# Problema: system.json não encontrado após instalação

## Erro
```
Error loading system "/data/Data/systems/rising-steel/system.json": 
ENOENT: no such file or directory
```

## Causa Provável

Quando você baixa o ZIP do GitHub e extrai, ele cria uma pasta `ex_aa-main` ou similar, então a estrutura fica:

```
rising-steel/
  └── ex_aa-main/
      └── system.json  ❌ (arquivo está aqui, mas deveria estar na raiz)
```

Quando deveria ser:

```
rising-steel/
  └── system.json  ✅
```

## Soluções

### Solução 1: Instalação Manual Corrigida

1. Baixe o ZIP:
   ```
   https://github.com/Terule/ex_aa/archive/refs/heads/main.zip
   ```

2. Extraia o arquivo ZIP

3. **IMPORTANTE**: Entre na pasta extraída (geralmente chamada `ex_aa-main`)

4. Copie **TODO O CONTEÚDO** de dentro da pasta `ex_aa-main` para a pasta `rising-steel`:
   - system.json
   - module/
   - css/
   - template/
   - packs/
   - etc.

5. A estrutura final deve ser:
   ```
   C:\...\FoundryVTT\Data\systems\rising-steel\
     ├── system.json  ✅
     ├── module\
     ├── css\
     ├── template\
     └── ...
   ```

### Solução 2: Renomear Corretamente

Se você já extraiu o ZIP:

1. Encontre a pasta `ex_aa-main` (ou nome similar)
2. Renomeie essa pasta para `rising-steel`
3. Mova para a pasta de sistemas do Foundry

### Solução 3: Verificar Estrutura

Verifique se o `system.json` está na raiz da pasta `rising-steel`:

```
rising-steel/
  ├── system.json  ← DEVE estar aqui!
  ├── module/
  ├── css/
  └── ...
```

Se não estiver, mova todos os arquivos da subpasta para a raiz.

## Verificação

No servidor Foundry, verifique se o arquivo existe em:
```
/data/Data/systems/rising-steel/system.json
```

Se não existir, o sistema não foi instalado corretamente.


# Scripts de Automação

## bump-version.js / bump-version.ps1

Scripts para incrementar automaticamente a versão do sistema antes de cada commit.

### Como funciona

- **bump-version.js**: Script Node.js para Linux/Mac
- **bump-version.ps1**: Script PowerShell para Windows

Ambos os scripts fazem o seguinte:
1. Lêem o arquivo `system.json`
2. Extraem a versão atual (formato: X.Y.Z)
3. Incrementam o patch version (último número)
4. Atualizam o arquivo `system.json`
5. Adicionam o arquivo ao staging area do git

### Git Hook

O arquivo `.git/hooks/pre-commit` é executado automaticamente antes de cada commit e chama o script apropriado baseado no sistema operacional.

### Exemplo

Se a versão atual é `0.0.1`, após o commit ela será `0.0.2`.

### Execução Manual

Se quiser incrementar a versão manualmente sem fazer commit:

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/bump-version.ps1
```

**Linux/Mac:**
```bash
node scripts/bump-version.js
```


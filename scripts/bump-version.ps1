# Script PowerShell para incrementar automaticamente a versão do sistema
# Incrementa o patch version (0.0.1 -> 0.0.2)

$systemJsonPath = Join-Path $PSScriptRoot "..\system.json"

try {
    # Ler o arquivo system.json
    $systemJson = Get-Content $systemJsonPath -Raw | ConvertFrom-Json
    
    # Extrair a versão atual
    $currentVersion = $systemJson.version
    $versionParts = $currentVersion.Split('.')
    
    if ($versionParts.Length -ne 3) {
        Write-Error "Versão inválida: $currentVersion. Esperado formato: X.Y.Z"
        exit 1
    }
    
    # Incrementar o patch version (último número)
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    $patch = [int]$versionParts[2] + 1
    
    $newVersion = "$major.$minor.$patch"
    
    # Atualizar a versão
    $systemJson.version = $newVersion
    
    # Salvar o arquivo sem BOM (UTF8 sem BOM)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    $jsonContent = $systemJson | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText((Resolve-Path $systemJsonPath), $jsonContent, $utf8NoBom)
    
    Write-Host "Versão incrementada: $currentVersion -> $newVersion"
    
    # Adicionar o arquivo system.json ao staging area do git
    try {
        git add $systemJsonPath
    } catch {
        # Ignorar erros se não estiver em um repositório git
    }
    
} catch {
    Write-Error "Erro ao incrementar versão: $($_.Exception.Message)"
    exit 1
}


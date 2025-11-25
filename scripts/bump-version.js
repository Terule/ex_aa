#!/usr/bin/env node

/**
 * Script para incrementar automaticamente a versão do sistema
 * Incrementa o patch version (0.0.1 -> 0.0.2)
 */

const fs = require('fs');
const path = require('path');

const systemJsonPath = path.join(__dirname, '..', 'system.json');

try {
    // Ler o arquivo system.json
    const systemJson = JSON.parse(fs.readFileSync(systemJsonPath, 'utf8'));
    
    // Extrair a versão atual
    const currentVersion = systemJson.version;
    const versionParts = currentVersion.split('.');
    
    if (versionParts.length !== 3) {
        console.error(`Versão inválida: ${currentVersion}. Esperado formato: X.Y.Z`);
        process.exit(1);
    }
    
    // Incrementar o patch version (último número)
    const major = parseInt(versionParts[0], 10);
    const minor = parseInt(versionParts[1], 10);
    const patch = parseInt(versionParts[2], 10) + 1;
    
    const newVersion = `${major}.${minor}.${patch}`;
    
    // Atualizar a versão
    systemJson.version = newVersion;
    
    // Salvar o arquivo
    fs.writeFileSync(systemJsonPath, JSON.stringify(systemJson, null, 2) + '\n', 'utf8');
    
    console.log(`Versão incrementada: ${currentVersion} -> ${newVersion}`);
    
    // Adicionar o arquivo system.json ao staging area do git
    const { execSync } = require('child_process');
    try {
        execSync(`git add ${systemJsonPath}`, { stdio: 'inherit' });
    } catch (error) {
        // Ignorar erros se não estiver em um repositório git
    }
    
} catch (error) {
    console.error('Erro ao incrementar versão:', error.message);
    process.exit(1);
}


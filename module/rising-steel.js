// Import Modules
import { RisingSteel } from "./config.js";
import { FoundryCompatibility } from "./utils/compatibility.js";
import { RisingSteelActor } from "./actor/actor.js";
import { RisingSteelPilotSheet } from "./actor/pilot-sheet.js";
import { RisingSteelCreatureSheet } from "./actor/creature-sheet.js";
import { RisingSteelCompanionSheet } from "./actor/companion-sheet.js";
import { RisingSteelExacomSheet } from "./actor/exacom-sheet.js";
import { RisingSteelItem } from "./item/item.js";
import { RisingSteelItemSheet } from "./item/item-sheet.js";
import { RisingSteelRollDialog } from "./app/roll-dialog.js";

/* ------------------------------------ */
/* Setup Rising Steel system	 */
/* ------------------------------------ */

// Log de carregamento do módulo para debug de cache
console.log("[Rising Steel] Módulo carregado - Versão:", game.system?.version || "desconhecida", "- Timestamp:", new Date().toISOString());

Hooks.once("init", async function () {
    console.log("[Rising Steel] Hook init executado - Timestamp:", new Date().toISOString());
    /**
     * Set an initiative formula for the system
     * Iniciativa = Destreza + Perspicácia (como quantidade de dados)
     * Usamos uma fórmula padrão que será substituída pelo hook
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "1d6",
        decimals: 0,
    };
    
    // Hook para interceptar quando o combatant rola iniciativa
    // Sobrescrever o método getInitiativeRoll do Combatant
    Hooks.on("ready", () => {
        // Interceptar o método rollInitiative do Combat
        const originalRollInitiative = Combat.prototype.rollInitiative;
        Combat.prototype.rollInitiative = async function(ids, options = {}) {
            // Se ids não foi fornecido, rolar para todos
            if (!ids) ids = this.combatants.map(c => c.id);
            if (!Array.isArray(ids)) ids = [ids];
            
            for (const id of ids) {
                const combatant = this.combatants.get(id);
                if (!combatant) continue;
                const actor = combatant.actor;
                if (!actor) continue;
                
                const initiativeData = getActorInitiativeData(actor);
                if (initiativeData.dice > 0) {
                    const roll = new Roll(`${initiativeData.dice}d6`);
                    await roll.roll();
                    
                    await combatant.update({ initiative: roll.total });
                    
                    await roll.toMessage({
                        rollMode: game.settings.get('core', 'rollMode'),
                        speaker: ChatMessage.getSpeaker({ actor, token: combatant.token }),
                        flavor: `Rolagem de Iniciativa: ${initiativeData.flavor} = ${initiativeData.dice}d6`
                    });
                    
                    continue;
                }
                
                // Sem fórmula customizada: usar comportamento padrão
                await originalRollInitiative.call(this, [id], options);
            }
        };
    });

    /**
     * Retorna a quantidade de dados de iniciativa e descrição baseada no tipo do ator
     * @param {Actor} actor 
     * @returns {{dice:number, flavor:string}}
     */
    function getActorInitiativeData(actor) {
        const safeNumber = (value) => Number(value ?? 0);
        const attr = actor.system?.atributos || {};
        let dice = 0;
        let flavor = "";
        
        if (actor.type === "piloto" || actor.type === "companion" || actor.type === "criatura") {
            const destreza = safeNumber(attr.fisicos?.destreza);
            const perspicacia = safeNumber(attr.mentais?.perspicacia);
            dice = destreza + perspicacia;
            flavor = `${destreza} (Destreza) + ${perspicacia} (Perspicácia)`;
        } else if (actor.type === "exacom") {
            const neuromotor = safeNumber(actor.system?.sistema?.neuromotor);
            const sensorial = safeNumber(actor.system?.sistema?.sensorial);
            dice = neuromotor + sensorial;
            flavor = `${neuromotor} (Neuromotor) + ${sensorial} (Sensorial)`;
        }
        
        return { dice, flavor };
    }

    CONFIG.RisingSteel = RisingSteel;
    CONFIG.Actor.documentClass = RisingSteelActor;
    CONFIG.Item.documentClass = RisingSteelItem;
    
    // Configurar tipos de Actor
    CONFIG.Actor.types = ["piloto", "criatura", "companion", "exacom"];
    CONFIG.Actor.typeLabels = CONFIG.Actor.typeLabels || {};
    CONFIG.Actor.typeLabels.piloto = "Piloto";
    CONFIG.Actor.typeLabels.criatura = "Criatura";
    CONFIG.Actor.typeLabels.companion = "Companion";
    CONFIG.Actor.typeLabels.exacom = "EXAcom";
    CONFIG.Actor.defaultType = "piloto";
    
    // Configurar labels para tipos de itens
    CONFIG.Item.typeLabels = CONFIG.Item.typeLabels || {};
    CONFIG.Item.typeLabels.armadura = "Armadura";
    CONFIG.Item.typeLabels.arma = "Arma";
    CONFIG.Item.typeLabels.equipamento = "Equipamento";
    CONFIG.Item.typeLabels.exacomModel = "Modelo EXAcom";
    CONFIG.Item.typeLabels.blindagemExacom = "Blindagem EXAcom";
    CONFIG.Item.typeLabels.exacomModulo = "Módulo EXAcom";
    
    // Modificar CONFIG.Item.types para ter apenas os tipos relevantes do sistema
    // Isso afeta todos os lugares onde os tipos são listados, incluindo compendiums
    // IMPORTANTE: Isso deve ser feito ANTES de qualquer outro sistema carregar
    const systemItemTypes = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom", "exacomModulo"];
    CONFIG.Item.types = [...systemItemTypes];
    
    // Salvar tipos originais de itens (caso precise restaurar)
    const originalItemTypes = ["item", "feature", "spell", ...systemItemTypes];
    
    // Log packs disponíveis para debug
    Hooks.once("ready", async () => {
        // Salvar tipos originais
        window.RisingSteel = window.RisingSteel || {};
        window.RisingSteel.originalItemTypes = originalItemTypes;
        console.log("Rising Steel - Packs disponíveis:", Array.from(game.packs).map(p => ({
            id: p.metadata.id,
            name: p.metadata.name,
            label: p.metadata.label
        })));
        
        // Verificar e importar outros packs se estiverem vazios (armaduras e armas removidos - importação manual apenas)
        if (game.user.isGM) {
            try {
                await ensurePackFilled("rising-steel.equipamentos", window.RisingSteel.importEquipamentos, "equipamentos");
                await ensurePackFilled("rising-steel.exacom", window.RisingSteel.importExacomModels, "exacom");
                await ensurePackFilled("rising-steel.blindagemExacom", window.RisingSteel.importBlindagensExacom, "blindagemExacom");
                await ensurePackFilled("rising-steel.modulosExacom", window.RisingSteel.importModulosExacom, "modulosExacom");
            } catch (error) {
                console.warn("[Rising Steel] Erro ao verificar/importar packs:", error);
            }
        }
        
        // Garantir que CONFIG.Item.types está correto
        // Mantemos também o tipo "exacomModel" para permitir criação de modelos de EXAcom
        CONFIG.Item.types = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom", "exacomModulo"];
        
        // Registrar hook renderDialog aqui para garantir que seja executado
        console.log("[Rising Steel] Registrando hook renderDialog no ready");
    });

    // Register sheet application classes (multi-version compatible)
    FoundryCompatibility.unregisterActorSheet("core", FoundryCompatibility.getDefaultActorSheet());
    FoundryCompatibility.registerActorSheet("rising-steel", RisingSteelPilotSheet, {
        types: ["piloto"],
        makeDefault: true,
    });
    FoundryCompatibility.registerActorSheet("rising-steel", RisingSteelCreatureSheet, {
        types: ["criatura"],
        makeDefault: true
    });
    FoundryCompatibility.registerActorSheet("rising-steel", RisingSteelCompanionSheet, {
        types: ["companion"],
        makeDefault: true
    });
    FoundryCompatibility.registerActorSheet("rising-steel", RisingSteelExacomSheet, {
        types: ["exacom"],
        makeDefault: true
    });
    FoundryCompatibility.unregisterItemSheet("core", FoundryCompatibility.getDefaultItemSheet());
    FoundryCompatibility.registerItemSheet("rising-steel", RisingSteelItemSheet, { makeDefault: true });

    /* -------------------------------------------- */
    /*  HANDLEBARS HELPERS      */
    /* -------------------------------------------- */

    Handlebars.registerHelper("eq", (a, b) => a == b);
    
    Handlebars.registerHelper("math", function (lvalue, operator, rvalue, options) {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);

        return {
            "+": lvalue + rvalue,
            "-": lvalue - rvalue,
            "*": lvalue * rvalue,
            "/": lvalue / rvalue,
            "%": lvalue % rvalue
        }[operator];
    });

    Handlebars.registerHelper("greaterThan", function (val1, val2) {
        return val1 > val2;
    });

    // Helper para normalizar valores numéricos no template
    Handlebars.registerHelper("number", function (value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        // Se for string, remover vírgulas e converter
        if (typeof value === 'string') {
            value = value.replace(/,/g, '.');
        }
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    });

});

// Hook para recalcular limiares de dano e atributos de combate do EXACOM quando o piloto vinculado mudar
Hooks.on("updateActor", async (actor, updateData, options, userId) => {
    // Verificar se é um piloto
    if (actor.type === "piloto") {
        const oldVigor = actor.system?.atributos?.fisicos?.vigor;
        const newVigor = updateData.system?.atributos?.fisicos?.vigor;
        
        // Verificar se o Vigor foi alterado (para recalcular limiares)
        const vigorChanged = newVigor !== undefined && newVigor !== oldVigor;
        
        // Verificar se os atributos de combate foram alterados (para recalcular atributos de combate do EXACOM)
        const oldEsquiva = actor.system?.combate?.esquiva;
        const oldMobilidade = actor.system?.combate?.mobilidade;
        const oldIniciativa = actor.system?.combate?.iniciativa;
        const newEsquiva = updateData.system?.combate?.esquiva;
        const newMobilidade = updateData.system?.combate?.mobilidade;
        const newIniciativa = updateData.system?.combate?.iniciativa;
        
        const esquivaChanged = newEsquiva !== undefined && newEsquiva !== oldEsquiva;
        const mobilidadeChanged = newMobilidade !== undefined && newMobilidade !== oldMobilidade;
        const iniciativaChanged = newIniciativa !== undefined && newIniciativa !== oldIniciativa;
        const combatStatsChanged = esquivaChanged || mobilidadeChanged || iniciativaChanged;
        
        // Se nada mudou, não fazer nada
        if (!vigorChanged && !combatStatsChanged) return;
        
        // Buscar todos os EXACOMs vinculados a este piloto
        try {
            const exacoms = game.actors?.filter(a => 
                a.type === "exacom" && 
                a.system?.vinculo?.pilotoId === actor.id
            ) || [];
            
            if (exacoms.length === 0) return;
            
            // Para cada EXACOM vinculado, recalcular limiares e/ou atributos de combate
            for (const exacom of exacoms) {
                const exacomUpdateData = {};
                
                // Recalcular limiares se o Vigor mudou
                if (vigorChanged) {
                    const estrutural = Number(exacom.system?.sistema?.estrutural || 0);
                    const vigorPiloto = Number(newVigor || 0);
                    
                    // Calcular novos limiares baseados em (Vigor do piloto + Estrutural)
                    const baseLimiar = vigorPiloto + estrutural;
                    exacomUpdateData["system.limiarDano.leve.limiar"] = baseLimiar * 1;
                    exacomUpdateData["system.limiarDano.moderado.limiar"] = baseLimiar * 2;
                    exacomUpdateData["system.limiarDano.grave.limiar"] = baseLimiar * 4;
                }
                
                // Recalcular atributos de combate se mudaram
                if (combatStatsChanged) {
                    const sincronia = Number(exacom.system?.exa?.sincronia || 0);
                    
                    // Usar os novos valores do piloto (ou os antigos se não foram alterados)
                    const pilotoEsquiva = newEsquiva !== undefined ? Number(newEsquiva) : Number(oldEsquiva || 0);
                    const pilotoMobilidade = newMobilidade !== undefined ? Number(newMobilidade) : Number(oldMobilidade || 0);
                    const pilotoIniciativa = newIniciativa !== undefined ? Number(newIniciativa) : Number(oldIniciativa || 0);
                    
                    exacomUpdateData["system.combate.esquiva"] = sincronia + pilotoEsquiva;
                    exacomUpdateData["system.combate.mobilidade"] = sincronia + pilotoMobilidade;
                    exacomUpdateData["system.combate.iniciativa"] = sincronia + pilotoIniciativa;
                }
                
                // Atualizar o EXACOM se houver algo para atualizar
                if (Object.keys(exacomUpdateData).length > 0) {
                    await exacom.update(exacomUpdateData, { render: false });
                }
            }
            
            // Renderizar todas as sheets abertas de EXACOMs afetados
            Object.values(ui.windows || {}).forEach(app => {
                if (app.actor && exacoms.some(e => e.id === app.actor.id)) {
                    app.render(false);
                }
            });
            
        } catch (error) {
            console.error("[Rising Steel] Erro ao recalcular limiares dos EXACOMs vinculados:", error);
        }
    }
}); // Hook updateActor - v2

// Hook para garantir que os atributos do template.json sejam aplicados quando um item é criado
// Usamos uma abordagem direta sem depender da API deprecada
Hooks.on("preCreateItem", (item, data, options, userId) => {
    // Apenas processar se o item não tiver dados do sistema ou se estiver faltando atributos essenciais
    if (!data.system || Object.keys(data.system).length === 0 || 
        (data.type === "armadura" && data.system.tipo === undefined) ||
        (data.type === "arma" && data.system.tipo === undefined) ||
        (data.type === "equipamento" && data.system.tipo === undefined) ||
        (data.type === "exacomModel" && data.system.modelo === undefined)) {
        
        const itemType = data.type;
        
        // Inicializar system se não existir
        if (!data.system) {
            data.system = {};
        }
        
        // Definir atributos baseados no tipo de item diretamente
        // Isso evita usar a API deprecada game.system.template
        if (itemType === "armadura") {
            if (data.system.tipo === undefined) data.system.tipo = "";
            if (data.system.protecao === undefined) data.system.protecao = 0;
            if (data.system.peso === undefined) data.system.peso = 0;
            if (data.system.descricao === undefined) data.system.descricao = "";
            if (data.system.especial === undefined) data.system.especial = "";
            if (data.system.description === undefined) data.system.description = "";
        } else if (itemType === "arma") {
            if (data.system.tipo === undefined) data.system.tipo = "";
            if (data.system.dano === undefined) data.system.dano = 0;
            if (data.system.alcance === undefined) data.system.alcance = "";
            if (data.system.bonus === undefined) data.system.bonus = 0;
            if (data.system.descricao === undefined) data.system.descricao = "";
            if (data.system.description === undefined) data.system.description = "";
        } else if (itemType === "equipamento") {
            if (data.system.tipo === undefined) data.system.tipo = "";
            if (data.system.efeito === undefined) data.system.efeito = "";
            if (data.system.peso === undefined) data.system.peso = 0;
            if (data.system.descricao === undefined) data.system.descricao = "";
            if (data.system.description === undefined) data.system.description = "";
        } else if (itemType === "exacomModel") {
            if (data.system.modelo === undefined) data.system.modelo = "";
            if (data.system.neuromotor === undefined) data.system.neuromotor = 0;
            if (data.system.sensorial === undefined) data.system.sensorial = 0;
            if (data.system.estrutural === undefined) data.system.estrutural = 0;
            if (data.system.reator === undefined) data.system.reator = 0;
            if (data.system.description === undefined) data.system.description = "";
        } else if (itemType === "blindagemExacom") {
            if (data.system.tipo === undefined) data.system.tipo = "";
            if (data.system.blindagem === undefined) data.system.blindagem = 0;
            if (data.system.descricao === undefined) data.system.descricao = "";
            if (data.system.especial === undefined) data.system.especial = "";
            if (data.system.description === undefined) data.system.description = "";
        }
        
        console.log(`[Rising Steel] Atributos inicializados para item tipo ${itemType}:`, data.system);
    }
});

Hooks.on("renderChatMessage", (message, html) => {
    const rsFlags = message.flags?.["rising-steel"];
    if (!rsFlags || rsFlags.rollType !== "success-pool") return;

    // Verificar se é um blind roll ou GM roll
    // Se for blind roll e o usuário não for GM, não exibir informações
    const rollMode = message.flags?.core?.rollMode || message.rollMode || message.getFlag?.("core", "rollMode");
    const isBlindRoll = rollMode === "blindroll" || rollMode === "gmroll";
    const isGM = game.user.isGM;
    
    // Verificar também se o HTML contém elementos ocultos (indicando blind roll)
    // O FoundryVTT oculta os dados em blind rolls mostrando "???"
    const diceRollElement = html.find(".dice-roll");
    const hasHiddenRoll = diceRollElement.length > 0 && (
        diceRollElement.text().includes("???") || 
        diceRollElement.find(".dice-result").text().includes("???") ||
        diceRollElement.find(".dice-total").text().includes("???")
    );
    
    // Se for blind roll e o usuário não for GM, não processar
    if ((isBlindRoll || hasHiddenRoll) && !isGM) {
        return;
    }

    const diceInfo = rsFlags.diceInfo || [];
    const totalSuccesses = Number(rsFlags.successes ?? 0);

    const updateSuccessLabel = () => {
        const rollBlocks = html.find(".dice-roll");
        if (rollBlocks.length === 0) return;

        const firstBlock = $(rollBlocks[0]);
        if (firstBlock.length && firstBlock.text().includes("???") && !isGM) {
            return;
        }

        // Calcular sucessos por tipo (normal, bonus, exapoint)
        let sucessosPadrao = 0;
        let sucessosBonus = 0;
        let sucessosExa = 0;

        diceInfo.forEach(info => {
            const resultados = info.results || [];
            const successesPerBlock = resultados.filter(r => (r.result ?? r.total) === 6).length;
            if (info.type === "normal") sucessosPadrao += successesPerBlock;
            else if (info.type === "bonus") sucessosBonus += successesPerBlock;
            else if (info.type === "exapoint") sucessosExa += successesPerBlock;
        });

        const partes = [];
        if (sucessosPadrao > 0) partes.push(`Padrão (${sucessosPadrao})`);
        if (sucessosBonus > 0) partes.push(`Bônus (${sucessosBonus})`);
        if (sucessosExa > 0) partes.push(`EXApoints (${sucessosExa})`);

        let label = "";
        if (partes.length > 0) {
            label = `Sucessos: ${partes.join(" | ")} | Total: ${totalSuccesses}`;
        } else {
            label = totalSuccesses === 1 ? "1 Sucesso" : `${totalSuccesses} Sucessos`;
        }

        // Limpar mensagens antigas para evitar repetições
        html.find(".rs-success-label").remove();

        // Substituir o total geral (mesmo dentro do bloco) pela mensagem de sucessos
        let applied = false;
        const allTotals = html.find("h4.dice-total, .dice-total");
        for (let i = allTotals.length - 1; i >= 0; i--) {
            const $el = $(allTotals[i]);
            const text = $el.text().trim();
            if (text.includes("???")) continue;
            // Só uma aplicação
            $el.text(label)
               .css({ "font-size": "16px", "font-weight": "bold" })
               .addClass("rs-success-label");
            // Remover textos numéricos de outros totais para não duplicar
            for (let j = 0; j < i; j++) {
                const $prev = $(allTotals[j]);
                if (!$prev.text().includes("???")) {
                    $prev.text("");
                }
            }
            applied = true;
            break;
        }

        // Se não encontrou nenhum total, insere abaixo do último bloco
        if (!applied) {
            const lastRoll = html.find(".dice-roll").last();
            if (lastRoll.length) {
                const newDiv = $(`<div class="rs-success-label" style="font-size: 16px; font-weight: bold; margin-top: 6px;">${label}</div>`);
                lastRoll.after(newDiv);
            }
        }
    };

    // Rodar após render e novamente para pegarmos expansões
    setTimeout(updateSuccessLabel, 120);
    setTimeout(updateSuccessLabel, 400);
    setTimeout(updateSuccessLabel, 800);
});

// Customizar visualização dos itens do compendium em formato de tabela
Hooks.on("renderCompendiumDirectory", (app, html, data) => {
    // Verificar se é um pack de itens do sistema Rising Steel
    const packId = app.collection?.metadata?.id || app.collection?.metadata?.name || "";
    const isRisingSteel = packId.includes("rising-steel");
    const isTargetPack = packId.includes("armaduras") || packId.includes("armas") || packId.includes("equipamentos");
    
    if (!isRisingSteel || !isTargetPack) {
        return;
    }

    // Aguardar o conteúdo ser renderizado
    setTimeout(async () => {
        const directoryItems = html.find(".directory-item");
        
        if (directoryItems.length === 0) return;

        // Determinar o tipo de pack
        const isArmaduras = packId.includes("armaduras");
        const isArmas = packId.includes("armas");
        const isEquipamentos = packId.includes("equipamentos");
        const isExacom = packId.includes("exacom");

        // Carregar os documentos completos para obter os dados do system
        const pack = game.packs.get(packId);
        if (!pack) return;

        try {
            const documents = await pack.getDocuments();
            
            // Criar tabela
            const tableContainer = $('<div class="rising-steel-compendium-table"></div>');
            const table = $('<table class="rising-steel-compendium-items-table"></table>');
            const thead = $('<thead></thead>');
            const tbody = $('<tbody></tbody>');

            // Definir cabeçalhos baseado no tipo
            let headers = [];
            if (isArmaduras) {
                headers = ['Nome', 'Tipo', 'Proteção', 'Peso', 'Especial'];
            } else if (isArmas) {
                headers = ['Nome', 'Tipo', 'Dano', 'Alcance', 'Peso', 'Especial'];
            } else if (isEquipamentos) {
                headers = ['Nome', 'Tipo', 'Efeito', 'Peso'];
            } else if (isExacom) {
                headers = ['Modelo', 'Neuromotor', 'Sensorial', 'Estrutural', 'Reator'];
            }

            const headerRow = $('<tr></tr>');
            headers.forEach(header => {
                headerRow.append($(`<th>${header}</th>`));
            });
            thead.append(headerRow);
            table.append(thead);

            // Adicionar linhas para cada item
            documents.forEach(doc => {
                const row = $('<tr class="compendium-item-row" data-item-id="' + doc.id + '"></tr>');
                
                if (isArmaduras) {
                    row.append($(`<td><strong>${doc.name}</strong></td>`));
                    row.append($(`<td>${doc.system?.tipo || '-'}</td>`));
                    row.append($(`<td>${doc.system?.protecao || '-'}</td>`));
                    row.append($(`<td>${doc.system?.peso || '-'} kg</td>`));
                    row.append($(`<td><small>${doc.system?.especial || '-'}</small></td>`));
                } else if (isArmas) {
                    row.append($(`<td><strong>${doc.name}</strong></td>`));
                    row.append($(`<td>${doc.system?.tipo || '-'}</td>`));
                    row.append($(`<td>${doc.system?.dano || '-'}</td>`));
                    row.append($(`<td>${doc.system?.alcance || '-'}</td>`));
                    row.append($(`<td>${doc.system?.peso || '-'} kg</td>`));
                    row.append($(`<td><small>${doc.system?.especial || '-'}</small></td>`));
                } else if (isEquipamentos) {
                    row.append($(`<td><strong>${doc.name}</strong></td>`));
                    row.append($(`<td>${doc.system?.tipo || '-'}</td>`));
                    row.append($(`<td><small>${doc.system?.efeito || '-'}</small></td>`));
                    row.append($(`<td>${doc.system?.peso || '-'} kg</td>`));
                } else if (isExacom) {
                    row.append($(`<td><strong>${doc.name}</strong></td>`));
                    row.append($(`<td>${doc.system?.neuromotor ?? '-'}</td>`));
                    row.append($(`<td>${doc.system?.sensorial ?? '-'}</td>`));
                    row.append($(`<td>${doc.system?.estrutural ?? '-'}</td>`));
                    row.append($(`<td><small>${doc.system?.reator || '-'}</small></td>`));
                }

                // Tornar a linha clicável para abrir o item
                row.on('click', async (e) => {
                    if (!$(e.target).is('a')) {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            // Abrir o sheet do item do compendium
                            if (doc.sheet) {
                                doc.sheet.render(true);
                            } else {
                                // Se não tiver sheet disponível, usar o método padrão do Foundry
                                const uuid = doc.uuid || `Compendium.${packId}.${doc.id}`;
                                const item = await fromUuid(uuid);
                                if (item && item.sheet) {
                                    item.sheet.render(true);
                                }
                            }
                        } catch (error) {
                            console.error("[Rising Steel] Erro ao abrir item do compendium:", error, doc);
                        }
                    }
                });
                row.css('cursor', 'pointer');

                tbody.append(row);
            });

            table.append(tbody);
            tableContainer.append(table);

            // Substituir a lista padrão pela tabela
            const directoryList = html.find('.directory-list');
            if (directoryList.length) {
                directoryList.hide();
                directoryList.after(tableContainer);
            } else {
                // Se não encontrar .directory-list, tentar adicionar após o header
                const directoryHeader = html.find('.directory-header');
                if (directoryHeader.length) {
                    directoryHeader.after(tableContainer);
                } else {
                    html.append(tableContainer);
                }
            }
        } catch (error) {
            console.error("[Rising Steel] Erro ao renderizar tabela do compendium:", error);
        }
    }, 100);
});

// Filtrar tipos de itens ao criar item no compendium
// Interceptar quando o compendium é renderizado para modificar CONFIG.Item.types
Hooks.on("renderCompendium", (app, html, data) => {
    const packId = app.collection?.metadata?.id || "";
    const isRisingSteel = packId.includes("rising-steel");
    const isTargetPack = packId.includes("armaduras") || packId.includes("armas") || packId.includes("equipamentos") || packId.includes("exacom");
    
    if (isRisingSteel && isTargetPack) {
        // Modificar CONFIG.Item.types para ter apenas os tipos relevantes
        // Isso afeta o diálogo de criação
        CONFIG.Item.types = ["armadura", "arma", "equipamento", "exacomModel"];
        
        // Interceptar o botão de criar ANTES do diálogo ser criado
        html.find('button[data-action="create"]').off('click.rising-steel-types').on('click.rising-steel-types', (event) => {
            // Garantir tipos ANTES do template ser renderizado
            CONFIG.Item.types = ["armadura", "arma", "equipamento", "exacomModel"];
            console.log("[Rising Steel] CONFIG.Item.types definido antes do diálogo:", CONFIG.Item.types);
        });
    }
});

// Interceptar ANTES do diálogo ser renderizado para garantir que CONFIG.Item.types está correto
// Isso é crítico porque o template do Foundry lê CONFIG.Item.types quando prepara os dados
console.log("[Rising Steel] Registrando hook preRenderDialog no nível do módulo");
Hooks.on("preRenderDialog", (app, data, options) => {
    // Verificar se é um diálogo de criação de item ou actor
    const dialogTitle = app.options?.title || app.title || options?.title || "";
    const isCreateActorDialog = dialogTitle.includes("Create") && dialogTitle.includes("Actor");
    const isCreateItemDialog = dialogTitle.includes("Create") && dialogTitle.includes("Item");
    
    // Se for um diálogo de criação de Actor, não aplicar filtros de Item
    if (isCreateActorDialog) {
        return;
    }
    
    // Verificar se o diálogo tem um pack associado
    let packId = app.options?.pack || options?.pack || "";
    let isRisingSteel = packId.includes("rising-steel");
    let isTargetPack = packId.includes("armaduras") || packId.includes("armas") || packId.includes("equipamentos") || packId.includes("exacom");
    
    // Se não encontrou pelo packId, verificar nas janelas abertas
    if (!isRisingSteel || !isTargetPack) {
        const activeWindows = Object.values(ui.windows || {});
        for (const window of activeWindows) {
            if (window.collection && window.collection.metadata) {
                const wPackId = window.collection.metadata.id || "";
                if (wPackId.includes("rising-steel") && 
                    (wPackId.includes("armaduras") || wPackId.includes("armas") || wPackId.includes("equipamentos") || wPackId.includes("exacom"))) {
                    isRisingSteel = true;
                    isTargetPack = true;
                    packId = wPackId;
                    break;
                }
            }
        }
    }
    
    // Aplicar filtro APENAS se for um diálogo de criação de item OU se for um compendium do Rising Steel de itens
    if (isCreateItemDialog || (isRisingSteel && isTargetPack)) {
        // Garantir que CONFIG.Item.types está correto ANTES do template ser renderizado
        CONFIG.Item.types = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom"];
        console.log("[Rising Steel] preRenderDialog - CONFIG.Item.types definido:", CONFIG.Item.types);
        
        // Se o data tem tipos, filtrar também
        if (data && data.types) {
            const allowed = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom"];
            data.types = data.types.filter(t => allowed.includes(t));
        }
    }
});

// Interceptar quando qualquer diálogo é renderizado para garantir filtro
// Este hook é registrado no nível do módulo para garantir que seja executado
console.log("[Rising Steel] Registrando hook renderDialog no nível do módulo");
Hooks.on("renderDialog", (app, html, data) => {
    // Verificar se é um diálogo de criação de item ou actor
    const dialogTitle = app.options?.title || app.title || "";
    const isCreateActorDialog = dialogTitle.includes("Create") && dialogTitle.includes("Actor");
    const isCreateItemDialog = dialogTitle.includes("Create") && dialogTitle.includes("Item");
    
    // Se for um diálogo de criação de Actor, não aplicar filtros de Item
    if (isCreateActorDialog) {
        console.log("[Rising Steel] renderDialog - Diálogo de criação de Actor detectado, ignorando filtros de Item");
        return;
    }
    
    console.log("[Rising Steel] renderDialog chamado", {
        title: dialogTitle,
        pack: app.options?.pack || app.data?.pack || "",
        hasTypeSelect: html.find('select[name="type"]').length > 0,
        appClass: app.constructor?.name || "unknown",
        isCreateItemDialog: isCreateItemDialog,
        isCreateActorDialog: isCreateActorDialog
    });
    
    const typeSelect = html.find('select[name="type"]');
    if (!typeSelect.length) {
        // Tentar encontrar o select de outra forma
        const allSelects = html.find('select');
        console.log("[Rising Steel] renderDialog - Nenhum select[name='type'] encontrado, mas há", allSelects.length, "selects no diálogo");
        if (allSelects.length > 0) {
            console.log("[Rising Steel] renderDialog - Primeiro select:", allSelects.first().attr('name'), allSelects.first().html());
        }
        return;
    }
    
    console.log("[Rising Steel] renderDialog - Select de tipo encontrado, opções atuais:", 
        typeSelect.find('option').map((i, opt) => $(opt).val()).get());
    
    // Verificar se o diálogo tem um pack associado
    let packId = app.options?.pack || app.data?.pack || "";
    let isRisingSteel = packId.includes("rising-steel");
    let isTargetPack = packId.includes("armaduras") || packId.includes("armas") || packId.includes("equipamentos") || packId.includes("exacom") || packId.includes("blindagemExacom");
    
    // Se não encontrou pelo packId, verificar nas janelas abertas
    if (!isRisingSteel || !isTargetPack) {
        const activeWindows = Object.values(ui.windows || {});
        for (const window of activeWindows) {
            if (window.collection && window.collection.metadata) {
                const wPackId = window.collection.metadata.id || "";
                if (wPackId.includes("rising-steel") && 
                    (wPackId.includes("armaduras") || wPackId.includes("armas") || wPackId.includes("equipamentos") || wPackId.includes("exacom") || wPackId.includes("blindagemExacom"))) {
                    isRisingSteel = true;
                    isTargetPack = true;
                    packId = wPackId;
                    break;
                }
            }
        }
    }
    
    // Aplicar filtro APENAS se for um diálogo de criação de item OU se for um compendium do Rising Steel de itens
    if (isCreateItemDialog || (isRisingSteel && isTargetPack)) {
        // Garantir que CONFIG.Item.types está correto
        CONFIG.Item.types = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom"];
        
        // Filtrar o select usando MutationObserver para garantir que funcione mesmo com opções dinâmicas
        const allowedTypes = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom"];
        
        const filterOptions = () => {
            let changed = false;
            typeSelect.find('option').each(function() {
                const value = $(this).val();
                if (value && !allowedTypes.includes(value)) {
                    $(this).remove();
                    changed = true;
                }
            });
            // Garantir que uma opção válida está selecionada
            if (typeSelect.find('option:selected').length === 0 || !allowedTypes.includes(typeSelect.val())) {
                typeSelect.find('option').first().prop('selected', true);
            }
            if (changed) {
                console.log("[Rising Steel] Tipos filtrados no diálogo:", allowedTypes);
            }
        };
        
        // Filtrar imediatamente
        filterOptions();
        
        // Filtrar novamente após um pequeno delay para garantir
        setTimeout(filterOptions, 100);
        setTimeout(filterOptions, 300);
        
        // Usar MutationObserver para filtrar opções adicionadas dinamicamente
        if (typeSelect.length && typeSelect[0]) {
            const observer = new MutationObserver(() => {
                filterOptions();
            });
            
            observer.observe(typeSelect[0], { childList: true, subtree: true });
            
            // Limpar observer quando o diálogo for fechado
            const originalClose = app.close?.bind(app);
            if (originalClose) {
                app.close = function(...args) {
                    observer.disconnect();
                    return originalClose.apply(this, args);
                };
            }
        }
    }
});

// Funções para importar itens dos arquivos para os packs
window.RisingSteel = window.RisingSteel || {};

async function ensurePackFilled(packId, importFn, label) {
    const pack = game.packs.get(packId);
    if (!pack) {
        console.warn(`[Rising Steel] Pack ${label} (${packId}) não encontrado.`);
        return;
    }

    await pack.getIndex();
    if (pack.index.size === 0) {
        console.log(`[Rising Steel] Pack de ${label} vazio. Importando automaticamente...`);
        await importFn();
    }
}

/**
 * Gera um ID único no formato exigido pelo Foundry v13:
 * 16 caracteres alfanuméricos (sem hífens).
 * @param {string} name - Nome do item (não é usado diretamente, mas mantido por compatibilidade)
 * @returns {string} - ID único gerado
 */
function generateItemId(name) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 16; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        id += chars[idx];
    }
    return id;
}

/**
 * Adiciona IDs explícitos a um array de dados de itens
 * @param {Array} itemsData - Array de dados de itens
 * @returns {Array} - Array com IDs adicionados
 */
function addIdsToItems(itemsData) {
    return itemsData.map(item => ({
        ...item,
        _id: generateItemId(item.name)
    }));
}

/**
 * Importa armaduras do CSV para o compendium
 * Esta função limpa completamente o compendium e importa apenas as 7 armaduras corretas
 * IMPORTANTE: Esta função NÃO é executada automaticamente - deve ser chamada manualmente
 */
window.RisingSteel.importArmaduras = async function() {
    // Dados das armaduras do CSV
    const armadurasData = [
        {
            "name": "Colete Balístico",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Leve",
                "protecao": 10,
                "peso": 3,
                "descricao": "Colete com camadas de proteção contra balas e fragmentos. Ideal para operações táticas e combate urbano.",
                "especial": ""
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Armadura de Combate Tático",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Leve",
                "protecao": 15,
                "peso": 5,
                "descricao": "Armadura com placas de proteção em kevlar e mobilidade melhorada, adequada para combate em ambientes variados.",
                "especial": ""
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Armadura de Placas Cerâmicas",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Média",
                "protecao": 20,
                "peso": 10,
                "descricao": "Armadura com placas de cerâmica, oferece excelente proteção em combate.",
                "especial": "Penalidade: 1\nRequisito: FOR 3"
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Armadura de Proteção Modular",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Média",
                "protecao": 20,
                "peso": 7,
                "descricao": "Armadura com módulos intercambiáveis para diferentes tipos de proteção, versátil e adaptável.",
                "especial": "Penalidade: 1\n+2 em testes de consertar armadura\nRequisito: FOR 3"
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Armadura de Combate Pesada",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Pesada",
                "protecao": 30,
                "peso": 10,
                "descricao": "Armadura completa com placas reforçadas e acolchoamento, ideal para situações de combate extremo.",
                "especial": "Penalidade: 3\nReforçada\n-1 Esquiva\n-3 Iniciativa\nRequisito: FOR 4"
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Escudo Balístico de Nível I",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Leve",
                "protecao": 10,
                "peso": 10,
                "descricao": "Escudo de liga leve de polímeros. Absorve impactos moderados sem comprometer a mobilidade.",
                "especial": "Penalidade: 1\nReforçada\nIncapaz de equipar armas de 2 mãos\nRequisito: FOR 3"
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Escudo Balístico de Nível II",
            "type": "armadura",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Armadura Pesada",
                "protecao": 20,
                "peso": 20,
                "descricao": "Escudo com estrutura de compósito avançado com núcleo metálico. Oferece resistência superior contra projéteis e golpes contundentes às custas da Mobilidade.",
                "especial": "Penalidade: 2\nReforçada\nIncapaz de equipar armas de 2 mãos\n-1 Esquiva\nRequisito: FOR 4"
            },
            "flags": {},
            "effects": []
        }
    ];
    
    const pack = game.packs.get("rising-steel.armaduras");
    if (!pack) {
        ui.notifications.error("Pack de armaduras não encontrado!");
        return;
    }
    
    if (!game.user.isGM) {
        ui.notifications.error("Apenas o GM pode importar armaduras!");
        return;
    }
    
    try {
        console.log(`[Rising Steel] Iniciando importação de armaduras...`);
        
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({locked: false});
        }
        
        // Limpar compendium: obter todos os itens existentes e deletar
        console.log(`[Rising Steel] Limpando compendium existente...`);
        await pack.getIndex({force: true});
        
        const existingItems = await pack.getDocuments();
        if (existingItems && existingItems.length > 0) {
            const itemIds = existingItems
                .filter(item => item && (item.id || item._id))
                .map(item => item.id || item._id);
            
            if (itemIds.length > 0) {
                await Item.deleteDocuments(itemIds, {pack: pack.collection});
                console.log(`[Rising Steel] ${itemIds.length} armaduras antigas removidas`);
                // Aguardar processamento
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Adicionar IDs explícitos aos itens
        const armadurasDataWithIds = addIdsToItems(armadurasData);
        
        // Criar os itens
        const created = await Item.createDocuments(armadurasDataWithIds, {
            pack: pack.collection
        });
        
        // Bloquear o pack novamente
        await pack.configure({locked: true});
        
        // Recarregar o índice
        await pack.getIndex({force: true});
        
        ui.notifications.info(`Importadas ${created.length} armaduras com sucesso!`);
        console.log(`[Rising Steel] ✅ Importadas ${created.length} armaduras com sucesso`);
        
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar armaduras:", error);
        ui.notifications.error("Erro ao importar armaduras. Verifique o console.");
    }
};

window.RisingSteel.importEquipamentos = async function() {
    const equipamentosData = [
        {"name":"Kit de Primeiros Socorros","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Reduz marcações de dano leve baseado em sucessos de teste de conhecimento.","peso":0.5,"descricao":"Contém bandagens, antissépticos e medicamentos básicos."},"flags":{},"effects":[]},
        {"name":"Kit de Cirurgia de Campo - Model 4x","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Reduz marcações de dano moderado (cada marcação de dano moderado equivale a três marcações de dano leve) baseado em sucessos de teste de conhecimento. Permite um teste de conhecimento para estabilizar um indivíduo incapacitado por dano grave.","peso":5,"descricao":"Kit compacto e especializado para procedimentos cirúrgicos em condições adversas, incluindo instrumentos esterilizados, iluminação LED e mini fonte de energia."},"flags":{},"effects":[]},
        {"name":"MedPod X-500","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Permite um teste de conhecimento para estabilizar um indivíduo incapacitado por dano grave, e um teste para reanimar alguém em coma.","peso":30,"descricao":"Estação de tratamento de feridos portátil de última geração para cuidados médicos avançados em qualquer ambiente, desde zonas de combate até expedições remotas."},"flags":{},"effects":[]},
        {"name":"Lanterna Tática","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Ilumina uma área de 10 metros de raio, com intensidade ajustável.","peso":0.4,"descricao":"Lanterna resistente com várias configurações de iluminação."},"flags":{},"effects":[]},
        {"name":"Binóculos","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Permite observar alvos a até 200 metros de distância com detalhes ampliados.","peso":0.6,"descricao":"Binóculos compactos com zoom ajustável."},"flags":{},"effects":[]},
        {"name":"GPS Portátil","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Fornece coordenadas e navegação em terreno desconhecido.","peso":0.3,"descricao":"Dispositivo de navegação com mapas e rastreamento de localização."},"flags":{},"effects":[]},
        {"name":"Corda de Escalada","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Corda de 15 metros que suporta até 500 kg, ideal para escalada e rappelling.","peso":1,"descricao":"Corda resistente e leve para escalada e resgate."},"flags":{},"effects":[]},
        {"name":"Kit de Ferramentas Multifunções","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Inclui alicate, faca, chave de fenda e outras ferramentas básicas.","peso":0.7,"descricao":"Ferramenta compacta com várias funções, útil para reparos e manutenção."},"flags":{},"effects":[]},
        {"name":"Kit de Hackeamento Tático - H9X","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Inclui um tablet de alto desempenho com software de penetração e ferramentas de exploração de vulnerabilidades pré-instaladas.","peso":0.5,"descricao":"Solução compacta e poderosa para especialistas em cibersegurança em campo."},"flags":{},"effects":[]},
        {"name":"Cantil Tático","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Capacidade de 1 litro, mantém água fria ou quente.","peso":0.3,"descricao":"Cantil durável e isolado que pode ser instalado em qualquer modelo de armadura de combate."},"flags":{},"effects":[]},
        {"name":"Rádio de Comunicação","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Permite comunicação em distâncias de até 10 km, com opções de canais.","peso":0.5,"descricao":"Rádio portátil com alcance de comunicação e função de emergência."},"flags":{},"effects":[]},
        {"name":"Kit de Sobrevivência","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Contém itens essenciais como isqueiro, fósforos, abridor de latas e utensílios para pesca.","peso":0.8,"descricao":"Kit compacto com ferramentas e suprimentos para situações de emergência."},"flags":{},"effects":[]},
        {"name":"Capa de Chuva","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Utilitário","efeito":"Protege contra chuva e vento, pode ser compactada para transporte.","peso":0.2,"descricao":"Capa leve e impermeável, ideal para condições meteorológicas adversas."},"flags":{},"effects":[]},
        {"name":"Óculos de Visão Noturna","type":"equipamento","img":"icons/svg/item-bag.svg","system":{"tipo":"Equipamento de Visão","efeito":"Permite ver em condições de pouca luz ou escuridão total.","peso":0.8,"descricao":"Óculos especializados para visão noturna, ideal para operações em ambientes escuros."},"flags":{},"effects":[]}
    ];
    
    const pack = game.packs.get("rising-steel.equipamentos");
    if (!pack) {
        ui.notifications.error("Pack de equipamentos não encontrado!");
        return;
    }
    
    try {
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({locked: false});
        }
        
        // Deletar todos os itens existentes primeiro
        try {
            const existingItems = await pack.getDocuments();
            if (existingItems && existingItems.length > 0) {
                const validItemIds = existingItems
                    .filter(item => item && (item.id || item._id))
                    .map(item => item.id || item._id);
                
                if (validItemIds.length > 0) {
                    await Item.deleteDocuments(validItemIds, {pack: pack.collection});
                    console.log(`[Rising Steel] Removidos ${validItemIds.length} equipamentos antigos`);
                }
            }
        } catch (error) {
            console.warn(`[Rising Steel] Erro ao remover equipamentos antigos (continuando mesmo assim):`, error);
        }
        
        // Adicionar IDs explícitos aos itens
        const equipamentosDataWithIds = addIdsToItems(equipamentosData);
        
        // Criar os itens usando a API correta do Foundry VTT v13
        const created = await Item.createDocuments(equipamentosDataWithIds, {
            pack: pack.collection
        });
        
        // Bloquear o pack novamente após a importação
        await pack.configure({locked: true});
        
        ui.notifications.info(`Importados ${created.length} equipamentos com sucesso!`);
        console.log(`[Rising Steel] Importados ${created.length} equipamentos`);
        
        // Recarregar o índice do pack para atualizar a lista
        await pack.getIndex({force: true});
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar equipamentos:", error);
        ui.notifications.error("Erro ao importar equipamentos. Verifique o console.");
    }
};

/**
 * Importa armas do CSV para o compendium
 * Esta função limpa completamente o compendium e importa apenas as armas corretas do CSV
 * IMPORTANTE: Esta função NÃO é executada automaticamente - deve ser chamada manualmente
 */
window.RisingSteel.importArmas = async function() {
    // Dados das armas do CSV
    const armasData = [
        {
            "name": "K-Bar Combat Knife",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Faca",
                "dano": 2,
                "alcance": "Engajado (1)",
                "peso": 0.7,
                "descricao": "Faca de combate robusta e durável, ideal para situações de combate próximo.",
                "especial": "",
                "bonus": 3
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Tanto",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Faca",
                "dano": 2,
                "alcance": "Engajado (1)",
                "peso": 0.6,
                "descricao": "Faca de lâmina afiada, ideal para ataques rápidos e precisos.",
                "especial": "",
                "bonus": 3
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Machete",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Faca",
                "dano": 3,
                "alcance": "Engajado (1)",
                "peso": 0.9,
                "descricao": "Faca de lâmina larga, útil para cortar vegetação e em combate corpo a corpo.",
                "especial": "",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Tomahawk",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Machadinha",
                "dano": 3,
                "alcance": "Engajado (1)",
                "peso": 0.8,
                "descricao": "Machadinha leve, pode ser usada tanto em combate corpo a corpo quanto como arma de arremesso.",
                "especial": "",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Glock 17",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Pistola",
                "dano": 4,
                "alcance": "Distância (12)",
                "peso": 0.8,
                "descricao": "Pistola semi-automática conhecida por sua durabilidade e precisão.",
                "especial": "Ignora Penalidade",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Uzi Pro",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Submetralhadora",
                "dano": 4,
                "alcance": "Distância (14)",
                "peso": 2.5,
                "descricao": "Submetralhadora compacta, ideal para combate em ambientes fechados.",
                "especial": "Rajada 2",
                "bonus": 1
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "MP5",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Submetralhadora",
                "dano": 5,
                "alcance": "Distância (16)",
                "peso": 2.5,
                "descricao": "Submetralhadora com alta cadência de tiro e controle excelente.",
                "especial": "Rajada 1",
                "bonus": 1
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Crossbow (Arbalete)",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Arbalete",
                "dano": 5,
                "alcance": "Distância (10)",
                "peso": 2.5,
                "descricao": "Arma de longo alcance com alta precisão, eficaz para ataques furtivos.",
                "especial": "Silenciosa",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Remington 870",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Espingarda",
                "dano": 6,
                "alcance": "Distância (14)",
                "peso": 3.4,
                "descricao": "Espingarda de repetição com grande poder de impacto, eficaz a curta distância.",
                "especial": "Spread 2",
                "bonus": 1
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Beretta 92FS",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Pistola",
                "dano": 6,
                "alcance": "Distância (12)",
                "peso": 1,
                "descricao": "Pistola de 9mm com boa capacidade de munição e precisão confiável.",
                "especial": "Ignora Penalidade",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Mossberg 500",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Escopeta",
                "dano": 6,
                "alcance": "Distância (10)",
                "peso": 3.5,
                "descricao": "Escopeta de repetição com eficácia em combate a curta distância e alta versatilidade.",
                "especial": "Ignora Penalidade\nSpread 2",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "AK-47",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Fuzil de Assalto",
                "dano": 6,
                "alcance": "Distância (20)",
                "peso": 4.5,
                "descricao": "Fuzil robusto e confiável, com alta cadência de tiro e impacto potente.",
                "especial": "Rajada 2",
                "bonus": 1
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "M4 Carbine",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Fuzil de Assalto",
                "dano": 8,
                "alcance": "Distância (20)",
                "peso": 3,
                "descricao": "Fuzil compacto e versátil, com precisão e capacidade de disparo automático.",
                "especial": "Rajada 1",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "RPG-7",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Lançador de Foguetes",
                "dano": 16,
                "alcance": "Distância (40)",
                "peso": 10,
                "descricao": "Lançador de foguetes antitanque com alto poder destrutivo, ideal para alvos blindados.",
                "especial": "Titan Killer\nMirar 1",
                "bonus": 1
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Barrett M82",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Rifle de Precisão",
                "dano": 18,
                "alcance": "Distância (80)",
                "peso": 14,
                "descricao": "Fuzil de precisão de longo alcance, ideal para tiros a grandes distâncias.",
                "especial": "Ignora Armadura.\nMirar 1",
                "bonus": 1
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "FR-15 Shredder",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Granada de Mão",
                "dano": 10,
                "alcance": "Distância (8)",
                "peso": 0.5,
                "descricao": "Uma granada de corpo serrilhado em aço temperado. Ao detonar, lança centenas de pequenos cubos metálicos em 360 graus. É o padrão-ouro para limpeza de infantaria.",
                "especial": "Área - Quadrado (3)",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "FL-9 Supernova",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Granada de Mão",
                "dano": 0,
                "alcance": "Distância (8)",
                "peso": 0.5,
                "descricao": "Ao detonar, emite um clarão intenso e um som alto, causando cegueira e surdez temporárias em todos dentro de um raio de efeito, tornando-os alvos fáceis por um curto período.",
                "especial": "Área - Quadrado (3)\nContínuo 3",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "SM-12 Shroud",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Granada de Mão",
                "dano": 0,
                "alcance": "Distância (8)",
                "peso": 0.5,
                "descricao": "Cria uma densa cortina de fumaça, bloqueando a linha de visão e proporcionando cobertura para movimentos táticos ou retiradas.",
                "especial": "Área - Quadrado (3)",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "IN-75 Cinder",
            "type": "arma",
            "img": "icons/svg/item-bag.svg",
            "system": {
                "tipo": "Granada de Mão",
                "dano": 6,
                "alcance": "Distância (8)",
                "peso": 1,
                "descricao": "Diferente das outras, ela não explode; ela \"derrete\". Ao ser ativada, a mistura interna de alumínio e óxido de ferro (termite) ou fósforo branco consome-se em uma chama branca intensa que atinge até 2.200°C.",
                "especial": "Área - Quadrado (3)\nContínuo 3",
                "bonus": 2
            },
            "flags": {},
            "effects": []
        }
    ];
    
    const pack = game.packs.get("rising-steel.armas");
    if (!pack) {
        ui.notifications.error("Pack de armas não encontrado!");
        return;
    }
    
    if (!game.user.isGM) {
        ui.notifications.error("Apenas o GM pode importar armas!");
        return;
    }
    
    try {
        console.log(`[Rising Steel] Iniciando importação de armas...`);
        
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({locked: false});
        }
        
        // Limpar compendium: obter todos os itens existentes e deletar
        console.log(`[Rising Steel] Limpando compendium existente...`);
        await pack.getIndex({force: true});
        
        const existingItems = await pack.getDocuments();
        if (existingItems && existingItems.length > 0) {
            const itemIds = existingItems
                .filter(item => item && (item.id || item._id))
                .map(item => item.id || item._id);
            
            if (itemIds.length > 0) {
                await Item.deleteDocuments(itemIds, {pack: pack.collection});
                console.log(`[Rising Steel] ${itemIds.length} armas antigas removidas`);
                // Aguardar processamento
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Adicionar IDs explícitos aos itens
        const armasDataWithIds = addIdsToItems(armasData);
        
        // Criar os itens
        const created = await Item.createDocuments(armasDataWithIds, {
            pack: pack.collection
        });
        
        // Bloquear o pack novamente
        await pack.configure({locked: true});
        
        // Recarregar o índice
        await pack.getIndex({force: true});
        
        ui.notifications.info(`Importadas ${created.length} armas com sucesso!`);
        console.log(`[Rising Steel] ✅ Importadas ${created.length} armas com sucesso`);
        
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar armas:", error);
        ui.notifications.error("Erro ao importar armas. Verifique o console.");
    }
};

window.RisingSteel.importExacomModels = async function() {
    const modelosData = [
        {
            name: "Hawnkins",
            type: "exacomModel",
            img: "icons/svg/item-bag.svg",
            system: {
                modelo: "Hawnkins",
                neuromotor: 2,
                sensorial: 2,
                estrutural: 4,
                reator: "1"
            },
            flags: {},
            effects: []
        },
        {
            name: "Currie",
            type: "exacomModel",
            img: "icons/svg/item-bag.svg",
            system: {
                modelo: "Currie",
                neuromotor: 2,
                sensorial: 4,
                estrutural: 1,
                reator: "2"
            },
            flags: {},
            effects: []
        },
        {
            name: "Oppenheimer",
            type: "exacomModel",
            img: "icons/svg/item-bag.svg",
            system: {
                modelo: "Oppenheimer",
                neuromotor: 4,
                sensorial: 2,
                estrutural: 1,
                reator: "2"
            },
            flags: {},
            effects: []
        },
        {
            name: "Darwin",
            type: "exacomModel",
            img: "icons/svg/item-bag.svg",
            system: {
                modelo: "Darwin",
                neuromotor: 1,
                sensorial: 2,
                estrutural: 2,
                reator: "4"
            },
            flags: {},
            effects: []
        }
    ];

    const pack = game.packs.get("rising-steel.exacom");
    if (!pack) {
        ui.notifications.error("Pack de modelos EXAcom não encontrado!");
        return;
    }

    try {
        if (pack.locked) {
            await pack.configure({ locked: false });
        }

        try {
            const existingItems = await pack.getDocuments();
            if (existingItems && existingItems.length > 0) {
                const validItemIds = existingItems
                    .filter(item => item && (item.id || item._id))
                    .map(item => item.id || item._id);

                if (validItemIds.length > 0) {
                    await Item.deleteDocuments(validItemIds, { pack: pack.collection });
                    console.log(`[Rising Steel] Removidos ${validItemIds.length} modelos EXAcom antigos`);
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao remover modelos EXAcom antigos (continuando mesmo assim):", error);
        }

        const modelosDataWithIds = addIdsToItems(modelosData);

        const created = await Item.createDocuments(modelosDataWithIds, {
            pack: pack.collection
        });

        await pack.configure({ locked: true });

        ui.notifications.info(`Importados ${created.length} modelos EXAcom com sucesso!`);
        console.log(`[Rising Steel] Importados ${created.length} modelos EXAcom`);

        await pack.getIndex({ force: true });
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar modelos EXAcom:", error);
        ui.notifications.error("Erro ao importar modelos EXAcom. Verifique o console.");
    }
};

/**
 * Recria todos os compendiums (armaduras, equipamentos e armas) com IDs explícitos
 * Esta função limpa e recria todos os packs do zero
 */
window.RisingSteel.recriarTodosPacks = async function() {
    if (!game.user.isGM) {
        ui.notifications.error("Apenas o GM pode recriar os packs!");
        return;
    }
    
    try {
        ui.notifications.info("Iniciando recriação de todos os packs...");
        console.log("[Rising Steel] Recriando todos os packs com IDs explícitos...");
        
        // Recriar armaduras
        await window.RisingSteel.importArmaduras();
        
        // Recriar equipamentos
        await window.RisingSteel.importEquipamentos();
        
        // Recriar armas
        await window.RisingSteel.importArmas();

        // Recriar modelos EXAcom
        await window.RisingSteel.importExacomModels();
        await window.RisingSteel.importBlindagensExacom();
        await window.RisingSteel.importModulosExacom();
        
        ui.notifications.info("Todos os packs foram recriados com sucesso! Recarregue a página para aplicar as mudanças.");
        console.log("[Rising Steel] Todos os packs foram recriados com IDs explícitos!");
    } catch (error) {
        console.error("[Rising Steel] Erro ao recriar packs:", error);
        ui.notifications.error("Erro ao recriar packs. Verifique o console.");
    }
};

window.RisingSteel.importBlindagensExacom = async function() {
    const blindagensData = [
        {"name":"Blindagem EXAcom 1","type":"blindagemExacom","img":"icons/svg/shield.svg","system":{"tipo":"Blindagem Básica","blindagem":1,"descricao":"Blindagem básica para EXAcom. Oferece proteção mínima contra danos.","especial":""},"flags":{},"effects":[]},
        {"name":"Blindagem EXAcom 2","type":"blindagemExacom","img":"icons/svg/shield.svg","system":{"tipo":"Blindagem Intermediária","blindagem":2,"descricao":"Blindagem intermediária para EXAcom. Oferece proteção moderada contra danos.","especial":""},"flags":{},"effects":[]},
        {"name":"Blindagem EXAcom 3","type":"blindagemExacom","img":"icons/svg/shield.svg","system":{"tipo":"Blindagem Avançada","blindagem":3,"descricao":"Blindagem avançada para EXAcom. Oferece proteção superior contra danos.","especial":""},"flags":{},"effects":[]}
    ];
    
    const pack = game.packs.get("rising-steel.blindagemExacom");
    if (!pack) {
        ui.notifications.error("Pack de blindagens EXAcom não encontrado!");
        return;
    }
    
    try {
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({ locked: false });
        }
        
        // Limpar itens existentes
        const existingItems = await pack.getDocuments();
        if (existingItems.length > 0) {
            await Item.deleteDocuments(existingItems.map(i => i.id), { pack: pack.collection });
        }
        
        // Adicionar IDs aos itens
        const itemsWithIds = addIdsToItems(blindagensData);
        
        // Criar os itens no pack
        await Item.createDocuments(itemsWithIds, { pack: pack.collection });
        
        ui.notifications.info(`Blindagens EXAcom importadas com sucesso! (${itemsWithIds.length} itens)`);
        console.log("[Rising Steel] Blindagens EXAcom importadas:", itemsWithIds);
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar blindagens EXAcom:", error);
        ui.notifications.error("Erro ao importar blindagens EXAcom. Verifique o console.");
    }
};

window.RisingSteel.importModulosExacom = async function() {
    const modulosData = [
        {
            "name": "Escudo de Energia Primário",
            "type": "exacomModulo",
            "img": "icons/svg/shield.svg",
            "system": {
                "consumo": 1,
                "descricao": "Cria uma barreira protetora ao redor do EXA que absorve automaticamente (sem necessidade de teste de blindagem) até 2 sucessos em uma rolagem de ataque inimiga.",
                "custo": 1,
                "duracao": "Ativo até absorver 2 sucessos.",
                "tipo": "Ação/Defensivo"
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Sistema de Reparo Automático",
            "type": "exacomModulo",
            "img": "icons/svg/gear.svg",
            "system": {
                "consumo": 2,
                "descricao": "Sistema que repara automaticamente danos estruturais do EXAcom durante o combate. Restaura 1 ponto de dano estrutural a cada rodada.",
                "custo": 2,
                "duracao": "Ativo por 3 rodadas.",
                "tipo": "Ação/Passivo"
            },
            "flags": {},
            "effects": []
        },
        {
            "name": "Amplificador de Sincronia",
            "type": "exacomModulo",
            "img": "icons/svg/lightning.svg",
            "system": {
                "consumo": 3,
                "descricao": "Aumenta temporariamente a sincronia entre piloto e EXAcom, concedendo +2 em todas as rolagens de atributos de sistema.",
                "custo": 1,
                "duracao": "Ativo por 1 cena.",
                "tipo": "Ação/Buff"
            },
            "flags": {},
            "effects": []
        }
    ];
    
    // Tentar encontrar o pack de diferentes formas
    let pack = game.packs.get("rising-steel.modulosExacom");
    if (!pack) {
        // Tentar encontrar por nome alternativo
        pack = Array.from(game.packs.values()).find(p => 
            p.metadata?.name === "modulosExacom" || 
            p.metadata?.label === "Módulos EXAcom" ||
            (p.metadata?.name && p.metadata.name.toLowerCase().includes("modulo"))
        );
    }
    
    if (!pack) {
        ui.notifications.error("Pack de módulos EXAcom não encontrado! Certifique-se de que o sistema foi recarregado (F5) após a atualização.");
        console.error("[Rising Steel] Pack não encontrado. Packs disponíveis:", Array.from(game.packs.keys()));
        return;
    }
    
    try {
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({ locked: false });
        }
        
        // Limpar itens existentes
        try {
            const existingItems = await pack.getDocuments();
            if (existingItems && existingItems.length > 0) {
                const validItemIds = existingItems
                    .filter(item => item && (item.id || item._id))
                    .map(item => item.id || item._id);
                
                if (validItemIds.length > 0) {
                    await Item.deleteDocuments(validItemIds, { pack: pack.collection });
                    console.log(`[Rising Steel] Removidos ${validItemIds.length} módulos antigos`);
                }
            }
        } catch (error) {
            console.warn(`[Rising Steel] Erro ao remover módulos antigos (continuando mesmo assim):`, error);
        }
        
        // Adicionar IDs aos itens
        const itemsWithIds = addIdsToItems(modulosData);
        
        // Criar os itens no pack
        const created = await Item.createDocuments(itemsWithIds, { pack: pack.collection });
        
        // Bloquear o pack novamente após a importação
        await pack.configure({ locked: true });
        
        ui.notifications.info(`Módulos EXAcom importados com sucesso! (${created.length} itens)`);
        console.log(`[Rising Steel] Importados ${created.length} módulos EXAcom`);
        
        // Recarregar o índice do pack para atualizar a lista
        await pack.getIndex({ force: true });
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar módulos EXAcom:", error);
        ui.notifications.error("Erro ao importar módulos EXAcom. Verifique o console.");
    }
};


// Import Modules
import { RisingSteel } from "./config.js";
import { FoundryCompatibility } from "./utils/compatibility.js";
import { RisingSteelActor } from "./actor/actor.js";
import { RisingSteelPilotSheet } from "./actor/pilot-sheet.js";
import { RisingSteelCreatureSheet } from "./actor/creature-sheet.js";
import { RisingSteelCompanionSheet } from "./actor/companion-sheet.js";
import { RisingSteelItem } from "./item/item.js";
import { RisingSteelItemSheet } from "./item/item-sheet.js";
import { RisingSteelRollDialog } from "./app/roll-dialog.js";

/* ------------------------------------ */
/* Setup Rising Steel system	 */
/* ------------------------------------ */

Hooks.once("init", async function () {
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
            
            // Para cada combatant, verificar se é piloto e usar fórmula correta
            for (const id of ids) {
                const combatant = this.combatants.get(id);
                if (!combatant) continue;
                
                if (combatant.actor?.type === "piloto") {
                    const iniciativa = combatant.actor.system.combate?.iniciativa || 0;
                    if (iniciativa > 0) {
                        // Criar rolagem com fórmula correta
                        const roll = new Roll(`${iniciativa}d6`);
                        await roll.roll();
                        
                        // Atualizar a iniciativa do combatant
                        await combatant.update({ initiative: roll.total });
                        
                        // Exibir no chat
                        await roll.toMessage({
                            speaker: ChatMessage.getSpeaker({ actor: combatant.actor, token: combatant.token }),
                            flavor: `Rolagem de Iniciativa: ${iniciativa}d6`
                        });
                        
                        continue;
                    }
                }
                
                // Para não-pilotos, usar o método original
                await originalRollInitiative.call(this, [id], options);
            }
        };
    });

    CONFIG.RisingSteel = RisingSteel;
    CONFIG.Actor.documentClass = RisingSteelActor;
    CONFIG.Item.documentClass = RisingSteelItem;
    CONFIG.Actor.typeLabels = CONFIG.Actor.typeLabels || {};
    CONFIG.Actor.typeLabels.piloto = "Piloto";
    CONFIG.Actor.typeLabels.criatura = "Criatura";
    CONFIG.Actor.typeLabels.companion = "Companion";
    CONFIG.Actor.defaultType = "piloto";
    
    // Configurar labels para tipos de itens
    CONFIG.Item.typeLabels = CONFIG.Item.typeLabels || {};
    CONFIG.Item.typeLabels.armadura = "Armadura";
    CONFIG.Item.typeLabels.arma = "Arma";
    CONFIG.Item.typeLabels.equipamento = "Equipamento";
    
    // Modificar CONFIG.Item.types para ter apenas os tipos relevantes
    // Isso afeta todos os lugares onde os tipos são listados, incluindo compendiums
    CONFIG.Item.types = ["armadura", "arma", "equipamento"];
    
    // Salvar tipos originais de itens (caso precise restaurar)
    const originalItemTypes = ["item", "feature", "spell", "armadura", "arma", "equipamento"];
    
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
        
        // Verificar e importar armaduras se o pack estiver vazio
        if (game.user.isGM) {
            try {
                await ensurePackFilled("rising-steel.armaduras", window.RisingSteel.importArmaduras, "armaduras");
                await ensurePackFilled("rising-steel.armas", window.RisingSteel.importArmas, "armas");
                await ensurePackFilled("rising-steel.equipamentos", window.RisingSteel.importEquipamentos, "equipamentos");
            } catch (error) {
                console.warn("[Rising Steel] Erro ao verificar/importar packs:", error);
            }
        }
        
        // Garantir que CONFIG.Item.types está correto
        CONFIG.Item.types = ["armadura", "arma", "equipamento"];
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

Hooks.on("renderChatMessage", (message, html) => {
    const rsFlags = message.flags?.["rising-steel"];
    if (!rsFlags || rsFlags.rollType !== "success-pool") return;

    const successes = Number(rsFlags.successes ?? 0);
    const label = successes === 1 ? "1 Sucesso" : `${successes} Sucessos`;
    const totalEl = html.find("h4.dice-total");
    if (totalEl.length) {
        totalEl.text(label);
    }
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
    const isTargetPack = packId.includes("armaduras") || packId.includes("armas") || packId.includes("equipamentos");
    
    if (isRisingSteel && isTargetPack) {
        // Modificar CONFIG.Item.types para ter apenas os tipos relevantes
        // Isso afeta o diálogo de criação
        CONFIG.Item.types = ["armadura", "arma", "equipamento"];
        
        // Interceptar o botão de criar para garantir que os tipos estão corretos
        html.find('button[data-action="create"]').off('click.rising-steel-types').on('click.rising-steel-types', () => {
            CONFIG.Item.types = ["armadura", "arma", "equipamento"];
        });
    }
});

// Interceptar quando qualquer diálogo é renderizado para garantir filtro
Hooks.on("renderDialog", (app, html, data) => {
    const typeSelect = html.find('select[name="type"]');
    if (!typeSelect.length) return;
    
    // Verificar se o diálogo tem um pack associado
    const packId = app.options?.pack || app.data?.pack || "";
    const isRisingSteel = packId.includes("rising-steel");
    const isTargetPack = packId.includes("armaduras") || packId.includes("armas") || packId.includes("equipamentos");
    
    if (!isRisingSteel || !isTargetPack) {
        // Verificar se há um compendium ativo nas janelas abertas
        const activeWindows = Object.values(ui.windows || {});
        let foundTarget = false;
        
        for (const window of activeWindows) {
            if (window.collection && window.collection.metadata) {
                const wPackId = window.collection.metadata.id || "";
                if (wPackId.includes("rising-steel") && 
                    (wPackId.includes("armaduras") || wPackId.includes("armas") || wPackId.includes("equipamentos"))) {
                    foundTarget = true;
                    break;
                }
            }
        }
        
        if (!foundTarget) return;
    }
    
    // Garantir que CONFIG.Item.types está correto
    CONFIG.Item.types = ["armadura", "arma", "equipamento"];
    
    // Filtrar o select usando MutationObserver para garantir que funcione mesmo com opções dinâmicas
    const allowedTypes = ["armadura", "arma", "equipamento"];
    
    const filterOptions = () => {
        typeSelect.find('option').each(function() {
            const value = $(this).val();
            if (value && !allowedTypes.includes(value)) {
                $(this).remove();
            }
        });
        // Garantir que uma opção válida está selecionada
        if (typeSelect.find('option:selected').length === 0 || !allowedTypes.includes(typeSelect.val())) {
            typeSelect.find('option').first().prop('selected', true);
        }
    };
    
    // Filtrar imediatamente
    filterOptions();
    
    // Usar MutationObserver para filtrar opções adicionadas dinamicamente
    if (typeSelect.length && typeSelect[0]) {
        const observer = new MutationObserver(() => {
            filterOptions();
        });
        
        observer.observe(typeSelect[0], { childList: true, subtree: true });
        
        // Limpar observer quando o diálogo for fechado (usar o evento de fechamento do app)
        const originalClose = app.close?.bind(app);
        if (originalClose) {
            app.close = function(...args) {
                observer.disconnect();
                return originalClose.apply(this, args);
            };
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

window.RisingSteel.importArmaduras = async function() {
    const armadurasData = [
        {"name":"Colete Balístico","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Leve","protecao":1,"peso":3,"descricao":"Colete com camadas de proteção contra balas e fragmentos. Ideal para operações táticas e combate urbano.","especial":""},"flags":{},"effects":[]},
        {"name":"Armadura de Combate Tático","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Leve","protecao":2,"peso":4,"descricao":"Armadura com placas de proteção em kevlar e mobilidade melhorada, adequada para combate em ambientes variados.","especial":""},"flags":{},"effects":[]},
        {"name":"Armadura de Placas Soldadas","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Média","protecao":3,"peso":6,"descricao":"Armadura com placas de cerâmica, oferece excelente proteção em combate.","especial":"-1 Mobilidade"},"flags":{},"effects":[]},
        {"name":"Armadura de Proteção Modular","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Média","protecao":4,"peso":8,"descricao":"Armadura com módulos intercambiáveis para diferentes tipos de proteção, versátil e adaptável.","especial":"+1 para consertos de armadura -1 Mobilidade"},"flags":{},"effects":[]},
        {"name":"Armadura de Combate Pesada","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Pesada","protecao":5,"peso":10,"descricao":"Armadura completa com placas reforçadas e acolchoamento, ideal para situações de combate extremo.","especial":"-2 Mobilidade -1 Iniciativa"},"flags":{},"effects":[]},
        {"name":"Escudo Balístico de Nível I","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Leve","protecao":2,"peso":7,"descricao":"Escudo de liga leve de polímeros. Absorve impactos moderados sem comprometer a mobilidade.","especial":"Durável\nIncapaz de equipar armas de 2 mãos"},"flags":{},"effects":[]},
        {"name":"Escudo Balístico de Nível II","type":"armadura","img":"icons/svg/item-bag.svg","system":{"tipo":"Armadura Pesada","protecao":4,"peso":10,"descricao":"Escudo com estrutura de compósito avançado com núcleo metálico. Oferece resistência superior contra projéteis e golpes contundentes à custa da Mobilidade.","especial":"-2 Mobilidade\nDurável\nIncapaz de equipar armas de 2 mãos"},"flags":{},"effects":[]}
    ];
    
    const pack = game.packs.get("rising-steel.armaduras");
    if (!pack) {
        ui.notifications.error("Pack de armaduras não encontrado!");
        return;
    }
    
    try {
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({locked: false});
        }
        
        // Criar os itens usando a API correta do Foundry VTT v13
        const created = await Item.createDocuments(armadurasData, {
            pack: pack.collection
        });
        
        // Bloquear o pack novamente após a importação
        await pack.configure({locked: true});
        
        ui.notifications.info(`Importadas ${created.length} armaduras com sucesso!`);
        console.log(`[Rising Steel] Importadas ${created.length} armaduras`);
        
        // Recarregar o índice do pack para atualizar a lista
        await pack.getIndex({force: true});
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
                // Filtrar apenas itens com IDs válidos
                const validItemIds = existingItems
                    .filter(item => item && item.id && item._id)
                    .map(item => item.id);
                
                if (validItemIds.length > 0) {
                    await Item.deleteDocuments(validItemIds, {pack: pack.collection});
                    console.log(`[Rising Steel] Removidos ${validItemIds.length} equipamentos antigos`);
                } else {
                    console.log(`[Rising Steel] Nenhum equipamento válido encontrado para remover`);
                }
            }
        } catch (error) {
            console.warn(`[Rising Steel] Erro ao remover equipamentos antigos (continuando mesmo assim):`, error);
        }
        
        // Criar os itens usando a API correta do Foundry VTT v13
        const created = await Item.createDocuments(equipamentosData, {
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

window.RisingSteel.importArmas = async function() {
    const armasData = [
        {"name":"M4 Carbine","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Fuzil de Assalto","dano":10,"alcance":"Longe","peso":3,"descricao":"Fuzil compacto e versátil, com precisão e capacidade de disparo automático.","especial":"","bonus":1},"flags":{},"effects":[]},
        {"name":"AK-47","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Fuzil de Assalto","dano":10,"alcance":"Longe","peso":4.3,"descricao":"Fuzil robusto e confiável, com alta cadência de tiro e impacto potente.","especial":"","bonus":1},"flags":{},"effects":[]},
        {"name":"Glock 17","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Pistola","dano":6,"alcance":"Perto","peso":0.8,"descricao":"Pistola semi-automática conhecida por sua durabilidade e precisão.","especial":"Ignora Penalidade","bonus":2},"flags":{},"effects":[]},
        {"name":"Remington 870","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Espingarda","dano":7,"alcance":"Perto","peso":3.4,"descricao":"Espingarda de repetição com grande poder de impacto, eficaz a curta distância.","especial":"Spread +2","bonus":1},"flags":{},"effects":[]},
        {"name":"MP5","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Submetralhadora","dano":5,"alcance":"Longe","peso":2.5,"descricao":"Submetralhadora com alta cadência de tiro e controle excelente.","especial":"Rajada +2","bonus":1},"flags":{},"effects":[]},
        {"name":"Uzi Pro","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Submetralhadora","dano":5,"alcance":"Longe","peso":2.5,"descricao":"Submetralhadora compacta, ideal para combate em ambientes fechados.","especial":"Rajada +1","bonus":1},"flags":{},"effects":[]},
        {"name":"Beretta 92FS","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Pistola","dano":8,"alcance":"Perto","peso":1,"descricao":"Pistola de 9mm com boa capacidade de munição e precisão confiável.","especial":"Ignora Penalidade","bonus":2},"flags":{},"effects":[]},
        {"name":"K-Bar Combat Knife","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Faca","dano":3,"alcance":"Corpo a corpo","peso":0.7,"descricao":"Faca de combate robusta e durável, ideal para situações de combate próximo.","especial":"","bonus":2},"flags":{},"effects":[]},
        {"name":"Machete","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Faca","dano":4,"alcance":"Corpo a corpo","peso":0.9,"descricao":"Faca de lâmina larga, útil para cortar vegetação e em combate corpo a corpo.","especial":"","bonus":2},"flags":{},"effects":[]},
        {"name":"Tanto","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Faca","dano":2,"alcance":"Corpo a corpo","peso":0.6,"descricao":"Faca de lâmina afiada, ideal para ataques rápidos e precisos.","especial":"","bonus":3},"flags":{},"effects":[]},
        {"name":"Tomahawk","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Machadinha","dano":4,"alcance":"Corpo a corpo","peso":0.8,"descricao":"Machadinha leve, pode ser usada tanto em combate corpo a corpo quanto como arma de arremesso.","especial":"","bonus":2},"flags":{},"effects":[]},
        {"name":"Crossbow (Arbalete)","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Arbalete","dano":6,"alcance":"Perto","peso":2.5,"descricao":"Arma de longo alcance com alta precisão, eficaz para ataques furtivos.","especial":"Silenciosa","bonus":2},"flags":{},"effects":[]},
        {"name":"Barrett M82","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Fuzil de Precisão","dano":20,"alcance":"Muito Longe","peso":14,"descricao":"Fuzil de precisão de longo alcance, ideal para tiros a grandes distâncias.","especial":"Ignora Armadura. Necessita de 1 turno de preparação para atirar. Durante esse turno, o piloto não pode realizar outra atividade, nem se mover, esquivar de ataques ou receber dano. Caso contrário, precisará iniciar a preparação outra vez.","bonus":1},"flags":{},"effects":[]},
        {"name":"Mossberg 500","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Espingarda","dano":8,"alcance":"Perto","peso":3.5,"descricao":"Espingarda de repetição com eficácia em combate a curta distância e alta versatilidade.","especial":"Spread +2","bonus":1},"flags":{},"effects":[]},
        {"name":"RPG-7","type":"arma","img":"icons/svg/item-bag.svg","system":{"tipo":"Lançador de Foguetes","dano":20,"alcance":"Muito Longe","peso":7,"descricao":"Lançador de foguetes antitanque com alto poder destrutivo, ideal para alvos blindados.","especial":"Penalidade -3 para acertar alvos que não sejam veículos ou grandes. Dano em dobro contra veículos e inimigos grandes. Necessita de 1 turno de preparação para atirar. Durante esse turno, o piloto não pode realizar outra atividade, nem se mover, esquivar de ataques ou receber dano. Caso contrário, precisará iniciar a preparação outra vez.","bonus":1},"flags":{},"effects":[]}
    ];
    
    const pack = game.packs.get("rising-steel.armas");
    if (!pack) {
        ui.notifications.error("Pack de armas não encontrado!");
        return;
    }
    
    try {
        // Desbloquear o pack se estiver bloqueado
        if (pack.locked) {
            await pack.configure({locked: false});
        }
        
        // Criar os itens usando a API correta do Foundry VTT v13
        const created = await Item.createDocuments(armasData, {
            pack: pack.collection
        });
        
        // Bloquear o pack novamente após a importação
        await pack.configure({locked: true});
        
        ui.notifications.info(`Importadas ${created.length} armas com sucesso!`);
        console.log(`[Rising Steel] Importadas ${created.length} armas`);
        
        // Recarregar o índice do pack para atualizar a lista
        await pack.getIndex({force: true});
    } catch (error) {
        console.error("[Rising Steel] Erro ao importar armas:", error);
        ui.notifications.error("Erro ao importar armas. Verifique o console.");
    }
};


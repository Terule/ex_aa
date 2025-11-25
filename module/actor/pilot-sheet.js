// Import compatibility utilities
import { FoundryCompatibility } from "../utils/compatibility.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class RisingSteelPilotSheet extends FoundryCompatibility.getActorSheetBase() {
    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["rising-steel", "sheet", "actor", "pilot"],
            template: "systems/rising-steel/template/actor/pilot-sheet.html",
            width: 800,
            height: 900,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "identificacao" }]
        });
    }

    /** @override */
    async getData(options) {
        const source = this.actor.toObject();
        const actorData = this.actor.toObject(false);
        
        // Limpar e normalizar valores numéricos antes de passar para o template
        this._normalizeNumericValues(actorData.system);
        
        const context = {
            actor: actorData,
            source: source.system,
            system: actorData.system,
            items: actorData.items,
            owner: this.actor.isOwner,
            limited: this.actor.limited,
            options: this.options,
            editable: this.isEditable,
            type: this.actor.type,
            rollData: this.actor.getRollData.bind(this.actor)
        }
        
        context.descriptionHTML = await FoundryCompatibility.enrichHTML(context.system.description || "", {
            secrets: this.actor.isOwner,
            async: true
        });
        
        // Adicionar lista de patentes para o template
        context.patentes = CONFIG.RisingSteel?.getPatentesList() || [];
        context.availableCompanions = [];
        context.currentCompanion = null;
        try {
            const actorsCollection = game?.actors ? (game.actors.contents ?? Array.from(game.actors)) : [];
            if (actorsCollection?.length) {
                const allowedTypes = new Set(["companion"]);
                context.availableCompanions = actorsCollection
                    .filter(actor => allowedTypes.has(actor.type) && actor.id !== this.actor.id)
                    .map(actor => ({ id: actor.id, name: actor.name }))
                    .sort((a, b) => a.name.localeCompare(b.name, game.i18n?.lang || "pt-BR"));

                if (context.system?.companionId) {
                    const companionActor = game.actors.get(context.system.companionId);
                    if (companionActor) {
                        const companionData = companionActor.toObject(false);
                        const companionSystem = foundry.utils.duplicate(companionData.system || {});
                        const { ataquesList, habilidadesList } = this._buildLinkedCompanionLists(companionSystem);
                        const companionDescriptionHTML = await FoundryCompatibility.enrichHTML(companionSystem.descricao || "", {
                            secrets: this.actor.isOwner,
                            async: true
                        });
                        context.currentCompanion = {
                            id: companionActor.id,
                            name: companionActor.name,
                            img: companionActor.img,
                            type: companionActor.type,
                            system: companionSystem,
                            informacoes: foundry.utils.duplicate(companionSystem?.informacoes || {}),
                            atributos: foundry.utils.duplicate(companionSystem?.atributos || {}),
                            combate: foundry.utils.duplicate(companionSystem?.combate || {}),
                            limiarDano: foundry.utils.duplicate(companionSystem?.limiarDano || {}),
                            ataquesList: ataquesList ?? [],
                            habilidadesList: habilidadesList ?? [],
                            descriptionHTML: companionDescriptionHTML
                        };
                    }
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Falha ao carregar companions disponíveis:", error);
        }
        
        // Organizar especializações por tipo
        if (!context.system.especializacoes) {
            context.system.especializacoes = {
                fisicos: [],
                mentais: [],
                sociais: []
            };
        }
        context.especializacoes = {
            fisicos: context.system.especializacoes.fisicos || [],
            mentais: context.system.especializacoes.mentais || [],
            sociais: context.system.especializacoes.sociais || []
        };
        
        // Buscar armaduras, equipamentos e armas dos compendiums
        // Se os packs não estiverem disponíveis ainda, retornar arrays vazios
        try {
            context.armaduras = await this._getCompendiumItems("armaduras", "armadura");
            context.equipamentos = await this._getCompendiumItems("equipamentos", "equipamento");
            context.armas = await this._getCompendiumItems("armas", "arma");
            
            // Sincronizar ID da armadura equipada
            if (context.system.armadura?.equipada && context.armaduras.length > 0) {
                const armaduraEquipadaId = context.system.armadura.equipada;
                const foundById = context.armaduras.find(a => a.id === armaduraEquipadaId);
                if (!foundById) {
                    // ID não encontrado - isso indica que o ID salvo não corresponde ao ID do compendium
                    // Vamos verificar se podemos encontrar uma correspondência pelo valor total salvo
                    // (já que o total é atualizado quando uma armadura é selecionada)
                    const protecaoSalva = context.system.armadura?.total || 0;
                    if (protecaoSalva > 0) {
                        // Tentar encontrar armadura com a mesma proteção
                        const foundByProtecao = context.armaduras.find(a => {
                            const protecaoArmadura = Number(a.system?.protecao || 0);
                            return protecaoArmadura === protecaoSalva;
                        });
                        if (foundByProtecao) {
                            // Encontrada armadura com proteção correspondente, atualizar ID
                            // Se houver múltiplas com a mesma proteção, usar a primeira
                            console.log(`[Rising Steel] Sincronizando armadura: ID antigo "${armaduraEquipadaId}", novo ID "${foundByProtecao.id}" (proteção: ${protecaoSalva})`);
                            await this.actor.update({
                                "system.armadura.equipada": foundByProtecao.id,
                                "system.armadura.total": protecaoSalva,
                                "system.armadura.atual": Math.max(0, protecaoSalva - (context.system.armadura?.dano || 0))
                            }, {render: false});
                            context.system.armadura.equipada = foundByProtecao.id;
                        } else {
                            // Não encontrada correspondência, limpar
                            console.log(`[Rising Steel] Armadura equipada com ID "${armaduraEquipadaId}" não encontrada no compendium, limpando...`);
                            await this.actor.update({
                                "system.armadura.equipada": "",
                                "system.armadura.total": 0,
                                "system.armadura.atual": 0
                            }, {render: false});
                            context.system.armadura.equipada = "";
                        }
                    } else {
                        // Sem proteção salva, limpar
                        console.log(`[Rising Steel] Armadura equipada com ID "${armaduraEquipadaId}" não encontrada no compendium, limpando...`);
                        await this.actor.update({
                            "system.armadura.equipada": "",
                            "system.armadura.total": 0,
                            "system.armadura.atual": 0
                        }, {render: false});
                        context.system.armadura.equipada = "";
                    }
                }
            }
            
            // Sincronizar IDs dos equipamentos salvos com os IDs do compendium
            // Se um ID não corresponder, tentar encontrar pelo nome e atualizar
            if (context.system.inventario?.equipamentos && context.equipamentos.length > 0) {
                let equipamentosAtualizados = false;
                const equipamentosCorrigidos = context.system.inventario.equipamentos.map((eq, idx) => {
                    if (!eq || !eq.nome || !eq.nome.trim()) {
                        return {id: "", nome: ""};
                    }
                    
                    // Se já tem ID, verificar se corresponde
                    if (eq.id) {
                        const foundById = context.equipamentos.find(e => e.id === eq.id);
                        if (foundById) {
                            // ID válido, retornar como está
                            return {id: eq.id, nome: eq.nome};
                        }
                    }
                    
                    // ID não encontrado ou inválido, tentar encontrar pelo nome
                    const foundByName = context.equipamentos.find(e => {
                        const nomeSalvo = (eq.nome || "").trim().toLowerCase();
                        const nomeItem = (e.name || "").trim().toLowerCase();
                        return nomeSalvo === nomeItem;
                    });
                    
                    if (foundByName) {
                        equipamentosAtualizados = true;
                        console.log(`[Rising Steel] Sincronizando equipamento ${idx}: "${eq.nome}"`);
                        return {id: foundByName.id, nome: foundByName.name};
                    }
                    
                    // Não encontrado, limpar
                    if (eq.id || eq.nome) {
                        equipamentosAtualizados = true;
                        console.log(`[Rising Steel] Equipamento ${idx} "${eq.nome}" não encontrado no compendium, limpando...`);
                    }
                    return {id: "", nome: ""};
                });
                
                // Se houve atualizações, salvar os IDs corrigidos
                if (equipamentosAtualizados) {
                    await this.actor.update({
                        "system.inventario.equipamentos": equipamentosCorrigidos
                    }, {render: false});
                    // Atualizar o context com os valores corrigidos
                    context.system.inventario.equipamentos = equipamentosCorrigidos;
                }
            }
            
            // Fazer o mesmo para armas
            if (context.system.inventario?.armas && context.armas.length > 0) {
                let armasAtualizadas = false;
                // IMPORTANTE: Não sincronizar automaticamente durante o getData
                // A sincronização só deve acontecer quando realmente necessário (IDs vazios ou inválidos)
                // Não devemos alterar armas que já têm IDs válidos, mesmo que o nome coincida
                const armasCorrigidas = context.system.inventario.armas.map((arma, idx) => {
                    if (!arma || !arma.nome || !arma.nome.trim()) {
                        return {id: "", nome: "", dano: 0, alcance: "", bonus: 0};
                    }
                    
                    // Se já tem ID, verificar se corresponde ao compendium
                    if (arma.id && arma.id.trim() !== "") {
                        const foundById = context.armas.find(a => a.id === arma.id);
                        if (foundById) {
                            // ID válido e encontrado no compendium, preservar TODOS os valores como estão
                            // Não atualizar nome, dano, alcance - manter exatamente como está salvo
                            return arma;
                        } else {
                            // ID existe mas não foi encontrado no compendium
                            // Tentar encontrar pelo nome para atualizar o ID inválido
                            if (arma.nome && arma.nome.trim() !== "") {
                                const foundByName = context.armas.find(a => {
                                    const nomeSalvo = (arma.nome || "").trim().toLowerCase();
                                    const nomeItem = (a.name || "").trim().toLowerCase();
                                    return nomeSalvo === nomeItem && nomeSalvo !== "";
                                });
                                
                                if (foundByName) {
                                    // Verificar se o item encontrado tem um ID válido
                                    let novoId = foundByName.id || foundByName._id || "";
                                    
                                    // Se o ID é null ou inválido, não atualizar para null - manter o ID antigo
                                    if (!novoId || novoId === null || novoId === "null" || (typeof novoId === "string" && novoId.trim() === "")) {
                                        console.warn(`[Rising Steel] Arma ${idx} "${arma.nome}" encontrada no compendium mas o item mapeado não tem ID válido (id=${foundByName.id}, _id=${foundByName._id}). Mantendo ID antigo "${arma.id}" e valores atuais.`, foundByName);
                                        return arma;
                                    }
                                    
                                    // Garantir que o ID é uma string válida
                                    novoId = String(novoId).trim();
                                    
                                    // ID válido encontrado
                                    armasAtualizadas = true;
                                    console.log(`[Rising Steel] Arma ${idx} com ID inválido "${arma.id}" não encontrada. Encontrada pelo nome "${arma.nome}" - atualizando ID para "${novoId}"`);
                                    // Atualizar o ID inválido e sincronizar valores do item encontrado
                                    return {
                                        id: novoId,
                                        nome: foundByName.name,
                                        dano: Number(foundByName.system?.dano || arma.dano || 0),
                                        alcance: foundByName.system?.alcance || arma.alcance || "",
                                        bonus: Number(foundByName.system?.bonus || arma.bonus || 0)
                                    };
                                }
                            }
                            
                            // ID inválido e não encontrou pelo nome
                            // Manter valores atuais mas avisar
                            console.warn(`[Rising Steel] Arma ${idx} com ID "${arma.id}" não encontrada no compendium e não foi possível encontrar pelo nome "${arma.nome}". Mantendo valores atuais.`);
                            return arma;
                        }
                    }
                    
                    // SÓ sincronizar se NÃO tem ID e tem nome
                    // Isso ajuda quando uma arma foi salva apenas com nome (sem ID)
                    if (!arma.id || arma.id.trim() === "") {
                        if (arma.nome && arma.nome.trim() !== "") {
                            const foundByName = context.armas.find(a => {
                                const nomeSalvo = (arma.nome || "").trim().toLowerCase();
                                const nomeItem = (a.name || "").trim().toLowerCase();
                                return nomeSalvo === nomeItem && nomeSalvo !== "";
                            });
                            
                            if (foundByName) {
                                // Verificar se o item encontrado tem um ID válido
                                const novoId = foundByName.id || foundByName._id || "";
                                
                                if (novoId && novoId.trim() !== "" && novoId !== "null") {
                                    armasAtualizadas = true;
                                    console.log(`[Rising Steel] Sincronizando arma ${idx}: "${arma.nome}" - adicionando ID "${novoId}" e atualizando valores do item`);
                                    // Quando sincroniza pelo nome, usar TODOS os valores do item encontrado
                                    // Isso garante consistência entre nome, dano, alcance, bonus
                                    return {
                                        id: String(novoId).trim(),
                                        nome: foundByName.name,
                                        dano: Number(foundByName.system?.dano || arma.dano || 0),
                                        alcance: foundByName.system?.alcance || arma.alcance || "",
                                        bonus: Number(foundByName.system?.bonus || arma.bonus || 0)
                                    };
                                } else {
                                    // Item encontrado mas sem ID válido - manter sem ID por enquanto
                                    console.warn(`[Rising Steel] Arma ${idx} "${arma.nome}" encontrada no compendium mas sem ID válido. Mantendo sem ID.`);
                                    return {
                                        id: "",
                                        nome: foundByName.name,
                                        dano: Number(foundByName.system?.dano || arma.dano || 0),
                                        alcance: foundByName.system?.alcance || arma.alcance || "",
                                        bonus: Number(foundByName.system?.bonus || arma.bonus || 0)
                                    };
                                }
                            }
                        }
                    }
                    
                    // Se chegou aqui, não encontrou correspondência
                    // Se tem nome mas não encontrou, pode ser um nome customizado
                    // Manter como está (não limpar automaticamente)
                    return arma;
                });
                
                // Se houve atualizações (apenas IDs vazios foram corrigidos), salvar as armas corrigidas
                if (armasAtualizadas) {
                    console.log(`[Rising Steel] Sincronização automática corrigiu ${armasCorrigidas.filter((a, i) => a.id !== (context.system.inventario.armas[i]?.id || "")).length} armas com IDs vazios`);
                    await this.actor.update({
                        "system.inventario.armas": armasCorrigidas
                    }, {render: false});
                    // Atualizar o context com os valores corrigidos
                    context.system.inventario.armas = armasCorrigidas;
                }
            }
        } catch (error) {
            // Se houver erro ao carregar packs, usar arrays vazios
            context.armaduras = [];
            context.equipamentos = [];
            context.armas = [];
        }
        
        return context;
    }

    /**
     * Get items from a compendium pack
     * @param {string} packName - Name of the compendium pack
     * @param {string} itemType - Type of items to filter
     * @returns {Promise<Array>} Array of items with id and name
     * @private
     */
    async _getCompendiumItems(packName, itemType) {
        try {
            // Verificar se game.packs está disponível
            if (!game.packs || game.packs.size === 0) {
                // Packs ainda não foram carregados, retornar array vazio silenciosamente
                return [];
            }
            
            // Listar todos os packs disponíveis
            const allPacks = Array.from(game.packs);
            if (allPacks.length === 0) {
                return [];
            }
            
            // Tentar diferentes formatos de nome de pack
            let pack = game.packs.get(`rising-steel.${packName}`);
            if (!pack) {
                pack = game.packs.get(packName);
            }
            if (!pack) {
                // Buscar por label ou name (case insensitive)
                pack = allPacks.find(p => {
                    const label = (p.metadata?.label || "").toLowerCase();
                    const name = (p.metadata?.name || "").toLowerCase();
                    const packNameLower = packName.toLowerCase();
                    return label === packNameLower || name === packNameLower || 
                           label.includes(packNameLower) || name.includes(packNameLower);
                });
            }
            
            if (!pack) {
                console.warn(`[Rising Steel] Pack "${packName}" não encontrado. Packs disponíveis:`, allPacks.map(p => ({
                    id: p.metadata?.id,
                    name: p.metadata?.name,
                    label: p.metadata?.label
                })));
                return [];
            }
            
            // Garantir que o índice está carregado
            try {
                await pack.getIndex({force: true});
            } catch (error) {
                console.warn(`[Rising Steel] Erro ao carregar índice do pack "${packName}":`, error);
            }
            
            // Verificar o índice
            let index = pack.index;
            console.log(`[Rising Steel] Pack "${packName}" - Índice tem ${index ? index.size : 0} entradas`);
            
            // Construir mapa de nome -> ID do índice
            const nameToIdFromIndex = new Map();
            
            if (index && index.size > 0) {
                try {
                    const indexEntries = Array.from(index.entries());
                    for (const [id, indexEntry] of indexEntries) {
                        if (indexEntry && indexEntry.name) {
                            nameToIdFromIndex.set(indexEntry.name, String(id));
                        }
                    }
                } catch (e) {
                    console.warn(`[Rising Steel] Erro ao processar índice do pack "${packName}":`, e);
                }
            }
            
            // Tentar buscar documentos
            let items = [];
            let filtered = [];
            
            // Estratégia 1: Buscar todos os documentos
            try {
                items = await pack.getDocuments();
                filtered = items.filter(item => item && item.type === itemType);
            } catch (error) {
                console.warn(`[Rising Steel] Erro ao buscar documentos do pack "${packName}":`, error);
            }
            
            // Estratégia 2: Se não encontrou ou encontrou sem IDs, buscar pelo índice
            if (filtered.length === 0 || filtered.some(item => !item.id && !item._id)) {
                if (index && index.size > 0) {
                    try {
                        const indexEntries = Array.from(index.entries());
                        // Filtrar pelo tipo se disponível no índice
                        const filteredIds = indexEntries
                            .filter(([id, entry]) => {
                                if (!entry || !entry.name) return false;
                                // Se o índice não tem informação de tipo, buscar todos
                                if (!entry.type) return true;
                                return entry.type === itemType;
                            })
                            .map(([id]) => String(id));
                        
                        if (filteredIds.length > 0) {
                            const itemsFromIndex = await Promise.all(
                                filteredIds.map(id => pack.getDocument(id).catch(() => null))
                            );
                            const validItems = itemsFromIndex.filter(item => item !== null && item.type === itemType);
                            if (validItems.length > 0) {
                                filtered = validItems;
                            }
                        }
                    } catch (error) {
                        console.warn(`[Rising Steel] Erro ao buscar pelo índice do pack "${packName}":`, error);
                    }
                }
            }
            
            console.log(`[Rising Steel] Pack "${packName}": ${filtered.length} itens do tipo "${itemType}"`);
            
            if (filtered.length === 0 && index && index.size > 0) {
                console.warn(`[Rising Steel] Pack "${packName}" tem ${index.size} entradas no índice mas nenhum item do tipo "${itemType}" foi encontrado.`);
            }
            
            // Mapear os itens filtrados usando múltiplas estratégias para obter o ID
            const mapped = filtered.map((item) => {
                let itemId = "";
                
                // DEBUG: Log detalhado do item para entender sua estrutura
                if (!item.id || item.id === null || item.id === "null") {
                    console.log(`[Rising Steel] DEBUG Item "${item.name}" - item.id=${item.id}, item._id=${item._id}, item.uuid=${item.uuid}`);
                }
                
                // Prioridade 1: ID direto do documento (propriedade padrão do Foundry)
                // IMPORTANTE: Verificar se não é null, undefined ou string "null"
                if (item.id && item.id !== null && item.id !== "null" && item.id !== undefined) {
                    itemId = String(item.id).trim();
                    // Se resultou em "null", limpar
                    if (itemId === "null") itemId = "";
                }
                // Prioridade 2: _id do documento (alternativa) - pode conter o ID explícito que criamos
                else if (item._id && item._id !== null && item._id !== "null" && item._id !== undefined) {
                    itemId = String(item._id).trim();
                    // Se resultou em "null", limpar
                    if (itemId === "null") itemId = "";
                }
                // Prioridade 3: Buscar no mapa do índice pelo nome (mais confiável)
                else if (item.name && nameToIdFromIndex.has(item.name)) {
                    itemId = nameToIdFromIndex.get(item.name);
                }
                // Prioridade 4: Tentar extrair do UUID
                else if (item.uuid) {
                    // UUID formato: "Compendium.rising-steel.armaduras.Item.{id}"
                    const uuidMatch = item.uuid.match(/Item\.([^\.]+)/);
                    if (uuidMatch && uuidMatch[1] && uuidMatch[1].trim()) {
                        itemId = String(uuidMatch[1].trim());
                    } else {
                        // Tentar dividir por pontos
                        const parts = item.uuid.split(".");
                        const itemIndex = parts.findIndex(p => p === "Item");
                        if (itemIndex >= 0 && itemIndex < parts.length - 1) {
                            const potentialId = parts[itemIndex + 1];
                            if (potentialId && potentialId.trim()) {
                                itemId = String(potentialId.trim());
                            }
                        }
                    }
                }
                // Prioridade 5: Buscar diretamente no índice se ainda não encontrou
                else if (item.name && index && index.size > 0) {
                    try {
                        const indexEntries = Array.from(index.entries());
                        for (const [id, indexEntry] of indexEntries) {
                            if (indexEntry && indexEntry.name === item.name) {
                                itemId = String(id);
                                break;
                            }
                        }
                    } catch (e) {
                        // Continuar sem ID se houver erro
                    }
                }
                
                // Garantir que itemId não é "null" ou null
                if (itemId === "null" || itemId === null) {
                    itemId = "";
                }
                
                // Se ainda não tem ID válido, tentar buscar diretamente do índice pelo nome
                if (!itemId && item.name && index && index.size > 0) {
                    try {
                        const indexEntries = Array.from(index.entries());
                        for (const [id, indexEntry] of indexEntries) {
                            if (indexEntry && indexEntry.name === item.name) {
                                const idFromIndex = String(id).trim();
                                if (idFromIndex && idFromIndex !== "null") {
                                    itemId = idFromIndex;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        // Continuar sem ID se houver erro
                    }
                }
                
                // IMPORTANTE: Verificar se itemId é válido ANTES de criar o objeto
                // Se itemId for null, "null", vazio ou inválido, retornar null imediatamente
                if (!itemId || itemId === null || itemId === "null" || (typeof itemId === "string" && itemId.trim() === "")) {
                    // Log apenas se o item tem nome (para ajudar a debugar)
                    if (item.name) {
                        console.warn(`[Rising Steel] Item "${item.name}" do pack "${packName}" não tem ID válido - será filtrado.`, {
                            itemIdOriginal: item.id,
                            item_idOriginal: item._id,
                            hasUuid: !!item.uuid,
                            uuid: item.uuid,
                            nameInIndex: nameToIdFromIndex.has(item.name),
                            mappedItemId: itemId
                        });
                    }
                    return null; // Será filtrado depois
                }
                
                // Garantir que itemId é uma string válida
                itemId = String(itemId).trim();
                
                // Verificar novamente após conversão (caso tenha resultado em "null")
                if (!itemId || itemId === "null") {
                    return null;
                }
                
                const mappedItem = {
                    id: itemId, // Já validado
                    name: item.name || "",
                    system: item.system || {}
                };
                
                // Verificação final (não deve chegar aqui se itemId for inválido)
                if (!mappedItem.id || !mappedItem.name) {
                    return null;
                }
                
                return mappedItem;
            });
            
            // Filtrar itens inválidos - remover nulls e itens sem ID válido
            const mappedValid = mapped.filter(item => {
                if (!item) return false;
                if (!item.name || !item.name.trim()) return false;
                
                // Verificar se o ID é válido
                const itemId = item.id;
                if (!itemId || itemId === null || itemId === "null" || itemId === undefined) {
                    console.warn(`[Rising Steel] Item "${item.name}" do pack "${packName}" será filtrado - ID inválido:`, itemId);
                    return false;
                }
                
                const itemIdStr = String(itemId).trim();
                if (itemIdStr === "" || itemIdStr === "null") {
                    console.warn(`[Rising Steel] Item "${item.name}" do pack "${packName}" será filtrado - ID vazio ou "null":`, itemIdStr);
                    return false;
                }
                
                return true;
            });
            
            const filteredCount = mapped.length - mappedValid.length;
            if (filteredCount > 0) {
                console.warn(`[Rising Steel] ${filteredCount} itens do pack "${packName}" foram filtrados por terem IDs inválidos. Total antes: ${mapped.length}, Total depois: ${mappedValid.length}`);
            }
            
            console.log(`[Rising Steel] Mapeando ${mappedValid.length} itens válidos do pack "${packName}"`);
            
            // Substituir o array mapeado pelos itens válidos
            mapped.length = 0;
            mapped.push(...mappedValid);
            
            return mapped;
        } catch (error) {
            console.error(`[Rising Steel] Erro ao buscar itens do pack "${packName}":`, error);
            return [];
        }
    }

    /**
     * Normalize numeric values in the system data
     * @param {Object} systemData - The system data object
     * @private
     */
    _normalizeNumericValues(systemData) {
        const normalizeValue = (value) => {
            if (value === null || value === undefined || value === '') {
                return 0;
            }
            // Se for string, remover vírgulas e converter
            if (typeof value === 'string') {
                value = value.replace(/,/g, '.');
            }
            const num = Number(value);
            return isNaN(num) ? 0 : num;
        };

        // Normalizar atributos
        if (systemData.atributos) {
            const attr = systemData.atributos;
            
            // Físicos
            if (attr.fisicos) {
                attr.fisicos.forca = normalizeValue(attr.fisicos.forca);
                attr.fisicos.destreza = normalizeValue(attr.fisicos.destreza);
                attr.fisicos.vigor = normalizeValue(attr.fisicos.vigor);
            }
            
            // Mentais
            if (attr.mentais) {
                attr.mentais.conhecimento = normalizeValue(attr.mentais.conhecimento);
                attr.mentais.perspicacia = normalizeValue(attr.mentais.perspicacia);
                attr.mentais.resiliencia = normalizeValue(attr.mentais.resiliencia);
            }
            
            // Sociais
            if (attr.sociais) {
                attr.sociais.eloquencia = normalizeValue(attr.sociais.eloquencia);
                attr.sociais.dissimulacao = normalizeValue(attr.sociais.dissimulacao);
                attr.sociais.presenca = normalizeValue(attr.sociais.presenca);
            }
        }

        // Normalizar EXApoints
        if (systemData.exapoints) {
            systemData.exapoints.maximo = normalizeValue(systemData.exapoints.maximo);
            systemData.exapoints.gastos = normalizeValue(systemData.exapoints.gastos);
            systemData.exapoints.atual = normalizeValue(systemData.exapoints.atual);
            systemData.exapoints.overdrive = normalizeValue(systemData.exapoints.overdrive);
        }

        // Normalizar Pontos de Atributo
        if (systemData.pontosAtributo) {
            systemData.pontosAtributo.total = normalizeValue(systemData.pontosAtributo.total);
            systemData.pontosAtributo.distribuidos = normalizeValue(systemData.pontosAtributo.distribuidos);
            systemData.pontosAtributo.restantes = normalizeValue(systemData.pontosAtributo.restantes);
        }

        // Normalizar Combate
        if (systemData.combate) {
            systemData.combate.iniciativa = normalizeValue(systemData.combate.iniciativa);
            systemData.combate.mobilidade = normalizeValue(systemData.combate.mobilidade);
            systemData.combate.esquiva = normalizeValue(systemData.combate.esquiva);
        }
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Validar e corrigir valores numéricos antes de atualizar
        html.find("input[type='number']").on("blur", this._validateNumericInput.bind(this));
        html.find("input[type='number']").on("input", this._sanitizeNumericInput.bind(this));
        
        // Corrigir valores ao carregar a página
        html.find("input[type='number']").each((index, element) => {
            const input = $(element);
            const value = input.val();
            if (value && (value.includes(',') || isNaN(Number(value)))) {
                const normalized = this._normalizeInputValue(value, element);
                if (normalized !== value) {
                    input.val(normalized);
                }
            }
        });

        // Roll Attribute
        html.find(".roll-atributo").click(this._onRollAttribute.bind(this));

        // Atualizar pontos quando patente mudar
        html.find("select[name='system.identificacao.patente']").on("change", this._onPatenteChange.bind(this));

        // Atualizar pontos quando atributos mudarem (exceto Resiliência que tem handler específico)
        // Excluir campos de equipamentos do listener genérico
        html.find("input[name^='system.atributos']")
            .not("input[name='system.atributos.mentais.resiliencia']")
            .not("input[name*='equipamentos']")
            .on("change", this._onAtributoChange.bind(this));
        
        // Atualizar EXApoints quando Resiliência mudar
        html.find("input[name='system.atributos.mentais.resiliencia']").on("change", this._onResilienciaChange.bind(this));
        
        // Atualizar EXApoints atual quando gastos mudarem
        html.find("input[name='system.exapoints.gastos']").on("change", this._onExapointsGastosChange.bind(this));
        
        // Atualizar Armadura atual quando total ou dano mudarem
        html.find("input[name='system.armadura.total'], input[name='system.armadura.dano']").on("change", this._onArmaduraChange.bind(this));
        
        // Botão de rolagem de Armadura
        html.find(".roll-armadura").click(this._onRollArmadura.bind(this));
        
        // Atualizar nome quando equipamento for selecionado
        html.find(".item-select-equipamento").on("change", this._onEquipamentoSelect.bind(this));
        
        // Atualizar nome quando arma for selecionada
        html.find(".item-select-arma").on("change", this._onArmaSelect.bind(this));
        
        // Atualizar armadura quando selecionada
        html.find(".item-select-armadura").on("change", this._onArmaduraSelect.bind(this));

        // Botões de rolagem para equipamentos e armas
        html.find(".roll-equipamento").click(this._onRollEquipamento.bind(this));
        html.find(".roll-arma").click(this._onRollArma.bind(this));

        // Botão de rolagem de iniciativa
        html.find(".roll-iniciativa").click(this._onRollIniciativa.bind(this));

        // Companion
        html.find(".open-companion-sheet").click(this._onOpenCompanionSheet.bind(this));

        // Especializações
        html.find(".especializacao-create").click(this._onCreateEspecializacao.bind(this));
        html.find(".edit-especializacao").click(this._onEditEspecializacao.bind(this));
        html.find(".delete-especializacao").click(this._onDeleteEspecializacao.bind(this));
        html.find(".roll-especializacao").click(this._onRollEspecializacao.bind(this));

        // ADD INVENTORY ITEM
        html.find(".item-create").click(this._onItemCreate.bind(this));

        // UPDATE INVENTORY ITEM
        html.find(".item-edit").click((ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            const item = this.actor.items.get(li.data("item-id"));
            item.sheet.render(true);
        });

        // DELETE INVENTORY ITEM
        html.find(".item-delete").click((ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            this._deleteOwnedItemById(li.data("item-id"));
            li.slideUp(200, () => this.render(false));
        });
    }

    async _updateObject(event, formData) {
        // Limpar valores undefined do formData
        const cleanFormData = {};
        for (const [key, value] of Object.entries(formData)) {
            if (value !== undefined && value !== null) {
                cleanFormData[key] = value;
            }
        }

        const previousCompanionId = this.actor.system?.companionId || "";
        const result = await super._updateObject(event, cleanFormData);
        const expanded = foundry.utils.expandObject(cleanFormData);
        const newCompanionId = (foundry.utils.getProperty(expanded, "system.companionId") ?? this.actor.system?.companionId) ?? "";
        await this._syncCompanionLink(previousCompanionId, newCompanionId);
        return result;
    }

    async _syncCompanionLink(oldCompanionId, newCompanionId) {
        if (oldCompanionId === newCompanionId) return;

        if (!game?.actors) {
            console.warn("[Rising Steel] game.actors indisponível para sincronizar companion.");
            return;
        }

        if (oldCompanionId) {
            const oldCompanion = game.actors.get(oldCompanionId);
            if (oldCompanion && oldCompanion.system?.vinculo?.pilotoId === this.actor.id) {
                await oldCompanion.update({ "system.vinculo.pilotoId": "" });
            }
        }

        if (newCompanionId) {
            const newCompanion = game.actors.get(newCompanionId);
            if (!newCompanion) {
                ui.notifications?.warn("Companion selecionado não foi encontrado.");
                await this.actor.update({ "system.companionId": "" });
                return;
            }

            if (newCompanion.type !== "companion") {
                ui.notifications?.warn("Somente atores do tipo Companion podem ser vinculados.");
                await this.actor.update({ "system.companionId": "" });
                return;
            }

            const previousPilotId = newCompanion.system?.vinculo?.pilotoId;
            if (previousPilotId && previousPilotId !== this.actor.id) {
                const previousPilot = game.actors.get(previousPilotId);
                if (previousPilot && previousPilot.system?.companionId === newCompanion.id) {
                    await previousPilot.update({ "system.companionId": "" });
                }
            }

            await newCompanion.update({ "system.vinculo.pilotoId": this.actor.id });
        }
    }

    /**
     * Normalize a single input value
     * @param {string} value
     * @param {HTMLElement} input
     * @returns {number}
     * @private
     */
    _normalizeInputValue(value, input) {
        if (value === '' || value === null || value === undefined) {
            // Para atributos, retornar 1 como padrão (não 0)
            const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : 0;
            return min;
        }
        
        // Remover vírgulas e converter para número
        let normalized = String(value).replace(/,/g, '.');
        let numValue = Number(normalized);
        
        if (isNaN(numValue)) {
            const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : 0;
            numValue = min;
        }
        
        // Aplicar min/max se definidos
        const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : null;
        const max = input.hasAttribute('max') ? Number(input.getAttribute('max')) : null;
        
        if (min !== null && numValue < min) {
            numValue = min;
        }
        if (max !== null && numValue > max) {
            numValue = max;
        }
        
        return numValue;
    }

    /**
     * Sanitize numeric input in real-time
     * @param {Event} event
     * @private
     */
    _sanitizeNumericInput(event) {
        const input = event.currentTarget;
        let value = input.value;
        
        // Remover vírgulas e substituir por ponto
        value = value.replace(/,/g, '.');
        
        // Remover caracteres não numéricos exceto ponto e sinal negativo
        value = value.replace(/[^\d.-]/g, '');
        
        // Se o valor mudou, atualizar o campo
        if (value !== input.value) {
            input.value = value;
        }
    }

    /**
     * Validate and fix numeric input when field loses focus
     * @param {Event} event
     * @private
     */
    _validateNumericInput(event) {
        const input = event.currentTarget;
        let value = input.value;
        
        // Se estiver vazio, definir como 0
        if (value === '' || value === null || value === undefined) {
            value = '0';
        }
        
        // Converter para número
        let numValue = Number(value);
        
        // Se não for um número válido, definir como 0
        if (isNaN(numValue)) {
            numValue = 0;
        }
        
        // Aplicar min/max se definidos
        const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : null;
        const max = input.hasAttribute('max') ? Number(input.getAttribute('max')) : null;
        
        if (min !== null && numValue < min) {
            numValue = min;
        }
        if (max !== null && numValue > max) {
            numValue = max;
        }
        
        // Se o valor mudou, atualizar o campo
        if (Number(input.value) !== numValue) {
            input.value = numValue;
            // Disparar evento change para atualizar o actor
            $(input).trigger('change');
        }
    }

    _editOwnedItemById(_itemId) {
        const item = this.actor.items.get(_itemId);
        item.sheet.render(true);
    }

    async _deleteOwnedItemById(_itemId) {
        await this.actor.deleteEmbeddedDocuments("Item", [_itemId]);
    }

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;
        const data = foundry.utils.duplicate(header.dataset);
        const name = `New ${type.capitalize()}`;
        const itemData = {
            name: name,
            type: type,
            system: data,
        };
        delete itemData.system["type"];
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    async _onPatenteChange(event) {
        event.preventDefault();
        const select = event.currentTarget;
        const novaPatente = select.value;
        
        // Atualizar a patente no actor
        await this.actor.update({
            "system.identificacao.patente": novaPatente
        });
        
        // Recalcular pontos (já será feito pelo prepareBaseData)
        // Forçar re-render para atualizar os valores calculados
        this.render(false);
    }

    async _onAtributoChange(event) {
        // Normalizar o valor antes de atualizar
        const input = event.currentTarget;
        const normalized = this._normalizeInputValue(input.value, input);
        if (Number(input.value) !== normalized) {
            input.value = normalized;
        }
        
        // Recalcular pontos quando atributos mudarem
        await this.actor.update({});
    }

    async _onResilienciaChange(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Normalizar o valor antes de atualizar
        const input = event.currentTarget;
        let normalized = this._normalizeInputValue(input.value, input);
        
        // Garantir que o valor está dentro dos limites
        const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : 0;
        // Resiliência não tem limite máximo (pode ser maior que 3)
        const max = input.hasAttribute('max') ? Number(input.getAttribute('max')) : null;
        normalized = Math.max(min, max !== null ? Math.min(max, normalized) : normalized);
        
        // Atualizar o campo imediatamente para feedback visual
        input.value = normalized;
        
        // Calcular EXApoints máximo baseado na Resiliência
        // EXApoints máximo = valor de Resiliência
        const exaMaximo = normalized;
        
        // Calcular EXApoints atual (máximo - gastos)
        const exaGastos = Number(this.actor.system.exapoints?.gastos || 0);
        const exaAtual = Math.max(0, exaMaximo - exaGastos);
        
        // Atualizar Resiliência e EXApoints simultaneamente
        const updateData = {
            "system.atributos.mentais.resiliencia": normalized,
            "system.exapoints.maximo": exaMaximo,
            "system.exapoints.atual": exaAtual
        };
        
        try {
            await this.actor.update(updateData);
            
            // Atualizar os campos visíveis na interface sem re-render completo
            const html = $(this.element);
            
            // Sincronizar o outro campo de Resiliência se estiver visível
            const otherResiliencia = html.find("input[name='system.atributos.mentais.resiliencia']").not(input);
            if (otherResiliencia.length) {
                otherResiliencia.val(normalized);
            }
            
            // Atualizar campos de EXApoints
            const exaMaximoInput = html.find("input[name='system.exapoints.maximo']");
            const exaAtualInput = html.find("input[name='system.exapoints.atual']");
            
            if (exaMaximoInput.length) {
                exaMaximoInput.val(exaMaximo);
            }
            if (exaAtualInput.length) {
                exaAtualInput.val(exaAtual);
            }
        } catch (error) {
            console.error("Erro ao atualizar Resiliência:", error);
            ui.notifications.error("Erro ao atualizar Resiliência");
        }
    }

    async _onExapointsGastosChange(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Normalizar o valor antes de atualizar
        const input = event.currentTarget;
        let normalized = this._normalizeInputValue(input.value, input);
        
        // Garantir que não seja negativo
        normalized = Math.max(0, normalized);
        
        // Atualizar o campo imediatamente para feedback visual
        input.value = normalized;
        
        // Calcular EXApoints atual (máximo - gastos)
        const exaMaximo = Number(this.actor.system.exapoints?.maximo || 0);
        const exaAtual = Math.max(0, exaMaximo - normalized);
        
        // Atualizar EXApoints gastos e atual simultaneamente
        const updateData = {
            "system.exapoints.gastos": normalized,
            "system.exapoints.atual": exaAtual
        };
        
        try {
            await this.actor.update(updateData);
            
            // Atualizar o campo de EXApoints atual na interface
            const html = $(this.element);
            const exaAtualInput = html.find("input[name='system.exapoints.atual']");
            
            if (exaAtualInput.length) {
                exaAtualInput.val(exaAtual);
            }
        } catch (error) {
            console.error("Erro ao atualizar EXApoints gastos:", error);
            ui.notifications.error("Erro ao atualizar EXApoints gastos");
        }
    }

    async _onArmaduraChange(event) {
        // Calcular Armadura atual (total - dano)
        const total = Number(this.actor.system.armadura?.total || 0);
        const dano = Number(this.actor.system.armadura?.dano || 0);
        const atual = Math.max(0, total - dano);
        
        // Atualizar Armadura atual
        await this.actor.update({
            "system.armadura.atual": atual
        });
        
        // Atualizar o campo na interface
        const html = $(this.element);
        const atualInput = html.find("input[name='system.armadura.atual']");
        if (atualInput.length) {
            atualInput.val(atual);
        }
    }

    async _onRollArmadura(event) {
        event.preventDefault();
        const armaduraAtual = Number(this.actor.system.armadura?.atual || 0);
        
        if (armaduraAtual <= 0) {
            ui.notifications.warn("Armadura atual é 0 ou inválida!");
            return;
        }

        // Importar o RollDialog
        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        
        // Abrir modal de rolagem usando a Armadura atual como base
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: "Teste de Armadura",
            baseDice: armaduraAtual,
            actor: this.actor,
            label: "Armadura"
        });
    }

    async _onRollAttribute(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const atributoPath = button.dataset.atributo;
        const label = button.dataset.label;
        const valor = foundry.utils.getProperty(this.actor.system, atributoPath);
        if (!valor || isNaN(valor)) {
            ui.notifications.warn(`Valor inválido para ${label}`);
            return;
        }

        // Importar o RollDialog
        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        
        // Abrir modal de rolagem
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: `Teste de ${label}`,
            baseDice: valor,
            actor: this.actor,
            label: label
        });
    }

    async _onEquipamentoSelect(event) {
        event.preventDefault();
        event.stopPropagation();
        const select = event.currentTarget;
        // Extrair o índice do nome do campo (ex: "system.inventario.equipamentos.0.id" -> 0)
        const match = select.name.match(/equipamentos\.(\d+)\.id/);
        const index = match ? parseInt(match[1]) : 0;
        
        // Ler o valor do selectedIndex diretamente
        let itemId = "";
        const selectedOption = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
        if (selectedOption) {
            itemId = selectedOption.value || "";
        }
        
        // Fallback
        if (!itemId) {
            itemId = select.value || $(select).val() || "";
        }
        
        let itemName = "";
        if (itemId && game.packs && game.packs.size > 0) {
            try {
                let pack = game.packs.get("rising-steel.equipamentos");
                if (!pack) {
                    const allPacks = Array.from(game.packs);
                    pack = allPacks.find(p => {
                        const label = (p.metadata?.label || "").toLowerCase();
                        const name = (p.metadata?.name || "").toLowerCase();
                        return label.includes("equipamento") || name.includes("equipamento");
                    });
                }
                if (pack) {
                    const item = await pack.getDocument(itemId);
                    if (item) {
                        itemName = item.name;
                        console.log(`[Rising Steel] Equipamento encontrado no pack - Nome: "${item.name}", ID salvo: "${itemId}"`);
                    }
                }
            } catch (error) {
                // Silenciosamente ignorar erro
            }
        }
        
        // Garantir que itemId é uma string válida, não null ou undefined
        const idParaSalvar = String(itemId || "").trim();
        
        if (!idParaSalvar && itemId) {
            // Se itemId existe mas não pode ser convertido para string válida, há problema
            console.warn(`[Rising Steel] Tentando salvar equipamento ${index} com ID inválido:`, itemId);
        }
        
        // Ler o estado atual completo do array de equipamentos
        // Usar deep clone para garantir que não há referências compartilhadas
        const equipamentosAtuais = JSON.parse(JSON.stringify(this.actor.system.inventario?.equipamentos || []));
        
        // Garantir que o array tenha o tamanho mínimo necessário
        while (equipamentosAtuais.length <= index) {
            equipamentosAtuais.push({id: "", nome: ""});
        }
        
        // Preservar os valores existentes dos outros equipamentos antes de atualizar
        console.log(`[Rising Steel] Estado atual dos equipamentos ANTES da atualização (índice ${index}):`, equipamentosAtuais.map((e, i) => ({
            index: i,
            id: e?.id || "",
            nome: e?.nome || ""
        })));
        
        // Criar um novo objeto para o equipamento específico
        const novoEquipamento = {
            id: idParaSalvar || "",
            nome: String(itemName || "")
        };
        
        // Atualizar APENAS o índice específico
        equipamentosAtuais[index] = novoEquipamento;
        
        console.log(`[Rising Steel] Salvando equipamento ${index}:`, {
            id: novoEquipamento.id,
            nome: novoEquipamento.nome
        });
        
        console.log(`[Rising Steel] Estado completo dos equipamentos APÓS atualização:`, equipamentosAtuais.map((e, i) => ({
            index: i,
            id: e?.id || "",
            nome: e?.nome || ""
        })));
        
        await this.actor.update({
            "system.inventario.equipamentos": equipamentosAtuais
        });
    }


    async _onArmaSelect(event) {
        event.preventDefault();
        event.stopPropagation();
        const select = event.currentTarget;
        // Extrair o índice do nome do campo (ex: "system.inventario.armas.0.id" -> 0)
        const match = select.name.match(/armas\.(\d+)\.id/);
        const index = match ? parseInt(match[1]) : 0;
        
        // Ler o valor do selectedIndex diretamente
        let itemId = "";
        const selectedOption = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
        if (selectedOption) {
            itemId = selectedOption.value || "";
        }
        
        // Fallback
        if (!itemId) {
            itemId = select.value || $(select).val() || "";
        }
        
        let itemName = "";
        let dano = 0;
        let alcance = "";
        let bonus = 0;
        
        // Se não houver itemId, limpar os campos do slot específico
        if (!itemId) {
            // Criar um array completamente novo com deep clone
            const armasAtuais = JSON.parse(JSON.stringify(this.actor.system.inventario?.armas || []));
            
            // Garantir que o array tenha o tamanho mínimo necessário
            while (armasAtuais.length <= index) {
                armasAtuais.push({id: "", nome: "", dano: 0, alcance: "", bonus: 0});
            }
            
            // Criar um novo array onde cada slot é um objeto completamente novo
            const armasNovas = armasAtuais.map((arma, idx) => {
                if (idx === index) {
                    // Para o slot sendo limpo, criar objeto vazio
                    return {
                        id: "",
                        nome: "",
                        dano: 0,
                        alcance: "",
                        bonus: 0
                    };
                } else {
                    // Para os outros slots, criar novo objeto com valores atuais
                    return {
                        id: String(arma?.id || ""),
                        nome: String(arma?.nome || ""),
                        dano: Number(arma?.dano || 0),
                        alcance: String(arma?.alcance || ""),
                        bonus: Number(arma?.bonus || 0)
                    };
                }
            });
            
            await this.actor.update({
                "system.inventario.armas": armasNovas
            }, {render: true});
            return;
        }
        
        // Ler o estado atual das armas antes de buscar no pack (para caso precisemos buscar pelo nome)
        const armasAtuaisParaBusca = JSON.parse(JSON.stringify(this.actor.system.inventario?.armas || []));
        const armaSalvaAtual = armasAtuaisParaBusca[index] || null;
        
        if (itemId && game.packs && game.packs.size > 0) {
            try {
                let pack = game.packs.get("rising-steel.armas");
                if (!pack) {
                    const allPacks = Array.from(game.packs);
                    pack = allPacks.find(p => {
                        const label = (p.metadata?.label || "").toLowerCase();
                        const name = (p.metadata?.name || "").toLowerCase();
                        return label.includes("arma") || name.includes("arma");
                    });
                }
                if (pack) {
                    // Tentar buscar o item pelo ID do dropdown primeiro
                    let item = null;
                    try {
                        item = await pack.getDocument(itemId);
                    } catch (error) {
                        console.warn(`[Rising Steel] Erro ao buscar arma com ID "${itemId}":`, error);
                    }
                    
                    if (item) {
                        itemName = item.name;
                        // Acessar os dados do sistema do item
                        const itemSystem = item.system || {};
                        dano = Number(itemSystem.dano || 0);
                        alcance = itemSystem.alcance || "";
                        bonus = Number(itemSystem.bonus || 0);
                        
                        // IMPORTANTE: Usar o ID real do documento retornado pelo getDocument
                        // Este é o ID que deve ser usado para buscar no futuro
                        const idRealDoItem = item.id || item._id || itemId;
                        itemId = String(idRealDoItem);
                        
                        console.log(`[Rising Steel] Arma encontrada no pack - Nome: "${item.name}", Dano: ${dano}, Alcance: "${alcance}", ID usado: "${itemId}"`);
                    } else {
                        // Se não encontrou pelo ID, tentar buscar todos os itens e encontrar pelo nome
                        console.warn(`[Rising Steel] Arma com ID "${itemId}" não encontrada no pack. Buscando todas as armas...`);
                        try {
                            const allItems = await pack.getDocuments();
                            // Tentar encontrar pelo ID em todos os itens (pode estar com formato diferente)
                            let foundItem = allItems.find(i => {
                                const idDoItem = String(i.id || i._id || "");
                                return idDoItem === itemId || idDoItem === String(itemId);
                            });
                            
                            // Se não encontrou pelo ID, tentar pelo nome da opção selecionada no dropdown
                            if (!foundItem) {
                                const selectedOption = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
                                if (selectedOption && selectedOption.text) {
                                    const nomeDoDropdown = selectedOption.text.trim();
                                    foundItem = allItems.find(i => {
                                        const nomeItem = (i.name || "").trim();
                                        return nomeItem === nomeDoDropdown && nomeItem !== "";
                                    });
                                }
                            }
                            
                            // Se ainda não encontrou, tentar pelo nome da arma salva atualmente
                            if (!foundItem && armaSalvaAtual && armaSalvaAtual.nome) {
                                const nomeSalvo = (armaSalvaAtual.nome || "").trim().toLowerCase();
                                foundItem = allItems.find(i => {
                                    const nomeItem = (i.name || "").trim().toLowerCase();
                                    return nomeItem === nomeSalvo && nomeItem !== "";
                                });
                            }
                            
                            if (foundItem) {
                                item = foundItem;
                                itemName = item.name;
                                const itemSystem = item.system || {};
                                dano = Number(itemSystem.dano || 0);
                                alcance = itemSystem.alcance || "";
                                bonus = Number(itemSystem.bonus || 0);
                                
                                // Atualizar o ID para o ID real do item encontrado
                                itemId = String(item.id || item._id || itemId);
                                console.log(`[Rising Steel] Arma encontrada após busca - Nome: "${item.name}", ID corrigido: "${itemId}"`);
                            } else {
                                console.warn(`[Rising Steel] Não foi possível encontrar a arma com ID "${itemId}" no pack. Usando valores do dropdown.`);
                            }
                        } catch (err) {
                            console.warn(`[Rising Steel] Erro ao buscar arma no pack:`, err);
                        }
                    }
                }
            } catch (error) {
                console.warn(`[Rising Steel] Erro ao buscar pack de armas:`, error);
            }
        }
        
        // Garantir que itemId é uma string válida, não null ou undefined
        const idParaSalvar = String(itemId || "").trim();
        
        if (!idParaSalvar && itemId) {
            // Se itemId existe mas não pode ser convertido para string válida, há problema
            console.warn(`[Rising Steel] Tentando salvar arma ${index} com ID inválido:`, itemId);
        }
        
        // Ler o estado atual completo do array de armas
        // Usar deep clone para garantir que não há referências compartilhadas
        const armasAtuais = JSON.parse(JSON.stringify(this.actor.system.inventario?.armas || []));
        
        // Garantir que o array tenha o tamanho mínimo necessário
        while (armasAtuais.length <= index) {
            armasAtuais.push({id: "", nome: "", dano: 0, alcance: "", bonus: 0});
        }
        
        // Preservar os valores existentes das outras armas antes de atualizar
        console.log(`[Rising Steel] Estado atual das armas ANTES da atualização (índice ${index}):`, armasAtuais.map((a, i) => ({
            index: i,
            id: a?.id || "",
            nome: a?.nome || "",
            dano: a?.dano || 0,
            alcance: a?.alcance || "",
            bonus: a?.bonus || 0
        })));
        
        // IMPORTANTE: Garantir que cada slot de arma é completamente independente
        // Criar um novo objeto totalmente novo para a arma no slot específico
        // NÃO usar referências ou objetos compartilhados
        const novaArma = {
            id: idParaSalvar || "",
            nome: itemName || "",
            dano: itemName ? Number(dano) : 0,
            alcance: itemName ? String(alcance || "") : "",
            bonus: itemName ? Number(bonus) : 0
        };
        
        // Garantir que estamos criando um array completamente novo
        // Copiar todas as armas existentes, criando novos objetos para cada uma
        const armasNovas = armasAtuais.map((arma, idx) => {
            if (idx === index) {
                // Para o slot sendo atualizado, usar o novo objeto
                return {
                    id: novaArma.id,
                    nome: novaArma.nome,
                    dano: novaArma.dano,
                    alcance: novaArma.alcance,
                    bonus: novaArma.bonus
                };
            } else {
                // Para os outros slots, criar um novo objeto com os valores atuais
                // Isso garante que não há referências compartilhadas
                return {
                    id: String(arma?.id || ""),
                    nome: String(arma?.nome || ""),
                    dano: Number(arma?.dano || 0),
                    alcance: String(arma?.alcance || ""),
                    bonus: Number(arma?.bonus || 0)
                };
            }
        });
        
        console.log(`[Rising Steel] Salvando arma ${index}:`, {
            id: novaArma.id,
            nome: novaArma.nome,
            dano: novaArma.dano,
            alcance: novaArma.alcance,
            bonus: novaArma.bonus
        });
        
        console.log(`[Rising Steel] Estado completo das armas APÓS atualização:`, armasNovas.map((a, i) => ({
            index: i,
            id: a?.id || "",
            nome: a?.nome || "",
            dano: a?.dano || 0,
            alcance: a?.alcance || "",
            bonus: a?.bonus || 0
        })));
        
        // DEBUG: Verificar se o array está correto
        console.log(`[Rising Steel] DEBUG - Verificando array armasNovas:`);
        armasNovas.forEach((arma, idx) => {
            console.log(`  Slot ${idx}:`, {
                id: arma.id,
                nome: arma.nome,
                isSameObject: idx === index ? 'ATUALIZADO' : 'PRESERVADO'
            });
        });
        
        // Preservar equipamentos durante a atualização (usar deep clone também)
        const equipamentosAtuais = JSON.parse(JSON.stringify(this.actor.system.inventario?.equipamentos || []));
        
        // Atualizar APENAS o array de armas, garantindo que cada slot seja independente
        // Usar render: true para que a UI seja atualizada imediatamente
        await this.actor.update({
            "system.inventario.armas": armasNovas,
            "system.inventario.equipamentos": equipamentosAtuais
        }, {render: true});
        
        // Forçar atualização dos campos de input para garantir que os valores sejam exibidos corretamente
        const html = $(this.element);
        const danoInput = html.find(`input[name="system.inventario.armas.${index}.dano"]`);
        const alcanceInput = html.find(`input[name="system.inventario.armas.${index}.alcance"]`);
        const bonusInput = html.find(`input[name="system.inventario.armas.${index}.bonus"]`);
        
        if (danoInput.length) danoInput.val(novaArma.dano);
        if (alcanceInput.length) alcanceInput.val(novaArma.alcance);
        if (bonusInput.length) bonusInput.val(novaArma.bonus);
    }

    async _onArmaduraSelect(event) {
        event.preventDefault();
        event.stopPropagation();
        const select = event.currentTarget;
        
        // Ler o valor do selectedIndex diretamente (mesmo padrão de equipamentos e armas)
        let armaduraId = "";
        const selectedOption = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
        if (selectedOption) {
            armaduraId = selectedOption.value || "";
        }
        
        // Fallback
        if (!armaduraId) {
            armaduraId = select.value || $(select).val() || "";
        }
        
        // Debug: verificar qual ID foi selecionado
        if (armaduraId) {
            console.log(`[Rising Steel] Armadura selecionada - ID: "${armaduraId}", selectedIndex: ${select.selectedIndex}, valor atual do select: "${select.value}"`);
        } else {
            console.log(`[Rising Steel] Nenhuma armadura selecionada - selectedIndex: ${select.selectedIndex}, valor atual do select: "${select.value}"`);
        }
        
        if (!armaduraId) {
            // Se nenhuma armadura foi selecionada, limpar os valores
            await this.actor.update({
                "system.armadura.equipada": "",
                "system.armadura.total": 0,
                "system.armadura.dano": 0,
                "system.armadura.atual": 0
            });
            return;
        }
        
        // Buscar dados da armadura do pack
        let protecao = 0;
        if (game.packs && game.packs.size > 0) {
            try {
                let pack = game.packs.get("rising-steel.armaduras");
                if (!pack) {
                    const allPacks = Array.from(game.packs);
                    pack = allPacks.find(p => {
                        const label = (p.metadata?.label || "").toLowerCase();
                        const name = (p.metadata?.name || "").toLowerCase();
                        return label.includes("armadura") || name.includes("armadura");
                    });
                }
                if (pack) {
                    const item = await pack.getDocument(armaduraId);
                    if (item) {
                        protecao = Number(item.system?.protecao || 0);
                        // O ID usado é o armaduraId (do dropdown), não item.id que pode ser null
                        console.log(`[Rising Steel] Armadura encontrada no pack - Nome: "${item.name}", Proteção: ${protecao}, ID salvo: "${armaduraId}"`);
                    } else {
                        console.warn(`[Rising Steel] Armadura com ID "${armaduraId}" não encontrada no pack!`);
                        // Tentar listar todos os IDs disponíveis para debug
                        try {
                            const allItems = await pack.getDocuments();
                            const availableIds = allItems.map(i => i.id);
                            console.warn(`[Rising Steel] IDs disponíveis no pack de armaduras:`, availableIds);
                        } catch (err) {
                            // Ignorar erro ao listar itens
                        }
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar armadura do pack:", error);
            }
        }
        
        // Atualizar armadura equipada e proteção total
        const danoAtual = Number(this.actor.system.armadura?.dano || 0);
        const atual = Math.max(0, protecao - danoAtual);
        
        // Garantir que armaduraId é uma string válida, não null ou undefined
        const idParaSalvar = String(armaduraId || "").trim();
        
        if (!idParaSalvar) {
            console.warn(`[Rising Steel] Tentando salvar armadura sem ID válido!`);
            return;
        }
        
        console.log(`[Rising Steel] Salvando armadura - ID: "${idParaSalvar}", Proteção: ${protecao}`);
        
        await this.actor.update({
            "system.armadura.equipada": idParaSalvar,
            "system.armadura.total": protecao,
            "system.armadura.atual": atual
        });
    }

    async _onRollEquipamento(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const index = parseInt(button.dataset.index || 0);
        const nome = button.dataset.nome || "";
        
        if (!nome || nome === "") {
            ui.notifications.warn("Nenhum equipamento selecionado!");
            return;
        }

        // Importar o RollDialog
        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        
        // Abrir modal de rolagem com 1d6 como base e permitir seleção de atributo
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: `Teste com ${nome}`,
            baseDice: 1,
            actor: this.actor,
            label: nome,
            allowAttributeSelection: true
        });
    }

    async _onRollArma(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const index = parseInt(button.dataset.index || 0);
        const nome = button.dataset.nome || "";
        
        if (!nome || nome === "") {
            ui.notifications.warn("Nenhuma arma selecionada!");
            return;
        }

        // Buscar o bônus da arma do inventário
        const armas = this.actor.system.inventario?.armas || [];
        const arma = armas[index];
        const bonus = Number(arma?.bonus || 0);
        
        // Se não houver bônus, usar 1 como padrão
        const baseDice = bonus > 0 ? bonus : 1;

        // Importar o RollDialog
        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        
        // Abrir modal de rolagem com o bônus da arma como base e permitir seleção de atributo
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: `Teste com ${nome}`,
            baseDice: baseDice,
            actor: this.actor,
            label: nome,
            allowAttributeSelection: true
        });
    }

    /**
     * Handle initiative roll
     * @param {Event} event
     * @private
     */
    async _onRollIniciativa(event) {
        event.preventDefault();
        
        try {
            // Verificar se há um combate ativo
            let combat = game.combat;
            
            // Se não houver combate, criar um novo
            if (!combat) {
                if (FoundryCompatibility.isV13()) {
                    // v13: criar combate usando foundry.documents
                    const combatData = {
                        scene: canvas.scene?.id || null,
                        combatants: []
                    };
                    combat = await foundry.documents.BaseCombat.create(combatData, { temporary: false });
                } else {
                    // v12: criar combate usando Combat.create
                    combat = await Combat.create({
                        scene: canvas.scene?.id || null,
                        combatants: []
                    });
                }
                
                if (!combat) {
                    ui.notifications.warn("Não foi possível criar um combate. Certifique-se de estar em uma cena.");
                    return;
                }
            }
            
            // Verificar se o actor já está no combate
            let combatant = combat.combatants.find(c => c.actor?.id === this.actor.id);
            
            // Se não estiver no combate, adicionar
            if (!combatant) {
                // Adicionar o token ao combate
                const tokens = this.actor.getActiveTokens(true);
                if (tokens.length === 0) {
                    ui.notifications.warn("Nenhum token ativo encontrado para este personagem. Coloque o token na cena primeiro.");
                    return;
                }
                
                const token = tokens[0];
                
                // Criar combatant
                const combatantData = {
                    tokenId: token.id,
                    actorId: this.actor.id
                };
                
                if (FoundryCompatibility.isV13()) {
                    combatantData.sceneId = canvas.scene?.id;
                }
                
                await combat.createEmbeddedDocuments("Combatant", [combatantData]);
                
                // Atualizar a referência do combate e encontrar o combatant
                combat = game.combat;
                combatant = combat.combatants.find(c => c.actor?.id === this.actor.id);
            }
            
            if (!combatant) {
                ui.notifications.error("Não foi possível encontrar o combatente no combate.");
                return;
            }
            
            // Calcular o valor de iniciativa (destreza + perspicácia)
            const destreza = this.actor.system.atributos?.fisicos?.destreza || 0;
            const perspicacia = this.actor.system.atributos?.mentais?.perspicacia || 0;
            const iniciativaBase = destreza + perspicacia;
            
            // Rolar Xd6 onde X é o valor de iniciativa
            const roll = new Roll(`${iniciativaBase}d6`);
            await roll.roll();
            
            // Atualizar a iniciativa do combatant
            const rollTotal = Number(roll.total ?? roll._total ?? 0);
            if (FoundryCompatibility.isV13()) {
                // v13: usar rollInitiative do combatant
                await combatant.rollInitiative({ formula: `${iniciativaBase}d6` });
            } else {
                // v12: atualizar diretamente
                await combatant.update({ initiative: rollTotal });
            }
            
            // Exibir a rolagem no chat
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor, token: combatant.token }),
                flavor: `Rolagem de Iniciativa: ${destreza} (Destreza) + ${perspicacia} (Perspicácia) = ${iniciativaBase}d6`
            });
            
            ui.notifications.info(`Iniciativa rolada: ${rollTotal}`);
            
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar iniciativa:", error);
            ui.notifications.error("Erro ao rolar iniciativa. Verifique o console.");
        }
    }

    /**
     * Open the companion sheet if linked
     * @param {Event} event
     * @private
     */
    async _onOpenCompanionSheet(event) {
        event.preventDefault();
        const companionId = this.actor.system?.companionId;
        if (!companionId) {
            ui.notifications?.warn("Nenhum companion vinculado a este piloto.");
            return;
        }

        if (!game?.actors) {
            ui.notifications?.error("Coleção de atores indisponível.");
            return;
        }

        const companion = game.actors.get(companionId);
        if (!companion) {
            ui.notifications?.warn("Companion não encontrado. Verifique se ele ainda existe.");
            return;
        }

        companion.sheet?.render(true, { focus: true });
    }

    /**
     * Get the linked companion actor
     * @returns {Actor|null}
     * @private
     */
    _getLinkedCompanion() {
        const companionId = this.actor.system?.companionId;
        if (!companionId || !game?.actors) return null;
        const companion = game.actors.get(companionId);
        return companion || null;
    }

    /**
     * Roll companion attribute
     * @param {Event} event
     * @private
     */
    async _onRollCompanionAttribute(event) {
        event.preventDefault();
        const companion = this._getLinkedCompanion();
        if (!companion) {
            ui.notifications?.warn("Nenhum companion vinculado.");
            return;
        }

        const path = event.currentTarget.dataset.atributo;
        if (!path) return;

        // Tentar ler do DOM primeiro (input readonly na aba de vínculo)
        const formElement = this.element?.get(0);
        let domValue = null;
        if (formElement) {
            const button = event.currentTarget;
            const row = button.closest("tr");
            if (row) {
                const input = row.querySelector("input[type='number']");
                if (input && input.value !== undefined && input.value !== "") {
                    const parsed = Number(String(input.value).replace(/,/g, "."));
                    if (!Number.isNaN(parsed)) domValue = parsed;
                }
            }
        }

        // Se não encontrou no DOM, ler do sistema do companion
        const cleanPath = path.replace("companion.", "");
        const systemValue = foundry.utils.getProperty(companion.system, cleanPath);
        const systemNumValue = Number(String(systemValue ?? 0).replace(/,/g, "."));
        
        // Usar o valor do DOM se disponível, senão usar o do sistema
        const numValue = (!Number.isNaN(domValue) && domValue !== null) ? domValue : 
            (!Number.isNaN(systemNumValue) ? systemNumValue : 0);

        if (numValue <= 0 || Number.isNaN(numValue)) {
            ui.notifications.warn("Este atributo precisa ser maior que zero para rolar.");
            return;
        }

        const labelMap = {
            "atributos.fisicos.forca": "FOR",
            "atributos.fisicos.destreza": "DES",
            "atributos.fisicos.vigor": "VIG",
            "atributos.mentais.conhecimento": "CON",
            "atributos.mentais.perspicacia": "PER",
            "atributos.mentais.resiliencia": "RES",
            "atributos.sociais.eloquencia": "ELO",
            "atributos.sociais.dissimulacao": "DIS",
            "atributos.sociais.presenca": "PRE"
        };

        const label = labelMap[cleanPath] || "Atributo";
        const roll = await new Roll(`${numValue}d6`).roll();
        const dice = roll.dice?.[0];
        let successes = 0;
        if (dice?.results) {
            successes = dice.results.filter(r => (r.result ?? r.total) === 6).length;
        }

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: companion }),
            flavor: `Rolagem de ${label} do Companion (${numValue}d6)`,
            flags: {
                "rising-steel": {
                    rollType: "success-pool",
                    totalDice: numValue,
                    successes
                }
            }
        });
    }

    /**
     * Roll companion initiative
     * @param {Event} event
     * @private
     */
    async _onRollCompanionIniciativa(event) {
        event.preventDefault();
        const companion = this._getLinkedCompanion();
        if (!companion) {
            ui.notifications?.warn("Nenhum companion vinculado.");
            return;
        }

        try {
            const { FoundryCompatibility } = await import("../utils/compatibility.js");
            let combat = game.combat;
            if (!combat) {
                if (FoundryCompatibility.isV13()) {
                    combat = await foundry.documents.BaseCombat.create({
                        scene: canvas.scene?.id || null,
                        combatants: []
                    }, { temporary: false });
                } else {
                    combat = await Combat.create({
                        scene: canvas.scene?.id || null,
                        combatants: []
                    });
                }
                if (!combat) {
                    ui.notifications.warn("Não foi possível criar um combate. Certifique-se de estar em uma cena.");
                    return;
                }
            }

            let combatant = combat.combatants.find(c => c.actor?.id === companion.id);
            if (!combatant) {
                const tokens = companion.getActiveTokens(true);
                if (tokens.length === 0) {
                    ui.notifications.warn("Nenhum token ativo encontrado para este companion. Coloque o token na cena primeiro.");
                    return;
                }
                const token = tokens[0];
                const combatantData = {
                    tokenId: token.id,
                    actorId: companion.id
                };
                if (FoundryCompatibility.isV13()) {
                    combatantData.sceneId = canvas.scene?.id;
                }
                await combat.createEmbeddedDocuments("Combatant", [combatantData]);
                combat = game.combat;
                combatant = combat.combatants.find(c => c.actor?.id === companion.id);
            }

            if (!combatant) {
                ui.notifications.error("Não foi possível encontrar o combatente no combate.");
                return;
            }

            const destreza = Number(companion.system?.atributos?.fisicos?.destreza || 0);
            const perspicacia = Number(companion.system?.atributos?.mentais?.perspicacia || 0);
            const iniciativaBase = destreza + perspicacia;

            if (iniciativaBase <= 0) {
                ui.notifications.warn("Valor de iniciativa inválido para este companion.");
                return;
            }

            const roll = await new Roll(`${iniciativaBase}d6`).roll();

            if (FoundryCompatibility.isV13()) {
                await combatant.rollInitiative({ formula: `${iniciativaBase}d6` });
            } else {
                const rollTotal = roll.total ?? 0;
                await combatant.update({ initiative: rollTotal });
            }

            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: companion, token: combatant.token }),
                flavor: `Rolagem de Iniciativa do Companion (${destreza} + ${perspicacia})`
            });

            ui.notifications.info(`Iniciativa rolada: ${roll.total ?? 0}`);
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar iniciativa do companion:", error);
            ui.notifications.error("Erro ao rolar iniciativa. Verifique o console.");
        }
    }

    /**
     * Roll companion attack
     * @param {Event} event
     * @private
     */
    async _onRollCompanionAttack(event) {
        event.preventDefault();
        const companion = this._getLinkedCompanion();
        if (!companion) {
            ui.notifications?.warn("Nenhum companion vinculado.");
            return;
        }

        const index = parseInt(event.currentTarget.dataset.index);
        if (Number.isNaN(index)) return;

        const ataques = companion.system?.ataques || [];
        const ataque = ataques[index];
        if (!ataque) {
            ui.notifications?.warn("Ataque não encontrado.");
            return;
        }

        if (!ataque.atributo) {
            ui.notifications.warn("Defina o atributo do ataque antes de rolar.");
            return;
        }

        const normalizeNumber = (value) => {
            if (value === null || value === undefined || value === "") return 0;
            const normalized = String(value).replace(/,/g, '.');
            const num = Number(normalized);
            return isNaN(num) ? 0 : num;
        };

        const getAttributeValue = (path) => {
            if (!path) return 0;
            const value = foundry.utils.getProperty(companion.system, path);
            return normalizeNumber(value);
        };

        const atributoValor = getAttributeValue(ataque.atributo);
        if (atributoValor <= 0) {
            ui.notifications.warn("O atributo selecionado não possui valor.");
            return;
        }

        const dadoBonus = Math.max(0, normalizeNumber(ataque.dadoBonus) || 0);
        const totalDados = atributoValor + dadoBonus;

        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: ataque.nome || `Ataque do Companion ${index + 1}`,
            baseDice: totalDados,
            actor: companion,
            label: ataque.nome || `Ataque do Companion ${index + 1}`
        });
    }

    /**
     * Roll companion habilidade
     * @param {Event} event
     * @private
     */
    async _onRollCompanionHabilidade(event) {
        event.preventDefault();
        const companion = this._getLinkedCompanion();
        if (!companion) {
            ui.notifications?.warn("Nenhum companion vinculado.");
            return;
        }

        const index = parseInt(event.currentTarget.dataset.index);
        if (Number.isNaN(index)) return;

        const habilidades = Array.isArray(companion.system?.habilidadesEspeciais) 
            ? companion.system.habilidadesEspeciais 
            : [];
        const habilidade = habilidades[index];
        if (!habilidade) {
            ui.notifications?.warn("Habilidade não encontrada.");
            return;
        }

        const usos = habilidade.usos || { atual: 0, total: 0 };

        new Dialog({
            title: habilidade.nome || "Habilidade do Companion",
            content: `
                <p><strong>${habilidade.nome}</strong></p>
                <p>Usos restantes: ${usos.atual} / ${usos.total}</p>
                <p>Deseja consumir uma carga?</p>
            `,
            buttons: {
                consume: {
                    icon: '<i class="fas fa-bolt"></i>',
                    label: "Consumir",
                    callback: async () => {
                        if (usos.atual <= 0) {
                            ui.notifications.warn("Sem cargas disponíveis.");
                            return;
                        }

                        const novaLista = [...habilidades];
                        novaLista[index] = {
                            nome: String(habilidade.nome || ""),
                            descricao: String(habilidade.descricao || ""),
                            usos: {
                                atual: Math.max(0, Number(usos.atual || 0) - 1),
                                total: Math.max(0, Number(usos.total || 0))
                            }
                        };
                        await companion.update({ "system.habilidadesEspeciais": novaLista });
                        this._enviarCompanionHabilidadeChat(companion, habilidade, true);
                    }
                },
                justRoll: {
                    icon: '<i class="fas fa-comment"></i>',
                    label: "Só mostrar no chat",
                    callback: () => this._enviarCompanionHabilidadeChat(companion, habilidade, false)
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar"
                }
            },
            default: "consume"
        }).render(true);
    }

    /**
     * Send companion habilidade to chat
     * @param {Actor} companion
     * @param {Object} habilidade
     * @param {boolean} consumiuCarga
     * @private
     */
    _enviarCompanionHabilidadeChat(companion, habilidade, consumiuCarga) {
        const content = `
            <h3>${habilidade.nome}</h3>
            <p>${habilidade.descricao || "Sem descrição"}</p>
            ${consumiuCarga ? "<p><em>Uma carga foi consumida.</em></p>" : ""}
        `;

        ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: companion }),
            content
        });
    }

    /**
     * Handle create especialização
     * @param {Event} event
     * @private
     */
    async _onCreateEspecializacao(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const tipo = button.dataset.tipo; // fisicos, mentais ou sociais
        
        // Abrir modal similar ao de itens
        await this._showEspecializacaoDialog(tipo);
    }

    /**
     * Show especialização dialog (create/edit)
     * @param {string} tipo - Tipo de especialização (fisicos, mentais, sociais)
     * @param {number} index - Index para edição (undefined para criar)
     * @private
     */
    async _showEspecializacaoDialog(tipo, index = undefined) {
        const especializacoes = this.actor.system.especializacoes?.[tipo] || [];
        const especializacao = index !== undefined ? especializacoes[index] : null;
        
        // Lista de atributos baseado no tipo
        const atributosPorTipo = {
            fisicos: [
                { value: "atributos.fisicos.forca", label: "Força" },
                { value: "atributos.fisicos.destreza", label: "Destreza" },
                { value: "atributos.fisicos.vigor", label: "Vigor" }
            ],
            mentais: [
                { value: "atributos.mentais.conhecimento", label: "Conhecimento" },
                { value: "atributos.mentais.perspicacia", label: "Perspicácia" },
                { value: "atributos.mentais.resiliencia", label: "Resiliência" }
            ],
            sociais: [
                { value: "atributos.sociais.eloquencia", label: "Eloquência" },
                { value: "atributos.sociais.dissimulacao", label: "Dissimulação" },
                { value: "atributos.sociais.presenca", label: "Presença" }
            ]
        };
        
        const atributos = atributosPorTipo[tipo] || [];
        const exapointsAtual = this.actor.system.exapoints?.atual || 0;
        const exapointsMaximo = this.actor.system.exapoints?.maximo || 0;
        
        // Renderizar template do dialog
        const templatePath = "systems/rising-steel/template/app/especializacao-dialog.html";
        const htmlContent = await FoundryCompatibility.renderTemplate(templatePath, {
            especializacao: especializacao || { nome: "", atributo: "", dadoBase: 1, dadoBonus: 0, exapoints: 0 },
            atributos: atributos,
            exapointsAtual: exapointsAtual,
            exapointsMaximo: exapointsMaximo,
            isEdit: index !== undefined
        });
        
        new Dialog({
            title: index !== undefined ? "Editar Especialização" : "Criar Especialização",
            content: htmlContent,
            buttons: {
                save: {
                    icon: '<i class="fas fa-check"></i>',
                    label: index !== undefined ? "Salvar" : "Criar",
                    callback: async (html) => {
                        const nome = html.find("#especializacao-nome").val().trim();
                        const atributo = html.find("#especializacao-atributo").val();
                        const dadoBase = parseInt(html.find("#especializacao-dado-base").val()) || 1;
                        
                        // Apenas ler dadoBonus e exapoints se estiver editando
                        const dadoBonus = index !== undefined ? (parseInt(html.find("#especializacao-dado-bonus").val()) || 0) : 0;
                        const exapoints = index !== undefined ? (parseInt(html.find("#especializacao-exapoints").val()) || 0) : 0;
                        
                        if (!nome) {
                            ui.notifications.warn("O nome da especialização não pode estar vazio.");
                            return;
                        }
                        
                        if (!atributo) {
                            ui.notifications.warn("Selecione um atributo.");
                            return;
                        }
                        
                        // Validar EXApoints apenas se estiver editando
                        if (index !== undefined && exapoints > exapointsMaximo) {
                            ui.notifications.warn(`O máximo de EXApoints é ${exapointsMaximo}!`);
                            return;
                        }
                        
                        const novaEspecializacao = {
                            nome: nome,
                            atributo: atributo,
                            dadoBase: dadoBase,
                            dadoBonus: dadoBonus,
                            exapoints: exapoints
                        };
                        
                        // Obter lista atual
                        const especializacoesAtual = foundry.utils.getProperty(this.actor, `system.especializacoes.${tipo}`) || [];
                        
                        if (index !== undefined) {
                            // Editar
                            especializacoesAtual[index] = novaEspecializacao;
                        } else {
                            // Criar
                            especializacoesAtual.push(novaEspecializacao);
                        }
                        
                        // Atualizar actor
                        await this.actor.update({ [`system.especializacoes.${tipo}`]: especializacoesAtual });
                        this.render(false);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar"
                }
            },
            default: "save"
        }).render(true);
    }

    /**
     * Handle edit especialização
     * @param {Event} event
     * @private
     */
    async _onEditEspecializacao(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const row = button.closest("tr");
        const tipo = row.dataset.tipo;
        const index = parseInt(row.dataset.index);
        
        await this._showEspecializacaoDialog(tipo, index);
    }

    /**
     * Handle delete especialização
     * @param {Event} event
     * @private
     */
    async _onDeleteEspecializacao(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const row = button.closest("tr");
        const tipo = row.dataset.tipo;
        const index = parseInt(row.dataset.index);
        
        const especializacoes = this.actor.system.especializacoes?.[tipo] || [];
        const especializacao = especializacoes[index];
        
        if (!especializacao) {
            ui.notifications.error("Especialização não encontrada.");
            return;
        }
        
        // Confirmar exclusão
        new Dialog({
            title: "Confirmar Exclusão",
            content: `<p>Deseja realmente excluir a especialização "<strong>${especializacao.nome}</strong>"?</p>`,
            buttons: {
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Excluir",
                    callback: async () => {
                        especializacoes.splice(index, 1);
                        await this.actor.update({ [`system.especializacoes.${tipo}`]: especializacoes });
                        this.render(false);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar"
                }
            },
            default: "cancel"
        }).render(true);
    }

    /**
     * Handle roll especialização
     * @param {Event} event
     * @private
     */
    async _onRollEspecializacao(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const tipo = button.dataset.tipo;
        const index = parseInt(button.dataset.index);
        
        const especializacoes = this.actor.system.especializacoes?.[tipo] || [];
        const especializacao = especializacoes[index];
        
        if (!especializacao) {
            ui.notifications.error("Especialização não encontrada.");
            return;
        }
        
        // Obter valor do atributo
        const atributoValue = foundry.utils.getProperty(this.actor, `system.${especializacao.atributo}`) || 0;
        
        if (atributoValue === 0) {
            ui.notifications.warn("O atributo tem valor 0!");
            return;
        }
        
        // Calcular total de dados: dadoBase + dadoBonus + atributo
        const totalDados = especializacao.dadoBase + especializacao.dadoBonus + atributoValue;
        
        // Usar o RollDialog para rolar com EXApoints
        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: especializacao.nome,
            baseDice: totalDados,
            actor: this.actor,
            label: especializacao.nome,
            allowAttributeSelection: false,
            exapointsMaximo: especializacao.exapoints || 0
        });
    }

    _buildLinkedCompanionLists(system) {
        const attributeLabels = this._getLinkedAttributeLabelMap();
        const ataquesRaw = this._coerceToArray(system?.ataques);
        const ataquesList = ataquesRaw.map((ataque, index) => {
            const atributoPath = ataque?.atributo || "";
            const atributoLabel = attributeLabels[atributoPath] || atributoPath || "—";
            const atributoValor = this._getLinkedAttributeValue(system, atributoPath);
            return {
                ...ataque,
                index,
                atributoLabel,
                atributoValor
            };
        });

        const habilidadesRaw = this._coerceToArray(system?.habilidadesEspeciais);
        const habilidadesList = habilidadesRaw.map((hab, index) => ({
            ...hab,
            index,
            usos: {
                atual: hab?.usos?.atual ?? 0,
                total: hab?.usos?.total ?? 0
            }
        }));

        return { ataquesList, habilidadesList };
    }

    _coerceToArray(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") {
            return Object.keys(value)
                .sort((a, b) => Number(a) - Number(b))
                .map(key => value[key]);
        }
        return [];
    }

    _getLinkedAttributeLabelMap() {
        return {
            "system.atributos.fisicos.forca": "FOR",
            "system.atributos.fisicos.destreza": "DES",
            "system.atributos.fisicos.vigor": "VIG",
            "system.atributos.mentais.conhecimento": "CON",
            "system.atributos.mentais.perspicacia": "PER",
            "system.atributos.mentais.resiliencia": "RES",
            "system.atributos.sociais.eloquencia": "ELO",
            "system.atributos.sociais.dissimulacao": "DIS",
            "system.atributos.sociais.presenca": "PRE"
        };
    }

    _getLinkedAttributeValue(system, path) {
        if (!system || !path) return 0;
        const value = foundry.utils.getProperty(system, path);
        const num = Number(value ?? 0);
        return Number.isFinite(num) ? num : 0;
    }
}


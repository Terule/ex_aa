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
            template: "systems/rising-steel/templates/actor/pilot-sheet.html",
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
            
            // Debug: verificar os equipamentos salvos
            console.log(`[Rising Steel] Equipamentos salvos no actor:`, context.system.inventario?.equipamentos);
            console.log(`[Rising Steel] Equipamentos disponíveis no compendium:`, context.equipamentos.map(e => ({id: e.id, name: e.name})));
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
            
            // Forçar reload do índice do pack
            try {
                // Limpar cache e forçar reload
                if (pack.indexed) {
                    pack.index.clear();
                }
                await pack.getIndex({force: true});
            } catch (error) {
                console.warn(`[Rising Steel] Erro ao recarregar índice do pack "${packName}":`, error);
            }
            
            // Verificar o índice
            let index = pack.index;
            console.log(`[Rising Steel] Pack "${packName}" - Índice tem ${index ? index.size : 0} entradas`);
            
            // Se o índice estiver vazio, tentar construir manualmente
            if (!index || index.size === 0) {
                console.log(`[Rising Steel] Índice vazio para "${packName}". Tentando construir índice manualmente...`);
                try {
                    // Tentar obter todos os documentos primeiro
                    const allDocs = await pack.getDocuments();
                    if (allDocs && allDocs.length > 0) {
                        // Construir um mapa manual de nome -> id
                        const manualIndex = new Map();
                        for (const doc of allDocs) {
                            if (doc.name && (doc.id || doc._id)) {
                                const docId = String(doc.id || doc._id);
                                manualIndex.set(doc.name, docId);
                            }
                        }
                        console.log(`[Rising Steel] Índice manual construído com ${manualIndex.size} entradas para "${packName}"`);
                        // Usar o índice manual
                        index = manualIndex;
                    }
                } catch (error) {
                    console.warn(`[Rising Steel] Erro ao construir índice manual para "${packName}":`, error);
                }
            }
            
            // Tentar buscar documentos
            let items = [];
            try {
                items = await pack.getDocuments();
            } catch (error) {
                console.error(`[Rising Steel] Erro ao buscar documentos do pack "${packName}":`, error);
            }
            
            // Se não encontrou itens mas o índice existe, tentar buscar pelo índice
            if (items.length === 0 && index && index.size > 0) {
                console.log(`[Rising Steel] Tentando buscar ${index.size} itens pelo índice...`);
                try {
                    const itemIds = Array.from(index.keys());
                    items = await Promise.all(itemIds.map(id => pack.getDocument(id).catch(() => null)));
                    items = items.filter(item => item !== null);
                } catch (error) {
                    console.error(`[Rising Steel] Erro ao buscar pelo índice:`, error);
                }
            }
            
            // Se ainda não encontrou e o índice está vazio, tentar ler diretamente do arquivo
            if (items.length === 0 && (!index || index.size === 0)) {
                console.warn(`[Rising Steel] Índice vazio para "${packName}". Tentando ler diretamente do arquivo...`);
                try {
                    // Tentar buscar todos os documentos sem usar o índice
                    const allItems = await pack.getDocuments({});
                    if (allItems && allItems.length > 0) {
                        items = allItems;
                        console.log(`[Rising Steel] Encontrados ${items.length} itens lendo diretamente do pack "${packName}"`);
                    } else {
                        // Última tentativa: buscar pelo tipo diretamente
                        const packItems = pack.contents || pack.index;
                        if (packItems && packItems.size > 0) {
                            const itemIds = Array.from(packItems.keys());
                            items = await Promise.all(
                                itemIds.map(id => pack.getDocument(id).catch(() => null))
                            );
                            items = items.filter(item => item !== null);
                            console.log(`[Rising Steel] Encontrados ${items.length} itens usando método alternativo para "${packName}"`);
                        }
                    }
                } catch (error) {
                    console.error(`[Rising Steel] Erro ao tentar métodos alternativos para "${packName}":`, error);
                }
            }
            
            const filtered = items.filter(item => item && item.type === itemType);
            
            console.log(`[Rising Steel] Pack "${packName}": ${items.length} itens totais, ${filtered.length} do tipo "${itemType}"`);
            
            if (filtered.length === 0 && items.length > 0) {
                console.warn(`[Rising Steel] Pack "${packName}" tem ${items.length} itens mas nenhum do tipo "${itemType}". Tipos encontrados:`, [...new Set(items.map(i => i.type))]);
            }
            
            // Construir mapa de nome -> ID
            const nameToIdMap = new Map();
            
            // Tentar obter IDs do índice
            if (index && index.size > 0) {
                try {
                    if (index instanceof Map) {
                        // Se é um Map direto (índice manual)
                        for (const [name, id] of index.entries()) {
                            nameToIdMap.set(name, String(id));
                        }
                    } else {
                        // Se é o índice do Foundry (Map com entries)
                        const indexEntries = Array.from(index.entries());
                        for (const [id, indexEntry] of indexEntries) {
                            if (indexEntry && indexEntry.name) {
                                nameToIdMap.set(indexEntry.name, String(id));
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[Rising Steel] Erro ao processar índice do pack "${packName}":`, e);
                }
            }
            
            // Também tentar obter IDs diretamente dos documentos
            for (const item of filtered) {
                if (item.name && !nameToIdMap.has(item.name)) {
                    if (item.id) {
                        nameToIdMap.set(item.name, String(item.id));
                    } else if (item._id) {
                        nameToIdMap.set(item.name, String(item._id));
                    } else if (item.uuid) {
                        const uuidParts = item.uuid.split(".");
                        if (uuidParts.length >= 3) {
                            nameToIdMap.set(item.name, String(uuidParts[uuidParts.length - 1]));
                        }
                    }
                }
            }
            
            const mapped = filtered.map((item, idx) => {
                let itemId = "";
                
                // Prioridade 1: Buscar no mapa pelo nome
                if (item.name && nameToIdMap.has(item.name)) {
                    itemId = nameToIdMap.get(item.name);
                }
                // Prioridade 2: ID direto do documento
                else if (item.id) {
                    itemId = String(item.id);
                } else if (item._id) {
                    itemId = String(item._id);
                }
                // Prioridade 3: UUID
                else if (item.uuid) {
                    const uuidParts = item.uuid.split(".");
                    if (uuidParts.length >= 3) {
                        itemId = String(uuidParts[uuidParts.length - 1]);
                    }
                }
                
                const mappedItem = {
                    id: itemId || "",
                    name: item.name || "",
                    system: item.system || {}
                };
                
                if (!mappedItem.id) {
                    console.warn(`[Rising Steel] Item "${mappedItem.name}" do pack "${packName}" não tem ID.`, {
                        item: item,
                        itemKeys: Object.keys(item),
                        uuid: item.uuid,
                        _id: item._id,
                        id: item.id
                    });
                    // Não usar fallback - deixar vazio para forçar recriação
                    mappedItem.id = "";
                }
                
                return mappedItem;
            });
            
            console.log(`[Rising Steel] Mapeando ${mapped.length} itens do pack "${packName}":`, mapped.map(i => ({id: i.id, name: i.name})));
            
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
                    }
                }
            } catch (error) {
                // Silenciosamente ignorar erro
            }
        }
        
        // Ler o estado atual completo do array de equipamentos
        const equipamentosAtuais = foundry.utils.duplicate(this.actor.system.inventario?.equipamentos || []);
        while (equipamentosAtuais.length <= index) {
            equipamentosAtuais.push({id: "", nome: ""});
        }
        
        // Atualizar apenas o equipamento específico
        equipamentosAtuais[index] = {
            id: String(itemId || ""),
            nome: String(itemName || "")
        };
        
        console.log(`[Rising Steel] Salvando equipamento ${index}:`, equipamentosAtuais[index]);
        
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
        
        // Se não houver itemId, limpar os campos
        if (!itemId) {
            const armasAtuais = foundry.utils.duplicate(this.actor.system.inventario?.armas || []);
            while (armasAtuais.length <= index) {
                armasAtuais.push({id: "", nome: "", dano: 0, alcance: "", bonus: 0});
            }
            armasAtuais[index] = {
                id: "",
                nome: "",
                dano: 0,
                alcance: "",
                bonus: 0
            };
            await this.actor.update({
                "system.inventario.armas": armasAtuais
            }, {render: false});
            return;
        }
        
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
                    const item = await pack.getDocument(itemId);
                    if (item) {
                        itemName = item.name;
                        // Acessar os dados do sistema do item
                        const itemSystem = item.system || {};
                        dano = Number(itemSystem.dano || 0);
                        alcance = itemSystem.alcance || "";
                        bonus = Number(itemSystem.bonus || 0);
                        
                        // Debug: verificar se os dados foram encontrados
                        console.log(`[Rising Steel] Dados da arma "${itemName}":`, {
                            dano: dano,
                            alcance: alcance,
                            bonus: bonus,
                            itemSystem: itemSystem
                        });
                    }
                }
            } catch (error) {
                // Silenciosamente ignorar erro
            }
        }
        
        // Ler o estado atual completo do array de armas
        const armasAtuais = foundry.utils.duplicate(this.actor.system.inventario?.armas || []);
        while (armasAtuais.length <= index) {
            armasAtuais.push({id: "", nome: "", dano: 0, alcance: "", bonus: 0});
        }
        
        armasAtuais[index] = {
            id: itemId,
            nome: itemName,
            dano: dano,
            alcance: alcance,
            bonus: bonus
        };
        
        // Debug: verificar o que será atualizado
        console.log(`[Rising Steel] Atualizando arma ${index}:`, armasAtuais[index]);
        
        // Preservar equipamentos durante a atualização
        const equipamentosAtuais = foundry.utils.duplicate(this.actor.system.inventario?.equipamentos || []);
        
        // Atualizar e renderizar para mostrar os dados preenchidos
        await this.actor.update({
            "system.inventario.armas": armasAtuais,
            "system.inventario.equipamentos": equipamentosAtuais
        });
    }

    async _onArmaduraSelect(event) {
        event.preventDefault();
        const select = event.currentTarget;
        const armaduraId = select.value;
        
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
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar armadura do pack:", error);
            }
        }
        
        // Atualizar armadura equipada e proteção total
        const danoAtual = Number(this.actor.system.armadura?.dano || 0);
        const atual = Math.max(0, protecao - danoAtual);
        
        await this.actor.update({
            "system.armadura.equipada": armaduraId,
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
            if (FoundryCompatibility.isV13()) {
                // v13: usar rollInitiative do combatant
                await combatant.rollInitiative({ formula: `${iniciativaBase}d6` });
            } else {
                // v12: atualizar diretamente
                await combatant.update({ initiative: roll.total });
            }
            
            // Exibir a rolagem no chat
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor, token: combatant.token }),
                flavor: `Rolagem de Iniciativa: ${destreza} (Destreza) + ${perspicacia} (Perspicácia) = ${iniciativaBase}d6`
            });
            
            ui.notifications.info(`Iniciativa rolada: ${roll.total}`);
            
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar iniciativa:", error);
            ui.notifications.error("Erro ao rolar iniciativa. Verifique o console.");
        }
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
        const templatePath = "systems/rising-steel/templates/app/especializacao-dialog.html";
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

}


import { FoundryCompatibility } from "../utils/compatibility.js";

export class RisingSteelExacomSheet extends FoundryCompatibility.getActorSheetBase() {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["rising-steel", "sheet", "actor", "exacom"],
            template: "systems/rising-steel/template/actor/exacom-sheet.html",
            width: 860,
            height: 720,
            tabs: [{
                navSelector: ".exacom-tabs",
                contentSelector: ".exacom-body",
                initial: "sistema"
            }]
        });
    }

    async getData(options) {
        try {
            const source = this.actor.toObject();
            const actorData = this.actor.toObject(false);

            // Garantir que system existe
            if (!actorData.system) {
                actorData.system = {};
            }

            const context = {
                actor: actorData,
                source: source.system || {},
                system: actorData.system,
                owner: this.actor.isOwner,
                limited: this.actor.limited,
                options: this.options,
                editable: this.isEditable,
                type: this.actor.type
            };

            // Garantir estruturas básicas
            if (!context.system.sistema) {
                context.system.sistema = { neuromotor: 0, sensorial: 0, estrutural: 0 };
            }
            if (!context.system.equipamentosExa) {
                context.system.equipamentosExa = { armas: [], blindagem: 0 };
            }
            context.system.equipamentosExa.blindagemTotal = Number(context.system.equipamentosExa.blindagem || 0) * 10;
            context.system.equipamentosExa.blindagemDano = Math.max(0, Number(context.system.equipamentosExa.blindagemDano || 0));
            context.system.equipamentosExa.blindagemAtual = Math.max(0, context.system.equipamentosExa.blindagemTotal - context.system.equipamentosExa.blindagemDano);
            if (!context.system.exa) {
                context.system.exa = { sincronia: 0, overdrive: 0 };
            }
            if (!context.system.combate) {
                context.system.combate = { esquiva: 0, mobilidade: 0 };
            }
            if (!context.system.limiarDano) {
                context.system.limiarDano = {
                    leve: { limiar: 0, marcacoes: 0 },
                    moderado: { limiar: 0, marcacoes: 0 },
                    grave: { limiar: 0, marcacoes: 0 },
                    penalidades: 0
                };
            }

            context.descriptionHTML = await FoundryCompatibility.enrichHTML(context.system.descricao || "", {
                secrets: this.actor.isOwner,
                async: true
            });

            // Modelos de EXAcom vindos do compendium dedicado
            try {
                context.exacomModels = await this._getExacomModels();
            } catch (error) {
                console.warn("[Rising Steel] Erro ao carregar modelos EXAcom:", error);
                context.exacomModels = [];
            }
            context.system.modeloId = context.system.modeloId || "";

            // Buscar o valor do reator do modelo selecionado
            try {
                context.selectedModelReator = await this._getSelectedModelReator(context.system.modeloId);
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar reator do modelo:", error);
                context.selectedModelReator = null;
            }

            // Buscar blindagens do compendium
            try {
                context.blindagensExacom = await this._getBlindagensExacom();
            } catch (error) {
                console.warn("[Rising Steel] Erro ao carregar blindagens EXAcom:", error);
                context.blindagensExacom = [];
            }

            // Buscar a blindagem selecionada
            context.selectedBlindagem = null;
            try {
                const blindagemId = context.system.equipamentosExa?.blindagemId;
                if (blindagemId && context.blindagensExacom) {
                    context.selectedBlindagem = context.blindagensExacom.find(b => b.id === blindagemId);
                    // Atualizar o valor da blindagem baseado no item selecionado
                    if (context.selectedBlindagem) {
                        context.system.equipamentosExa.blindagem = Number(context.selectedBlindagem.system?.blindagem || 0);
                        context.system.equipamentosExa.blindagemDescricao = context.selectedBlindagem.system?.descricao || "";
                        context.system.equipamentosExa.blindagemEspecial = context.selectedBlindagem.system?.especial || "";
                        context.system.equipamentosExa.blindagemTotal = Number(context.selectedBlindagem.system?.blindagem || 0) * 10;
                        const blindagemDano = Number(context.system.equipamentosExa?.blindagemDano || 0);
                        context.system.equipamentosExa.blindagemDano = Math.max(0, blindagemDano);
                        context.system.equipamentosExa.blindagemAtual = Math.max(0, context.system.equipamentosExa.blindagemTotal - context.system.equipamentosExa.blindagemDano);
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar blindagem selecionada:", error);
            }

            // Calcular valores efetivos dos atributos (aplicando penalidades)
            const penalidades = context.system.sistema?.penalidades || {};
            const sincroniaBonus = Number(context.system.exa?.sincronia || 0);
            context.sistemaEfetivo = {
                neuromotor: Math.max(0, Number(context.system.sistema?.neuromotor || 0) - Number(penalidades.neuromotor || 0) + sincroniaBonus),
                sensorial: Math.max(0, Number(context.system.sistema?.sensorial || 0) - Number(penalidades.sensorial || 0) + sincroniaBonus),
                estrutural: Math.max(0, Number(context.system.sistema?.estrutural || 0) - Number(penalidades.estrutural || 0) + sincroniaBonus),
                energetico: Math.max(0, Number(context.system.sistema?.energetico || 0) - Number(penalidades.energetico || 0) + sincroniaBonus)
            };
            
            // Calcular limiares de dano baseados em (Vigor do piloto + Estrutural com penalidade aplicada)
            const estrutural = context.sistemaEfetivo.estrutural;
            
            // Buscar Vigor do piloto vinculado
            let vigorPiloto = 0;
            try {
                const pilotoId = context.system?.vinculo?.pilotoId;
                if (pilotoId && game?.actors) {
                    const pilotoActor = game.actors.get(pilotoId);
                    if (pilotoActor && pilotoActor.type === "piloto") {
                        vigorPiloto = Number(pilotoActor.system?.atributos?.fisicos?.vigor || 0);
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar Vigor do piloto vinculado:", error);
            }
            
            // Calcular base do limiar: Vigor do piloto + Estrutural do EXACOM (com penalidade aplicada)
            const baseLimiar = vigorPiloto + estrutural;
            context.limiarLeve = baseLimiar * 1;
            context.limiarMedio = baseLimiar * 2;
            context.limiarGrave = baseLimiar * 4;
            
            // Atualizar os limiares calculados
            context.system.limiarDano.leve.limiar = context.limiarLeve;
            context.system.limiarDano.moderado.limiar = context.limiarMedio;
            context.system.limiarDano.grave.limiar = context.limiarGrave;

            // Garantir que a escala seja sempre "Grande"
            if (!context.system.identificacao) {
                context.system.identificacao = {};
            }
            context.system.identificacao.escala = "Grande";

            // Preparar armas como ataquesList
            const armas = context.system.equipamentosExa?.armas || [];
            
            // Buscar piloto vinculado para obter labels dos atributos
            let linkedPilot = null;
            try {
                const linkedPilotId = context.system?.vinculo?.pilotoId;
                if (linkedPilotId && game?.actors) {
                    const pilotActor = game.actors.get(linkedPilotId);
                    if (pilotActor) {
                        linkedPilot = pilotActor;
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar piloto vinculado:", error);
            }

            // Calcular dadoBase: Neuromotor + Sincronia (usando valor efetivo já calculado)
            const neuromotor = context.sistemaEfetivo.neuromotor;
            const sincronia = Number(context.system.exa?.sincronia || 0);
            const dadoBaseCalculado = neuromotor + sincronia;

            context.armasList = armas.map((arma, index) => {
                // Obter label do atributo do piloto
                let atributoLabel = "—";
                let atributoValor = 0;
                
                if (linkedPilot && arma.atributo) {
                    if (arma.atributo === "atributos.fisicos.forca") {
                        atributoLabel = "Força";
                        atributoValor = Number(linkedPilot.system?.atributos?.fisicos?.forca || 0);
                    } else if (arma.atributo === "atributos.fisicos.destreza") {
                        atributoLabel = "Destreza";
                        atributoValor = Number(linkedPilot.system?.atributos?.fisicos?.destreza || 0);
                    }
                }

                // Recalcular dadoBase para cada arma (pode ter mudado desde a última atualização)
                const dadoBaseAtual = dadoBaseCalculado;

                return {
                    ...arma,
                    index,
                    atributoLabel,
                    atributoValor,
                    dadoBase: dadoBaseAtual
                };
            });

            // Buscar piloto vinculado primeiro para calcular atributos de combate
            context.linkedPilot = null;
            context.linkedPilotOverdrive = 0;
            let pilotoEsquiva = 0;
            let pilotoMobilidade = 0;
            let pilotoIniciativa = 0;
            
            try {
                const linkedPilotId = context.system?.vinculo?.pilotoId;
                if (linkedPilotId && game?.actors) {
                    const pilotActor = game.actors.get(linkedPilotId);
                    if (pilotActor) {
                        context.linkedPilot = { id: pilotActor.id, name: pilotActor.name };
                        // Buscar overdrive do piloto vinculado
                        context.linkedPilotOverdrive = Number(pilotActor.system?.exapoints?.overdrive || 0);
                        
                        // Buscar atributos de combate do piloto vinculado
                        pilotoEsquiva = Number(pilotActor.system?.combate?.esquiva || 0);
                        pilotoMobilidade = Number(pilotActor.system?.combate?.mobilidade || 0);
                        pilotoIniciativa = Number(pilotActor.system?.combate?.iniciativa || 0);
                        
                        if (!context.system.identificacao) {
                            context.system.identificacao = {};
                        }
                        if (!context.system.identificacao.piloto) {
                            context.system.identificacao.piloto = pilotActor.name;
                        }
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Não foi possível carregar piloto vinculado ao EXAcom:", error);
            }
            
            // Calcular atributos de combate baseados no piloto vinculado + sincronia
            // (sincronia já foi declarada acima na linha 161)
            
            // Iniciativa = Sincronia + Iniciativa do piloto
            context.calculatedIniciativa = sincronia + pilotoIniciativa;
            
            // Esquiva = Sincronia + Esquiva do piloto
            context.calculatedEsquiva = sincronia + pilotoEsquiva;
            
            // Mobilidade = Sincronia + Mobilidade do piloto
            context.calculatedMobilidade = sincronia + pilotoMobilidade;

            // Calcular capacidade: (Neuromotor + Estrutural) * 100
            context.capacity = this._calculateCapacity(context);

            // Organizar módulos em uma lista única, ordenada por consumo
            const modulos = this.actor.items.filter(item => item.type === "exacomModulo");
            const reatorDisponivel = context.selectedModelReator || 0;
            
            // Calcular total de consumo dos módulos equipados (soma dos consumos)
            let totalConsumoEquipado = 0;
            modulos.forEach(modulo => {
                const consumo = Number(modulo.system?.consumo || 0);
                totalConsumoEquipado += consumo;
            });
            
            // Criar lista única de módulos ordenada por consumo
            const modulosOrdenados = modulos
                .map(modulo => ({
                    ...modulo.toObject(),
                    consumo: Number(modulo.system?.consumo || 0)
                }))
                .sort((a, b) => {
                    // Ordenar primeiro por consumo (menor para maior)
                    if (a.consumo !== b.consumo) {
                        return a.consumo - b.consumo;
                    }
                    // Se consumo igual, ordenar por nome
                    return (a.name || "").localeCompare(b.name || "");
                });

            context.modulosOrdenados = modulosOrdenados;
            context.reatorDisponivel = reatorDisponivel;
            context.totalConsumoEquipado = totalConsumoEquipado;
            context.modulosDisponiveis = totalConsumoEquipado < reatorDisponivel;

            return context;
        } catch (error) {
            console.error("[Rising Steel] Erro crítico ao preparar dados da ficha EXAcom:", error);
            // Retornar contexto mínimo em caso de erro
            return {
                actor: this.actor.toObject(false),
                system: this.actor.system || {},
                owner: this.actor.isOwner,
                limited: this.actor.limited,
                options: this.options,
                editable: this.isEditable,
                type: this.actor.type,
                exacomModels: [],
                selectedModelReator: null,
                blindagensExacom: [],
                selectedBlindagem: null,
                limiarLeve: 0,
                limiarMedio: 0,
                limiarGrave: 0,
                calculatedIniciativa: 0,
                calculatedEsquiva: 0,
                calculatedMobilidade: 0,
                linkedPilot: null,
                linkedPilotOverdrive: 0,
                sistemaEfetivo: {
                    neuromotor: 0,
                    sensorial: 0,
                    estrutural: 0,
                    energetico: 0
                },
                modulosPorConsumo: null,
                reatorDisponivel: 0,
                totalConsumoEquipado: 0,
                consumosPadrao: [1, 2, 3, 4, 5]
            };
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (!this.options.editable) return;

        html.find("input[type='number']").on("input", this._sanitizeNumericInput.bind(this));
        html.find(".exacom-row-add").click(this._onAddRow.bind(this));
        html.find(".exacom-row-remove").click(this._onRemoveRow.bind(this));
        html.find(".open-linked-pilot").click(this._onOpenLinkedPilot.bind(this));
        html.find("select[name='system.modeloId']").change(this._onModeloChange.bind(this));
        // Atualizar limiares e atributos de combate quando valores mudarem
        html.find("input[name='system.sistema.estrutural']").on("change", this._onEstruturalChange.bind(this));
        html.find("input[name='system.sistema.neuromotor']").on("change", this._onCombatStatsChange.bind(this));
        html.find("input[name='system.sistema.sensorial']").on("change", this.render.bind(this));
        html.find("input[name='system.sistema.energetico']").on("change", this.render.bind(this));
        html.find("select[name='system.equipamentosExa.blindagemId']").on("change", this._onBlindagemChange.bind(this));
        html.find("input[name='system.equipamentosExa.blindagemDano']").on("change", this._onBlindagemDanoChange.bind(this));
        html.find("input[name='system.exa.sincronia']").on("change", this._onCombatStatsChange.bind(this));
        // Listeners para penalidades dos atributos de sistema (recalcular tudo)
        html.find("input[name='system.sistema.penalidades.neuromotor']").on("change", this._onCombatStatsChange.bind(this));
        html.find("input[name='system.sistema.penalidades.estrutural']").on("change", this._onEstruturalChange.bind(this));
        html.find("input[name='system.sistema.penalidades.sensorial']").on("change", this.render.bind(this));
        html.find("input[name='system.sistema.penalidades.energetico']").on("change", this.render.bind(this));
        html.find(".roll-sincronia").click(this._onRollSincronia.bind(this));
        
        // Listeners para armas (ataques)
        html.find(".arma-create").click(this._onCreateArma.bind(this));
        html.find(".arma-edit").click(this._onEditArma.bind(this));
        html.find(".arma-delete").click(this._onDeleteArma.bind(this));
        html.find(".arma-roll").click(this._onRollArma.bind(this));
        
        // Listeners para rolagem de atributos de sistema
        html.find(".roll-atributo-sistema").click(this._onRollAtributoSistema.bind(this));
        
        // Botão de rolagem de iniciativa
        html.find(".roll-iniciativa").click(this._onRollIniciativa.bind(this));
        // Botão de rolagem de esquiva
        html.find(".roll-esquiva").click(this._onRollEsquiva.bind(this));
        
        // Listeners para módulos EXA
        html.find(".modulo-create").click(this._onCreateModulo.bind(this));
        html.find(".modulo-use").click(this._onUseModulo.bind(this));
        
        // Listeners para editar e deletar módulos (apenas dentro da seção de módulos)
        html.find(".exa-mods-card .item-edit").click((ev) => {
            const li = $(ev.currentTarget).closest("li[data-item-id]");
            const itemId = li.data("item-id");
            const item = this.actor.items.get(itemId);
            if (item && item.type === "exacomModulo") {
                item.sheet.render(true);
            }
        });
        
        html.find(".exa-mods-card .item-delete").click((ev) => {
            const li = $(ev.currentTarget).closest("li[data-item-id]");
            const itemId = li.data("item-id");
            if (itemId) {
                this._onDeleteModulo(itemId);
            }
        });
    }
    
    async _onDeleteModulo(itemId) {
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "exacomModulo") {
            return;
        }
        
        const confirmar = await Dialog.confirm({
            title: "Confirmar Exclusão",
            content: `<p>Deseja realmente deletar o módulo <strong>${item.name}</strong>?</p>`,
            yes: () => true,
            no: () => false,
            defaultYes: false
        });
        
        if (confirmar) {
            await item.delete();
            ui.notifications.info(`Módulo "${item.name}" deletado.`);
        }
    }
    
    _getAttributeOptions() {
        return [
            { label: "Neuromotor", path: "sistema.neuromotor" },
            { label: "Sensorial", path: "sistema.sensorial" },
            { label: "Estrutural", path: "sistema.estrutural" },
            { label: "Reator", path: "sistema.energetico" }
        ];
    }
    
    _getAttributeValue(path) {
        if (!path) return 0;
        const value = foundry.utils.getProperty(this.actor.system, path);
        let valorBase = Number(value || 0) || 0;
        
        // Aplicar penalidades e bônus de Sincronia se for um atributo de sistema
        if (path.startsWith("sistema.")) {
            const atributoNome = path.replace("sistema.", "");
            const penalidades = this.actor.system.sistema?.penalidades || {};
            const penalidade = Number(penalidades[atributoNome] || 0);
            const sincroniaBonus = Number(this.actor.system.exa?.sincronia || 0);
            valorBase = Math.max(0, valorBase - penalidade + sincroniaBonus);
        }
        
        return valorBase;
    }
    
    _normalizeNumber(value) {
        if (value === null || value === undefined || value === "") return 0;
        const normalized = String(value).replace(/,/g, '.');
        const num = Number(normalized);
        return isNaN(num) ? 0 : num;
    }

    _sanitizeNumericInput(event) {
        const input = event.currentTarget;
        if (!input) return;
        let value = input.value || "";
        value = value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
        if (value !== input.value) {
            input.value = value;
        }
    }

    async _onAddRow(event) {
        event.preventDefault();
        const target = event.currentTarget.dataset.target;
        const templateKey = event.currentTarget.dataset.template || "default";
        if (!target) {
            console.warn("[Rising Steel] Botão de adicionar linha sem data-target definido.");
            return;
        }

        await this._modifyCollection(target, (collection) => {
            const template = this._getTemplate(templateKey);
            collection.push(template);
            return collection;
        });
    }

    async _onRemoveRow(event) {
        event.preventDefault();
        const target = event.currentTarget.dataset.target;
        const templateKey = event.currentTarget.dataset.template || "default";
        const min = Number(event.currentTarget.dataset.min || 0);
        const index = Number(event.currentTarget.dataset.index);

        if (!target || Number.isNaN(index)) {
            console.warn("[Rising Steel] Botão de remover linha sem target ou index válido.");
            return;
        }

        await this._modifyCollection(target, (collection) => {
            if (collection.length <= min) {
                ui.notifications?.warn?.("Não é possível remover todos os registros desta seção.");
                return null;
            }
            collection.splice(index, 1);
            if (collection.length === 0 && min > 0) {
                collection.push(this._getTemplate(templateKey));
            }
            return collection;
        });
    }

    async _modifyCollection(path, updater) {
        const collection = foundry.utils.getProperty(this.actor.system, path) || [];
        const workingCopy = collection.map(entry => foundry.utils.duplicate(entry));
        const updated = updater(workingCopy);
        if (!Array.isArray(updated)) {
            return;
        }
        const updateData = {};
        updateData[`system.${path}`] = updated;
        await this.actor.update(updateData);
        this.render(false);
    }

    _getTemplate(key) {
        switch (key) {
            case "arma":
                return { nome: "", descricao: "" };
            case "modulo":
                return { descricao: "" };
            default:
                return {};
        }
    }

    async _onOpenLinkedPilot(event) {
        event.preventDefault();
        const pilotId = this.actor.system?.vinculo?.pilotoId;
        if (!pilotId) {
            ui.notifications?.warn("Nenhum piloto vinculado a este EXAcom.");
            return;
        }

        if (!game?.actors) {
            ui.notifications?.error("Coleção de atores indisponível.");
            return;
        }

        const pilot = game.actors.get(pilotId);
        if (!pilot) {
            ui.notifications?.warn("Piloto vinculado não foi encontrado.");
            return;
        }

        pilot.sheet?.render(true, { focus: true });
    }

    async _getExacomModels() {
        try {
            if (!game?.packs || game.packs.size === 0) return [];
            const allPacks = Array.from(game.packs);
            let pack = game.packs.get("rising-steel.exacom") || game.packs.get("exacom");
            if (!pack) {
                pack = allPacks.find(p => {
                    const id = (p.metadata?.id || "").toLowerCase();
                    const name = (p.metadata?.name || "").toLowerCase();
                    const label = (p.metadata?.label || "").toLowerCase();
                    return id.includes("exacom") || name.includes("exacom") || label.includes("exacom");
                });
            }
            if (!pack) return [];

            try {
                await pack.getIndex({ force: true });
            } catch (err) {
                console.warn("[Rising Steel] Erro ao carregar índice do pack EXAcom:", err);
            }

            const index = pack.index || [];
            const models = [];
            for (const entry of index) {
                const type = entry.type || entry.documentName || "";
                if (type !== "exacomModel" && type !== "Item") continue;
                models.push({
                    id: entry._id || entry.id,
                    name: entry.name || "Modelo"
                });
            }

            return models.sort((a, b) => a.name.localeCompare(b.name, game.i18n?.lang || "pt-BR"));
        } catch (error) {
            console.warn("[Rising Steel] Não foi possível carregar modelos de EXAcom do compendium:", error);
            return [];
        }
    }

    async _getSelectedModelReator(modeloId) {
        if (!modeloId || !game?.packs || game.packs.size === 0) return null;

        try {
            const allPacks = Array.from(game.packs);
            let pack = game.packs.get("rising-steel.exacom") || game.packs.get("exacom");
            if (!pack) {
                pack = allPacks.find(p => {
                    const id = (p.metadata?.id || "").toLowerCase();
                    const name = (p.metadata?.name || "").toLowerCase();
                    const label = (p.metadata?.label || "").toLowerCase();
                    return id.includes("exacom") || name.includes("exacom") || label.includes("exacom");
                });
            }
            if (!pack) return null;

            const doc = await pack.getDocument(modeloId);
            if (!doc) return null;

            const sys = doc.system || {};
            return Number(sys.reator ?? 0) || 0;
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar reator do modelo:", error);
            return null;
        }
    }

    async _getBlindagensExacom() {
        try {
            const pack = game.packs.get("rising-steel.blindagemExacom");
            if (!pack) {
                console.warn("[Rising Steel] Pack de blindagens EXAcom não encontrado");
                return [];
            }
            
            const docs = await pack.getDocuments();
            return docs.map(doc => ({
                id: doc.id,
                name: doc.name,
                system: doc.system || {}
            }));
        } catch (error) {
            console.warn("[Rising Steel] Erro ao carregar blindagens EXAcom:", error);
            return [];
        }
    }

    async _getModulosExacom() {
        try {
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
                console.warn("[Rising Steel] Pack de módulos EXAcom não encontrado");
                return [];
            }
            
            const docs = await pack.getDocuments();
            return docs.map(doc => ({
                id: doc.id,
                name: doc.name,
                system: doc.system || {},
                img: doc.img || "icons/svg/item-bag.svg"
            }));
        } catch (error) {
            console.warn("[Rising Steel] Erro ao carregar módulos EXAcom:", error);
            return [];
        }
    }

    async _onEstruturalChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const estruturalBase = Number(input.value || 0);
        
        // Aplicar penalidade do estrutural
        const penalidades = this.actor.system.sistema?.penalidades || {};
        const estrutural = Math.max(0, estruturalBase - Number(penalidades.estrutural || 0));
        
        // Buscar Vigor do piloto vinculado
        let vigorPiloto = 0;
        try {
            const pilotoId = this.actor.system?.vinculo?.pilotoId;
            if (pilotoId && game?.actors) {
                const pilotoActor = game.actors.get(pilotoId);
                if (pilotoActor && pilotoActor.type === "piloto") {
                    vigorPiloto = Number(pilotoActor.system?.atributos?.fisicos?.vigor || 0);
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar Vigor do piloto vinculado:", error);
        }
        
        // Calcular novos limiares baseados em (Vigor do piloto + Estrutural com penalidade aplicada)
        const baseLimiar = vigorPiloto + estrutural;
        const limiarLeve = baseLimiar * 1;
        const limiarMedio = baseLimiar * 2;
        const limiarGrave = baseLimiar * 4;
        
        // Atualizar apenas os limiares (atributos de combate não dependem mais de estrutural)
        await this.actor.update({
            "system.limiarDano.leve.limiar": limiarLeve,
            "system.limiarDano.moderado.limiar": limiarMedio,
            "system.limiarDano.grave.limiar": limiarGrave
        });
        
        this.render(false);
    }

    async _onCombatStatsChange(event) {
        // Prevenir default apenas se o evento existir
        if (event) {
            event.preventDefault();
        }
        
        // Buscar piloto vinculado para obter seus atributos de combate
        let pilotoEsquiva = 0;
        let pilotoMobilidade = 0;
        let pilotoIniciativa = 0;
        
        try {
            const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
            if (linkedPilotId && game?.actors) {
                const pilotActor = game.actors.get(linkedPilotId);
                if (pilotActor && pilotActor.type === "piloto") {
                    pilotoEsquiva = Number(pilotActor.system?.combate?.esquiva || 0);
                    pilotoMobilidade = Number(pilotActor.system?.combate?.mobilidade || 0);
                    pilotoIniciativa = Number(pilotActor.system?.combate?.iniciativa || 0);
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar atributos de combate do piloto vinculado:", error);
        }
        
        const sincronia = Number(this.actor.system.exa?.sincronia || 0);
        const penalidades = this.actor.system.sistema?.penalidades || {};
        const neuromotor = Math.max(0, Number(this.actor.system.sistema?.neuromotor || 0) - Number(penalidades.neuromotor || 0));
        
        // Calcular atributos de combate: Sincronia + atributo do piloto
        const calculatedEsquiva = sincronia + pilotoEsquiva;
        const calculatedMobilidade = sincronia + pilotoMobilidade;
        const calculatedIniciativa = sincronia + pilotoIniciativa;
        
        // Recalcular dadoBase das armas: Neuromotor + Sincronia (com penalidade aplicada)
        const novoDadoBase = neuromotor + sincronia;
        const armas = this.actor.system.equipamentosExa?.armas || [];
        const armasAtualizadas = armas.map(arma => ({
            ...arma,
            dadoBase: novoDadoBase
        }));
        
        // Atualizar os atributos de combate e armas no banco de dados
        const updateData = {
            "system.combate.esquiva": calculatedEsquiva,
            "system.combate.mobilidade": calculatedMobilidade,
            "system.combate.iniciativa": calculatedIniciativa
        };
        
        // Só atualizar armas se houver armas e se o dadoBase mudou
        if (armasAtualizadas.length > 0) {
            updateData["system.equipamentosExa.armas"] = armasAtualizadas;
        }
        
        await this.actor.update(updateData);
        
        this.render(false);
    }

    async _onBlindagemChange(event) {
        event.preventDefault();
        const select = event.currentTarget;
        const blindagemId = select.value;
        
        let blindagemValue = 0;
        let blindagemDescricao = "";
        let blindagemEspecial = "";
        if (blindagemId) {
            try {
                const pack = game.packs.get("rising-steel.blindagemExacom");
                if (pack) {
                    const docs = await pack.getDocuments();
                    const blindagemDoc = docs.find(d => d.id === blindagemId);
                    if (blindagemDoc) {
                        blindagemValue = Number(blindagemDoc.system?.blindagem || 0);
                        blindagemDescricao = blindagemDoc.system?.descricao || "";
                        blindagemEspecial = blindagemDoc.system?.especial || "";
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar blindagem:", error);
            }
        }
        
        // Atualizar a blindagem no actor
        await this.actor.update({
            "system.equipamentosExa.blindagemId": blindagemId,
            "system.equipamentosExa.blindagem": blindagemValue,
            "system.equipamentosExa.blindagemTotal": blindagemValue * 10,
            "system.equipamentosExa.blindagemDano": 0,
            "system.equipamentosExa.blindagemAtual": Math.max(0, (blindagemValue * 10)),
            "system.equipamentosExa.blindagemDescricao": blindagemId ? blindagemDescricao : "",
            "system.equipamentosExa.blindagemEspecial": blindagemId ? blindagemEspecial : ""
        });
        
        // Recalcular atributos de combate (não depende mais de blindagem, mas pode haver outras mudanças)
        await this._onCombatStatsChange();
    }

    async _onBlindagemDanoChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const dano = Number(input.value || 0);
        const total = Number(this.actor.system.equipamentosExa?.blindagemTotal || 0);
        const atual = Math.max(0, total - Math.max(0, dano));

        await this.actor.update({
            "system.equipamentosExa.blindagemDano": Math.max(0, dano),
            "system.equipamentosExa.blindagemAtual": atual
        });

        const html = $(this.element);
        html.find("input[name='system.equipamentosExa.blindagemAtual']").val(atual);
    }

    _calculateCapacity(context) {
        const system = context.system || {};
        const penalidades = system.sistema?.penalidades || {};
        const neuromotor = Math.max(0, Number(system.sistema?.neuromotor || 0) - Number(penalidades.neuromotor || 0));
        const estrutural = Math.max(0, Number(system.sistema?.estrutural || 0) - Number(penalidades.estrutural || 0));
        const baseMax = Math.max(0, (neuromotor + estrutural) * 100);

        const addWeight = (value, total) => {
            const num = Number(value);
            if (!Number.isNaN(num) && num > 0) {
                return total + num;
            }
            return total;
        };

        let totalWeight = 0;

        // Blindagem equipada
        if (system.equipamentosExa?.blindagemId) {
            const blindagemId = system.equipamentosExa.blindagemId;
            if (context.blindagensExacom) {
                const blindagem = context.blindagensExacom.find(b => b.id === blindagemId);
                if (blindagem && blindagem.system?.peso !== undefined) {
                    totalWeight = addWeight(blindagem.system.peso, totalWeight);
                }
            }
        }

        // TODO: Adicionar peso de outros equipamentos quando necessário

        const rawPercent = baseMax > 0 ? (totalWeight / baseMax) * 100 : 0;
        const percent = Math.max(0, Math.min(100, rawPercent));
        const color = this._getCapacityColor(percent);
        const overLimit = rawPercent > 100;
        const statusLabel = overLimit ? "Acima do limite!" : this._getCapacityStatusLabel(percent);

        return {
            total: Number(totalWeight.toFixed(2)),
            max: Number(baseMax.toFixed(2)),
            percent: Number(percent.toFixed(1)),
            color,
            statusLabel,
            overLimit
        };
    }

    _getCapacityColor(percent) {
        const clamped = Math.max(0, Math.min(100, percent));
        const hue = Math.max(0, Math.min(120, 120 - (clamped * 1.2)));
        return `hsl(${hue}, 70%, 45%)`;
    }

    _getCapacityStatusLabel(percent) {
        if (percent < 35) return "Leve";
        if (percent < 65) return "Carregado";
        if (percent < 90) return "Pesado";
        return "Quase no limite";
    }

    async _onModeloChange(event) {
        event.preventDefault();
        const select = event.currentTarget;
        const modelId = select.value || "";

        if (!game?.packs || game.packs.size === 0) return;

        const allPacks = Array.from(game.packs);
        let pack = game.packs.get("rising-steel.exacom") || game.packs.get("exacom");
        if (!pack) {
            pack = allPacks.find(p => {
                const id = (p.metadata?.id || "").toLowerCase();
                const name = (p.metadata?.name || "").toLowerCase();
                const label = (p.metadata?.label || "").toLowerCase();
                return id.includes("exacom") || name.includes("exacom") || label.includes("exacom");
            });
        }
        if (!pack) {
            ui.notifications?.warn("Compendium de modelos EXAcom não encontrado.");
            return;
        }

        if (!modelId) {
            // Limpar modelo e zerar todos os atributos de sistema
            await this.actor.update({ 
                "system.modeloId": "",
                "system.identificacao.modelo": "",
                "system.sistema.neuromotor": 0,
                "system.sistema.sensorial": 0,
                "system.sistema.estrutural": 0,
                "system.sistema.energetico": 0
            });
            this.render(false);
            return;
        }

        try {
            const doc = await pack.getDocument(modelId);
            if (!doc) {
                ui.notifications?.warn("Modelo de EXAcom selecionado não foi encontrado.");
                return;
            }

            const sys = doc.system || {};

            const neuromotor = Number(sys.neuromotor ?? 0) || 0;
            const estrutural = Number(sys.estrutural ?? 0) || 0;
            const reator = Number(sys.reator ?? 0) || 0;
            
            const updateData = {
                "system.modeloId": modelId,
                "system.identificacao.modelo": doc.name || "",
                "system.sistema.neuromotor": neuromotor,
                "system.sistema.sensorial": Number(sys.sensorial ?? 0) || 0,
                "system.sistema.estrutural": estrutural,
                "system.sistema.energetico": reator
            };

            await this.actor.update(updateData);
            
            // Recalcular atributos de combate com a nova lógica
            await this._onCombatStatsChange();
        } catch (error) {
            console.error("[Rising Steel] Erro ao aplicar modelo de EXAcom na ficha:", error);
            ui.notifications?.error("Erro ao aplicar modelo de EXAcom. Verifique o console.");
        }
    }
    
    async _onCreateArma(event) {
        event.preventDefault();
        await this._showArmaDialog();
    }

    async _onEditArma(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        await this._showArmaDialog(index);
    }

    async _onDeleteArma(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        const armas = [...(this.actor.system.equipamentosExa?.armas || [])];
        const arma = armas[index];
        if (!arma) {
            ui.notifications.warn("Arma não encontrada.");
            return;
        }

        new Dialog({
            title: "Remover Arma",
            content: `<p>Tem certeza que deseja remover a arma <strong>${arma.nome || `Arma ${index + 1}`}</strong>?</p>`,
            buttons: {
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Remover",
                    callback: async () => {
                        armas.splice(index, 1);
                        await this.actor.update({ "system.equipamentosExa.armas": armas });
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
    
    async _showArmaDialog(index = undefined) {
        const armas = this.actor.system.equipamentosExa?.armas || [];
        const arma = index !== undefined ? foundry.utils.duplicate(armas[index]) : {
            nome: "",
            atributo: "",
            alcance: "",
            dano: "",
            efeito: ""
        };

        // Buscar piloto vinculado para obter Força e Destreza
        let atributosPiloto = [];
        let linkedPilotId = this.actor.system?.vinculo?.pilotoId;
        
        if (linkedPilotId && game?.actors) {
            const pilotActor = game.actors.get(linkedPilotId);
            if (pilotActor) {
                const forca = Number(pilotActor.system?.atributos?.fisicos?.forca || 0);
                const destreza = Number(pilotActor.system?.atributos?.fisicos?.destreza || 0);
                
                atributosPiloto = [
                    { label: "Força", path: "atributos.fisicos.forca", valor: forca },
                    { label: "Destreza", path: "atributos.fisicos.destreza", valor: destreza }
                ];
            }
        }

        if (atributosPiloto.length === 0) {
            ui.notifications.warn("Este EXAcom não possui um piloto vinculado. É necessário vincular um piloto para adicionar armas.");
            return;
        }

        // Calcular dadoBase automaticamente: Neuromotor + Sincronia
        const neuromotor = Number(this.actor.system?.sistema?.neuromotor || 0);
        const sincronia = Number(this.actor.system?.exa?.sincronia || 0);
        const dadoBaseCalculado = neuromotor + sincronia;

        const htmlContent = await FoundryCompatibility.renderTemplate(
            "systems/rising-steel/template/app/ataque-dialog.html",
            {
                ataque: arma,
                atributosPiloto: atributosPiloto,
                neuromotor: neuromotor,
                sincronia: sincronia,
                dadoBaseCalculado: dadoBaseCalculado
            }
        );

        new Dialog({
            title: index !== undefined ? "Editar Arma" : "Adicionar Arma",
            content: htmlContent,
            buttons: {
                save: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Salvar",
                    callback: async (html) => {
                        const nome = html.find("#ataque-nome").val().trim();
                        const atributo = html.find("#ataque-atributo").val();
                        const alcance = html.find("#ataque-alcance").val().trim();
                        const dano = html.find("#ataque-dano").val().trim();
                        const efeito = html.find("#ataque-efeito").val().trim();

                        if (!nome) {
                            ui.notifications.warn("Informe o nome da arma.");
                            return false;
                        }
                        if (!atributo) {
                            ui.notifications.warn("Selecione um atributo relacionado.");
                            return false;
                        }

                        // Recalcular dadoBase no momento do salvamento (pode ter mudado)
                        const neuromotorAtual = Number(this.actor.system?.sistema?.neuromotor || 0);
                        const sincroniaAtual = Number(this.actor.system?.exa?.sincronia || 0);
                        const dadoBaseAtual = neuromotorAtual + sincroniaAtual;

                        const novaArma = {
                            nome,
                            atributo,
                            dadoBase: dadoBaseAtual,
                            alcance,
                            dano,
                            efeito
                        };

                        const novasArmas = [...armas];
                        if (index !== undefined) {
                            novasArmas[index] = novaArma;
                        } else {
                            novasArmas.push(novaArma);
                        }

                        await this.actor.update({ "system.equipamentosExa.armas": novasArmas });
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
    
    async _onRollArma(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const index = Number(button.dataset.index);
        const armas = this.actor.system.equipamentosExa?.armas || [];
        const arma = armas[index];

        if (!arma) {
            ui.notifications.warn("Arma inválida.");
            return;
        }

        if (!arma.atributo) {
            ui.notifications.warn("Defina o atributo da arma antes de rolar.");
            return;
        }

        // Obter valor do atributo do piloto vinculado
        let atributoValor = 0;
        try {
            const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
            if (linkedPilotId && game?.actors) {
                const pilotActor = game.actors.get(linkedPilotId);
                if (pilotActor) {
                    // O atributo está no formato "atributos.fisicos.forca" ou "atributos.fisicos.destreza"
                    atributoValor = foundry.utils.getProperty(pilotActor.system, arma.atributo) || 0;
                    atributoValor = Number(atributoValor) || 0;
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar atributo do piloto:", error);
        }

        if (atributoValor <= 0) {
            ui.notifications.warn("O atributo selecionado não possui valor.");
            return;
        }

        // Recalcular dadoBase: Neuromotor + Sincronia (aplicando penalidades)
        const penalidades = this.actor.system.sistema?.penalidades || {};
        const neuromotor = Math.max(0, Number(this.actor.system?.sistema?.neuromotor || 0) - Number(penalidades.neuromotor || 0));
        const sincronia = Number(this.actor.system?.exa?.sincronia || 0);
        const dadoBase = neuromotor + sincronia;

        const totalDados = atributoValor + dadoBase;

        // Obter piloto vinculado se houver
        let linkedPilot = null;
        try {
            const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
            if (linkedPilotId && game?.actors) {
                const pilotActor = game.actors.get(linkedPilotId);
                if (pilotActor) {
                    linkedPilot = pilotActor;
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar piloto vinculado para rolagem:", error);
        }

        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: arma.nome || `Arma ${index + 1}`,
            baseDice: totalDados,
            actor: this.actor,
            label: arma.nome || `Arma ${index + 1}`,
            linkedPilot: linkedPilot
        });
    }
    
    async _onRollAtributoSistema(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const atributoPath = button.dataset.atributo;
        const label = button.dataset.label || "Atributo";
        
        if (!atributoPath) {
            ui.notifications.warn("Atributo não especificado.");
            return;
        }
        
        // Obter valor do atributo
        const atributoValor = this._getAttributeValue(atributoPath);
        if (atributoValor <= 0) {
            ui.notifications.warn(`O atributo ${label} precisa ser maior que zero para rolar.`);
            return;
        }
        
        // Obter piloto vinculado se houver
        let linkedPilot = null;
        try {
            const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
            if (linkedPilotId && game?.actors) {
                const pilotActor = game.actors.get(linkedPilotId);
                if (pilotActor) {
                    linkedPilot = pilotActor;
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar piloto vinculado para rolagem:", error);
        }
        
        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: label,
            baseDice: atributoValor,
            actor: this.actor,
            label: label,
            allowAttributeSelection: false, // EXAcom não tem atributos físicos/mentais/sociais, apenas sistema
            linkedPilot: linkedPilot // O piloto vinculado já permite selecionar atributo e usar EXApoints
        });
    }

    async _onRollSincronia(event) {
        event.preventDefault();
        
        try {
            // Buscar piloto vinculado
            const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
            if (!linkedPilotId) {
                ui.notifications.warn("Este EXAcom não possui um piloto vinculado. É necessário vincular um piloto para rolar Sincronia.");
                return;
            }
            
            const linkedPilot = game.actors?.get(linkedPilotId);
            if (!linkedPilot) {
                ui.notifications.warn("Piloto vinculado não encontrado.");
                return;
            }
            
            // Obter exapoints atual do piloto
            const exapointsAtual = Number(linkedPilot.system?.exapoints?.atual || 0);
            if (exapointsAtual <= 0) {
                ui.notifications.warn(`O piloto ${linkedPilot.name} não possui EXApoints disponíveis (atual: ${exapointsAtual}).`);
                return;
            }
            
            // Rolar dados baseado no exapoints atual
            const roll = new Roll(`${exapointsAtual}d6`);
            await roll.roll();
            
            // Obter resultados dos dados
            const diceResults = roll.terms?.[0]?.results || [];
            
            // Contar sucessos (valores 6)
            const sucessos = diceResults.filter(result => {
                const value = result.result ?? result.total ?? result;
                return Number(value) === 6;
            }).length;
            
            // Calcular Sincronia = 1 + sucessos
            const sincronia = 1 + sucessos;
            
            // Atualizar o campo Sincronia
            await this.actor.update({
                "system.exa.sincronia": sincronia
            });
            
            // Atualizar a interface imediatamente
            const html = $(this.element);
            const sincroniaInput = html.find("input[name='system.exa.sincronia']");
            if (sincroniaInput.length) {
                sincroniaInput.val(sincronia);
            }
            
            // Recalcular atributos de combate que dependem de Sincronia
            this._onCombatStatsChange();
            
            // Criar mensagem de chat com informações detalhadas
            const rollResultsText = diceResults.map(r => {
                const val = r.result ?? r.total ?? r;
                return Number(val) === 6 ? `<strong>${val}</strong>` : val;
            }).join(", ");
            
            // Preparar flags para usar o mesmo hook de "success-pool" das outras rolagens
            const diceInfo = [{
                type: "normal",
                count: exapointsAtual,
                results: diceResults
            }];
            
            // Exibir rolagem no chat
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: `Rolagem de Sincronia: ${exapointsAtual}d6 (EXApoints Atual do Piloto ${linkedPilot.name})<br>` +
                        `Resultados: [${rollResultsText}]<br>` +
                        `Sucessos (6): ${sucessos}<br>` +
                        `<strong>Sincronia = 1 + ${sucessos} = ${sincronia}</strong>`,
                rollMode: game.settings.get('core', 'rollMode'),
                flags: {
                    "rising-steel": {
                        rollType: "success-pool",
                        totalDice: exapointsAtual,
                        successes: sucessos,
                        diceInfo: diceInfo,
                        formula: `${exapointsAtual}d6`
                    }
                }
            });
            
            ui.notifications.info(`Sincronia atualizada: ${sincronia} (${sucessos} sucesso${sucessos !== 1 ? 's' : ''} em ${exapointsAtual}d6)`);
            
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar Sincronia:", error);
            ui.notifications.error("Erro ao rolar Sincronia. Verifique o console.");
        }
    }

    async _onRollIniciativa(event) {
        event.preventDefault();
        
        try {
            const { FoundryCompatibility } = await import("../utils/compatibility.js");
            
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
                    ui.notifications.warn("Nenhum token ativo encontrado para este EXAcom. Coloque o token na cena primeiro.");
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
            
            // Buscar iniciativa do piloto vinculado e sincronia
            let pilotoIniciativa = 0;
            let pilotoName = "Sem piloto";
            try {
                const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
                if (linkedPilotId && game?.actors) {
                    const pilotActor = game.actors.get(linkedPilotId);
                    if (pilotActor && pilotActor.type === "piloto") {
                        pilotoIniciativa = Number(pilotActor.system?.combate?.iniciativa || 0);
                        pilotoName = pilotActor.name;
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar iniciativa do piloto vinculado:", error);
            }
            
            const sincronia = Number(this.actor.system.exa?.sincronia || 0);
            const iniciativaBase = sincronia + pilotoIniciativa;
            
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
                flavor: `Rolagem de Iniciativa: ${sincronia} (Sincronia) + ${pilotoIniciativa} (Iniciativa do Piloto ${pilotoName}) = ${iniciativaBase}d6`,
                rollMode: game.settings.get('core', 'rollMode')
            });
            
            ui.notifications.info(`Iniciativa rolada: ${rollTotal}`);
            
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar iniciativa do EXAcom:", error);
            ui.notifications.error("Erro ao rolar iniciativa. Verifique o console.");
        }
    }

    async _onRollEsquiva(event) {
        event.preventDefault();
        const esquiva = Number(this.actor.system?.combate?.esquiva || 0);
        if (esquiva <= 0) {
            ui.notifications.warn("Esquiva atual é 0 ou inválida!");
            return;
        }

        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: "Teste de Esquiva",
            baseDice: esquiva,
            actor: this.actor,
            label: "Esquiva"
        });
    }

    async _onCreateModulo(event) {
        event.preventDefault();
        // Se não tiver data-consumo, mostrar diálogo para escolher o consumo
        let consumo = Number(event.currentTarget.dataset.consumo);
        
        if (!consumo || isNaN(consumo)) {
            // Mostrar diálogo para escolher o consumo
            const content = `
                <form>
                    <div class="form-group">
                        <label>Selecione o consumo do módulo:</label>
                        <select name="consumo" style="width: 100%;">
                            <option value="1">Consumo 1</option>
                            <option value="2">Consumo 2</option>
                            <option value="3">Consumo 3</option>
                            <option value="4">Consumo 4</option>
                            <option value="5">Consumo 5</option>
                        </select>
                    </div>
                </form>
            `;
            
            return new Promise((resolve) => {
                new Dialog({
                    title: "Adicionar Novo Módulo",
                    content: content,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: "Continuar",
                            callback: async (html) => {
                                const select = html.find('select[name="consumo"]')[0];
                                consumo = select ? Number(select.value) : 1;
                                if (consumo) {
                                    await this._processarAdicaoModulo(consumo);
                                }
                                resolve();
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "Cancelar",
                            callback: () => resolve()
                        }
                    },
                    default: "ok"
                }).render(true);
            });
        } else {
            await this._processarAdicaoModulo(consumo);
        }
    }

    async _processarAdicaoModulo(consumo) {
        // Verificar Reator disponível
        const reatorDisponivel = this.actor.system.sistema?.energetico || 
                                await this._getSelectedModelReator(this.actor.system.modeloId) || 0;
        
        // Calcular total de consumo dos módulos já equipados (soma dos consumos)
        const modulosAtuais = this.actor.items.filter(item => item.type === "exacomModulo");
        let totalConsumoEquipado = 0;
        modulosAtuais.forEach(modulo => {
            const consumoModulo = Number(modulo.system?.consumo || 0);
            totalConsumoEquipado += consumoModulo;
        });
        
        // Verificar se há espaço disponível (soma dos consumos não pode exceder o Reator)
        const espacoDisponivel = reatorDisponivel - totalConsumoEquipado;
        
        if (espacoDisponivel <= 0) {
            ui.notifications.warn(`Não é possível adicionar mais módulos. Consumo total equipado (${totalConsumoEquipado}) já atingiu o limite do Reator (${reatorDisponivel}).`);
            return;
        }
        
        if (consumo > espacoDisponivel) {
            const confirmar = await Dialog.confirm({
                title: "Aviso de Reator Insuficiente",
                content: `<p>Este módulo requer <strong>Consumo ${consumo}</strong>, mas há apenas <strong>${espacoDisponivel} ponto(s)</strong> de Reator disponível.</p>
                         <p>Consumo total equipado: ${totalConsumoEquipado} / ${reatorDisponivel}</p>
                         <p>Deseja adicionar mesmo assim?</p>`,
                yes: () => true,
                no: () => false,
                defaultYes: false
            });
            
            if (!confirmar) {
                return;
            }
        }
        
        // Buscar módulos do compendium
        const modulosDisponiveis = await this._getModulosExacom();
        const modulosFiltrados = modulosDisponiveis.filter(m => Number(m.system?.consumo || 0) === consumo);
        
        // Se houver módulos no compendium, mostrar diálogo de seleção
        if (modulosFiltrados.length > 0) {
            const options = modulosFiltrados.map(m => {
                const nome = m.name;
                const tipo = m.system?.tipo || "";
                return `<option value="${m.id}">${nome}${tipo ? ` (${tipo})` : ""}</option>`;
            }).join("");
            
            const content = `
                <form>
                    <div class="form-group">
                        <label>Selecione um módulo do compendium:</label>
                        <select name="moduloId" style="width: 100%;">
                            <option value="">-- Criar novo módulo --</option>
                            ${options}
                        </select>
                    </div>
                </form>
            `;
            
            return new Promise((resolve) => {
                new Dialog({
                    title: `Adicionar Módulo - Consumo ${consumo}`,
                    content: content,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: "Adicionar",
                            callback: async (html) => {
                                const select = html.find('select[name="moduloId"]')[0];
                                const moduloId = select ? select.value : "";
                                
                                if (moduloId && moduloId !== "") {
                                    // Adicionar módulo do compendium
                                    const pack = game.packs.get("rising-steel.modulosExacom");
                                    if (pack) {
                                        try {
                                            const moduloDoc = await pack.getDocument(moduloId);
                                            if (moduloDoc) {
                                                const itemData = moduloDoc.toObject();
                                                await this.actor.createEmbeddedDocuments("Item", [itemData]);
                                                resolve();
                                                return;
                                            }
                                        } catch (error) {
                                            console.error("[Rising Steel] Erro ao adicionar módulo do compendium:", error);
                                            ui.notifications.error("Erro ao adicionar módulo do compendium.");
                                        }
                                    }
                                } else {
                                    // Criar novo módulo vazio
                                    const itemData = {
                                        name: `Novo Módulo Consumo ${consumo}`,
                                        type: "exacomModulo",
                                        system: {
                                            consumo: consumo,
                                            descricao: "",
                                            custo: 0,
                                            duracao: "",
                                            tipo: ""
                                        }
                                    };
                                    await this.actor.createEmbeddedDocuments("Item", [itemData]);
                                }
                                resolve();
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "Cancelar",
                            callback: () => resolve()
                        }
                    },
                    default: "ok"
                }).render(true);
            });
        }
        
        // Criar novo módulo vazio
        const itemData = {
            name: `Novo Módulo Consumo ${consumo}`,
            type: "exacomModulo",
            system: {
                consumo: consumo,
                descricao: "",
                custo: 0,
                duracao: "",
                tipo: ""
            }
        };
        
        await this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    async _onUseModulo(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const modulo = this.actor.items.get(itemId);
        
        if (!modulo || modulo.type !== "exacomModulo") {
            ui.notifications.warn("Módulo não encontrado.");
            return;
        }
        
        const custo = Number(modulo.system?.custo || 0);
        const nomeModulo = modulo.name;
        const tipoModulo = modulo.system?.tipo || "—";
        const duracaoModulo = modulo.system?.duracao || "—";
        const descricaoModulo = modulo.system?.descricao || "";
        
        // Buscar piloto vinculado para obter EXApoints
        let linkedPilot = null;
        let exapointsAtual = 0;
        
        try {
            const linkedPilotId = this.actor.system?.vinculo?.pilotoId;
            if (linkedPilotId && game?.actors) {
                linkedPilot = game.actors.get(linkedPilotId);
                if (linkedPilot) {
                    exapointsAtual = Number(linkedPilot.system?.exapoints?.atual || 0);
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar piloto vinculado:", error);
        }
        
        // Enriquecer descrição HTML se necessário
        let descricaoHTML = "";
        if (descricaoModulo) {
            try {
                descricaoHTML = await FoundryCompatibility.enrichHTML(descricaoModulo, {
                    secrets: this.actor.isOwner,
                    async: true
                });
            } catch (error) {
                console.warn("[Rising Steel] Erro ao enriquecer descrição do módulo:", error);
                descricaoHTML = descricaoModulo;
            }
        }
        
        // Módulo sempre ativa com sucesso
        let mensagemFlavor = `<strong>Módulo Ativado: ${nomeModulo}</strong><br>`;
        mensagemFlavor += `Tipo: ${tipoModulo}<br>`;
        mensagemFlavor += `Duração: ${duracaoModulo}<br>`;
        if (descricaoHTML) {
            mensagemFlavor += `<br><div style="margin-top: 8px; padding: 8px; background: rgba(0, 0, 0, 0.05); border-left: 3px solid #4a9; border-radius: 3px;">`;
            mensagemFlavor += `<strong>Descrição:</strong><br>${descricaoHTML}`;
            mensagemFlavor += `</div>`;
        }
        
        if (custo > 0) {
            // Rolar dados para verificar gasto de EXApoints
            const roll = new Roll(`${custo}d6`);
            await roll.roll();
            
            const diceResults = roll.terms?.[0]?.results || [];
            // Contar quantos 1 saíram (cada 1 = 1 EXApoint gasto)
            const uns = diceResults.filter(r => {
                const val = r.result ?? r.total ?? r;
                return Number(val) === 1;
            }).length;
            
            // Criar mensagem no chat
            const rollResultsText = diceResults.map(r => {
                const val = r.result ?? r.total ?? r;
                return Number(val) === 1 ? `<strong style="color: #ff4444;">${val}</strong>` : val;
            }).join(", ");
            
            mensagemFlavor += `<br><strong>Rolagem de Custo: ${custo}d6</strong><br>`;
            mensagemFlavor += `Resultados: [${rollResultsText}]<br>`;
            mensagemFlavor += `Uns (1) rolados: <strong>${uns}</strong><br>`;
            mensagemFlavor += `EXApoints gastos: <strong>${uns}</strong>`;
            
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: mensagemFlavor,
                rollMode: game.settings.get('core', 'rollMode'),
                flags: {
                    "rising-steel": {
                        rollType: "modulo-ativacao",
                        moduloId: itemId,
                        uns: uns,
                        exapointsGastos: uns
                    }
                }
            });
            
            // Atualizar EXApoints do piloto (se houver)
            if (linkedPilot && uns > 0) {
                const novoExapoints = Math.max(0, exapointsAtual - uns);
                await linkedPilot.update({
                    "system.exapoints.atual": novoExapoints
                });
                ui.notifications.info(
                    `Módulo ${nomeModulo} ativado! ${uns} EXApoint${uns !== 1 ? 's' : ''} gasto${uns !== 1 ? 's' : ''}.`
                );
            } else if (uns === 0) {
                ui.notifications.info(`Módulo ${nomeModulo} ativado! Nenhum EXApoint gasto.`);
            }
        } else {
            // Módulo sem custo, apenas ativar
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: mensagemFlavor
            });
            
            ui.notifications.info(`Módulo ${nomeModulo} ativado!`);
        }
    }
}


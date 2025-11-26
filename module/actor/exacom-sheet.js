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
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar blindagem selecionada:", error);
            }

            // Calcular limiares de dano baseados no estrutural
            const estrutural = Number(context.system.sistema?.estrutural || 0);
            context.limiarLeve = estrutural * 10;
            context.limiarMedio = estrutural * 20;
            context.limiarGrave = estrutural * 40;
            
            // Calcular atributos de combate
            const neuromotor = Number(context.system.sistema?.neuromotor || 0);
            // Blindagem agora vem do item selecionado
            let blindagem = 0;
            if (context.selectedBlindagem) {
                blindagem = Number(context.selectedBlindagem.system?.blindagem || 0);
            } else {
                blindagem = Number(context.system.equipamentosExa?.blindagem || 0);
            }
            const sincronia = Number(context.system.exa?.sincronia || 0);
            
            // Esquiva = (Neuromotor - Blindagem) + Sincronia
            context.calculatedEsquiva = Math.max(0, (neuromotor - blindagem) + sincronia);
            
            // Mobilidade = (2 + Neuromotor) - Estrutural
            context.calculatedMobilidade = Math.max(0, (2 + neuromotor) - estrutural);
            
            // Atualizar os limiares calculados
            context.system.limiarDano.leve.limiar = context.limiarLeve;
            context.system.limiarDano.moderado.limiar = context.limiarMedio;
            context.system.limiarDano.grave.limiar = context.limiarGrave;

            // Garantir que a escala seja sempre "Grande"
            if (!context.system.identificacao) {
                context.system.identificacao = {};
            }
            context.system.identificacao.escala = "Grande";

            // Preparar armas como ataquesList (igual ao companion)
            const attributeOptions = this._getAttributeOptions();
            context.atributosAtaque = attributeOptions;
            const armas = context.system.equipamentosExa?.armas || [];
            context.armasList = armas.map((arma, index) => {
                const atributoLabel = attributeOptions.find(opt => opt.path === arma.atributo)?.label || "—";
                const atributoValor = this._getAttributeValue(arma.atributo);
                return {
                    ...arma,
                    index,
                    atributoLabel,
                    atributoValor
                };
            });

            context.linkedPilot = null;
            context.linkedPilotOverdrive = 0;
            try {
                const linkedPilotId = context.system?.vinculo?.pilotoId;
                if (linkedPilotId && game?.actors) {
                    const pilotActor = game.actors.get(linkedPilotId);
                    if (pilotActor) {
                        context.linkedPilot = { id: pilotActor.id, name: pilotActor.name };
                        // Buscar overdrive do piloto vinculado
                        context.linkedPilotOverdrive = Number(pilotActor.system?.exapoints?.overdrive || 0);
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
                calculatedEsquiva: 0,
                calculatedMobilidade: 0,
                linkedPilot: null,
                linkedPilotOverdrive: 0
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
        html.find("select[name='system.equipamentosExa.blindagemId']").on("change", this._onBlindagemChange.bind(this));
        html.find("input[name='system.exa.sincronia']").on("change", this._onCombatStatsChange.bind(this));
        
        // Listeners para armas (ataques)
        html.find(".arma-create").click(this._onCreateArma.bind(this));
        html.find(".arma-edit").click(this._onEditArma.bind(this));
        html.find(".arma-delete").click(this._onDeleteArma.bind(this));
        html.find(".arma-roll").click(this._onRollArma.bind(this));
        
        // Listeners para rolagem de atributos de sistema
        html.find(".roll-atributo-sistema").click(this._onRollAtributoSistema.bind(this));
    }
    
    _getAttributeOptions() {
        return [
            { label: "Neuromotor", path: "sistema.neuromotor" },
            { label: "Sensorial", path: "sistema.sensorial" },
            { label: "Estrutural", path: "sistema.estrutural" }
        ];
    }
    
    _getAttributeValue(path) {
        if (!path) return 0;
        const value = foundry.utils.getProperty(this.actor.system, path);
        return Number(value || 0) || 0;
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
            return sys.reator || null;
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

    async _onEstruturalChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const estrutural = Number(input.value || 0);
        
        // Calcular novos limiares
        const limiarLeve = estrutural * 10;
        const limiarMedio = estrutural * 20;
        const limiarGrave = estrutural * 40;
        
        // Calcular mobilidade (Esquiva não depende de estrutural, então não precisa recalcular)
        const neuromotor = Number(this.actor.system.sistema?.neuromotor || 0);
        const calculatedMobilidade = Math.max(0, (2 + neuromotor) - estrutural);
        
        // Atualizar os limiares e mobilidade no banco de dados
        await this.actor.update({
            "system.limiarDano.leve.limiar": limiarLeve,
            "system.limiarDano.moderado.limiar": limiarMedio,
            "system.limiarDano.grave.limiar": limiarGrave,
            "system.combate.mobilidade": calculatedMobilidade
        });
        
        this.render(false);
    }

    async _onCombatStatsChange(event) {
        event.preventDefault();
        
        const neuromotor = Number(this.actor.system.sistema?.neuromotor || 0);
        const blindagem = Number(this.actor.system.equipamentosExa?.blindagem || 0);
        const sincronia = Number(this.actor.system.exa?.sincronia || 0);
        const estrutural = Number(this.actor.system.sistema?.estrutural || 0);
        
        // Calcular Esquiva e Mobilidade
        const calculatedEsquiva = Math.max(0, (neuromotor - blindagem) + sincronia);
        const calculatedMobilidade = Math.max(0, (2 + neuromotor) - estrutural);
        
        // Atualizar os atributos de combate no banco de dados
        await this.actor.update({
            "system.combate.esquiva": calculatedEsquiva,
            "system.combate.mobilidade": calculatedMobilidade
        });
        
        this.render(false);
    }

    async _onBlindagemChange(event) {
        event.preventDefault();
        const select = event.currentTarget;
        const blindagemId = select.value;
        
        let blindagemValue = 0;
        if (blindagemId) {
            try {
                const pack = game.packs.get("rising-steel.blindagemExacom");
                if (pack) {
                    const docs = await pack.getDocuments();
                    const blindagemDoc = docs.find(d => d.id === blindagemId);
                    if (blindagemDoc) {
                        blindagemValue = Number(blindagemDoc.system?.blindagem || 0);
                    }
                }
            } catch (error) {
                console.warn("[Rising Steel] Erro ao buscar blindagem:", error);
            }
        }
        
        // Atualizar a blindagem no actor
        await this.actor.update({
            "system.equipamentosExa.blindagemId": blindagemId,
            "system.equipamentosExa.blindagem": blindagemValue
        });
        
        // Recalcular atributos de combate
        const neuromotor = Number(this.actor.system.sistema?.neuromotor || 0);
        const sincronia = Number(this.actor.system.exa?.sincronia || 0);
        const estrutural = Number(this.actor.system.sistema?.estrutural || 0);
        
        const calculatedEsquiva = Math.max(0, (neuromotor - blindagemValue) + sincronia);
        const calculatedMobilidade = Math.max(0, (2 + neuromotor) - estrutural);
        
        await this.actor.update({
            "system.combate.esquiva": calculatedEsquiva,
            "system.combate.mobilidade": calculatedMobilidade
        });
        
        this.render(false);
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
            // Limpar apenas o ID do modelo; não alteramos valores manuais
            await this.actor.update({ "system.modeloId": "" });
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
            const blindagem = Number(this.actor.system.equipamentosExa?.blindagem || 0);
            const sincronia = Number(this.actor.system.exa?.sincronia || 0);
            
            // Calcular atributos de combate
            const calculatedEsquiva = Math.max(0, (neuromotor - blindagem) + sincronia);
            const calculatedMobilidade = Math.max(0, (2 + neuromotor) - estrutural);
            
            const updateData = {
                "system.modeloId": modelId,
                "system.identificacao.modelo": doc.name || "",
                "system.sistema.neuromotor": neuromotor,
                "system.sistema.sensorial": Number(sys.sensorial ?? 0) || 0,
                "system.sistema.estrutural": estrutural,
                "system.combate.esquiva": calculatedEsquiva,
                "system.combate.mobilidade": calculatedMobilidade
            };

            await this.actor.update(updateData);
            this.render(false);
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
            dadoBonus: 0,
            condicao: "",
            alcance: "",
            dano: "",
            efeito: ""
        };

        const htmlContent = await FoundryCompatibility.renderTemplate(
            "systems/rising-steel/template/app/ataque-dialog.html",
            {
                ataque: arma,
                atributos: this._getAttributeOptions()
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
                        const dadoBonus = parseInt(html.find("#ataque-dado-bonus").val()) || 0;
                        const condicao = html.find("#ataque-condicao").val().trim();
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

                        const novaArma = {
                            nome,
                            atributo,
                            dadoBonus: Math.max(0, dadoBonus),
                            condicao,
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

        const atributoValor = this._getAttributeValue(arma.atributo);
        if (atributoValor <= 0) {
            ui.notifications.warn("O atributo selecionado não possui valor.");
            return;
        }

        const dadoBonus = Math.max(0, this._normalizeNumber(arma.dadoBonus) || 0);
        const totalDados = atributoValor + dadoBonus;

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
}


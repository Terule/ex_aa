import { FoundryCompatibility } from "../utils/compatibility.js";

export class RisingSteelCreatureSheet extends FoundryCompatibility.getActorSheetBase() {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["rising-steel", "sheet", "actor", "creature"],
            template: "systems/rising-steel/template/actor/creature-sheet.html",
            width: 820,
            height: 760,
            tabs: [{
                navSelector: ".creature-tabs",
                contentSelector: ".creature-tabs-content",
                initial: "status"
            }]
        });
    }

    async getData(options) {
        const source = this.actor.toObject();
        const actorData = this.actor.toObject(false);

        this._normalizeNumericValues(actorData.system);

        const context = {
            actor: actorData,
            source: source.system,
            system: actorData.system,
            owner: this.actor.isOwner,
            limited: this.actor.limited,
            options: this.options,
            editable: this.isEditable,
            type: this.actor.type
        };

        context.descriptionHTML = await FoundryCompatibility.enrichHTML(context.system.descricao || "", {
            secrets: this.actor.isOwner,
            async: true
        });

        context.categorias = CONFIG.RisingSteel?.getCategoriasList() || ["Delta", "Gama", "Beta", "Alfa", "Ômega"];
        context.escalas = CONFIG.RisingSteel?.getEscalasList() || ["Pequeno", "Médio", "Grande", "Colossal"];
        const categoriaAtual = context.system?.informacoes?.categoria || "Delta";
        context.categoriaSelecionada = categoriaAtual;
        context.categoriaPontos = CONFIG.RisingSteel?.getCategoriaPontos(categoriaAtual) || 5;
        context.pontosDistribuidos = context.system?.pontosAtributo?.distribuidos || 0;
        context.pontosRestantes = context.system?.pontosAtributo?.restantes || 0;
        context.categoriasDetalhes = context.categorias.map(nome => ({
            nome,
            pontos: CONFIG.RisingSteel?.getCategoriaPontos(nome) || 0
        }));

        const attributeOptions = this._getAttributeOptions();
        context.atributosAtaque = attributeOptions;
        context.ataquesList = (context.system?.ataques || []).map((ataque, index) => {
            const atributoLabel = attributeOptions.find(opt => opt.path === ataque.atributo)?.label || "—";
            const atributoValor = this._getAttributeValue(ataque.atributo);
            return {
                ...ataque,
                index,
                atributoLabel,
                atributoValor
            };
        });

        const habilidades = Array.isArray(context.system?.habilidadesEspeciais) ? context.system.habilidadesEspeciais : [];
        context.habilidadesList = habilidades.map((hab, index) => ({
            ...hab,
            index,
            usos: {
                atual: hab?.usos?.atual ?? 0,
                total: hab?.usos?.total ?? 0
            }
        }));

        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (!this.options.editable) return;

        html.find("input[type='number']").on("input", this._sanitizeNumericInput.bind(this));
        html.find("input[type='number']").on("blur", this._validateNumericInput.bind(this));

        html.find(".attack-create").click(this._onCreateAttack.bind(this));
        html.find(".attack-edit").click(this._onEditAttack.bind(this));
        html.find(".attack-delete").click(this._onDeleteAttack.bind(this));
        html.find(".attack-roll").click(this._onAttackRoll.bind(this));
        html.find(".roll-atributo").click(this._onRollAttribute.bind(this));

        html.find(".habilidade-create").click(this._onCreateHabilidade.bind(this));
        html.find(".habilidade-edit").click(this._onEditHabilidade.bind(this));
        html.find(".habilidade-delete").click(this._onDeleteHabilidade.bind(this));
        html.find(".habilidade-roll").click(this._onRollHabilidade.bind(this));
        html.find(".roll-iniciativa").click(this._onRollIniciativa.bind(this));
    }

    _normalizeNumericValues(systemData) {
        const normalizeValue = (value) => {
            if (value === null || value === undefined || value === '') {
                return 0;
            }
            if (typeof value === 'string') {
                value = value.replace(/,/g, '.');
            }
            const num = Number(value);
            return isNaN(num) ? 0 : num;
        };

        if (systemData.atributos) {
            const attr = systemData.atributos;
            if (attr.fisicos) {
                attr.fisicos.forca = normalizeValue(attr.fisicos.forca);
                attr.fisicos.destreza = normalizeValue(attr.fisicos.destreza);
                attr.fisicos.vigor = normalizeValue(attr.fisicos.vigor);
            }
            if (attr.mentais) {
                attr.mentais.conhecimento = normalizeValue(attr.mentais.conhecimento);
                attr.mentais.perspicacia = normalizeValue(attr.mentais.perspicacia);
                attr.mentais.resiliencia = normalizeValue(attr.mentais.resiliencia);
            }
            if (attr.sociais) {
                attr.sociais.eloquencia = normalizeValue(attr.sociais.eloquencia);
                attr.sociais.dissimulacao = normalizeValue(attr.sociais.dissimulacao);
                attr.sociais.presenca = normalizeValue(attr.sociais.presenca);
            }
        }

        if (systemData.combate) {
            systemData.combate.esquiva = normalizeValue(systemData.combate.esquiva);
            systemData.combate.mobilidade = normalizeValue(systemData.combate.mobilidade);
            systemData.combate.iniciativa = normalizeValue(systemData.combate.iniciativa);
        }

        if (systemData.armadura) {
            systemData.armadura.total = normalizeValue(systemData.armadura.total);
            systemData.armadura.dano = normalizeValue(systemData.armadura.dano);
            systemData.armadura.atual = normalizeValue(systemData.armadura.atual);
        }

        if (systemData.limiarDano) {
            ["leve", "moderado", "grave"].forEach(nivel => {
                if (systemData.limiarDano[nivel]) {
                    systemData.limiarDano[nivel].limiar = normalizeValue(systemData.limiarDano[nivel].limiar);
                    systemData.limiarDano[nivel].marcacoes = normalizeValue(systemData.limiarDano[nivel].marcacoes);
                }
            });
            systemData.limiarDano.penalidades = normalizeValue(systemData.limiarDano.penalidades);
        }

        if (systemData.pontosAtributo) {
            systemData.pontosAtributo.total = normalizeValue(systemData.pontosAtributo.total);
            systemData.pontosAtributo.distribuidos = normalizeValue(systemData.pontosAtributo.distribuidos);
            systemData.pontosAtributo.restantes = normalizeValue(systemData.pontosAtributo.restantes);
        }
    }

    async _onRollAttribute(event) {
        event.preventDefault();
        const path = event.currentTarget.dataset.atributo;
        if (!path) return;

        // Tentar capturar o valor atual diretamente do input (inclui edições ainda não salvas)
        const formElement = this.element?.get(0);
        let domValue = null;
        if (formElement) {
            const input = formElement.querySelector(`input[name='${path}']`);
            if (input) {
                const parsed = Number(String(input.value ?? 0).replace(/,/g, "."));
                if (!Number.isNaN(parsed)) domValue = parsed;
            }
        }

        const raw = foundry.utils.getProperty(this.actor.system, path);
        const dataValue = Number(String(raw ?? 0).replace(/,/g, "."));
        const value = (!Number.isNaN(domValue) && domValue !== null) ? domValue :
            (!Number.isNaN(dataValue) ? dataValue : 0);
        if (value <= 0) {
            ui.notifications.warn("Este atributo precisa ser maior que zero para rolar.");
            return;
        }

        const labelMap = {
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

        const label = labelMap[path] || "Atributo";
        const roll = await new Roll(`${value}d6`).roll();
        const dice = roll.dice?.[0];
        let successes = 0;
        if (dice?.results) {
            successes = dice.results.filter(r => (r.result ?? r.total) === 6).length;
        }

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `Rolagem de ${label} (${value}d6)`,
            rollMode: game.settings.get('core', 'rollMode'),
            flags: {
                "rising-steel": {
                    rollType: "success-pool",
                    totalDice: value,
                    successes
                }
            }
        });
    }

    async _onRollIniciativa(event) {
        event.preventDefault();
        try {
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

            let combatant = combat.combatants.find(c => c.actor?.id === this.actor.id);
            if (!combatant) {
                const tokens = this.actor.getActiveTokens(true);
                if (tokens.length === 0) {
                    ui.notifications.warn("Nenhum token ativo encontrado para esta criatura. Coloque o token na cena primeiro.");
                    return;
                }
                const token = tokens[0];
                const combatantData = {
                    tokenId: token.id,
                    actorId: this.actor.id
                };
                if (FoundryCompatibility.isV13()) {
                    combatantData.sceneId = canvas.scene?.id;
                }
                await combat.createEmbeddedDocuments("Combatant", [combatantData]);
                combat = game.combat;
                combatant = combat.combatants.find(c => c.actor?.id === this.actor.id);
            }

            if (!combatant) {
                ui.notifications.error("Não foi possível encontrar o combatente no combate.");
                return;
            }

            const destreza = this.actor.system.atributos?.fisicos?.destreza || 0;
            const perspicacia = this.actor.system.atributos?.mentais?.perspicacia || 0;
            const iniciativaBase = destreza + perspicacia;

            if (iniciativaBase <= 0) {
                ui.notifications.warn("Valor de iniciativa inválido para esta criatura.");
                return;
            }

            const roll = await new Roll(`${iniciativaBase}d6`).roll();
            const rollTotal = Number(roll.total ?? roll._total ?? 0);

            if (FoundryCompatibility.isV13()) {
                await combatant.rollInitiative({ formula: `${iniciativaBase}d6` });
            } else {
                await combatant.update({ initiative: rollTotal });
            }

            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor, token: combatant.token }),
                flavor: `Rolagem de Iniciativa: ${destreza} (Destreza) + ${perspicacia} (Perspicácia) = ${iniciativaBase}d6`,
                rollMode: game.settings.get('core', 'rollMode')
            });

            ui.notifications.info(`Iniciativa rolada: ${rollTotal}`);
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar iniciativa da criatura:", error);
            ui.notifications.error("Erro ao rolar iniciativa. Verifique o console.");
        }
    }

    _sanitizeNumericInput(event) {
        const input = event.currentTarget;
        let value = input.value || "";
        value = value.replace(/,/g, '.').replace(/[^\d.-]/g, '');
        if (value !== input.value) {
            input.value = value;
        }
    }

    _validateNumericInput(event) {
        const input = event.currentTarget;
        let value = input.value;

        if (value === '' || value === null || value === undefined) {
            value = '0';
        }

        let numValue = Number(value);
        if (isNaN(numValue)) {
            numValue = 0;
        }

        const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : null;
        const max = input.hasAttribute('max') ? Number(input.getAttribute('max')) : null;

        if (min !== null && numValue < min) {
            numValue = min;
        }
        if (max !== null && numValue > max) {
            numValue = max;
        }

        if (Number(input.value) !== numValue) {
            input.value = numValue;
            $(input).trigger('change');
        }
    }

    _normalizeNumber(value) {
        if (value === null || value === undefined || value === "") return 0;
        const normalized = String(value).replace(/,/g, '.');
        const num = Number(normalized);
        return isNaN(num) ? 0 : num;
    }

    _getAttributeOptions() {
        return [
            { label: "FOR (Físico)", path: "atributos.fisicos.forca" },
            { label: "DES (Físico)", path: "atributos.fisicos.destreza" },
            { label: "VIG (Físico)", path: "atributos.fisicos.vigor" },
            { label: "CON (Mental)", path: "atributos.mentais.conhecimento" },
            { label: "PER (Mental)", path: "atributos.mentais.perspicacia" },
            { label: "RES (Mental)", path: "atributos.mentais.resiliencia" },
            { label: "ELO (Social)", path: "atributos.sociais.eloquencia" },
            { label: "DIS (Social)", path: "atributos.sociais.dissimulacao" },
            { label: "PRE (Social)", path: "atributos.sociais.presenca" }
        ];
    }

    async _onCreateAttack(event) {
        event.preventDefault();
        await this._showAttackDialog();
    }

    async _onEditAttack(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        await this._showAttackDialog(index);
    }

    async _onDeleteAttack(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        const ataques = [...(this.actor.system.ataques || [])];
        const ataque = ataques[index];
        if (!ataque) {
            ui.notifications.warn("Ataque não encontrado.");
            return;
        }

        new Dialog({
            title: "Remover Ataque",
            content: `<p>Tem certeza que deseja remover o ataque <strong>${ataque.nome || `Ataque ${index + 1}`}</strong>?</p>`,
            buttons: {
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Remover",
                    callback: async () => {
                        ataques.splice(index, 1);
                        await this.actor.update({ "system.ataques": ataques });
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

    async _showAttackDialog(index = undefined) {
        const ataques = this.actor.system.ataques || [];
        const ataque = index !== undefined ? foundry.utils.duplicate(ataques[index]) : {
            nome: "",
            atributo: "",
            dadoBonus: 0,
            condicao: "",
            alcance: "",
            dano: "",
            efeito: ""
        };

        const htmlContent = await FoundryCompatibility.renderTemplate(
            "systems/rising-steel/template/app/ataque-criatura-dialog.html",
            {
                ataque,
                atributos: this._getAttributeOptions(),
                atributoSourceLabel: "Atributo da criatura"
            }
        );

        new Dialog({
            title: index !== undefined ? "Editar Ataque" : "Adicionar Ataque",
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
                            ui.notifications.warn("Informe o nome do ataque.");
                            return false;
                        }
                        if (!atributo) {
                            ui.notifications.warn("Selecione um atributo relacionado.");
                            return false;
                        }

                        const novoAtaque = {
                            nome,
                            atributo,
                            dadoBonus: Math.max(0, dadoBonus),
                            condicao,
                            alcance,
                            dano,
                            efeito
                        };

                        const novosAtaques = [...ataques];
                        if (index !== undefined) {
                            novosAtaques[index] = novoAtaque;
                        } else {
                            novosAtaques.push(novoAtaque);
                        }

                        await this.actor.update({ "system.ataques": novosAtaques });
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

    async _onAttackRoll(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const index = Number(button.dataset.index);
        const ataque = this.actor.system.ataques?.[index];

        if (!ataque) {
            ui.notifications.warn("Ataque inválido.");
            return;
        }

        if (!ataque.atributo) {
            ui.notifications.warn("Defina o atributo do ataque antes de rolar.");
            return;
        }

        const atributoValor = this._getAttributeValue(ataque.atributo);
        if (atributoValor <= 0) {
            ui.notifications.warn("O atributo selecionado não possui valor.");
            return;
        }

        const dadoBonus = Math.max(0, this._normalizeNumber(ataque.dadoBonus) || 0);
        const totalDados = atributoValor + dadoBonus;

        // Verificar se é um companion com piloto vinculado
        let linkedPilot = null;
        if (this.actor.type === "companion") {
            const pilotId = this.actor.system?.vinculo?.pilotoId;
            if (pilotId && game?.actors) {
                linkedPilot = game.actors.get(pilotId);
            }
        }

        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: ataque.nome || `Ataque ${index + 1}`,
            baseDice: totalDados,
            actor: this.actor,
            label: ataque.nome || `Ataque ${index + 1}`,
            linkedPilot: linkedPilot
        });
    }

    _getAttributeValue(path) {
        if (!path) return 0;
        const value = foundry.utils.getProperty(this.actor.system, path);
        return this._normalizeNumber(value);
    }

    async _onCreateHabilidade(event) {
        event.preventDefault();
        await this._showHabilidadeDialog();
    }

    async _onEditHabilidade(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        await this._showHabilidadeDialog(index);
    }

    async _onDeleteHabilidade(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        const habilidades = [...(this.actor.system.habilidadesEspeciais || [])];
        const habilidade = habilidades[index];
        if (!habilidade) {
            ui.notifications.warn("Habilidade não encontrada.");
            return;
        }

        new Dialog({
            title: "Remover Habilidade",
            content: `<p>Deseja remover <strong>${habilidade.nome || `Habilidade ${index + 1}`}</strong>?</p>`,
            buttons: {
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Remover",
                    callback: async () => {
                        habilidades.splice(index, 1);
                        await this.actor.update({ "system.habilidadesEspeciais": habilidades });
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

    async _showHabilidadeDialog(index = undefined) {
        const habilidadesRaw = this.actor.system.habilidadesEspeciais || [];
        const habilidades = Array.isArray(habilidadesRaw) ? habilidadesRaw : [];
        const habilidade = index !== undefined ? foundry.utils.duplicate(habilidades[index]) : {
            nome: "",
            descricao: "",
            usos: { atual: 0, total: 0 }
        };

        const htmlContent = await FoundryCompatibility.renderTemplate(
            "systems/rising-steel/template/app/habilidade-dialog.html",
            { habilidade }
        );

        new Dialog({
            title: index !== undefined ? "Editar Habilidade" : "Adicionar Habilidade",
            content: htmlContent,
            buttons: {
                save: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Salvar",
                    callback: async (html) => {
                        const nome = html.find("#habilidade-nome").val().trim();
                        const descricao = html.find("#habilidade-descricao").val().trim();
                        const usosAtual = parseInt(html.find("#habilidade-usos-atual").val()) || 0;
                        const usosTotal = parseInt(html.find("#habilidade-usos-total").val()) || 0;

                        if (!nome) {
                            ui.notifications.warn("Informe o nome da habilidade.");
                            return false;
                        }

                        const novoRegistro = {
                            nome,
                            descricao,
                            usos: {
                                atual: Math.max(0, Math.min(usosAtual, usosTotal)),
                                total: Math.max(0, usosTotal)
                            }
                        };

                        const novaLista = [...habilidades];
                        if (index !== undefined) {
                            novaLista[index] = novoRegistro;
                        } else {
                            novaLista.push(novoRegistro);
                        }

                        await this.actor.update({ "system.habilidadesEspeciais": novaLista });
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

    async _onRollHabilidade(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.dataset.index);
        const habilidades = this.actor.system.habilidadesEspeciais || [];
        const habilidade = habilidades[index];

        if (!habilidade) {
            ui.notifications.warn("Habilidade não encontrada.");
            return;
        }

        const usos = habilidade.usos || { atual: 0, total: 0 };

        new Dialog({
            title: habilidade.nome || "Habilidade",
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
                        await this.actor.update({ "system.habilidadesEspeciais": novaLista });
                        this._enviarHabilidadeChat(habilidade, true);
                    }
                },
                justRoll: {
                    icon: '<i class="fas fa-comment"></i>',
                    label: "Só mostrar no chat",
                    callback: () => this._enviarHabilidadeChat(habilidade, false)
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar"
                }
            },
            default: "consume"
        }).render(true);
    }

    _enviarHabilidadeChat(habilidade, consumiuCarga) {
        const content = `
            <h3>${habilidade.nome}</h3>
            <p>${habilidade.descricao || "Sem descrição"}</p>
            ${consumiuCarga ? "<p><em>Uma carga foi consumida.</em></p>" : ""}
        `;

        ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content
        });
    }

}



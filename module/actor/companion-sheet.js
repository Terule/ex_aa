import { RisingSteelCreatureSheet } from "./creature-sheet.js";

export class RisingSteelCompanionSheet extends RisingSteelCreatureSheet {
    static get defaultOptions() {
        const options = super.defaultOptions;
        return foundry.utils.mergeObject(options, {
            classes: ["rising-steel", "sheet", "actor", "companion"],
            template: "systems/rising-steel/template/actor/companion-sheet.html",
            tabs: [{
                navSelector: ".companion-tabs",
                contentSelector: ".creature-tabs-content",
                initial: "status"
            }]
        });
    }

    async getData(options) {
        const context = await super.getData(options);
        context.availablePilots = [];
        context.currentPilot = null;

        try {
            const actorsCollection = game?.actors ? (game.actors.contents ?? Array.from(game.actors)) : [];
            if (actorsCollection?.length) {
                context.availablePilots = actorsCollection
                    .filter(actor => actor.type === "piloto")
                    .map(actor => ({ id: actor.id, name: actor.name }))
                    .sort((a, b) => a.name.localeCompare(b.name, game.i18n?.lang || "pt-BR"));

                const pilotId = context.system?.vinculo?.pilotoId;
                if (pilotId) {
                    const pilotActor = game.actors.get(pilotId);
                    if (pilotActor) {
                        const pilotData = pilotActor.toObject(false);
                        const pilotSystem = foundry.utils.duplicate(pilotData.system || {});
                        context.currentPilot = {
                            id: pilotActor.id,
                            name: pilotActor.name,
                            img: pilotActor.img,
                            patente: pilotSystem?.identificacao?.patente || "",
                            codinome: pilotSystem?.identificacao?.codinome || "",
                            system: pilotSystem
                        };
                    }
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Falha ao carregar lista de pilotos para companions:", error);
        }

        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (!this.options.editable) return;
        html.find(".open-pilot-sheet").click(this._onOpenPilotSheet.bind(this));
    }

    async _updateObject(event, formData) {
        // Limpar valores undefined do formData
        const cleanFormData = {};
        for (const [key, value] of Object.entries(formData)) {
            if (value !== undefined && value !== null) {
                cleanFormData[key] = value;
            }
        }

        const previousPilotId = this.actor.system?.vinculo?.pilotoId || "";
        await super._updateObject(event, cleanFormData);
        const expanded = foundry.utils.expandObject(cleanFormData);
        const newPilotId = (foundry.utils.getProperty(expanded, "system.vinculo.pilotoId") ?? this.actor.system?.vinculo?.pilotoId) ?? "";
        await this._syncPilotLink(previousPilotId, newPilotId);
    }

    async _syncPilotLink(oldPilotId, newPilotId) {
        if (oldPilotId === newPilotId) return;

        if (!game?.actors) {
            console.warn("[Rising Steel] Coleção de atores indisponível para sincronizar companion.");
            return;
        }

        if (oldPilotId) {
            const oldPilot = game.actors.get(oldPilotId);
            if (oldPilot && oldPilot.system?.companionId === this.actor.id) {
                await oldPilot.update({ "system.companionId": "" });
            }
        }

        if (newPilotId) {
            const pilot = game.actors.get(newPilotId);
            if (!pilot) {
                ui.notifications?.warn("Piloto selecionado não encontrado.");
                await this.actor.update({ "system.vinculo.pilotoId": "" });
                return;
            }

            const existingCompanionId = pilot.system?.companionId;
            if (existingCompanionId && existingCompanionId !== this.actor.id) {
                const existingCompanion = game.actors.get(existingCompanionId);
                if (existingCompanion && existingCompanion.system?.vinculo?.pilotoId === pilot.id) {
                    await existingCompanion.update({ "system.vinculo.pilotoId": "" });
                }
            }

            await pilot.update({ "system.companionId": this.actor.id });
            if (this.actor.system?.vinculo?.pilotoId !== newPilotId) {
                await this.actor.update({ "system.vinculo.pilotoId": newPilotId });
            }
        }
    }

    async _onOpenPilotSheet(event) {
        event.preventDefault();
        const pilotId = this.actor.system?.vinculo?.pilotoId;
        if (!pilotId) {
            ui.notifications?.warn("Nenhum piloto vinculado.");
            return;
        }

        const pilot = game.actors?.get(pilotId);
        if (!pilot) {
            ui.notifications?.warn("Piloto vinculado não encontrado.");
            return;
        }

        pilot.sheet?.render(true, { focus: true });
    }

    /**
     * Get the linked pilot actor
     * @returns {Actor|null}
     * @private
     */
    _getLinkedPilot() {
        const pilotId = this.actor.system?.vinculo?.pilotoId;
        if (!pilotId || !game?.actors) return null;
        const pilot = game.actors.get(pilotId);
        return pilot || null;
    }

    /**
     * Roll pilot attribute
     * @param {Event} event
     * @private
     */
    async _onRollPilotAttribute(event) {
        event.preventDefault();
        const pilot = this._getLinkedPilot();
        if (!pilot) {
            ui.notifications?.warn("Nenhum piloto vinculado.");
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

        // Se não encontrou no DOM, ler do sistema do piloto
        const cleanPath = path.replace("pilot.", "");
        const systemValue = foundry.utils.getProperty(pilot.system, cleanPath);
        const systemNumValue = Number(String(systemValue ?? 0).replace(/,/g, "."));
        
        // Usar o valor do DOM se disponível, senão usar o do sistema
        const numValue = (!Number.isNaN(domValue) && domValue !== null) ? domValue : 
            (!Number.isNaN(systemNumValue) ? systemNumValue : 0);

        if (numValue <= 0 || Number.isNaN(numValue)) {
            ui.notifications.warn("Este atributo precisa ser maior que zero para rolar.");
            return;
        }

        const labelMap = {
            "atributos.fisicos.forca": "Força",
            "atributos.fisicos.destreza": "Destreza",
            "atributos.fisicos.vigor": "Vigor",
            "atributos.mentais.conhecimento": "Conhecimento",
            "atributos.mentais.perspicacia": "Perspicácia",
            "atributos.mentais.resiliencia": "Resiliência",
            "atributos.sociais.eloquencia": "Eloquência",
            "atributos.sociais.dissimulacao": "Dissimulação",
            "atributos.sociais.presenca": "Presença"
        };

        const label = labelMap[cleanPath] || "Atributo";
        const roll = await new Roll(`${numValue}d6`).roll();

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: pilot }),
            flavor: `Rolagem de ${label} do Piloto (${numValue}d6)`
        });
    }

    /**
     * Roll pilot initiative
     * @param {Event} event
     * @private
     */
    async _onRollPilotIniciativa(event) {
        event.preventDefault();
        const pilot = this._getLinkedPilot();
        if (!pilot) {
            ui.notifications?.warn("Nenhum piloto vinculado.");
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

            let combatant = combat.combatants.find(c => c.actor?.id === pilot.id);
            if (!combatant) {
                const tokens = pilot.getActiveTokens(true);
                if (tokens.length === 0) {
                    ui.notifications.warn("Nenhum token ativo encontrado para este piloto. Coloque o token na cena primeiro.");
                    return;
                }
                const token = tokens[0];
                const combatantData = {
                    tokenId: token.id,
                    actorId: pilot.id
                };
                if (FoundryCompatibility.isV13()) {
                    combatantData.sceneId = canvas.scene?.id;
                }
                await combat.createEmbeddedDocuments("Combatant", [combatantData]);
                combat = game.combat;
                combatant = combat.combatants.find(c => c.actor?.id === pilot.id);
            }

            if (!combatant) {
                ui.notifications.error("Não foi possível encontrar o combatente no combate.");
                return;
            }

            const destreza = Number(pilot.system?.atributos?.fisicos?.destreza || 0);
            const perspicacia = Number(pilot.system?.atributos?.mentais?.perspicacia || 0);
            const iniciativaBase = destreza + perspicacia;

            if (iniciativaBase <= 0) {
                ui.notifications.warn("Valor de iniciativa inválido para este piloto.");
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
                speaker: ChatMessage.getSpeaker({ actor: pilot, token: combatant.token }),
                flavor: `Rolagem de Iniciativa do Piloto: ${destreza} (Destreza) + ${perspicacia} (Perspicácia) = ${iniciativaBase}d6`
            });

            ui.notifications.info(`Iniciativa rolada: ${roll.total ?? 0}`);
        } catch (error) {
            console.error("[Rising Steel] Erro ao rolar iniciativa do piloto:", error);
            ui.notifications.error("Erro ao rolar iniciativa. Verifique o console.");
        }
    }

    /**
     * Roll pilot especialização
     * @param {Event} event
     * @private
     */
    async _onRollPilotEspecializacao(event) {
        event.preventDefault();
        const pilot = this._getLinkedPilot();
        if (!pilot) {
            ui.notifications?.warn("Nenhum piloto vinculado.");
            return;
        }

        const tipo = event.currentTarget.dataset.tipo;
        const index = parseInt(event.currentTarget.dataset.index);
        if (!tipo || Number.isNaN(index)) return;

        const especializacoes = pilot.system?.especializacoes?.[tipo] || [];
        const especializacao = especializacoes[index];
        if (!especializacao) {
            ui.notifications?.warn("Especialização não encontrada.");
            return;
        }

        const normalizeNumber = (value) => {
            if (value === null || value === undefined || value === "") return 0;
            const normalized = String(value).replace(/,/g, '.');
            const num = Number(normalized);
            return isNaN(num) ? 0 : num;
        };

        const atributoValue = normalizeNumber(foundry.utils.getProperty(pilot.system, especializacao.atributo));
        if (atributoValue === 0) {
            ui.notifications.warn("O atributo tem valor 0!");
            return;
        }

        const dadoBase = normalizeNumber(especializacao.dadoBase) || 0;
        const dadoBonus = normalizeNumber(especializacao.dadoBonus) || 0;
        const totalDados = dadoBase + dadoBonus + atributoValue;

        const { RisingSteelRollDialog } = await import("../app/roll-dialog.js");
        await RisingSteelRollDialog.prepareRollDialog({
            rollName: especializacao.nome || `Especialização do Piloto`,
            baseDice: totalDados,
            actor: pilot,
            label: especializacao.nome || `Especialização do Piloto`,
            allowAttributeSelection: false,
            exapointsMaximo: normalizeNumber(especializacao.exapoints) || 0
        });
    }
}


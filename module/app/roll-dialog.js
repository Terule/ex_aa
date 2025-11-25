// Import compatibility utilities
import { FoundryCompatibility } from "../utils/compatibility.js";

/**
 * Roll Dialog for Rising Steel system
 * Shows a dialog to add bonus dice and EXApoints before rolling
 */
export class RisingSteelRollDialog {
    /**
     * Display roll dialog and execute the roll.
     * 
     * @param {Object} options
     * @param {string} options.rollName - Name of the roll
     * @param {number} options.baseDice - Base number of dice (from attribute)
     * @param {Actor} options.actor - The actor making the roll
     * @param {string} options.label - Label for the roll
     * @param {boolean} options.allowAttributeSelection - Allow selecting an attribute to add as bonus
     */
    static async prepareRollDialog({
        rollName = "",
        baseDice = 0,
        actor = null,
        label = "",
        allowAttributeSelection = false,
        linkedPilot = null
    } = {}) {
        if (!actor) {
            ui.notifications.error("Actor não encontrado para a rolagem");
            return;
        }

        const exapointsAtual = actor.system.exapoints?.atual || 0;
        const exapointsMaximo = actor.system.exapoints?.maximo || 0;

        // Preparar lista de atributos para seleção
        const atributos = allowAttributeSelection ? {
            fisicos: {
                forca: actor.system.atributos?.fisicos?.forca || 0,
                destreza: actor.system.atributos?.fisicos?.destreza || 0,
                vigor: actor.system.atributos?.fisicos?.vigor || 0
            },
            mentais: {
                conhecimento: actor.system.atributos?.mentais?.conhecimento || 0,
                perspicacia: actor.system.atributos?.mentais?.perspicacia || 0,
                resiliencia: actor.system.atributos?.mentais?.resiliencia || 0
            },
            sociais: {
                eloquencia: actor.system.atributos?.sociais?.eloquencia || 0,
                dissimulacao: actor.system.atributos?.sociais?.dissimulacao || 0,
                presenca: actor.system.atributos?.sociais?.presenca || 0
            }
        } : null;

        // Preparar atributos do piloto vinculado (se houver)
        let linkedPilotAttributes = null;
        let linkedPilotExapoints = { atual: 0, maximo: 0 };
        if (linkedPilot) {
            linkedPilotAttributes = {
                fisicos: {
                    forca: linkedPilot.system?.atributos?.fisicos?.forca || 0,
                    destreza: linkedPilot.system?.atributos?.fisicos?.destreza || 0,
                    vigor: linkedPilot.system?.atributos?.fisicos?.vigor || 0
                },
                mentais: {
                    conhecimento: linkedPilot.system?.atributos?.mentais?.conhecimento || 0,
                    perspicacia: linkedPilot.system?.atributos?.mentais?.perspicacia || 0,
                    resiliencia: linkedPilot.system?.atributos?.mentais?.resiliencia || 0
                },
                sociais: {
                    eloquencia: linkedPilot.system?.atributos?.sociais?.eloquencia || 0,
                    dissimulacao: linkedPilot.system?.atributos?.sociais?.dissimulacao || 0,
                    presenca: linkedPilot.system?.atributos?.sociais?.presenca || 0
                }
            };
            linkedPilotExapoints = {
                atual: linkedPilot.system?.exapoints?.atual || 0,
                maximo: linkedPilot.system?.exapoints?.maximo || 0
            };
        }

        const htmlData = {
            baseDice: baseDice,
            bonusDice: 0,
            exapointsGastar: 0,
            exapointsDisponiveis: exapointsAtual,
            exapointsMaximo: exapointsMaximo,
            label: label || rollName,
            allowAttributeSelection: allowAttributeSelection,
            atributos: atributos,
            linkedPilot: linkedPilot ? {
                name: linkedPilot.name,
                attributes: linkedPilotAttributes,
                exapoints: linkedPilotExapoints
            } : null
        };

        const htmlContent = await FoundryCompatibility.renderTemplate("systems/rising-steel/template/app/roll-dialog.html", htmlData);
        
        return new Promise((resolve) => {
            let d = new Dialog({
                title: `Rolagem: ${label || rollName}`,
                content: htmlContent,
                render: (html) => {
                    // Atualizar total de dados em tempo real
                    const baseDiceInput = html.find("#base-dice")[0];
                    const bonusDiceInput = html.find("#bonus-dice")[0];
                    const totalDiceSpan = html.find("#total-dice");
                    const exapointsGastarInput = html.find("#exapoints-gastar")[0];
                    const exapointsDisponiveisSpan = html.find("#exapoints-disponiveis");
                    
                    // Função para atualizar total de dados
                    const updateTotalDice = () => {
                        const base = parseInt(baseDiceInput.value || 0);
                        const bonus = parseInt(bonusDiceInput.value || 0);
                        const exa = parseInt(exapointsGastarInput.value || 0);
                        
                        // Obter bônus do atributo se permitido
                        let atributoBonus = 0;
                        if (allowAttributeSelection) {
                            const atributoSelect = html.find("#atributo-select")[0];
                            if (atributoSelect && atributoSelect.value) {
                                const atributoPath = atributoSelect.value;
                                atributoBonus = foundry.utils.getProperty(actor.system, atributoPath) || 0;
                            }
                        }
                        
                        // Obter bônus do atributo do piloto vinculado (se houver)
                        let linkedPilotAtributoBonus = 0;
                        if (linkedPilot) {
                            const linkedPilotAtributoSelect = html.find("#linked-pilot-atributo-select")[0];
                            if (linkedPilotAtributoSelect && linkedPilotAtributoSelect.value) {
                                const atributoPath = linkedPilotAtributoSelect.value;
                                linkedPilotAtributoBonus = foundry.utils.getProperty(linkedPilot.system, atributoPath) || 0;
                            }
                        }
                        
                        // Obter EXApoints do piloto vinculado (se houver)
                        let linkedPilotExa = 0;
                        if (linkedPilot) {
                            const linkedPilotExaInput = html.find("#linked-pilot-exapoints-gastar")[0];
                            if (linkedPilotExaInput) {
                                linkedPilotExa = parseInt(linkedPilotExaInput.value || 0);
                            }
                        }
                        
                        const total = base + bonus + atributoBonus + linkedPilotAtributoBonus + exa + linkedPilotExa;
                        totalDiceSpan.text(total);
                    };
                    
                    // Atualizar total quando bônus mudar
                    if (bonusDiceInput && totalDiceSpan.length) {
                        $(bonusDiceInput).on("input", updateTotalDice);
                    }
                    
                    // Atualizar total quando atributo mudar
                    if (allowAttributeSelection) {
                        const atributoSelect = html.find("#atributo-select");
                        if (atributoSelect.length) {
                            atributoSelect.on("change", updateTotalDice);
                        }
                    }
                    
                    // Atualizar total quando atributo do piloto vinculado mudar
                    if (linkedPilot) {
                        const linkedPilotAtributoSelect = html.find("#linked-pilot-atributo-select");
                        if (linkedPilotAtributoSelect.length) {
                            linkedPilotAtributoSelect.on("change", updateTotalDice);
                        }
                        
                        const linkedPilotExaInput = html.find("#linked-pilot-exapoints-gastar")[0];
                        if (linkedPilotExaInput) {
                            $(linkedPilotExaInput).on("input", function() {
                                let valor = parseInt(this.value || 0);
                                const maximo = parseInt(html.find("#linked-pilot-exapoints-disponiveis").text() || 0);
                                
                                // Garantir que não ultrapasse o máximo
                                if (valor > maximo) {
                                    valor = maximo;
                                    this.value = valor;
                                }
                                
                                // Garantir que não seja negativo
                                if (valor < 0) {
                                    valor = 0;
                                    this.value = valor;
                                }
                                
                                // Atualizar total de dados
                                updateTotalDice();
                            });
                        }
                    }
                    
                    // Validar EXApoints quando mudar e atualizar total
                    if (exapointsGastarInput && exapointsDisponiveisSpan.length) {
                        $(exapointsGastarInput).on("input", function() {
                            let valor = parseInt(this.value || 0);
                            const maximo = parseInt(exapointsDisponiveisSpan.text() || 0);
                            
                            // Garantir que não ultrapasse o máximo
                            if (valor > maximo) {
                                valor = maximo;
                                this.value = valor;
                            }
                            
                            // Garantir que não seja negativo
                            if (valor < 0) {
                                valor = 0;
                                this.value = valor;
                            }
                            
                            // Atualizar total de dados
                            updateTotalDice();
                        });
                    }
                },
                buttons: {
                    roll: {
                        icon: '<i class="fas fa-dice-d20"></i>',
                        label: "Rolar",
                        callback: async (html) => {
                            const bonusDice = parseInt(html.find("#bonus-dice")[0].value) || 0;
                            let exapointsUsar = parseInt(html.find("#exapoints-gastar")[0].value) || 0;
                            
                            // Obter atributo selecionado se permitido
                            let atributoBonus = 0;
                            if (allowAttributeSelection) {
                                const atributoSelect = html.find("#atributo-select")[0];
                                if (atributoSelect && atributoSelect.value) {
                                    const atributoPath = atributoSelect.value;
                                    atributoBonus = foundry.utils.getProperty(actor.system, atributoPath) || 0;
                                }
                            }
                            
                            // Obter atributo do piloto vinculado (se houver)
                            let linkedPilotAtributoBonus = 0;
                            let linkedPilotExapointsUsar = 0;
                            if (linkedPilot) {
                                const linkedPilotAtributoSelect = html.find("#linked-pilot-atributo-select")[0];
                                if (linkedPilotAtributoSelect && linkedPilotAtributoSelect.value) {
                                    const atributoPath = linkedPilotAtributoSelect.value;
                                    linkedPilotAtributoBonus = foundry.utils.getProperty(linkedPilot.system, atributoPath) || 0;
                                }
                                
                                linkedPilotExapointsUsar = parseInt(html.find("#linked-pilot-exapoints-gastar")[0]?.value || 0) || 0;
                                
                                // Validar EXApoints do piloto vinculado
                                if (linkedPilotExapointsUsar > linkedPilotExapoints.atual) {
                                    ui.notifications.warn(`O piloto ${linkedPilot.name} só tem ${linkedPilotExapoints.atual} EXApoints disponíveis!`);
                                    linkedPilotExapointsUsar = Math.min(linkedPilotExapointsUsar, linkedPilotExapoints.atual);
                                }
                                
                                if (linkedPilotExapointsUsar < 0) {
                                    linkedPilotExapointsUsar = 0;
                                }
                            }
                            
                            // Validar EXApoints
                            if (exapointsUsar > exapointsAtual) {
                                ui.notifications.warn(`Você só tem ${exapointsAtual} EXApoints disponíveis!`);
                                exapointsUsar = Math.min(exapointsUsar, exapointsAtual);
                            }
                            
                            if (exapointsUsar < 0) {
                                exapointsUsar = 0;
                            }
                            
                            // Calcular total de dados (base + bônus + atributo + atributo piloto + EXApoints + EXApoints piloto)
                            const dadosNormais = baseDice + bonusDice + atributoBonus + linkedPilotAtributoBonus;
                            const totalDice = dadosNormais + exapointsUsar + linkedPilotExapointsUsar;
                            
                            if (dadosNormais <= 0) {
                                ui.notifications.warn("Você precisa de pelo menos 1 dado base para rolar!");
                                return;
                            }

                            // Fazer a rolagem de todos os dados
                            const roll = new Roll(`${totalDice}d6`);
                            await roll.roll();
                            
                            // Separar resultados: dados normais vs dados de EXApoints (companion + piloto)
                            const results = roll.terms[0].results;
                            const resultadosNormais = results.slice(0, dadosNormais);
                            const resultadosExapointsCompanion = results.slice(dadosNormais, dadosNormais + exapointsUsar);
                            const resultadosExapointsPiloto = results.slice(dadosNormais + exapointsUsar);
                            
                            // Contar sucessos (6) em todos os dados
                            const sucessos = results.filter(d => d.result === 6).length;
                            
                            // Contar falhas (1) apenas nos dados normais
                            const unsNormais = resultadosNormais.filter(d => d.result === 1).length;
                            
                            // Contar quantos 1s caíram nos dados de EXApoints do companion (isso gasta EXApoints)
                            const unsExapointsCompanion = resultadosExapointsCompanion.filter(d => d.result === 1).length;
                            
                            // Contar quantos 1s caíram nos dados de EXApoints do piloto (isso gasta EXApoints do piloto)
                            const unsExapointsPiloto = resultadosExapointsPiloto.filter(d => d.result === 1).length;
                            
                            // Gastar EXApoints do companion: cada 1 nos dados de EXApoints consome 1 EXApoint
                            let exapointsGastos = 0;
                            
                            if (exapointsUsar > 0) {
                                // Gastar EXApoints baseado nos 1s que caíram nos dados de EXApoints
                                exapointsGastos = unsExapointsCompanion;
                                
                                // Atualizar EXApoints gastos no actor
                                const novosGastos = (actor.system.exapoints.gastos || 0) + exapointsGastos;
                                const novoAtual = Math.max(0, exapointsAtual - exapointsGastos);
                                
                                await actor.update({
                                    "system.exapoints.gastos": novosGastos,
                                    "system.exapoints.atual": novoAtual
                                });
                            }
                            
                            // Gastar EXApoints do piloto vinculado (se houver)
                            if (linkedPilot && linkedPilotExapointsUsar > 0) {
                                const exapointsGastosPiloto = unsExapointsPiloto;
                                const exapointsAtualPiloto = linkedPilot.system.exapoints?.atual || 0;
                                const novosGastosPiloto = (linkedPilot.system.exapoints.gastos || 0) + exapointsGastosPiloto;
                                const novoAtualPiloto = Math.max(0, exapointsAtualPiloto - exapointsGastosPiloto);
                                
                                await linkedPilot.update({
                                    "system.exapoints.gastos": novosGastosPiloto,
                                    "system.exapoints.atual": novoAtualPiloto
                                });
                            }
                            
                            // Preparar mensagem detalhada
                            let flavor = `<strong>${label || rollName}</strong><br/>`;
                            flavor += `<div style="margin-top: 5px;">`;
                            flavor += `<strong>Dados Base:</strong> ${baseDice}`;
                            if (bonusDice > 0) {
                                flavor += ` | <strong>Dados Bônus:</strong> ${bonusDice}`;
                            }
                            if (atributoBonus > 0) {
                                flavor += ` | <strong>Dados do Atributo:</strong> ${atributoBonus}`;
                            }
                            if (linkedPilotAtributoBonus > 0) {
                                flavor += ` | <strong>Dados do Atributo do Piloto (${linkedPilot.name}):</strong> ${linkedPilotAtributoBonus}`;
                            }
                            if (exapointsUsar > 0) {
                                flavor += ` | <strong>Dados EXApoints:</strong> ${exapointsUsar}`;
                            }
                            if (linkedPilotExapointsUsar > 0) {
                                flavor += ` | <strong>Dados EXApoints do Piloto (${linkedPilot.name}):</strong> ${linkedPilotExapointsUsar}`;
                            }
                            flavor += ` | <strong>Total:</strong> ${totalDice} dados`;
                            flavor += `</div>`;
                            
                            flavor += `<div style="margin-top: 5px;">`;
                            flavor += `<strong>Resultados:</strong> `;
                            const resultadosStr = results.map(r => r.result).join(", ");
                            flavor += resultadosStr;
                            flavor += `</div>`;
                            
                            // Mostrar separação se houver EXApoints
                            if (exapointsUsar > 0 || linkedPilotExapointsUsar > 0) {
                                flavor += `<div style="margin-top: 5px; font-size: 0.9em; color: #666;">`;
                                flavor += `<strong>Dados normais:</strong> ${resultadosNormais.map(r => r.result).join(", ")}`;
                                if (exapointsUsar > 0) {
                                    flavor += ` | <strong>Dados EXApoints:</strong> ${resultadosExapointsCompanion.map(r => r.result).join(", ")}`;
                                }
                                if (linkedPilotExapointsUsar > 0) {
                                    flavor += ` | <strong>Dados EXApoints do Piloto (${linkedPilot.name}):</strong> ${resultadosExapointsPiloto.map(r => r.result).join(", ")}`;
                                }
                                flavor += `</div>`;
                            }
                            
                            flavor += `<div style="margin-top: 5px;">`;
                            flavor += `<strong>Sucessos (6):</strong> ${sucessos}`;
                            flavor += `</div>`;
                            
                            // Informações sobre EXApoints
                            if (exapointsUsar > 0) {
                                flavor += `<div style="margin-top: 5px; color: #4a9eff;">`;
                                flavor += `<strong>EXApoints usados:</strong> ${exapointsUsar} dados`;
                                if (unsExapointsCompanion > 0) {
                                    flavor += ` | <strong>Falhas (1):</strong> ${unsExapointsCompanion} | <strong>EXApoints gastos:</strong> ${exapointsGastos}`;
                                } else {
                                    flavor += ` | <strong>Falhas (1):</strong> 0 | <strong>EXApoints gastos:</strong> 0`;
                                }
                                flavor += `</div>`;
                            }
                            
                            // Informações sobre EXApoints do piloto vinculado
                            if (linkedPilot && linkedPilotExapointsUsar > 0) {
                                flavor += `<div style="margin-top: 5px; color: #5a2b91;">`;
                                flavor += `<strong>EXApoints do Piloto (${linkedPilot.name}) usados:</strong> ${linkedPilotExapointsUsar} dados`;
                                if (unsExapointsPiloto > 0) {
                                    flavor += ` | <strong>Falhas (1):</strong> ${unsExapointsPiloto} | <strong>EXApoints gastos:</strong> ${unsExapointsPiloto}`;
                                } else {
                                    flavor += ` | <strong>Falhas (1):</strong> 0 | <strong>EXApoints gastos:</strong> 0`;
                                }
                                flavor += `</div>`;
                            }
                            
                            await roll.toMessage({
                                speaker: ChatMessage.getSpeaker({ actor: actor }),
                                flavor: flavor,
                                flags: {
                                    "rising-steel": {
                                        rollType: "success-pool",
                                        totalDice: totalDice,
                                        successes: sucessos
                                    }
                                }
                            });
                            
                            resolve({ roll, sucessos, unsNormais, unsExapoints, exapointsGastos });
                        },
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancelar",
                        callback: () => resolve(null)
                    }
                },
                default: "roll",
                close: () => resolve(null),
            });
            d.render(true);
        });
    }
}


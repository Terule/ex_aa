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
        allowAttributeSelection = false
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

        const htmlData = {
            baseDice: baseDice,
            bonusDice: 0,
            exapointsGastar: 0,
            exapointsDisponiveis: exapointsAtual,
            exapointsMaximo: exapointsMaximo,
            label: label || rollName,
            allowAttributeSelection: allowAttributeSelection,
            atributos: atributos
        };

        const htmlContent = await FoundryCompatibility.renderTemplate("systems/rising-steel/templates/app/roll-dialog.html", htmlData);
        
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
                        
                        const total = base + bonus + atributoBonus + exa;
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
                            
                            // Validar EXApoints
                            if (exapointsUsar > exapointsAtual) {
                                ui.notifications.warn(`Você só tem ${exapointsAtual} EXApoints disponíveis!`);
                                exapointsUsar = Math.min(exapointsUsar, exapointsAtual);
                            }
                            
                            if (exapointsUsar < 0) {
                                exapointsUsar = 0;
                            }
                            
                            // Calcular total de dados (base + bônus + atributo + EXApoints)
                            const dadosNormais = baseDice + bonusDice + atributoBonus;
                            const totalDice = dadosNormais + exapointsUsar;
                            
                            if (dadosNormais <= 0) {
                                ui.notifications.warn("Você precisa de pelo menos 1 dado base para rolar!");
                                return;
                            }

                            // Fazer a rolagem de todos os dados
                            const roll = new Roll(`${totalDice}d6`);
                            await roll.roll();
                            
                            // Separar resultados: dados normais vs dados de EXApoints
                            const results = roll.terms[0].results;
                            const resultadosNormais = results.slice(0, dadosNormais);
                            const resultadosExapoints = results.slice(dadosNormais);
                            
                            // Contar sucessos (6) em todos os dados
                            const sucessos = results.filter(d => d.result === 6).length;
                            
                            // Contar falhas (1) apenas nos dados normais
                            const unsNormais = resultadosNormais.filter(d => d.result === 1).length;
                            
                            // Contar quantos 1s caíram nos dados de EXApoints (isso gasta EXApoints)
                            const unsExapoints = resultadosExapoints.filter(d => d.result === 1).length;
                            
                            // Gastar EXApoints: cada 1 nos dados de EXApoints consome 1 EXApoint
                            let exapointsGastos = 0;
                            
                            if (exapointsUsar > 0) {
                                // Gastar EXApoints baseado nos 1s que caíram nos dados de EXApoints
                                exapointsGastos = unsExapoints;
                                
                                // Atualizar EXApoints gastos no actor
                                const novosGastos = (actor.system.exapoints.gastos || 0) + exapointsGastos;
                                const novoAtual = Math.max(0, exapointsAtual - exapointsGastos);
                                
                                await actor.update({
                                    "system.exapoints.gastos": novosGastos,
                                    "system.exapoints.atual": novoAtual
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
                            if (exapointsUsar > 0) {
                                flavor += ` | <strong>Dados EXApoints:</strong> ${exapointsUsar}`;
                            }
                            flavor += ` | <strong>Total:</strong> ${totalDice} dados`;
                            flavor += `</div>`;
                            
                            flavor += `<div style="margin-top: 5px;">`;
                            flavor += `<strong>Resultados:</strong> `;
                            const resultadosStr = results.map(r => r.result).join(", ");
                            flavor += resultadosStr;
                            flavor += `</div>`;
                            
                            // Mostrar separação se houver EXApoints
                            if (exapointsUsar > 0) {
                                flavor += `<div style="margin-top: 5px; font-size: 0.9em; color: #666;">`;
                                flavor += `<strong>Dados normais:</strong> ${resultadosNormais.map(r => r.result).join(", ")}`;
                                flavor += ` | <strong>Dados EXApoints:</strong> ${resultadosExapoints.map(r => r.result).join(", ")}`;
                                flavor += `</div>`;
                            }
                            
                            flavor += `<div style="margin-top: 5px;">`;
                            flavor += `<strong>Sucessos (6):</strong> ${sucessos}`;
                            flavor += `</div>`;
                            
                            // Informações sobre EXApoints
                            if (exapointsUsar > 0) {
                                flavor += `<div style="margin-top: 5px; color: #4a9eff;">`;
                                flavor += `<strong>EXApoints usados:</strong> ${exapointsUsar} dados`;
                                if (unsExapoints > 0) {
                                    flavor += ` | <strong>Falhas (1):</strong> ${unsExapoints} | <strong>EXApoints gastos:</strong> ${exapointsGastos}`;
                                } else {
                                    flavor += ` | <strong>Falhas (1):</strong> 0 | <strong>EXApoints gastos:</strong> 0`;
                                }
                                flavor += `</div>`;
                            }
                            
                            await roll.toMessage({
                                speaker: ChatMessage.getSpeaker({ actor: actor }),
                                flavor: flavor
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


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

        // Preparar EXApoints do próprio piloto (se o actor for um piloto)
        let actorExapoints = null;
        if (actor && actor.type === "piloto") {
            actorExapoints = {
                atual: actor.system?.exapoints?.atual || 0,
                maximo: actor.system?.exapoints?.maximo || 0
            };
        }

        // Preparar atributos e EXApoints do piloto vinculado (se houver)
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
            label: label || rollName,
            allowAttributeSelection: allowAttributeSelection,
            atributos: atributos,
            actorExapoints: actorExapoints,
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
                    
                    // Função para atualizar total de dados
                    const updateTotalDice = () => {
                        const base = parseInt(baseDiceInput.value || 0);
                        const bonus = parseInt(bonusDiceInput.value || 0);
                        
                        // Obter bônus do atributo se permitido
                        let atributoBonus = 0;
                        if (allowAttributeSelection) {
                            const atributoSelect = html.find("#atributo-select")[0];
                            if (atributoSelect && atributoSelect.value) {
                                const atributoPath = atributoSelect.value;
                                atributoBonus = foundry.utils.getProperty(actor.system, atributoPath) || 0;
                            }
                        }
                        
                        // Obter EXApoints do próprio piloto (se for um piloto)
                        let actorExa = 0;
                        if (actor && actor.type === "piloto") {
                            const actorExaInput = html.find("#actor-exapoints-gastar")[0];
                            if (actorExaInput) {
                                actorExa = parseInt(actorExaInput.value || 0);
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
                        
                        const total = base + bonus + atributoBonus + actorExa + linkedPilotExa;
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
                    
                    // Atualizar total quando EXApoints do próprio piloto mudar
                    if (actor && actor.type === "piloto") {
                        const actorExaInput = html.find("#actor-exapoints-gastar")[0];
                        if (actorExaInput) {
                            $(actorExaInput).on("input", function() {
                                let valor = parseInt(this.value || 0);
                                const maximo = parseInt(html.find("#actor-exapoints-disponiveis").text() || 0);
                                
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
                    
                    // Atualizar total quando atributo ou EXApoints do piloto vinculado mudar
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
                    
                },
                buttons: {
                    roll: {
                        icon: '<i class="fas fa-dice-d20"></i>',
                        label: "Rolar",
                        callback: async (html) => {
                            const bonusDice = parseInt(html.find("#bonus-dice")[0].value) || 0;
                            
                            // Obter atributo selecionado se permitido
                            let atributoBonus = 0;
                            if (allowAttributeSelection) {
                                const atributoSelect = html.find("#atributo-select")[0];
                                if (atributoSelect && atributoSelect.value) {
                                    const atributoPath = atributoSelect.value;
                                    atributoBonus = foundry.utils.getProperty(actor.system, atributoPath) || 0;
                                }
                            }
                            
                            // Obter EXApoints do próprio piloto (se for um piloto)
                            let actorExapointsUsar = 0;
                            if (actor && actor.type === "piloto") {
                                actorExapointsUsar = parseInt(html.find("#actor-exapoints-gastar")[0]?.value || 0) || 0;
                                
                                // Validar EXApoints do próprio piloto
                                const actorExapointsAtual = actor.system?.exapoints?.atual || 0;
                                if (actorExapointsUsar > actorExapointsAtual) {
                                    ui.notifications.warn(`Você só tem ${actorExapointsAtual} EXApoints disponíveis!`);
                                    actorExapointsUsar = Math.min(actorExapointsUsar, actorExapointsAtual);
                                }
                                
                                if (actorExapointsUsar < 0) {
                                    actorExapointsUsar = 0;
                                }
                            }
                            
                            // Obter atributo e EXApoints do piloto vinculado (se houver)
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
                            
                            // Separar dados por tipo: normais (base + atributo + atributo piloto), bonus, exapoints próprio piloto, exapoints piloto vinculado
                            const dadosNormais = baseDice + atributoBonus + linkedPilotAtributoBonus;
                            const dadosBonus = bonusDice; // Pode ser negativo
                            const dadosExapointsActor = actorExapointsUsar;
                            const dadosExapointsPiloto = linkedPilotExapointsUsar;
                            const totalDice = dadosNormais + dadosBonus + dadosExapointsActor + dadosExapointsPiloto;
                            
                            if (totalDice <= 0) {
                                ui.notifications.warn("O total de dados precisa ser pelo menos 1 para rolar!");
                                return;
                            }
                            
                            if (dadosNormais <= 0) {
                                ui.notifications.warn("Você precisa de pelo menos 1 dado base para rolar!");
                                return;
                            }

                            // Criar rolagens separadas para cada tipo de dado
                            const rolls = [];
                            const rollResults = [];
                            
                            // Calcular quantos dados normais realmente vamos rolar (considerando redução do bonus negativo)
                            const dadosNormaisARolar = Math.max(1, dadosNormais + Math.min(0, dadosBonus));
                            
                            // Rolagem de dados normais (já considerando redução se bonus for negativo)
                            if (dadosNormaisARolar > 0) {
                                const rollNormais = new Roll(`${dadosNormaisARolar}d6`);
                                await rollNormais.roll();
                                rolls.push({ roll: rollNormais, type: "normal", count: dadosNormaisARolar });
                                rollResults.push(...rollNormais.terms[0].results);
                            }
                            
                            // Rolagem de dados bonus (só se for positivo)
                            if (dadosBonus > 0) {
                                const rollBonus = new Roll(`${dadosBonus}d6`);
                                await rollBonus.roll();
                                rolls.push({ roll: rollBonus, type: "bonus", count: dadosBonus });
                                rollResults.push(...rollBonus.terms[0].results);
                            }
                            // Se dadosBonus for negativo, já foi considerado na redução dos dados normais
                            
                            // Rolagem de dados EXApoints do próprio piloto
                            let resultadosExapointsActor = [];
                            if (actorExapointsUsar > 0) {
                                const rollExaActor = new Roll(`${actorExapointsUsar}d6`);
                                await rollExaActor.roll();
                                rolls.push({ roll: rollExaActor, type: "exapoint", count: actorExapointsUsar, source: "actor" });
                                resultadosExapointsActor = rollExaActor.terms[0].results || [];
                                // Garantir que os resultados sejam adicionados corretamente
                                if (Array.isArray(resultadosExapointsActor)) {
                                    rollResults.push(...resultadosExapointsActor);
                                } else {
                                    rollResults.push(resultadosExapointsActor);
                                }
                            }
                            
                            // Rolagem de dados EXApoints (piloto vinculado)
                            let resultadosExapointsPiloto = [];
                            if (linkedPilotExapointsUsar > 0) {
                                const rollExaPiloto = new Roll(`${linkedPilotExapointsUsar}d6`);
                                await rollExaPiloto.roll();
                                rolls.push({ roll: rollExaPiloto, type: "exapoint", count: linkedPilotExapointsUsar, source: "pilot" });
                                resultadosExapointsPiloto = rollExaPiloto.terms[0].results || [];
                                // Garantir que os resultados sejam adicionados corretamente
                                if (Array.isArray(resultadosExapointsPiloto)) {
                                    rollResults.push(...resultadosExapointsPiloto);
                                } else {
                                    rollResults.push(resultadosExapointsPiloto);
                                }
                            }
                            
                            // Combinar todas as rolagens em uma fórmula composta para exibição
                            // Criar fórmula separada: 3d6+1d6+2d6 em vez de 6d6
                            const formulaParts = rolls.map(r => `${r.count}d6`).join("+");
                            
                            // Clonar termos existentes para manter os resultados separados
                            const operatorTermClass = CONFIG.Dice?.termTypes?.OperatorTerm ?? foundry?.dice?.terms?.OperatorTerm;
                            const clonedTerms = [];
                            
                            rolls.forEach((rollData, rollIndex) => {
                                const sourceTerm = rollData.roll?.terms?.[0];
                                if (sourceTerm) {
                                    const clone = sourceTerm.clone ? sourceTerm.clone() : sourceTerm;
                                    clonedTerms.push(clone);
                                }
                                
                                if (rollIndex < rolls.length - 1 && operatorTermClass) {
                                    const operatorTerm = new operatorTermClass({ operator: "+" });
                                    operatorTerm._evaluated = true;
                                    operatorTerm._total = 0;
                                    clonedTerms.push(operatorTerm);
                                }
                            });
                            
                            const combinedRoll = Roll.fromTerms(clonedTerms);
                            combinedRoll._evaluated = true;
                            combinedRoll._total = rollResults.reduce((sum, r) => sum + (r.result || r.total || 0), 0);
                            
                            // Separar resultados por tipo para processamento
                            let resultIndex = 0;
                            const resultadosNormais = rollResults.slice(resultIndex, resultIndex + dadosNormaisARolar);
                            resultIndex += dadosNormaisARolar;
                            // Se dadosBonus for negativo, não há dados bonus rolados
                            const resultadosBonus = dadosBonus > 0 ? rollResults.slice(resultIndex, resultIndex + dadosBonus) : [];
                            if (dadosBonus > 0) {
                                resultIndex += dadosBonus;
                            }
                            // resultadosExapointsActor e resultadosExapointsPiloto já foram definidos acima durante a rolagem
                            
                            // Contar sucessos (6) em todos os dados
                            // Verificar tanto 'result' quanto 'total' e também verificar se é um número
                            // Incluir todos os resultados: normais, bonus e EXApoints
                            const todosResultados = [
                                ...resultadosNormais,
                                ...(dadosBonus > 0 ? resultadosBonus : []),
                                ...resultadosExapointsActor,
                                ...resultadosExapointsPiloto
                            ];
                            
                            const sucessos = todosResultados.filter(d => {
                                const value = d.result ?? d.total ?? d;
                                const numValue = Number(value);
                                return !isNaN(numValue) && numValue === 6;
                            }).length;
                            
                            // Contar falhas (1) apenas nos dados normais
                            const unsNormais = resultadosNormais.filter(d => (d.result ?? d.total) === 1).length;
                            
                            // Contar quantos 1s caíram nos dados de EXApoints do próprio piloto (isso gasta EXApoints)
                            const unsExapointsActor = resultadosExapointsActor.filter(d => (d.result ?? d.total) === 1).length;
                            
                            // Contar quantos 1s caíram nos dados de EXApoints do piloto vinculado (isso gasta EXApoints do piloto)
                            const unsExapointsPiloto = resultadosExapointsPiloto.filter(d => (d.result ?? d.total) === 1).length;
                            
                            // Gastar EXApoints do próprio piloto (se houver)
                            if (actor && actor.type === "piloto" && actorExapointsUsar > 0) {
                                const exapointsGastosActor = unsExapointsActor;
                                const exapointsAtualActor = actor.system.exapoints?.atual || 0;
                                const novosGastosActor = (actor.system.exapoints.gastos || 0) + exapointsGastosActor;
                                const novoAtualActor = Math.max(0, exapointsAtualActor - exapointsGastosActor);
                                
                                await actor.update({
                                    "system.exapoints.gastos": novosGastosActor,
                                    "system.exapoints.atual": novoAtualActor
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
                            if (bonusDice !== 0) {
                                if (bonusDice > 0) {
                                    flavor += ` | <strong>Dados Bônus:</strong> +${bonusDice}`;
                                } else {
                                    flavor += ` | <strong>Dados Bônus:</strong> ${bonusDice}`;
                                }
                            }
                            if (atributoBonus > 0) {
                                flavor += ` | <strong>Dados do Atributo:</strong> ${atributoBonus}`;
                            }
                            if (actorExapointsUsar > 0) {
                                flavor += ` | <strong>Dados EXApoints:</strong> ${actorExapointsUsar}`;
                            }
                            if (linkedPilotAtributoBonus > 0) {
                                flavor += ` | <strong>Dados do Atributo do Piloto (${linkedPilot.name}):</strong> ${linkedPilotAtributoBonus}`;
                            }
                            if (linkedPilotExapointsUsar > 0) {
                                flavor += ` | <strong>Dados EXApoints do Piloto (${linkedPilot.name}):</strong> ${linkedPilotExapointsUsar}`;
                            }
                            flavor += ` | <strong>Total:</strong> ${totalDice} dados`;
                            flavor += `</div>`;
                            
                            // Preparar dados para exibição com cores no chat
                            // Os dados serão coloridos pelo hook renderChatMessage
                            
                            flavor += `<div style="margin-top: 5px;">`;
                            flavor += `<strong>Sucessos (6):</strong> ${sucessos}`;
                            flavor += `</div>`;
                            
                            // Informações sobre EXApoints do próprio piloto
                            if (actor && actor.type === "piloto" && actorExapointsUsar > 0) {
                                flavor += `<div style="margin-top: 5px; color: #5a2b91;">`;
                                flavor += `<strong>EXApoints usados:</strong> ${actorExapointsUsar} dados`;
                                if (unsExapointsActor > 0) {
                                    flavor += ` | <strong>Falhas (1):</strong> ${unsExapointsActor} | <strong>EXApoints gastos:</strong> ${unsExapointsActor}`;
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
                            
                            // Preparar flags com informações sobre os tipos de dados
                            const diceInfo = [];
                            if (dadosNormaisARolar > 0) {
                                diceInfo.push({ type: "normal", count: dadosNormaisARolar, results: resultadosNormais });
                            }
                            if (dadosBonus > 0) {
                                diceInfo.push({ type: "bonus", count: dadosBonus, results: resultadosBonus });
                            }
                            if (actorExapointsUsar > 0) {
                                diceInfo.push({ type: "exapoint", count: actorExapointsUsar, results: resultadosExapointsActor, source: "actor" });
                            }
                            if (linkedPilotExapointsUsar > 0) {
                                diceInfo.push({ type: "exapoint", count: linkedPilotExapointsUsar, results: resultadosExapointsPiloto, source: "pilot" });
                            }
                            
                            await combinedRoll.toMessage({
                                speaker: ChatMessage.getSpeaker({ actor: actor }),
                                flavor: flavor,
                                flags: {
                                    "rising-steel": {
                                        rollType: "success-pool",
                                        totalDice: totalDice,
                                        successes: sucessos,
                                        diceInfo: diceInfo,
                                        formula: formulaParts
                                    }
                                }
                            });
                            
                            resolve({ roll: combinedRoll, sucessos, unsNormais, unsExapoints: unsExapointsActor + unsExapointsPiloto, exapointsGastos: unsExapointsActor + unsExapointsPiloto });
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


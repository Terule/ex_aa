// Import compatibility utilities
import { FoundryCompatibility } from "../utils/compatibility.js";

/**
 * Armadura Select Dialog for Rising Steel system
 * Shows a dialog with available armors to choose from
 */
export class RisingSteelArmaduraSelectDialog {
    /**
     * Display armadura selection dialog.
     * 
     * @param {Object} options
     * @param {Actor} options.actor - The actor selecting the armor
     * @param {Array} options.armaduras - Array of available armors
     */
    static async showDialog({
        actor = null,
        armaduras = []
    } = {}) {
        if (!actor) {
            ui.notifications.error("Actor não encontrado");
            return;
        }

        const armaduraEquipada = actor.system.armadura?.equipada || "";

        console.log(`[Rising Steel] Abrindo modal de armaduras. Total: ${armaduras.length}, Equipada: ${armaduraEquipada}`);

        const htmlData = {
            armaduras: armaduras || [],
            armaduraEquipada: armaduraEquipada
        };

        const htmlContent = await FoundryCompatibility.renderTemplate("systems/rising-steel/templates/app/armadura-select-dialog.html", htmlData);
        
        return new Promise((resolve) => {
            let d = new Dialog({
                title: "Escolher Armadura",
                content: htmlContent,
                render: (html) => {
                    // Listener para botões de seleção
                    html.find(".select-armadura-btn").click(async (event) => {
                        event.preventDefault();
                        const button = event.currentTarget;
                        const armaduraId = button.dataset.armaduraId;
                        const armaduraNome = button.dataset.armaduraNome;
                        const armaduraProtecao = parseInt(button.dataset.armaduraProtecao || 0);
                        
                        // Equipar a armadura
                        await actor.update({
                            "system.armadura.equipada": armaduraId,
                            "system.armadura.total": armaduraProtecao,
                            "system.armadura.dano": 0,
                            "system.armadura.atual": armaduraProtecao
                        });
                        
                        ui.notifications.info(`Armadura "${armaduraNome}" equipada!`);
                        d.close();
                        resolve(armaduraId);
                    });
                },
                buttons: {
                    nenhuma: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Remover Armadura",
                        callback: async () => {
                            await actor.update({
                                "system.armadura.equipada": "",
                                "system.armadura.total": 0,
                                "system.armadura.dano": 0,
                                "system.armadura.atual": 0
                            });
                            ui.notifications.info("Armadura removida!");
                            resolve(null);
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancelar",
                        callback: () => resolve(null)
                    }
                },
                default: "cancel",
                close: () => resolve(null)
            });
            d.render(true);
        });
    }
}


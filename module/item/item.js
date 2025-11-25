/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class RisingSteelItem extends Item {
    /**
     * Augment the basic Item values model with additional dynamic values.
     */
    prepareData() {
        super.prepareData();
    }

    /**
     * Override the static createDialog method to filter item types
     * @override
     */
    static async createDialog(data = {}, options = {}) {
        // Garantir que CONFIG.Item.types está correto antes de criar o diálogo
        const originalTypes = CONFIG.Item.types;
        CONFIG.Item.types = ["armadura", "arma", "equipamento"];
        
        console.log("[Rising Steel] createDialog - CONFIG.Item.types definido:", CONFIG.Item.types);
        
        try {
            // Chamar o método original do Foundry
            const result = await super.createDialog(data, options);
            return result;
        } finally {
            // Restaurar tipos originais se necessário (opcional)
            // CONFIG.Item.types = originalTypes;
        }
    }
}


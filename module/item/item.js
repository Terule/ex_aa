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
        
        console.log("[Rising Steel] createDialog chamado - CONFIG.Item.types definido:", CONFIG.Item.types);
        
        try {
            // Chamar o método original do Foundry
            const result = await super.createDialog(data, options);
            return result;
        } finally {
            // Restaurar tipos originais se necessário (opcional)
            // CONFIG.Item.types = originalTypes;
        }
    }

    /**
     * Override getCreateDialogData to filter types before dialog data is prepared
     * This method is called by Foundry V12 to prepare dialog data
     * @override
     */
    static getCreateDialogData(data = {}, options = {}) {
        // Garantir que CONFIG.Item.types está correto antes de preparar os dados
        const originalTypes = CONFIG.Item.types;
        CONFIG.Item.types = ["armadura", "arma", "equipamento"];
        
        console.log("[Rising Steel] getCreateDialogData chamado - CONFIG.Item.types definido:", CONFIG.Item.types);
        
        try {
            // Chamar o método original do Foundry
            const result = super.getCreateDialogData ? super.getCreateDialogData(data, options) : data;
            
            // Filtrar tipos nos dados se existirem
            if (result && result.types) {
                result.types = result.types.filter(t => ["armadura", "arma", "equipamento"].includes(t));
            }
            
            return result;
        } finally {
            // Não restaurar aqui, deixar para o createDialog
        }
    }
}


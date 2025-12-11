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
        
        // Garantir que atributos essenciais existam mesmo após prepareData
        const itemType = this.type;
        
        // Inicializar atributos baseados no tipo
        if (itemType === "armadura") {
            if (this.system.tipo === undefined) this.system.tipo = "";
            if (this.system.protecao === undefined) this.system.protecao = 0;
            if (this.system.peso === undefined) this.system.peso = 0;
            if (this.system.descricao === undefined) this.system.descricao = "";
            if (this.system.especial === undefined) this.system.especial = "";
        } else if (itemType === "arma") {
            if (this.system.tipo === undefined) this.system.tipo = "";
            if (this.system.dano === undefined) this.system.dano = 0;
            if (this.system.alcance === undefined) this.system.alcance = "";
            if (this.system.bonus === undefined) this.system.bonus = 0;
            if (this.system.descricao === undefined) this.system.descricao = "";
        } else if (itemType === "equipamento") {
            if (this.system.tipo === undefined) this.system.tipo = "";
            if (this.system.efeito === undefined) this.system.efeito = "";
            if (this.system.peso === undefined) this.system.peso = 0;
            if (this.system.descricao === undefined) this.system.descricao = "";
        } else if (itemType === "exacomModel") {
            if (this.system.modelo === undefined) this.system.modelo = "";
            if (this.system.neuromotor === undefined) this.system.neuromotor = 0;
            if (this.system.sensorial === undefined) this.system.sensorial = 0;
            if (this.system.estrutural === undefined) this.system.estrutural = 0;
            if (this.system.reator === undefined) this.system.reator = 0;
        } else if (itemType === "blindagemExacom") {
            if (this.system.tipo === undefined) this.system.tipo = "";
            if (this.system.blindagem === undefined) this.system.blindagem = 0;
            if (this.system.descricao === undefined) this.system.descricao = "";
            if (this.system.especial === undefined) this.system.especial = "";
        } else if (itemType === "exacomModulo") {
            if (this.system.consumo === undefined) this.system.consumo = 0;
            if (this.system.descricao === undefined) this.system.descricao = "";
            if (this.system.custo === undefined) this.system.custo = 0;
            if (this.system.duracao === undefined) this.system.duracao = "";
            if (this.system.tipo === undefined) this.system.tipo = "";
        }
    }

    /**
     * Override the static createDialog method to filter item types
     * @override
     */
    static async createDialog(data = {}, options = {}) {
        // Garantir que CONFIG.Item.types está correto antes de criar o diálogo
        const originalTypes = Array.isArray(CONFIG.Item.types) ? [...CONFIG.Item.types] : null;
        const allowedTypes = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom", "exacomModulo"];
        CONFIG.Item.types = [...allowedTypes];
        
        console.log("[Rising Steel] createDialog chamado - CONFIG.Item.types definido:", CONFIG.Item.types);
        
        try {
            // Chamar o método original do Foundry
            const result = await super.createDialog(data, options);
            return result;
        } finally {
            // Restaurar tipos originais se existirem
            if (originalTypes) {
                CONFIG.Item.types = originalTypes;
            }
        }
    }

    /**
     * Override getCreateDialogData to filter types before dialog data is prepared
     * This method is called by Foundry V12 to prepare dialog data
     * @override
     */
    static getCreateDialogData(data = {}, options = {}) {
        // Garantir que CONFIG.Item.types está correto antes de preparar os dados
        const originalTypes = Array.isArray(CONFIG.Item.types) ? [...CONFIG.Item.types] : null;
        const allowedTypes = ["armadura", "arma", "equipamento", "exacomModel", "blindagemExacom", "exacomModulo"];
        CONFIG.Item.types = [...allowedTypes];
        
        console.log("[Rising Steel] getCreateDialogData chamado - CONFIG.Item.types definido:", CONFIG.Item.types);
        
        try {
            // Chamar o método original do Foundry
            const result = super.getCreateDialogData ? super.getCreateDialogData(data, options) : data;
            
            // Filtrar tipos nos dados se existirem
            if (result && result.types) {
                result.types = result.types.filter(t => allowedTypes.includes(t));
            }
            
            return result;
        } finally {
            // Restaurar types originais aqui também, pois esse método pode ser chamado isoladamente
            if (originalTypes) {
                CONFIG.Item.types = originalTypes;
            }
        }
    }
}


// Actor class para Rising Steel
export class PilotActor extends Actor {
  /** @override */
  static async create(data = {}, options = {}) {
    // Garantir que o tipo está definido antes de criar
    const processedData = foundry.utils.duplicate(data);
    
    // Garantir que _source existe
    if (!processedData._source) {
      processedData._source = {};
    }
    
    // Se o tipo não estiver definido, definir como "piloto"
    if (!processedData._source.type) {
      processedData._source.type = "piloto";
    }
    
    // Também garantir no nível superior
    if (!processedData.type) {
      processedData.type = "piloto";
    }
    
    return super.create(processedData, options);
  }
  
  /** @override */
  _initialize(options = {}) {
    // Garantir que o tipo está definido antes de inicializar
    if (this._source && !this._source.type) {
      this._source.type = "piloto";
    }
    super._initialize(options);
    
    // Garantir novamente após inicialização
    if (!this.type) {
      this.type = "piloto";
    }
  }
  
  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    
    // Garantir que system existe
    if (!this.system) {
      this.system = {};
    }
    
    // Inicializar estrutura básica se não existir
    this._initializeSystem();
  }
  
  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    
    // Calcular valores derivados
    this._calculateDerived();
  }
  
  _initializeSystem() {
    // Garantir que system existe
    if (!this.system) {
      this.system = {};
    }
    
    const system = this.system;
    
    // Identificação
    foundry.utils.setProperty(system, "identificacao", foundry.utils.mergeObject({
        nome: "",
        codinome: "",
        patente: "",
        escala: "Médio",
        exacom: "",
        admissao: ""
    }, system.identificacao || {}));
    
    // Atributos
    foundry.utils.setProperty(system, "atributos", foundry.utils.mergeObject({
        fisicos: {
          forca: 0,
          destreza: 0,
          vigor: 0
        },
        mentais: {
          conhecimento: 0,
          perspicacia: 0,
          resiliencia: 0
        },
        sociais: {
          eloquencia: 0,
          dissimulacao: 0,
          presenca: 0
        }
    }, system.atributos || {}));
    
    // EXApoints
    foundry.utils.setProperty(system, "exapoints", foundry.utils.mergeObject({
        maximo: 4,
        gastos: 0,
        atual: 4,
        overdrive: 1
    }, system.exapoints || {}));
    
    // Pontos de Atributo
    foundry.utils.setProperty(system, "pontosAtributo", foundry.utils.mergeObject({
        total: 9,
        distribuidos: 0,
        restantes: 9
    }, system.pontosAtributo || {}));
  }
  
  _calculateDerived() {
    const system = this.system;
    const attr = system.atributos || {};
    const fis = attr.fisicos || {};
    const men = attr.mentais || {};
    
    // EXApoints atual
    if (system.exapoints) {
      system.exapoints.atual = (system.exapoints.maximo || 0) - (system.exapoints.gastos || 0);
    }
    
    // Pontos de Atributo
    if (system.pontosAtributo) {
      const total = (fis.forca || 0) + (fis.destreza || 0) + (fis.vigor || 0) +
                   (men.conhecimento || 0) + (men.perspicacia || 0) + (men.resiliencia || 0) +
                   (attr.sociais?.eloquencia || 0) + (attr.sociais?.dissimulacao || 0) + (attr.sociais?.presenca || 0);
      system.pontosAtributo.distribuidos = total;
      system.pontosAtributo.restantes = (system.pontosAtributo.total || 0) - total;
    }
    
    // Combate
    if (!system.combate) {
      system.combate = {};
    }
    system.combate.iniciativa = (fis.destreza || 0) + (men.perspicacia || 0);
    system.combate.mobilidade = (fis.destreza || 0) + (fis.vigor || 0);
    system.combate.esquiva = fis.destreza || 0;
  }
}

// Registrar o tipo de Actor no hook init
Hooks.once("init", () => {
  // Definir a classe de documento customizada para Actors
  CONFIG.Actor.documentClass = PilotActor;
  
  // Registrar os tipos de Actor (já definidos no system.json, mas garantindo aqui também)
  CONFIG.Actor.typeLabels = CONFIG.Actor.typeLabels || {};
  CONFIG.Actor.typeLabels.piloto = "Piloto";
  
  // Definir tipo padrão
  CONFIG.Actor.defaultType = "piloto";
  
  console.log("Rising Steel: Actor class registrada", CONFIG.Actor.documentClass);
  console.log("Rising Steel: Tipos disponíveis", CONFIG.Actor.typeLabels);
  console.log("Rising Steel: Tipo padrão", CONFIG.Actor.defaultType);
});

// Hook para garantir que o tipo seja sempre definido ao criar um Actor
Hooks.on("preCreateActor", (document, data, options, userId) => {
  // O data pode ser um array ou objeto único
  const dataArray = Array.isArray(data) ? data : [data];
  
  dataArray.forEach(d => {
    // Garantir que _source existe
    if (!d._source) {
      d._source = {};
    }
    
    // Se o tipo não estiver definido em _source, definir como "piloto"
    if (!d._source.type) {
      d._source.type = "piloto";
    }
    
    // Também garantir no nível superior
    if (!d.type) {
      d.type = "piloto";
    }
    
    // Garantir que o tipo está definido corretamente
    foundry.utils.setProperty(d, "_source.type", "piloto");
    foundry.utils.setProperty(d, "type", "piloto");
  });
  
  console.log("Rising Steel: preCreateActor - tipo definido como 'piloto'", data);
}, { priority: 100 });

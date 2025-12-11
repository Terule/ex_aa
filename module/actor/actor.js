import { parseTextualModifiers } from "../helpers/modifiers.mjs";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Rising Steel system.
 * @extends {Actor}
 */
export class RisingSteelActor extends Actor {
    /** @override */
    async _preUpdate(changed, options, user) {
        // Normalizar valores numéricos antes de atualizar
        if (changed.system) {
            this._normalizeUpdateData(changed.system);
        }
        return super._preUpdate(changed, options, user);
    }

    /**
     * Normalize numeric values in update data
     * @param {Object} systemData
     * @private
     */
    _normalizeUpdateData(systemData) {
        const normalizeValue = (value, min = 0) => {
            if (value === null || value === undefined || value === '') {
                return min;
            }
            if (typeof value === 'string') {
                value = value.replace(/,/g, '.');
            }
            const num = Number(value);
            return isNaN(num) ? min : Math.max(min, num);
        };

        const isCriatura = ["criatura", "companion"].includes(this.type);
        const clampAttribute = (value) => {
            const normalized = normalizeValue(value, 1);
            if (isCriatura) {
                return Math.max(1, normalized);
            }
            return Math.min(5, Math.max(1, normalized));
        };

        // Normalizar atributos se presentes (mínimo 1, máximo 5)
        if (systemData.atributos) {
            const attr = systemData.atributos;
            if (attr.fisicos) {
                if (attr.fisicos.forca !== undefined) attr.fisicos.forca = clampAttribute(attr.fisicos.forca);
                if (attr.fisicos.destreza !== undefined) attr.fisicos.destreza = clampAttribute(attr.fisicos.destreza);
                if (attr.fisicos.vigor !== undefined) attr.fisicos.vigor = clampAttribute(attr.fisicos.vigor);
            }
            if (attr.mentais) {
                if (attr.mentais.conhecimento !== undefined) attr.mentais.conhecimento = clampAttribute(attr.mentais.conhecimento);
                if (attr.mentais.perspicacia !== undefined) attr.mentais.perspicacia = clampAttribute(attr.mentais.perspicacia);
                if (attr.mentais.resiliencia !== undefined) attr.mentais.resiliencia = clampAttribute(attr.mentais.resiliencia);
            }
            if (attr.sociais) {
                if (attr.sociais.eloquencia !== undefined) attr.sociais.eloquencia = clampAttribute(attr.sociais.eloquencia);
                if (attr.sociais.dissimulacao !== undefined) attr.sociais.dissimulacao = clampAttribute(attr.sociais.dissimulacao);
                if (attr.sociais.presenca !== undefined) attr.sociais.presenca = clampAttribute(attr.sociais.presenca);
            }
        }

        // Normalizar EXApoints se presentes
        if (systemData.exapoints) {
            if (systemData.exapoints.maximo !== undefined) systemData.exapoints.maximo = normalizeValue(systemData.exapoints.maximo);
            if (systemData.exapoints.gastos !== undefined) systemData.exapoints.gastos = normalizeValue(systemData.exapoints.gastos);
            if (systemData.exapoints.atual !== undefined) systemData.exapoints.atual = normalizeValue(systemData.exapoints.atual);
            if (systemData.exapoints.overdrive !== undefined) systemData.exapoints.overdrive = normalizeValue(systemData.exapoints.overdrive);
        }

        if (systemData.sistema) {
            ["neuromotor", "sensorial", "estrutural"].forEach(prop => {
                if (systemData.sistema[prop] !== undefined) {
                    systemData.sistema[prop] = normalizeValue(systemData.sistema[prop]);
                }
            });
        }

        if (systemData.combate) {
            ["esquiva", "mobilidade"].forEach(prop => {
                if (systemData.combate[prop] !== undefined) {
                    systemData.combate[prop] = normalizeValue(systemData.combate[prop]);
                }
            });
        }

        if (systemData.exa) {
            if (systemData.exa.sincronia !== undefined) {
                systemData.exa.sincronia = normalizeValue(systemData.exa.sincronia);
            }
            if (systemData.exa.overdrive !== undefined) {
                systemData.exa.overdrive = normalizeValue(systemData.exa.overdrive);
            }
        }
    }

    /**
     * Augment the basic actor values with additional dynamic values.
     */
    prepareData() {
        super.prepareData();
    }

    // @override
    prepareBaseData(){
        if (this.type === "piloto") {
            if (this.system.exacomId === undefined || this.system.exacomId === null) {
                this.system.exacomId = "";
            }
            this._preparePilotoData();
        } else if (this.type === "criatura" || this.type === "companion") {
            this._prepareCriaturaData();
            if (!this.system.vinculo) {
                this.system.vinculo = { pilotoId: "" };
            } else if (this.system.vinculo.pilotoId === undefined || this.system.vinculo.pilotoId === null) {
                this.system.vinculo.pilotoId = "";
            }
        } else if (this.type === "exacom") {
            this._prepareExacomData();
        }

        this._applyTextualModifiers();
    }

    /**
     * Get roll data for rolls
     * @override
     */
    getRollData() {
        const rollData = super.getRollData();
        
        // Adicionar dados de combate para a fórmula de iniciativa
        if (this.system.combate) {
            rollData.combate = this.system.combate;
        }
        
        return rollData;
    }
    
    /**
     * Prepare Piloto type specific data
     */
    _preparePilotoData() {
        // Função auxiliar para garantir número válido (mínimo 1 para atributos)
        const safeNumber = (value, min = 0) => {
            const num = Number(value);
            if (isNaN(num)) return min;
            return Math.max(min, num);
        };
        
        // Garantir que todos os atributos tenham pelo menos 1
        if (!this.system.atributos) {
            this.system.atributos = {};
        }
        const attr = this.system.atributos;
        
        // Físicos
        if (!attr.fisicos) attr.fisicos = {};
        attr.fisicos.forca = Math.min(5, Math.max(1, safeNumber(attr.fisicos.forca, 1)));
        attr.fisicos.destreza = Math.min(5, Math.max(1, safeNumber(attr.fisicos.destreza, 1)));
        attr.fisicos.vigor = Math.min(5, Math.max(1, safeNumber(attr.fisicos.vigor, 1)));
        
        // Mentais
        if (!attr.mentais) attr.mentais = {};
        attr.mentais.conhecimento = Math.min(5, Math.max(1, safeNumber(attr.mentais.conhecimento, 1)));
        attr.mentais.perspicacia = Math.min(5, Math.max(1, safeNumber(attr.mentais.perspicacia, 1)));
        attr.mentais.resiliencia = Math.min(5, Math.max(1, safeNumber(attr.mentais.resiliencia, 1)));
        
        // Sociais
        if (!attr.sociais) attr.sociais = {};
        attr.sociais.eloquencia = Math.min(5, Math.max(1, safeNumber(attr.sociais.eloquencia, 1)));
        attr.sociais.dissimulacao = Math.min(5, Math.max(1, safeNumber(attr.sociais.dissimulacao, 1)));
        attr.sociais.presenca = Math.min(5, Math.max(1, safeNumber(attr.sociais.presenca, 1)));
        
        // Inicializar especializações (nova estrutura)
        if (!this.system.especializacoes) {
            this.system.especializacoes = {
                fisicos: [],
                mentais: [],
                sociais: []
            };
        }
        if (!Array.isArray(this.system.especializacoes.fisicos)) this.system.especializacoes.fisicos = [];
        if (!Array.isArray(this.system.especializacoes.mentais)) this.system.especializacoes.mentais = [];
        if (!Array.isArray(this.system.especializacoes.sociais)) this.system.especializacoes.sociais = [];
        
        // Calcular EXApoints máximo baseado em Resiliência
        const resiliencia = attr.mentais.resiliencia; // Já normalizado acima
        
        // Garantir que exapoints existe
        if (!this.system.exapoints) {
            this.system.exapoints = {};
        }
        
        // EXApoints máximo = valor de Resiliência
        this.system.exapoints.maximo = resiliencia;
        
        // Calcular EXApoints atual (máximo - gastos)
        const maximo = safeNumber(this.system.exapoints.maximo, 0);
        const gastos = safeNumber(this.system.exapoints.gastos || 0, 0);
        this.system.exapoints.atual = Math.max(0, maximo - gastos);
        
        // Calcular Pontos de Atributo e Overdrive baseado na patente
        const patente = this.system.identificacao?.patente || "Recruta";
        const pontosPorPatente = CONFIG.RisingSteel?.getPatentePontos(patente) || 5;
        const overdrivePorPatente = CONFIG.RisingSteel?.getPatenteOverdrive(patente) || 0;
        
        // Atualizar overdrive baseado na patente
        if (this.system.exapoints) {
            this.system.exapoints.overdrive = overdrivePorPatente;
        }
        
        if (this.system.pontosAtributo) {
            // Atualizar total baseado na patente
            this.system.pontosAtributo.total = pontosPorPatente;
            
            // Calcular pontos distribuídos: apenas os pontos ACIMA de 1 em cada atributo
            // (o valor 1 inicial é gratuito e não conta como distribuído)
            const pontosDistribuidos = 
                Math.max(0, attr.fisicos.forca - 1) +
                Math.max(0, attr.fisicos.destreza - 1) +
                Math.max(0, attr.fisicos.vigor - 1) +
                Math.max(0, attr.mentais.conhecimento - 1) +
                Math.max(0, attr.mentais.perspicacia - 1) +
                Math.max(0, attr.mentais.resiliencia - 1) +
                Math.max(0, attr.sociais.eloquencia - 1) +
                Math.max(0, attr.sociais.dissimulacao - 1) +
                Math.max(0, attr.sociais.presenca - 1);
            
            this.system.pontosAtributo.distribuidos = pontosDistribuidos;
            this.system.pontosAtributo.restantes = Math.max(0, pontosPorPatente - pontosDistribuidos);
        }
        
        // Calcular valores de combate
        if (!this.system.combate) {
            this.system.combate = {};
        }
        
        // Usar os valores já normalizados dos atributos
        this.system.combate.iniciativa = attr.fisicos.destreza + attr.mentais.perspicacia;
        this.system.combate.mobilidade = 2 + attr.fisicos.destreza;
        
        // Calcular Limiar de Dano
        if (!this.system.limiarDano) {
            this.system.limiarDano = {};
        }
        
        // Limiar de Dano Leve = Valor do Vigor (já normalizado acima)
        const vigor = attr.fisicos.vigor; // Já normalizado acima (mínimo 1, máximo 5)
        if (!this.system.limiarDano.leve) {
            this.system.limiarDano.leve = {};
        }
        const limiarLeveBase = vigor;
        
        // Limiar de Dano Moderado = 2x o Leve (2x Vigor)
        if (!this.system.limiarDano.moderado) {
            this.system.limiarDano.moderado = { limiar: 0, marcacoes: 0 };
        }
        this.system.limiarDano.moderado.limiar = limiarLeveBase * 2;
        
        // Limiar de Dano Grave = 4x o Leve (4x Vigor)
        if (!this.system.limiarDano.grave) {
            this.system.limiarDano.grave = { limiar: 0, marcacoes: 0 };
        }
        this.system.limiarDano.grave.limiar = limiarLeveBase * 4;
        
        // Garantir que marcações existam
        const clampMarcacao = (value, max) => {
            const num = safeNumber(value, 0);
            return Math.min(max, Math.max(0, num));
        };
        if (this.system.limiarDano.leve.marcacoes === undefined) {
            this.system.limiarDano.leve.marcacoes = 0;
        }
        this.system.limiarDano.leve.marcacoes = clampMarcacao(this.system.limiarDano.leve.marcacoes, 3);
        if (this.system.limiarDano.moderado.marcacoes === undefined) {
            this.system.limiarDano.moderado.marcacoes = 0;
        }
        this.system.limiarDano.moderado.marcacoes = clampMarcacao(this.system.limiarDano.moderado.marcacoes, 3);
        if (this.system.limiarDano.grave.marcacoes === undefined) {
            this.system.limiarDano.grave.marcacoes = 0;
        }
        this.system.limiarDano.grave.marcacoes = clampMarcacao(this.system.limiarDano.grave.marcacoes, 1);
        if (this.system.limiarDano.penalidades === undefined) {
            this.system.limiarDano.penalidades = 0;
        }
        const penalidadeLimiar = safeNumber(this.system.limiarDano.penalidades, 0);
        this.system.limiarDano.penalidades = penalidadeLimiar;
        this.system.limiarDano.leve.limiar = Math.max(0, limiarLeveBase - penalidadeLimiar);
        
        // Calcular Armadura atual (total - dano)
        if (!this.system.armadura) {
            this.system.armadura = { total: 0, dano: 0, atual: 0, equipada: "" };
        }
        const armadura = this.system.armadura;
        armadura.nome = armadura.nome ?? "";
        armadura.descricao = armadura.descricao ?? "";
        armadura.especial = armadura.especial ?? "";
        const total = safeNumber(armadura.total);
        const dano = safeNumber(armadura.dano);
        armadura.atual = Math.max(0, total - dano);
        if (armadura.equipada === undefined) {
            armadura.equipada = "";
        }
        
        // Calcular Esquiva = máximo entre (destreza/2) - total de armadura, com mínimo de 1
        const destreza = attr.fisicos.destreza;
        const armaduraTotal = safeNumber(this.system.armadura?.total || 0, 0);
        const armaduraDefesa = armaduraTotal / 10;
        const esquivaCalculada = Math.floor(destreza / 2) - armaduraDefesa;
        this.system.combate.esquiva = Math.max(1, esquivaCalculada);
        
        // IMPORTANTE: Ler dados salvos do _source ANTES de qualquer processamento
        // No Foundry VTT, _source contém os dados brutos salvos no banco de dados
        // Arrays aninhados são salvos como objetos com índices numéricos como chaves
        const sourceInventario = this._source?.system?.inventario;
        
        // Função auxiliar para converter objeto (com índices numéricos) em array
        const objectToArray = (obj) => {
            if (!obj) return null;
            if (Array.isArray(obj)) return obj; // Já é array
            if (typeof obj !== 'object') return null;
            
            // Converter objeto com índices numéricos em array
            const keys = Object.keys(obj).filter(k => !isNaN(parseInt(k))).map(k => parseInt(k)).sort((a, b) => a - b);
            if (keys.length === 0) return null;
            
            const arr = [];
            for (let i = 0; i <= Math.max(...keys); i++) {
                if (obj[i] !== undefined) {
                    arr[i] = foundry.utils.duplicate(obj[i]);
                }
            }
            return arr;
        };
        
        // Inicializar inventário a partir dos dados salvos, se disponíveis
        if (sourceInventario) {
            // Converter objetos em arrays se necessário
            const equipamentosSource = objectToArray(sourceInventario.equipamentos);
            const armasSource = objectToArray(sourceInventario.armas);
            
            this.system.inventario = {};
            if (equipamentosSource) {
                this.system.inventario.equipamentos = equipamentosSource;
            }
            if (armasSource) {
                this.system.inventario.armas = armasSource;
            }
        }
        
        // Se não há dados salvos ou não foram convertidos corretamente, inicializar
        if (!this.system.inventario) {
            // Se não há dados salvos e não existe inventário, criar novo
            this.system.inventario = {
                equipamentos: [
                    {nome: "", id: "", descricao: "", efeito: ""},
                    {nome: "", id: "", descricao: "", efeito: ""},
                    {nome: "", id: "", descricao: "", efeito: ""},
                    {nome: "", id: "", descricao: "", efeito: ""},
                    {nome: "", id: "", descricao: "", efeito: ""}
                ],
                armas: [
                    {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""},
                    {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""},
                    {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""}
                ]
            };
        }
        
        // Garantir que equipamentos existe e tem estrutura correta
        if (!this.system.inventario.equipamentos || !Array.isArray(this.system.inventario.equipamentos)) {
            this.system.inventario.equipamentos = [
                {nome: "", id: "", descricao: "", efeito: ""},
                {nome: "", id: "", descricao: "", efeito: ""},
                {nome: "", id: "", descricao: "", efeito: ""},
                {nome: "", id: "", descricao: "", efeito: ""},
                {nome: "", id: "", descricao: "", efeito: ""}
            ];
        }
        // Garantir que há exatamente 5 equipamentos
        while (this.system.inventario.equipamentos.length < 5) {
            this.system.inventario.equipamentos.push({nome: "", id: "", descricao: "", efeito: ""});
        }
        this.system.inventario.equipamentos = this.system.inventario.equipamentos.slice(0, 5);
        // Garantir que todos os equipamentos tenham os campos necessários
        for (let i = 0; i < this.system.inventario.equipamentos.length; i++) {
            const eq = this.system.inventario.equipamentos[i];
            if (!eq || typeof eq !== 'object') {
                this.system.inventario.equipamentos[i] = {nome: "", id: "", descricao: "", efeito: ""};
                continue;
            }
            // Apenas adicionar campos que não existem, preservar valores existentes
            if (eq.nome === undefined || eq.nome === null) eq.nome = "";
            if (eq.id === undefined || eq.id === null) eq.id = "";
            if (eq.descricao === undefined || eq.descricao === null) eq.descricao = "";
            if (eq.efeito === undefined || eq.efeito === null) eq.efeito = "";
        }
        
        // Garantir que armas existe e tem estrutura correta
        if (!this.system.inventario.armas || !Array.isArray(this.system.inventario.armas)) {
            this.system.inventario.armas = [
                {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""},
                {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""},
                {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""}
            ];
        }
        // Garantir que há exatamente 3 armas
        while (this.system.inventario.armas.length < 3) {
            this.system.inventario.armas.push({nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""});
        }
        this.system.inventario.armas = this.system.inventario.armas.slice(0, 3);
        // Garantir que todas as armas tenham os campos necessários
        for (let i = 0; i < this.system.inventario.armas.length; i++) {
            const arma = this.system.inventario.armas[i];
            if (!arma || typeof arma !== 'object') {
                this.system.inventario.armas[i] = {nome: "", id: "", dano: 0, alcance: "", bonus: 0, descricao: "", efeito: ""};
                continue;
            }
            // Apenas adicionar campos que não existem, preservar valores existentes
            if (arma.nome === undefined || arma.nome === null) arma.nome = "";
            if (arma.id === undefined || arma.id === null) arma.id = "";
            if (arma.dano === undefined || arma.dano === null) arma.dano = 0;
            if (arma.alcance === undefined || arma.alcance === null) arma.alcance = "";
            if (arma.bonus === undefined || arma.bonus === null) arma.bonus = 0;
            if (arma.descricao === undefined || arma.descricao === null) arma.descricao = "";
            if (arma.efeito === undefined || arma.efeito === null) arma.efeito = "";
        }
    }

    /**
     * Prepare Criatura type specific data
     */
    _prepareCriaturaData() {
        const safeNumber = (value, min = 0) => {
            const num = Number(value);
            if (isNaN(num)) return min;
            return Math.max(min, num);
        };

        if (!this.system.informacoes) {
            this.system.informacoes = {
                tipo: "",
                categoria: "Delta",
                escala: "Médio",
                descricao: ""
            };
        }

        const attr = this.system.atributos = this.system.atributos || {};
        attr.fisicos = attr.fisicos || {};
        attr.mentais = attr.mentais || {};
        attr.sociais = attr.sociais || {};

        const clampAttr = (value) => Math.max(1, safeNumber(value, 1));
        // Físicos
        attr.fisicos.forca = clampAttr(attr.fisicos.forca);
        attr.fisicos.destreza = clampAttr(attr.fisicos.destreza);
        attr.fisicos.vigor = clampAttr(attr.fisicos.vigor);

        // Mentais
        attr.mentais.conhecimento = clampAttr(attr.mentais.conhecimento);
        attr.mentais.perspicacia = clampAttr(attr.mentais.perspicacia);
        attr.mentais.resiliencia = clampAttr(attr.mentais.resiliencia);

        // Sociais
        attr.sociais.eloquencia = clampAttr(attr.sociais.eloquencia);
        attr.sociais.dissimulacao = clampAttr(attr.sociais.dissimulacao);
        attr.sociais.presenca = clampAttr(attr.sociais.presenca);

        const categoriaAtual = this.system.informacoes.categoria || "Delta";
        const pontosCategoria = CONFIG.RisingSteel?.getCategoriaPontos(categoriaAtual) ?? 5;
        this.system.informacoes.categoria = categoriaAtual;
        if (!this.system.informacoes.escala) {
            this.system.informacoes.escala = "Médio";
        }

        if (!this.system.pontosAtributo) {
            this.system.pontosAtributo = {
                total: pontosCategoria,
                distribuidos: 0,
                restantes: pontosCategoria
            };
        }

        this.system.pontosAtributo.total = pontosCategoria;
        const pontosDistribuidos =
            Math.max(0, attr.fisicos.forca - 1) +
            Math.max(0, attr.fisicos.destreza - 1) +
            Math.max(0, attr.fisicos.vigor - 1) +
            Math.max(0, attr.mentais.conhecimento - 1) +
            Math.max(0, attr.mentais.perspicacia - 1) +
            Math.max(0, attr.mentais.resiliencia - 1) +
            Math.max(0, attr.sociais.eloquencia - 1) +
            Math.max(0, attr.sociais.dissimulacao - 1) +
            Math.max(0, attr.sociais.presenca - 1);

        this.system.pontosAtributo.distribuidos = pontosDistribuidos;
        this.system.pontosAtributo.restantes = Math.max(0, pontosCategoria - pontosDistribuidos);

        if (!this.system.combate) {
            this.system.combate = {};
        }

        const destreza = attr.fisicos.destreza;
        const perspicacia = attr.mentais.perspicacia;
        const vigor = attr.fisicos.vigor;

        this.system.combate.iniciativa = destreza + perspicacia;
        this.system.combate.mobilidade = 2 + destreza;

        if (!this.system.armadura) {
            this.system.armadura = {
                total: 0,
                dano: 0,
                atual: 0
            };
        }

        const armaduraTotal = safeNumber(this.system.armadura.total);
        const armaduraDano = safeNumber(this.system.armadura.dano);
        this.system.armadura.total = armaduraTotal;
        this.system.armadura.dano = armaduraDano;
        this.system.armadura.atual = Math.max(0, armaduraTotal - armaduraDano);

        const armaduraDefesa = armaduraTotal / 10;
        const esquivaCalculada = Math.floor(destreza / 2) - armaduraDefesa;
        this.system.combate.esquiva = Math.max(1, esquivaCalculada);

        if (!this.system.limiarDano) {
            this.system.limiarDano = {};
        }

        const limiarLeveBase = vigor;
        if (!this.system.limiarDano.leve) this.system.limiarDano.leve = {};
        if (!this.system.limiarDano.moderado) this.system.limiarDano.moderado = {};
        if (!this.system.limiarDano.grave) this.system.limiarDano.grave = {};

        this.system.limiarDano.moderado.limiar = limiarLeveBase * 2;
        this.system.limiarDano.grave.limiar = limiarLeveBase * 4;

        const clampMarcacao = (value, max) => Math.min(max, Math.max(0, safeNumber(value, 0)));
        if (this.system.limiarDano.leve.marcacoes === undefined) this.system.limiarDano.leve.marcacoes = 0;
        this.system.limiarDano.leve.marcacoes = clampMarcacao(this.system.limiarDano.leve.marcacoes, 3);
        if (this.system.limiarDano.moderado.marcacoes === undefined) this.system.limiarDano.moderado.marcacoes = 0;
        this.system.limiarDano.moderado.marcacoes = clampMarcacao(this.system.limiarDano.moderado.marcacoes, 3);
        if (this.system.limiarDano.grave.marcacoes === undefined) this.system.limiarDano.grave.marcacoes = 0;
        this.system.limiarDano.grave.marcacoes = clampMarcacao(this.system.limiarDano.grave.marcacoes, 1);
        if (this.system.limiarDano.penalidades === undefined) this.system.limiarDano.penalidades = 0;
        const penalidadeLimiar = safeNumber(this.system.limiarDano.penalidades, 0);
        this.system.limiarDano.penalidades = penalidadeLimiar;
        this.system.limiarDano.leve.limiar = Math.max(0, limiarLeveBase - penalidadeLimiar);

        if (!Array.isArray(this.system.ataques)) {
            this.system.ataques = [];
        }
        this.system.ataques = this.system.ataques.map(ataque => {
            const ataqueNormalizado = {
                nome: ataque?.nome ?? "",
                atributo: ataque?.atributo ?? "",
                dadoBase: safeNumber(ataque?.dadoBase, 1) || 1,
                dadoBonus: safeNumber(ataque?.dadoBonus, 0),
                condicao: ataque?.condicao ?? "",
                alcance: ataque?.alcance ?? "",
                dano: ataque?.dano ?? "",
                efeito: ataque?.efeito ?? ""
            };
            // Compatibilidade com estrutura antiga (campo "bonus")
            if (!ataqueNormalizado.dadoBonus && ataque?.bonus) {
                ataqueNormalizado.dadoBonus = safeNumber(ataque.bonus, 0);
            }
            return ataqueNormalizado;
        });

        const ensureArraySize = (arr, size, factory) => {
            const result = Array.isArray(arr) ? arr.slice(0, size) : [];
            while (result.length < size) {
                result.push(factory());
            }
            return result;
        };

        const habilidadesSource = this._source?.system?.habilidadesEspeciais;
        let habilidadesList = this.system.habilidadesEspeciais;

        if (!Array.isArray(habilidadesList)) {
            if (Array.isArray(habilidadesSource)) {
                habilidadesList = habilidadesSource;
            } else if (habilidadesSource && typeof habilidadesSource === "object") {
                habilidadesList = Object.keys(habilidadesSource)
                    .filter(key => !isNaN(Number(key)))
                    .sort((a, b) => Number(a) - Number(b))
                    .map(key => foundry.utils.duplicate(habilidadesSource[key]));
            } else {
                habilidadesList = [];
            }
        }

        this.system.habilidadesEspeciais = habilidadesList.map(hab => ({
            nome: hab?.nome ?? "",
            descricao: hab?.descricao ?? "",
            usos: {
                atual: safeNumber(hab?.usos?.atual, 0),
                total: safeNumber(hab?.usos?.total, 0)
            }
        }));
    }

    _prepareExacomData() {
        const safeNumber = (value) => {
            if (value === null || value === undefined || value === "") return 0;
            const normalized = String(value).replace(/,/g, ".");
            const num = Number(normalized);
            return Number.isNaN(num) ? 0 : num;
        };

        if (!this.system.identificacao) {
            this.system.identificacao = {};
        }

        const ident = this.system.identificacao;
        // Escala é sempre "Grande" para EXAcom
        ident.escala = "Grande";
        ["piloto", "categoria", "modelo", "mce", "admissao"].forEach(field => {
            if (ident[field] === undefined || ident[field] === null) {
                ident[field] = "";
            }
        });

        if (this.system.modeloId === undefined || this.system.modeloId === null) {
            this.system.modeloId = "";
        }

        if (!this.system.vinculo) {
            this.system.vinculo = { pilotoId: "" };
        } else if (this.system.vinculo.pilotoId === undefined || this.system.vinculo.pilotoId === null) {
            this.system.vinculo.pilotoId = "";
        }

        if (!this.system.sistema) {
            this.system.sistema = { neuromotor: 0, sensorial: 0, estrutural: 0, energetico: 0 };
        }
        
        // Se não houver modelo selecionado, zerar todos os atributos de sistema
        if (!this.system.modeloId || this.system.modeloId === "") {
            this.system.sistema.neuromotor = 0;
            this.system.sistema.sensorial = 0;
            this.system.sistema.estrutural = 0;
            this.system.sistema.energetico = 0;
        } else {
            // Apenas normalizar se houver modelo (valores podem ter sido definidos pelo modelo)
            ["neuromotor", "sensorial", "estrutural", "energetico"].forEach(attr => {
                this.system.sistema[attr] = safeNumber(this.system.sistema[attr]);
            });
        }
        
        // Inicializar penalidades dos atributos de sistema
        if (!this.system.sistema.penalidades) {
            this.system.sistema.penalidades = {
                neuromotor: 0,
                sensorial: 0,
                estrutural: 0,
                energetico: 0
            };
        }
        this.system.sistema.penalidades.neuromotor = safeNumber(this.system.sistema.penalidades.neuromotor);
        this.system.sistema.penalidades.sensorial = safeNumber(this.system.sistema.penalidades.sensorial);
        this.system.sistema.penalidades.estrutural = safeNumber(this.system.sistema.penalidades.estrutural);
        this.system.sistema.penalidades.energetico = safeNumber(this.system.sistema.penalidades.energetico);

        if (!this.system.combate) {
            this.system.combate = {};
        }
        
        // Buscar piloto vinculado para obter seus atributos de combate
        let pilotoEsquiva = 0;
        let pilotoMobilidade = 0;
        let pilotoIniciativa = 0;
        
        try {
            const pilotoId = this.system.vinculo?.pilotoId;
            if (pilotoId && game?.actors) {
                const pilotoActor = game.actors.get(pilotoId);
                if (pilotoActor && pilotoActor.type === "piloto") {
                    pilotoEsquiva = safeNumber(pilotoActor.system?.combate?.esquiva || 0);
                    pilotoMobilidade = safeNumber(pilotoActor.system?.combate?.mobilidade || 0);
                    pilotoIniciativa = safeNumber(pilotoActor.system?.combate?.iniciativa || 0);
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar atributos de combate do piloto vinculado:", error);
        }
        
        // Calcular atributos de combate: Sincronia + atributo do piloto
        const sincronia = safeNumber(this.system.exa?.sincronia || 0);
        
        // Esquiva = Sincronia + Esquiva do piloto
        this.system.combate.esquiva = sincronia + pilotoEsquiva;
        
        // Mobilidade = Sincronia + Mobilidade do piloto
        this.system.combate.mobilidade = sincronia + pilotoMobilidade;
        
        // Iniciativa = Sincronia + Iniciativa do piloto
        this.system.combate.iniciativa = sincronia + pilotoIniciativa;

        // Inicializar limiar de dano
        if (!this.system.limiarDano) {
            this.system.limiarDano = {
                leve: { limiar: 0, marcacoes: 0 },
                moderado: { limiar: 0, marcacoes: 0 },
                grave: { limiar: 0, marcacoes: 0 },
                penalidades: 0
            };
        }
        
        // Buscar piloto vinculado para obter o Vigor
        let vigorPiloto = 0;
        try {
            const pilotoId = this.system.vinculo?.pilotoId;
            if (pilotoId && game?.actors) {
                const pilotoActor = game.actors.get(pilotoId);
                if (pilotoActor && pilotoActor.type === "piloto") {
                    vigorPiloto = safeNumber(pilotoActor.system?.atributos?.fisicos?.vigor || 0);
                }
            }
        } catch (error) {
            console.warn("[Rising Steel] Erro ao buscar Vigor do piloto vinculado:", error);
        }
        
        // Calcular limiares baseados em (Vigor do piloto + Estrutural do EXACOM)
        // Garantir que o valor estrutural esteja definido e normalizado
        const estruturalBase = safeNumber(this.system.sistema?.estrutural || 0);
        const penalidadeEstrutural = safeNumber(this.system.sistema?.penalidades?.estrutural || 0);
        const estrutural = Math.max(0, estruturalBase - penalidadeEstrutural);
        const baseLimiar = vigorPiloto + estrutural;
        this.system.limiarDano.leve.limiar = baseLimiar * 1;
        this.system.limiarDano.moderado.limiar = baseLimiar * 2;
        this.system.limiarDano.grave.limiar = baseLimiar * 4;
        
        // Garantir que marcações e penalidades existam
        this.system.limiarDano.leve.marcacoes = safeNumber(this.system.limiarDano.leve.marcacoes);
        this.system.limiarDano.moderado.marcacoes = safeNumber(this.system.limiarDano.moderado.marcacoes);
        this.system.limiarDano.grave.marcacoes = safeNumber(this.system.limiarDano.grave.marcacoes);
        this.system.limiarDano.penalidades = safeNumber(this.system.limiarDano.penalidades);

        if (!this.system.equipamentosExa) {
            this.system.equipamentosExa = {};
        }
        this.system.equipamentosExa.blindagemDescricao = this.system.equipamentosExa.blindagemDescricao ?? "";
        this.system.equipamentosExa.blindagemEspecial = this.system.equipamentosExa.blindagemEspecial ?? "";
        this.system.equipamentosExa.blindagemDano = safeNumber(this.system.equipamentosExa.blindagemDano);
        this.system.equipamentosExa.blindagemTotal = safeNumber(this.system.equipamentosExa.blindagem) * 10;
        this.system.equipamentosExa.blindagemAtual = Math.max(0, this.system.equipamentosExa.blindagemTotal - this.system.equipamentosExa.blindagemDano);

        const ensureEntries = (entries, template, min = 1) => {
            let list = Array.isArray(entries) ? entries.map(entry => ({
                ...template,
                ...entry
            })) : [];
            while (list.length < min) {
                list.push(foundry.utils.duplicate(template));
            }
            return list;
        };

        // Armas agora usam a mesma estrutura de ataques
        if (!Array.isArray(this.system.equipamentosExa.armas)) {
            this.system.equipamentosExa.armas = [];
        }
        
        // Calcular dadoBase automaticamente: Neuromotor + Sincronia (aplicando penalidades)
        // (sincronia já foi declarada acima na linha 669)
        const penalidadeNeuromotor = safeNumber(this.system.sistema?.penalidades?.neuromotor || 0);
        const neuromotor = Math.max(0, safeNumber(this.system.sistema?.neuromotor || 0) - penalidadeNeuromotor);
        const dadoBaseCalculado = neuromotor + sincronia;
        
        this.system.equipamentosExa.armas = this.system.equipamentosExa.armas.map(arma => {
            // Migrar de estrutura antiga (nome, descricao) para nova (ataque)
            if (arma.descricao && !arma.atributo) {
                return {
                    nome: arma.nome || "",
                    atributo: "",
                    dadoBase: dadoBaseCalculado,
                    alcance: "",
                    dano: "",
                    efeito: arma.descricao || ""
                };
            }
            return {
                nome: arma?.nome ?? "",
                atributo: arma?.atributo ?? "",
                dadoBase: dadoBaseCalculado, // Sempre recalcular
                alcance: arma?.alcance ?? "",
                dano: arma?.dano ?? "",
                efeito: arma?.efeito ?? ""
            };
        });
        
        // Blindagem agora é um número, não uma lista
        if (this.system.equipamentosExa.blindagem === undefined || this.system.equipamentosExa.blindagem === null) {
            this.system.equipamentosExa.blindagem = 0;
        } else if (Array.isArray(this.system.equipamentosExa.blindagem)) {
            // Migrar de array para número (pegar o primeiro valor ou 0)
            this.system.equipamentosExa.blindagem = 0;
        } else {
            this.system.equipamentosExa.blindagem = safeNumber(this.system.equipamentosExa.blindagem);
        }

        if (!this.system.exa) {
            this.system.exa = {
                exalink: "",
                sincronia: 0,
                overdrive: 0,
                mods: {
                    reator: [{ descricao: "" }],
                    modulos: [{ descricao: "" }]
                }
            };
        }

        this.system.exa.exalink = this.system.exa.exalink ?? "";
        this.system.exa.sincronia = safeNumber(this.system.exa.sincronia);
        this.system.exa.overdrive = safeNumber(this.system.exa.overdrive);

        if (!this.system.exa.mods) {
            this.system.exa.mods = { reator: [], modulos: [] };
        }
        this.system.exa.mods.reator = ensureEntries(
            this.system.exa.mods.reator,
            { descricao: "" },
            1
        );
        this.system.exa.mods.modulos = ensureEntries(
            this.system.exa.mods.modulos,
            { descricao: "" },
            1
        );
    }

    _gatherTextualModifierSources() {
        const entries = [];
        const addEntry = (text, source) => {
            if (!text || typeof text !== "string") return;
            const trimmed = text.trim();
            if (!trimmed) return;
            entries.push({ text: trimmed, source });
        };

        const ownedItems = Array.isArray(this.items?.contents) ? this.items.contents : Array.from(this.items ?? []);
        for (const item of ownedItems) {
            const label = `Item: ${item.name || item.id || "sem nome"}`;
            addEntry(item.system?.descricao, label);
            addEntry(item.system?.especial, label);
            addEntry(item.system?.efeito, label);
        }

        const armaduraNome = this.system?.armadura?.nome || this.system?.armadura?.equipada || "Armadura";
        addEntry(this.system?.armadura?.descricao, `Armadura: ${armaduraNome}`);
        addEntry(this.system?.armadura?.especial, `Armadura: ${armaduraNome}`);

        const equipamentos = this.system?.inventario?.equipamentos;
        if (Array.isArray(equipamentos)) {
            equipamentos.forEach((equipamento, index) => {
                const label = `Equipamento ${equipamento?.nome || index + 1}`;
                addEntry(equipamento?.descricao, label);
                addEntry(equipamento?.efeito, label);
            });
        }

        const armas = this.system?.inventario?.armas;
        if (Array.isArray(armas)) {
            armas.forEach((arma, index) => {
                const label = `Arma ${arma?.nome || index + 1}`;
                addEntry(arma?.descricao, label);
                addEntry(arma?.efeito, label);
            });
        }

        const habilidades = this.system?.habilidadesEspeciais;
        if (Array.isArray(habilidades)) {
            habilidades.forEach((habilidade, index) => {
                addEntry(habilidade?.descricao, `Habilidade ${habilidade?.nome || index + 1}`);
            });
        }

        const ataques = this.system?.ataques;
        if (Array.isArray(ataques)) {
            ataques.forEach((ataque, index) => {
                const label = `Ataque ${ataque?.nome || index + 1}`;
                addEntry(ataque?.descricao, label);
                addEntry(ataque?.efeito, label);
            });
        }

        const exaArmas = this.system?.equipamentosExa?.armas;
        if (Array.isArray(exaArmas)) {
            exaArmas.forEach((arma, index) => {
                const label = `EXA Arma ${arma?.nome || index + 1}`;
                addEntry(arma?.descricao, label);
                addEntry(arma?.efeito, label);
            });
        }

        const modsReator = this.system?.exa?.mods?.reator;
        if (Array.isArray(modsReator)) {
            modsReator.forEach((mod, index) => addEntry(mod?.descricao, `Reator ${index + 1}`));
        }

        const modsModulo = this.system?.exa?.mods?.modulos;
        if (Array.isArray(modsModulo)) {
            modsModulo.forEach((mod, index) => addEntry(mod?.descricao, `Modulo ${index + 1}`));
        }

        const blindagemDescricao = this.system?.equipamentosExa?.blindagemDescricao;
        if (blindagemDescricao) {
            addEntry(blindagemDescricao, "Blindagem EXA");
        }

        const blindagemEspecial = this.system?.equipamentosExa?.blindagemEspecial;
        if (blindagemEspecial) {
            addEntry(blindagemEspecial, "Blindagem EXA");
        }

        return entries;
    }

    _applyTextualModifiers() {
        const sources = this._gatherTextualModifierSources();
        const breakdown = [];

        for (const entry of sources) {
            breakdown.push(...parseTextualModifiers(entry.text, entry.source));
        }

        const totals = {};
        for (const mod of breakdown) {
            totals[mod.path] = (totals[mod.path] || 0) + mod.value;
        }

        for (const [path, total] of Object.entries(totals)) {
            if (!total) continue;
            const current = foundry.utils.getProperty(this.system, path);
            if (current === undefined || current === null) continue;
            const numericCurrent = Number(current);
            if (Number.isNaN(numericCurrent)) continue;
            foundry.utils.setProperty(this.system, path, numericCurrent + total);
        }

        this.system.textualModifiers = {
            breakdown,
            totals
        };
    }
}


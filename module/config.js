/**
 * Configuration for Rising Steel system
 */
export class RisingSteel {
    static PATENTES = {
        "Recruta": { pontos: 5, overdrive: 0 },
        "Soldado": { pontos: 7, overdrive: 0 },
        "Cabo": { pontos: 9, overdrive: 1 },
        "Sargento": { pontos: 11, overdrive: 1 },
        "Tenente": { pontos: 13, overdrive: 2 },
        "Capitão": { pontos: 15, overdrive: 2 },
        "Major": { pontos: 17, overdrive: 3 },
        "Coronel": { pontos: 19, overdrive: 3 },
        "General": { pontos: 21, overdrive: 4 },
        "Marechal": { pontos: 23, overdrive: 5 }
    };

    static getPatentePontos(patente) {
        const patenteData = this.PATENTES[patente];
        return patenteData?.pontos || 5; // Default para Recruta (5 pontos)
    }

    static getPatenteOverdrive(patente) {
        const patenteData = this.PATENTES[patente];
        return patenteData?.overdrive || 0; // Default 0
    }

    static getPatentesList() {
        return Object.keys(this.PATENTES);
    }

    static CATEGORIAS = {
        "Delta": 5,
        "Gama": 10,
        "Beta": 20,
        "Alfa": 30,
        "Ômega": 40
    };

    static ESCALAS = ["Pequeno", "Médio", "Grande", "Colossal"];

    static getCategoriaPontos(categoria) {
        return this.CATEGORIAS[categoria] ?? this.CATEGORIAS["Delta"];
    }

    static getCategoriasList() {
        return Object.keys(this.CATEGORIAS);
    }

    static getEscalasList() {
        return [...this.ESCALAS];
    }
}


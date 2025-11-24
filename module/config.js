/**
 * Configuration for Rising Steel system
 */
export class RisingSteel {
    static PATENTES = {
        "Recruta": 5,      // Começa com 5 pontos
        "Cabo": 7,        // +2 pontos
        "Sargento": 9,    // +2 pontos
        "Tenente": 11,    // +2 pontos
        "Capitão": 13,    // +2 pontos
        "Major": 15,      // +2 pontos
        "Coronel": 17,    // +2 pontos
        "General": 19,    // +2 pontos
        "Marechal": 21    // +2 pontos
    };

    static getPatentePontos(patente) {
        return this.PATENTES[patente] || 5; // Default para Recruta (5 pontos)
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


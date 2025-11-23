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
}


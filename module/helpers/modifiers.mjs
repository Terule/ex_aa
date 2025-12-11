const ATTRIBUTE_ALIASES = {
  "atributos.fisicos.forca": ["forca", "forca fisica", "atributo forca"],
  "atributos.fisicos.destreza": ["destreza"],
  "atributos.fisicos.vigor": ["vigor"],
  "atributos.mentais.conhecimento": ["conhecimento"],
  "atributos.mentais.perspicacia": ["perspicacia"],
  "atributos.mentais.resiliencia": ["resiliencia", "resiliencia mental"],
  "atributos.sociais.eloquencia": ["eloquencia"],
  "atributos.sociais.dissimulacao": ["dissimulacao"],
  "atributos.sociais.presenca": ["presenca"],
  "combate.mobilidade": ["mobilidade"],
  "combate.esquiva": ["esquiva"],
  "combate.iniciativa": ["iniciativa"],
  "sistema.neuromotor": ["neuromotor"],
  "sistema.sensorial": ["sensorial"],
  "sistema.estrutural": ["estrutural"],
  "exa.sincronia": ["sincronia", "exa sincronia"],
  "exa.overdrive": ["overdrive", "exa overdrive"],
  "limiarDano.leve.limiar": ["limiar leve", "limiar dano leve"],
  "limiarDano.moderado.limiar": ["limiar moderado", "limiar dano moderado"],
  "limiarDano.grave.limiar": ["limiar grave", "limiar dano grave"]
};

const OPTIONAL_WORD = "(?:\\s*(?:de|do|da|dos|das|em|no|na|nos|nas|para|por|ao|a)\\s*)?";

const ATTRIBUTE_ENTRIES = Object.entries(ATTRIBUTE_ALIASES);

function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function buildAliasPattern(alias) {
  const normalizedAlias = normalizeText(alias).trim();
  if (!normalizedAlias) return null;
  const aliasPattern = normalizedAlias.replace(/\s+/g, "\\s+");
  return new RegExp(
    `([+\\-]\\s*\\d+(?:[.,]\\d+)?)\\s*(?:pts?|pontos?)?${OPTIONAL_WORD}${aliasPattern}(?=\\b)`,
    "gi"
  );
}

export function parseTextualModifiers(text, source = "fonte desconhecida") {
  if (!text || typeof text !== "string") return [];

  const normalized = normalizeText(text);
  const breakdown = [];

  for (const [path, aliases] of ATTRIBUTE_ENTRIES) {
    for (const alias of aliases) {
      const regex = buildAliasPattern(alias);
      if (!regex) continue;
      let match;
      while ((match = regex.exec(normalized)) !== null) {
        const rawValue = match[1]?.replace(/\s+/g, "") ?? "";
        if (!rawValue) continue;
        const value = Number(rawValue.replace(",", "."));
        if (Number.isNaN(value)) continue;
        breakdown.push({
          path,
          value,
          source
        });
      }
    }
  }

  return breakdown;
}

export { ATTRIBUTE_ALIASES };



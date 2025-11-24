// Actor Sheet para Rising Steel
class PilotActorSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["rising-steel", "sheet", "actor"],
      template: "systems/rising-steel/template/actor-sheet.hbs",
      width: 800,
      height: 900,
      tabs: [{
        navSelector: ".sheet-tabs",
        contentSelector: ".sheet-body",
        initial: "piloto"
      }]
    });
  }
  
  getData() {
    const data = super.getData();
    return data;
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Botões de rolagem
    html.find(".roll-attribute").click(this._onRollAttribute.bind(this));
  }
  
  _onRollAttribute(event) {
    event.preventDefault();
    const attribute = event.currentTarget.dataset.attribute;
    const path = `system.atributos.${attribute}`;
    const value = foundry.utils.getProperty(this.actor, path);
    
    if (!value || value === 0) {
      ui.notifications.warn("Atributo com valor 0!");
      return;
    }
    
    const roll = new Roll(`${value}d6`);
    roll.roll({ async: false }).then(r => {
      const success = r.terms[0].results.filter(d => d.result === 6).length;
      r.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Rolagem de ${attribute} - Sucessos: ${success}`
      });
    });
  }
}

// Registrar a sheet
Hooks.once("init", () => {
  // Registrar a sheet customizada para o tipo piloto
  foundry.documents.collections.Actors.registerSheet("rising-steel", PilotActorSheet, {
    types: ["piloto"],
    makeDefault: true
  });
  
  console.log("Rising Steel: Actor Sheet registrada para tipo 'piloto'");
});

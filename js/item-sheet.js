class ExaItemSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["rising-steel", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: []
    });
  }

  get template() {
    const type = this.item.type;
    return `systems/rising-steel/template/items/${type}-sheet.hbs`;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }

  getData() {
    const data = super.getData();
    return data;
  }
}

Hooks.once("init", function () {
  // Desregistrar a sheet padrão do core
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  // Registrar sheets de itens
  foundry.documents.collections.Items.registerSheet("rising-steel", ExaItemSheet, {
    types: ["arma", "armadura", "equipamento", "examod"],
    makeDefault: true
  });
});


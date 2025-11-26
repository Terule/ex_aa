// Import compatibility utilities
import { FoundryCompatibility } from "../utils/compatibility.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class RisingSteelItemSheet extends FoundryCompatibility.getItemSheetBase() {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["rising-steel", "sheet", "item"],
            width: 520,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    /** @override */
    get template() {
        const path = "systems/rising-steel/template/item";
        // Templates HTML existem para: armadura, arma, equipamento, exacomModel, blindagemExacom
        const htmlTypes = ["armadura", "arma", "equipamento", "exacommodel", "blindagemexacom"];
        const itemType = this.item.type?.toLowerCase() || "item";

        // Para tipos especiais sem template próprio, usamos o template genérico item-sheet.hbs
        if (!htmlTypes.includes(itemType)) {
            return `${path}/item-sheet.hbs`;
        }

        return `${path}/item-${itemType}-sheet.html`;
    }

    /** @override */
    async getData(options) {
        const context = await super.getData();
        const item = context.item;
        const source = item.toObject();

        // Verificar se o item está bloqueado (por padrão, itens do compendium estão bloqueados)
        const isLocked = item.getFlag("rising-steel", "locked") ?? (item.isInCompendium ? true : false);

        foundry.utils.mergeObject(context, {
            source: source.system,
            system: item.system,      
            isEmbedded: item.isEmbedded,
            type: item.type,      
            flags: item.flags,
            isLocked: isLocked,
            descriptionHTML: await FoundryCompatibility.enrichHTML(item.system.description || "", {
              secrets: item.isOwner,
              async: true
            })
          });

        // Retrieve the roll data for TinyMCE editors.
        context.rollData = {};
        let actor = this.object?.parent ?? null;
        if (actor) {
            context.rollData = actor.getRollData();
        }
        
        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Botão para alternar bloqueio/desbloqueio
        html.find(".item-lock-toggle").click(this._onToggleLock.bind(this));

        // Aplicar bloqueio aos campos
        this._applyLockState(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;
    }

    _applyLockState(html) {
        const isLocked = this.item.getFlag("rising-steel", "locked") ?? (this.item.isInCompendium ? true : false);
        
        // O bloqueio já é aplicado via template com o atributo disabled
        // Aqui apenas desabilitamos a edição de imagem quando bloqueado
        if (isLocked) {
            html.find("img[data-edit]").off("click");
        }
    }

    async _onToggleLock(event) {
        event.preventDefault();
        const currentLocked = this.item.getFlag("rising-steel", "locked") ?? (this.item.isInCompendium ? true : false);
        await this.item.setFlag("rising-steel", "locked", !currentLocked);
        this.render(false);
    }
}


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
        // Templates HTML existem para: armadura, arma, equipamento
        const htmlTypes = ["armadura", "arma", "equipamento"];
        const itemType = this.item.type?.toLowerCase() || "item";
        const extension = htmlTypes.includes(itemType) ? "html" : "hbs";
        return `${path}/item-${itemType}-sheet.${extension}`;
    }

    /** @override */
    async getData(options) {
        const context = await super.getData();
        const item = context.item;
        const source = item.toObject();

        foundry.utils.mergeObject(context, {
            source: source.system,
            system: item.system,      
            isEmbedded: item.isEmbedded,
            type: item.type,      
            flags: item.flags,
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

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;
    }
}


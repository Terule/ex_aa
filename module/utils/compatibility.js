/**
 * Compatibility utilities for FoundryVTT v12 and v13
 * This module provides version detection and API abstraction
 */

export class FoundryCompatibility {
    /**
     * Get the major version of FoundryVTT
     * @returns {number} Major version number (12 or 13)
     */
    static getMajorVersion() {
        // Try multiple methods to detect version
        // Method 1: Check game.version (most reliable)
        if (typeof game !== "undefined" && game.version) {
            const version = game.version;
            const major = parseInt(version.split(".")[0]);
            if (!isNaN(major) && major > 0) {
                return major;
            }
        }
        
        // Method 2: Check global CONFIG (v12+)
        if (typeof CONFIG !== "undefined" && CONFIG.version) {
            const version = CONFIG.version;
            const major = parseInt(version.split(".")[0]);
            if (!isNaN(major) && major > 0) {
                return major;
            }
        }
        
        // Method 3: Detect from API structure (v13 has foundry.documents.collections)
        if (typeof foundry !== "undefined") {
            if (foundry.documents?.collections) {
                return 13;
            }
            if (foundry.appv1) {
                return 13;
            }
            // v12 has global Actors and Items
            if (typeof Actors !== "undefined" && typeof Items !== "undefined") {
                // Check if they have registerSheet method (v12+)
                if (Actors.registerSheet && Items.registerSheet) {
                    return 12;
                }
            }
        }
        
        // Default to v12 for safety (v12 APIs are more compatible)
        return 12;
    }

    /**
     * Check if running on FoundryVTT v13+
     * @returns {boolean}
     */
    static isV13() {
        return this.getMajorVersion() >= 13;
    }

    /**
     * Check if running on FoundryVTT v12
     * @returns {boolean}
     */
    static isV12() {
        return this.getMajorVersion() === 12;
    }

    /**
     * Get the ActorSheet base class for the current version
     * @returns {typeof ActorSheet}
     */
    static getActorSheetBase() {
        if (this.isV13()) {
            return foundry.appv1.sheets.ActorSheet;
        } else {
            return ActorSheet;
        }
    }

    /**
     * Get the ItemSheet base class for the current version
     * @returns {typeof ItemSheet}
     */
    static getItemSheetBase() {
        if (this.isV13()) {
            return foundry.appv1.sheets.ItemSheet;
        } else {
            return ItemSheet;
        }
    }

    /**
     * Register an actor sheet
     * @param {string} scope - The scope (system id)
     * @param {typeof ActorSheet} sheetClass - The sheet class
     * @param {object} options - Registration options
     */
    static registerActorSheet(scope, sheetClass, options = {}) {
        if (this.isV13()) {
            foundry.documents.collections.Actors.registerSheet(scope, sheetClass, options);
        } else {
            Actors.registerSheet(scope, sheetClass, options);
        }
    }

    /**
     * Unregister an actor sheet
     * @param {string} scope - The scope (system id or "core")
     * @param {typeof ActorSheet} sheetClass - The sheet class
     */
    static unregisterActorSheet(scope, sheetClass) {
        if (this.isV13()) {
            foundry.documents.collections.Actors.unregisterSheet(scope, sheetClass);
        } else {
            Actors.unregisterSheet(scope, sheetClass);
        }
    }

    /**
     * Register an item sheet
     * @param {string} scope - The scope (system id)
     * @param {typeof ItemSheet} sheetClass - The sheet class
     * @param {object} options - Registration options
     */
    static registerItemSheet(scope, sheetClass, options = {}) {
        if (this.isV13()) {
            foundry.documents.collections.Items.registerSheet(scope, sheetClass, options);
        } else {
            Items.registerSheet(scope, sheetClass, options);
        }
    }

    /**
     * Unregister an item sheet
     * @param {string} scope - The scope (system id or "core")
     * @param {typeof ItemSheet} sheetClass - The sheet class
     */
    static unregisterItemSheet(scope, sheetClass) {
        if (this.isV13()) {
            foundry.documents.collections.Items.unregisterSheet(scope, sheetClass);
        } else {
            Items.unregisterSheet(scope, sheetClass);
        }
    }

    /**
     * Enrich HTML content (for rich text editors)
     * @param {string} content - The content to enrich
     * @param {object} options - Enrichment options
     * @returns {Promise<string>}
     */
    static async enrichHTML(content, options = {}) {
        if (this.isV13()) {
            return foundry.applications.ux.TextEditor.implementation.enrichHTML(content, options);
        } else {
            return TextEditor.enrichHTML(content, options);
        }
    }

    /**
     * Render a Handlebars template
     * @param {string} templatePath - Path to the template
     * @param {object} data - Template data
     * @returns {Promise<string>}
     */
    static async renderTemplate(templatePath, data = {}) {
        if (this.isV13()) {
            return foundry.applications.handlebars.renderTemplate(templatePath, data);
        } else {
            return renderTemplate(templatePath, data);
        }
    }

    /**
     * Get the default ActorSheet class for unregistering
     * @returns {typeof ActorSheet}
     */
    static getDefaultActorSheet() {
        if (this.isV13()) {
            return foundry.appv1.sheets.ActorSheet;
        } else {
            return ActorSheet;
        }
    }

    /**
     * Get the default ItemSheet class for unregistering
     * @returns {typeof ItemSheet}
     */
    static getDefaultItemSheet() {
        if (this.isV13()) {
            return foundry.appv1.sheets.ItemSheet;
        } else {
            return ItemSheet;
        }
    }
}


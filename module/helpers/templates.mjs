/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/rising-steel/template/actor/parts/actor-features.hbs',
    'systems/rising-steel/template/actor/parts/actor-items.hbs',
    'systems/rising-steel/template/actor/parts/actor-spells.hbs',
    'systems/rising-steel/template/actor/parts/actor-effects.hbs',
    // Item partials
    'systems/rising-steel/template/item/parts/item-effects.hbs',
  ]);
};

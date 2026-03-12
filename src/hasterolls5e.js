Hooks.once("init", () => {
  console.log("Haste Rolls 5e init");
});

Hooks.once("dnd5e.preRollAttackV2", (config, dialog, message) => {
  dialog.configure = false;
});

Hooks.once("dnd5e.preRollAbilityCheckV2", (config, dialog, message) => {
  dialog.configure = false;
});

Hooks.once("dnd5e.preRollSavingThrowV2", (config, dialog, message) => {
  dialog.configure = false;
});

Hooks.once("dnd5e.preRollDamageV2", (config, dialog, message) => {
  dialog.configure = false;
});

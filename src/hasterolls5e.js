Hooks.once("init", () => {
  console.log("Haste Rolls 5e init");

  game.settings.register("hasterolls5e", "skipRollConfig", {
    name: "Skip Roll Configuration Dialogs",
    hint: "Skip the roll configuration dialog when rolling D20 Tests, damage, and healing rolls. Hold Shift to show the dialogs.",
    scope: "client",
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });

  game.settings.register("hasterolls5e", "autoRollDamage", {
    name: "Auto Roll Damage",
    hint: "Automatically trigger the damage roll if the attack roll hits. For players, will only happen if Attack Roll Visibility is enabled.",
    scope: "world",
    config: true,
    requiresReload: false,
    type: Boolean,
    default: false,
  });

  // implement autoRollDamage on system version 5.1.0 or newer with a hook, older versions with libWrapper
  const system51 = foundry.utils.isNewerVersion(game.system.version, "5.0.99");
  if (system51)
    Hooks.on("dnd5e.postRollAttack", autoRollDamage);
  else
    libWrapper.register("hasterolls5e", "dnd5e.documents.activity.AttackActivity.prototype._triggerSubsequentActions",
      triggerSubsequentActions, "OVERRIDE");
});

Hooks.on("dnd5e.preRollD20TestV2", (config, dialog, message) => {
  handleRoll(config, dialog);
});

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  handleRoll(config, dialog);
});

function handleRoll(config, dialog) {
  const skipRollConfig = game.settings.get("hasterolls5e", "skipRollConfig");
  if (skipRollConfig)
    dialog.configure = dnd5e.utils.areKeysPressed(config.event, "skipDialogNormal");
}

function autoRollDamage(rolls, data) {
  // check if Auto Roll Damage is enabled
  const autoRollDamage = game.settings.get("hasterolls5e", "autoRollDamage");
  if (!autoRollDamage) return;
  // check if GM or that Attack Roll Visibility isn't none
  const attackRollVisibility = game.settings.get("dnd5e", "attackRollVisibility");
  if (!game.user.isGM && attackRollVisibility === "none") return;

  if (rolls[0].isSuccess) {
    // get original Activity message
    const attackMessage = rolls[0].parent;
    const messageId = attackMessage.getFlag("dnd5e", "originatingMessage");
    // simulate a click on the Activity message's Damage button
    const activityMessage = document.querySelector(`#chat li[data-message-id="${messageId}"]`);
    activityMessage?.querySelector('button[data-action="rollDamage"]')?.click();
  }
}

async function triggerSubsequentActions(config, results) {
  const rolls = await this.rollAttack({event: config.event}, {}, {data: {"flags.dnd5e.originatingMessage": results.message?.id}});

  // check if Auto Roll Damage is enabled
  const autoRollDamage = game.settings.get("hasterolls5e", "autoRollDamage");
  if (!autoRollDamage) return;
  // check if GM or that Attack Roll Visibility isn't none
  const attackRollVisibility = game.settings.get("dnd5e", "attackRollVisibility");
  if (!game.user.isGM && attackRollVisibility === "none") return;

  if (rolls && rolls[0].isSuccess) {
    const lastAttack = results.message.getAssociatedRolls("attack").pop();
    const attackMode = rolls[0].options.attackMode;

    // fetch the ammunition used with the attack
    let ammunition;
    const actor = this.actor;
    if (actor) {
      const storedData = lastAttack.getFlag("dnd5e", "roll.ammunitionData");
      ammunition = storedData
        ? new Item.implementation(storedData, { parent: actor })
        : actor.items.get(rolls[0].options.ammunition);
    }

    const isCritical = rolls[0].isCritical;
    const dialogConfig = {};
    if ( isCritical ) dialogConfig.options = { defaultButton: "critical" };

    this.rollDamage({ event: config.event, ammunition, attackMode, isCritical }, dialogConfig);
  }
}

Hooks.once("init", () => {
  console.log("Haste Rolls 5e init");

  game.settings.register("hasterolls5e", "skipRollConfig", {
    name: "hasterolls5e.skipRollConfig.name",
    hint: "hasterolls5e.skipRollConfig.hint",
    scope: "client",
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });

  game.settings.register("hasterolls5e", "autoRollDamage", {
    name: "hasterolls5e.autoRollDamage.name",
    hint: "hasterolls5e.autoRollDamage.hint",
    scope: "world",
    config: true,
    requiresReload: false,
    type: Boolean,
    default: false,
  });

  // implement autoRollDamage on system version 5.1.0 or newer with the postRollAttack hook, older versions with the pre/postUseActivity hooks
  const system51 = foundry.utils.isNewerVersion(game.system.version, "5.0.99");
  if (system51)
    Hooks.on("dnd5e.postRollAttack", autoRollDamage);
  else
    Hooks.on("dnd5e.postUseActivity", postUseActivity);
});

Hooks.on("dnd5e.preRollD20TestV2", (config, dialog, message) => {
  handleRoll(config, dialog);
});

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  handleRoll(config, dialog);
});

function handleRoll(config, dialog) {
  // system version 5.1.0 changed the key presses so now shift+alt, for example, forces advantage
  // tweak it so only holding Shift shows the dialog
  const system51 = foundry.utils.isNewerVersion(game.system.version, "5.0.99");
  const skipRollConfig = game.settings.get("hasterolls5e", "skipRollConfig");
  if (system51 && skipRollConfig) {
    const normal = dnd5e.utils.areKeysPressed(config.event, "skipDialogNormal");
    const advantage = dnd5e.utils.areKeysPressed(config.event, "skipDialogAdvantage");
    const disadvantage = dnd5e.utils.areKeysPressed(config.event, "skipDialogDisadvantage");
    dialog.configure = normal && !advantage && !disadvantage;
  } else if (skipRollConfig)
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

function postUseActivity(activity, usageConfig, results) {
  // only handle Attack activities
  if (activity.type !== "attack") return;
  // check if Auto Roll Damage is enabled
  const autoRollDamage = game.settings.get("hasterolls5e", "autoRollDamage");
  if (!autoRollDamage) return;
  // check if GM or that Attack Roll Visibility isn't none
  const attackRollVisibility = game.settings.get("dnd5e", "attackRollVisibility");
  if (!game.user.isGM && attackRollVisibility === "none") return;

  // turn off the system's subsequent actions since we'll trigger the attack here
  usageConfig.subsequentActions = false;

  /* Rolling the attack and damage can be done async, but this hook needs to return immediately so setting
     subsequentActions to false is picked up by the system's code. We'd have a race condition if this function
     was async, so it's split in two. */
  triggerSubsequentActions.call(activity, usageConfig, results);
}

async function triggerSubsequentActions(config, results) {
  const rolls = await this.rollAttack({event: config.event}, {}, {data: {"flags.dnd5e.originatingMessage": results.message?.id}});
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

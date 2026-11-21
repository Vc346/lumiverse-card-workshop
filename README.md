# Card Forge for Lumiverse

A Spindle extension for developing original characters and roleplay scenarios with Murasaki through conversation. Each forge keeps its own conversation, card, writing preset and pending proposals. The backend uses a Lumiverse connection and scopes workshop storage to the signed-in user.

## Install

1. Open the Spindle panel in Lumiverse and paste `https://github.com/Vc346/lumiverse-card-workshop` into the repository installer. Both compiled bundles are included.
2. Install Card Forge, grant its requested permissions, and enable it.
3. Open **Card Forge** in the drawer and tap **New forge** (+). Choose a card or scenario, select a writing preset and connection, then choose **Create forge**.

For subsequent releases, use **Update** in the Spindle panel.

## First forge

Try asking “Give me two ways to differentiate Mara and Ivo’s voices.” Then ask “Use the second option for the card, create a keyword lore entry about Ivo’s secret, and propose an inline tracker that records who knows it.”

Open the **Review** tab, then expand any proposal to compare its current and proposed values. Select the changes you want and choose **Apply selected**. Other proposals stay available for revision or dismissal. Applying the first selection in a new forge creates the library card. To continue later, select the same conversation under **Forges**. Open the resulting card in Lumiverse to start a regular roleplay chat.

## Card and lore overview

Open **Card & lore** to see which card fields and forge prompts are saved, empty, or have pending edits. Expand a row for its full text. The overview loads when you open the forge and updates after applying changes. Use **Refresh from Lumiverse** after editing the card elsewhere.

Expand a linked lorebook to see its entries and activation keywords. To create an entry, ask Murasaki to draft one and name a linked lorebook if you have a specific destination. Approve it in **Review**. If you leave the destination up to Murasaki, it can use a dedicated lorebook that the extension creates and attaches on approval.

## Create or revise a player persona

Ask Murasaki to draft a new persona, expand the proposal in **Review**, and select **Apply** to save it to Lumiverse’s Persona library. **Bind to this card** is selected by default when the card has no binding. For a new card, Forge waits until the card is saved. When there’s an existing binding, select the checkbox to confirm replacing it.

Choose a **Player persona** in Forge settings to give Murasaki context and request changes to its name, tagline, or description. Approved edits update the selected persona in Lumiverse. A card binding lets Lumiverse select the persona when opening the card’s chats. Removing a forge keeps its persona in the library.

## Delete a forge

Use the trash button beside a forge. The default removes its conversation and pending proposals. If the forge created the card and no other forge uses it, you can also choose to remove the card, its Forge tracker rules, and an unshared dedicated lorebook. Lumiverse also removes roleplay chats that use the deleted card as their primary character. Card Forge uses the **Chats** and **Personas** permissions to check for shared lorebooks before offering asset cleanup.

## Use an inline tracker

Ask Murasaki for an inline tracker and a matching display rule. In **Review**, expand the rule to see a sample reply, its collapsible preview, and the regex. Applying saves a native character-scoped rule for AI replies. It formats the tagged tracker block on display and leaves the stored reply intact. Forge can revise its own rule when you ask it to use the same tag. Grant **Regex Scripts** permission in Spindle to apply rules.

Add `{{forgeInlineTracker}}` to a system prompt block **after Chat History** in your Lumiverse preset. The macro inserts the inline tracker saved on the card used for that reply. It expands to empty text for cards with a blank tracker. The roleplay model can then emit the tagged block for the display rule to format. If you already pasted the same instructions into Post-History Instructions, keep one copy so you only send them once.

## Use a card’s summary prompt in Loom

From **Forges**, open **Loom summary prompts**, enable chat switching, and enter generic system and user prompts. Card Forge resolves each field independently, using the active card’s prompt and then the corresponding generic prompt. A blank generic system prompt uses Loom’s built-in default. A blank generic user prompt keeps your original Loom user template. Custom user prompts require `{{conversation}}` and either `{{previousSummaryBlock}}` or `{{existingSummary}}`. Turning syncing off restores both original overrides.

Loom stores one pair of overrides per account. Use this feature with one active roleplay chat at a time. Allow Loom to reload the override after switching chats before manually generating or rebuilding a summary.

## What gets saved

- Card Forge can propose changes to the name, description, personality, scenario, opening message, alternate greetings, example dialogue, creator notes, system prompt and post-history instructions. New scenario cards include a narrator prompt that moves the story forward, including scenes where the player’s persona is alone.
- Card Forge reads directly attached world books. It can create keyword entries and revise entry titles, activation keys and content. If a new entry needs a dedicated book, applying it creates or reuses the card’s forge book and attaches it.
- Card-specific templates live under `character.extensions.voidverse_author` as `inline_tracker`, `summary_prompt`, `summary_user_prompt` and `ledger_prompt`. The summary prompts can be synced into Loom. The inline tracker is available through `{{forgeInlineTracker}}`. The ledger prompt is saved for future continuity integration.
- The selected preset provides enabled blocks in stored order, including their roles and placement. The model receives their authored text, linked lore, card fields, pending edits and forge conversation. Model context limits apply to large presets, books and conversations.
- Each approved change is saved separately. The extension compares the current field with the value used to prepare the proposal. If a later change conflicts, earlier successful changes are recorded and the remaining proposals can be revised or discarded.

## Rebuild

Run these commands from the extension directory after editing the sources. Commit the rebuilt bundles alongside the source to distribute an update.

```sh
bun install --frozen-lockfile
bun build src/backend.ts --target bun --outfile dist/backend.js
bun build src/frontend.ts --target browser --outfile dist/frontend.js
```

Run `bun test` for the fixture-based regression test.

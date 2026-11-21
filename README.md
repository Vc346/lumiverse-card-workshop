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

## Use a card’s summary prompt in Loom

From **Forges**, open **Loom summary prompts**, enable chat switching, and enter a generic prompt. Card Forge uses the active chat’s card prompt when one is saved. Cards with an empty prompt use your generic prompt. An empty generic prompt uses Loom’s built-in default. Turning the feature off in Card Forge restores the override that was set when you enabled it.

Loom stores one override per account. Use this feature with one active roleplay chat at a time. Allow Loom to reload the override after switching chats before manually generating or rebuilding a summary.

## What gets saved

- Card Forge can propose changes to the name, description, personality, scenario, opening message, alternate greetings, example dialogue, creator notes, system prompt and post-history instructions. New scenario cards include a narrator prompt that moves the story forward, including scenes where the player’s persona is alone.
- Card Forge reads directly attached world books. It can create keyword entries and revise entry titles, activation keys and content. If a new entry needs a dedicated book, applying it creates or reuses the card’s forge book and attaches it.
- Card-specific templates live under `character.extensions.voidverse_author` as `inline_tracker`, `summary_prompt` and `ledger_prompt`. The summary prompt can be synced into Loom. The two tracker prompts are saved for future continuity integration.
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

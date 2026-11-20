# Card Workshop for Lumiverse

A Spindle extension for developing characters and ensemble scenarios through conversation. Each workshop keeps its own conversation, card, writing preset and pending proposals. The backend uses a Lumiverse connection and scopes workshop storage to the signed-in user.

## Install

1. Open the Spindle panel in Lumiverse and paste `https://github.com/Vc346/lumiverse-card-workshop` into the repository installer. Both compiled bundles are included.
2. Install Card Workshop, grant its requested permissions, and enable it.
3. Open **Card Workshop** in the drawer, choose a card or scenario, and select a writing preset and connection.

For subsequent releases, use **Update** in the Spindle panel.

## First workshop

Try asking “Give me two ways to differentiate Mara and Ivo’s voices.” Then ask “Use the second option for the card, create a keyword lore entry about Ivo’s secret, and propose an inline tracker that records who knows it.”

Open the **Review** tab, then expand any proposal to compare its current and proposed values. Select the changes you want and choose **Apply selected**. Other proposals stay available for revision or dismissal. Applying the first selection in a new workshop creates the library card. To continue later, select the same conversation under **Workshops**. Open the resulting card in Lumiverse to start a regular roleplay chat.

## Card and lore overview

Open **Card & lore** to see which card fields and workshop prompts are saved, empty, or have pending edits. Expand a row for its full text. The overview loads when you open the workshop and updates after applying changes. Use **Refresh from Lumiverse** after editing the card elsewhere.

Expand a linked lorebook to see its entries and activation keywords. To create an entry, ask the workshop to draft one and name a linked lorebook if you have a specific destination. Approve it in **Review**. If you leave the destination up to the workshop, it can use a dedicated lorebook that the extension creates and attaches on approval.

## What gets saved

- The workshop can propose changes to the name, description, personality, scenario, opening message, alternate greetings, example dialogue, creator notes, system prompt and post-history instructions. New ensemble cards include a narrator instruction that preserves player agency.
- The workshop reads directly attached world books. It can create keyword entries and revise entry titles, activation keys and content. If a new entry needs a dedicated book, applying it creates or reuses the card’s workshop book and attaches it.
- Card-specific templates live under `character.extensions.voidverse_author` as `inline_tracker`, `summary_prompt` and `ledger_prompt`. These are authoring outputs for the planned continuity integration.
- The selected preset provides enabled blocks in stored order, including their roles and placement. The model receives their authored text, linked lore, card fields, pending edits and workshop conversation. Model context limits apply to large presets, books and conversations.
- Each approved change is saved separately. The extension compares the current field with the value used to prepare the proposal. If a later change conflicts, earlier successful changes are recorded and the remaining proposals can be revised or discarded.

## Rebuild

Run these commands from the extension directory after editing the sources. Commit the rebuilt bundles alongside the source to distribute an update.

```sh
bun build src/backend.ts --target bun --outfile dist/backend.js
bun build src/frontend.ts --target browser --outfile dist/frontend.js
```

Run `bun test` for the fixture-based regression test.

import { request } from "./lumiverse-api";

const path = "settings/characterPersonaBindings";

function bindingId(binding) {
  if (typeof binding === "string") return binding;
  return binding?.personaId ?? null;
}

async function readBindings(api) {
  return (await api(path))?.value ?? {};
}

export async function readPersonaBinding(cardId, api = request) {
  return cardId ? bindingId((await readBindings(api))[cardId]) : null;
}

export async function bindPersona(cardId, personaId, expectedPersonaId, api = request) {
  const bindings = await readBindings(api);
  const current = bindingId(bindings[cardId]);
  if (current === personaId) return;
  if (current !== expectedPersonaId) throw new Error("The card’s persona binding changed in Lumiverse.");
  await api(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: { ...bindings, [cardId]: personaId } }),
  });
}

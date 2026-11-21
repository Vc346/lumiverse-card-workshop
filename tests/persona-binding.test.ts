import { expect, test } from "bun:test";
import { bindPersona, readPersonaBinding } from "../src/persona-binding";

test("updates the native binding without overwriting unrelated or newly changed bindings", async () => {
  const original = { personaId: "before", addonStates: { tone: true } };
  let value = { card: original, other: { personaId: "elsewhere", addonStates: { brevity: false } } };
  let writes = 0;
  const api = async (_, options) => {
    if (options?.method === "PUT") {
      writes++;
      value = JSON.parse(options.body).value;
    }
    return { value };
  };
  expect(await readPersonaBinding("card", api)).toBe("before");
  expect(await readPersonaBinding("missing", api)).toBeNull();
  await expect(bindPersona("card", "new", null, api)).rejects.toThrow("binding changed");
  expect(value.card).toEqual(original);
  await bindPersona("card", "before", "before", api);
  expect(writes).toBe(0);
  await bindPersona("card", "new", "before", api);
  expect(value).toEqual({ card: "new", other: { personaId: "elsewhere", addonStates: { brevity: false } } });
  await bindPersona("card", "new", "before", api);
  expect(writes).toBe(1);
});

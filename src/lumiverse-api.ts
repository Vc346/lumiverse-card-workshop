export async function request(path, options = {}) {
  const response = await fetch("/api/v1/" + path, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    ...options,
  });
  if (response.status === 404 && !options.method) return null;
  if (!response.ok) throw new Error("Lumiverse request failed (" + response.status + ").");
  return response.json();
}

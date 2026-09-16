export function consumeSseFrames(buffer: string): { events: Array<Record<string, unknown>>; rest: string } {
  const events: Array<Record<string, unknown>> = [];
  let rest = buffer;
  while (true) {
    const boundary = rest.indexOf("\n\n");
    if (boundary === -1) break;
    const frame = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    const line = frame.split("\n").find((item) => item.startsWith("data:"));
    if (!line) continue;
    const payload = line.replace(/^data:\s?/, "").trim();
    if (!payload) continue;
    try {
      events.push(JSON.parse(payload) as Record<string, unknown>);
    } catch {
      /* A complete frame that is not JSON is ignored; incomplete frames stay in rest. */
    }
  }
  return { events, rest };
}

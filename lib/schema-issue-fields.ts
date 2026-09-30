// T-058: where a model answer failed its schema, for the server log: each issue's path (keys and
// array indices) and zod's issue code, never a value. A path segment that is not a plain key or an
// index (a key the model made up) is written as "?", and an unexpected code as "other".
export function schemaIssueFields(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; code: string }>, limit = 6): string[] {
  return issues.slice(0, limit).map((issue) => {
    const path = issue.path
      .map((part) => (typeof part === "number" ? String(part) : typeof part === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(part) ? part : "?"))
      .join(".") || "root";
    return `${path}:${/^[a-z_]{1,40}$/.test(issue.code) ? issue.code : "other"}`;
  });
}

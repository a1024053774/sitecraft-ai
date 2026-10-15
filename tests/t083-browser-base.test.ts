import test from "node:test";
import { checkTestIdentity } from "../scripts/test-identity.ts";

test("browser base serves the current workspace", async () => {
  await checkTestIdentity();
});

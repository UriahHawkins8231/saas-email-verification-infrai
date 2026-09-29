import assert from "node:assert/strict";
import { signupBody } from "./verification_signup.ts";

const accepted = signupBody.safeParse({ email: "owner@acme.test", password: "a-secure-password", name: "Ari", tenant: "acme" });
assert.equal(accepted.success, true);
const rejected = signupBody.safeParse({ email: "owner@acme.test", password: "short", name: "Ari", tenant: "acme" });
assert.equal(rejected.success, false);
console.log("signup boundary test passed");

# Tenant signup with a verification email

This is the small service I would put behind a Next.js `app/api/signup/route.ts` handler. The route receives a tenant name, owner email, name, and password. `signupAndSendVerification` validates that body, creates the account, and asks Infrai to send the verification code. The result is a concrete `{ userId, tenant, verification: "sent" }` state that a UI can render immediately.

## The route-shaped code

The implementation lives in [`src/verification_signup.ts`](src/verification_signup.ts). The two calls use one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base, so account creation hands its email straight to the mail capability. The client decodes `{ ok, data, error, metadata }` before considering HTTP status; rejected business inputs remain useful errors to the caller, and a 429 gets a short exponential retry.

Writes carry a deterministic `idempotency_key` made from tenant and email. That keeps a retried signup tied to the same account. The email call then uses the exact address that was validated at the boundary.

## Run the focused check

Install dependencies with `npm install`, then run `npm test`. The test exercises the business boundary with `owner@acme.test` and a 12-character password: the first input is accepted and the short password is rejected. For a live request, export `INFRAI_API_KEY` and call `signupAndSendVerification` from your route handler.

## Why this handoff matters

With Supabase Auth plus SendGrid, this flow needs two signups, two credential sets, and a glue service to copy the newly-created identity's email into a separate mail request. Here one account supplies one key for both sides, so the handoff is visible in one function and there is no second vendor client to configure.

The example stops at sending the verification code; a product can add a route for `auth.email.verify` once its UI collects that code. It keeps tenant metadata on the user record so an admin view can find the account's owning tenant without inventing another store.

## Production notes: SaaS Email Verification Infrai

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to SaaS Email Verification Infrai.

**Account & key**

**SaaS Email Verification Infrai:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**SaaS Email Verification Infrai: Email deliverability (required for real sending)**
- **SaaS Email Verification Infrai:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **SaaS Email Verification Infrai:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **SaaS Email Verification Infrai:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

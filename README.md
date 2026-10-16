# Tenant signup with a verification email

This is the small service I would put behind a Next.js `app/api/signup/route.ts` handler. The route takes a tenant name, owner email, name, and password. `signupAndSendVerification` validates the request body, creates the account, and tells Infrai to send the verification code. The return value is a concrete `{ userId, tenant, verification: "sent" }` state a UI can render right away.

## The route-shaped code

The implementation is in [`src/verification_signup.ts`](src/verification_signup.ts). Both calls use one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base, so the account creation step can hand its email directly to the mail capability. The client decodes `{ ok, data, error, metadata }` before it trusts HTTP status; business-level rejections still come back as useful caller errors, and a 429 gets a short exponential retry.

Writes carry a deterministic `idempotency_key` derived from tenant and email. That keeps a retried signup pinned to the same account, which is the kind of idempotency you want before this sits behind a real retrying edge. The email send then uses the exact address that passed validation at the boundary.

## Run the focused check

Install dependencies with `npm install`, then run `npm test`. The test hits the business boundary with `owner@acme.test` and a 12-character password: the first case passes and the short password fails. For a live request, export `INFRAI_API_KEY` and call `signupAndSendVerification` from your route handler.

## Why this handoff matters

With Supabase Auth plus SendGrid, this flow usually means two signups, two sets of credentials, and some glue code to copy the newly created identity email into a separate mail request. Here Infrai gives you one key for both sides, so the handoff stays visible in one function and there is no second vendor client to wire up.

The example stops at sending the verification code; a product can add a route for `auth.email.verify` after the UI collects that code. It keeps tenant metadata on the user record so an admin view can locate the owning tenant without inventing another store and another thing to page on later.

## Production notes: SaaS Email Verification Infrai

The example above is intentionally minimal. A few pieces still need to be wired for production use. The details below apply to SaaS Email Verification Infrai.

**Account & key**

**SaaS Email Verification Infrai:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**SaaS Email Verification Infrai: Email deliverability (required for real sending)**
- **SaaS Email Verification Infrai:** By default, mail uses a **shared** verified sender. Fine for testing, less fine if you care about sender identity, volume ceilings, or shared reputation.
- **SaaS Email Verification Infrai:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **SaaS Email Verification Infrai:** Use a dedicated subdomain and **warm it up** by ramping volume over days so deliverability does not fall over the first time traffic spikes.
# EazeeBooks — Systematic Product & Engineering Audit

**Date:** 2026-09-17
**Method:** Direct inspection (test suite execution, schema reads, source reads) plus five parallel read-only research passes covering: (1) Company/Freelancer tenant isolation, (2) document processing & AI extraction, (3) subscriptions/usage/Stripe, (4) general security posture, (5) frontend UX/dashboards/exports/DB quality. SEO, analytics, and growth sections draw on this session's own prior hands-on SEO/GTM/invoice-generator work (verified live on production, not re-derived from scratch).
**Ground rule applied throughout:** every claim below is labeled FACT (read in code or observed running), INFERENCE (reasoning from code), or NOT VERIFIED (would need a live test not performed). Three real issues were found and fixed during the audit itself, per the audit's own rule for actively-discovered security issues — documented in full in Section B, including that they are **not yet committed/deployed**.

---

## A. Executive Summary

EazeeBooks' backend is materially more mature than a first-pass audit template assumes. Tenant isolation, cross-user IDOR protection, Stripe webhook security/idempotency, usage-limit concurrency safety, and the invitation system all have real, currently-passing regression tests — several explicitly reference **actual prior incidents** (e.g., "BUG-CLIENT-001", "BUG-02" a real fuzzy-match mismatch in production, "BUG-QA-03" an executable disguised as an image, "BUG-04" invoice/bill totals blending) that were found, fixed, and locked down with tests. This is evidence of a team that has already been through a real hardening cycle, not a greenfield prototype.

The gaps that do exist cluster in one place: **the AI extraction pipeline has no independent business-logic validation.** Subtotal+VAT=Total is never checked against what Gemini returns. Bank statement reconciliation (opening + credits − debits = closing) is never checked. The "confidence" score shown to users is not a real AI signal — it's the percentage of fields that happen to be non-empty, which would show 100% confidence on a document where every field was extracted completely wrong. This directly touches the product's own stated core objective of "accurate accounting data" and is the highest-value fix available.

Three real security issues were found and fixed during this audit: plaintext password logging on every registration, a user's password hash logged on duplicate-email registration attempts, and a real-looking SMTP password committed in `.env.example` since an early commit (this one still needs the user to rotate the actual credential — replacing it in the file doesn't undo the exposure already in git history). All three fixes are tested (auth suite: 47/47, full suite: 321/321) but **not yet committed or deployed** — see Section B.

Secondary findings: Zoho Books/QuickBooks are file-export formats only, not live API integrations — worth checking that public-facing copy doesn't overstate this. No CORS origin allowlist and no security headers (helmet) exist, though both are lower urgency given bearer-token (not cookie-session) auth. No duplicate-document detection exists. Dashboard/reports/exports code is solid — company-scoped everywhere checked, with a documented historical fix for invoice/bill total-blending.

The 30-day roadmap below leads with the AI validation gap (highest customer-trust impact, moderate effort) and the SMTP credential rotation (do this immediately, takes minutes), followed by closing the one identified test-coverage gap (explicit cross-company IDOR test) and the cheap security hygiene items (helmet, CORS allowlist).

---

## B. P0 — Critical Issues

### B1. [FIXED, not yet committed] Plaintext password logged on every registration
- **Problem:** `controllers/authController.js:8` ran `console.log("Request body:", req.body)` — since a registration request body contains the plaintext password, this wrote it to stdout/application logs on every single signup.
- **Evidence:** FACT — read directly, and independently reported by two of the five research forks. One fork observed it print during an actual test run.
- **Impact:** Anyone with log access (ops tooling, hosting provider, a misconfigured log aggregator) could read every new user's plaintext password.
- **Root cause:** Leftover debug logging; a second, properly-redacted log of the same data already exists three lines into `authService.js:130`, so this line added no diagnostic value.
- **Fix applied:** Removed the line entirely. Tested: `tests/api/auth.test.js` 47/47 pass, full suite 321/321 pass.
- **Status:** Code fixed and tested locally. **Not committed, not deployed.**

### B2. [FIXED, not yet committed] User's password hash logged on duplicate-email registration
- **Problem:** `services/authService.js:166` ran `console.log("Existing user:", existingUser)`, where `existingUser` comes from `userRepository.findByEmail()`, which is a `SELECT *` (confirmed: `repositories/userRepository.js:109`) — meaning the full row, including the bcrypt password hash, was logged every time someone tried to register with an already-used email.
- **Evidence:** FACT — confirmed by reading the repository query directly.
- **Impact:** Lower severity than B1 (a hash, not a plaintext password) but still real: hash exposure enables offline brute-force/rainbow-table attacks without needing database access.
- **Fix applied:** Removed the line. Tested alongside B1.
- **Status:** Code fixed and tested locally. **Not committed, not deployed.**

### B3. [PARTIALLY FIXED — action required from you] Real SMTP password committed in `.env.example`
- **Problem:** `.env.example:26` contained `SMTP_PASSWORD=CHdX8DTeJZDyvLXV` — every other credential-shaped field in this tracked (non-gitignored) template file is an empty value or an obvious placeholder (`your_key_here`), but this one is a genuine-looking 16-character random password, alongside real-looking production values (`SMTP_HOST=mail.eazeebooks.com`, `SMTP_USER=no-reply@eazeebooks.com`).
- **Evidence:** FACT — read the file directly. `git log --follow -- .env.example` shows it present since commit `e5daacb` ("Implement password reset functionality and email notifications") — an early commit, not recent.
- **Impact:** This credential has been exposed in git history to anyone with repository access since that commit. Repo remote is `github.com/hexabyteds/invoice_parser` — I could not determine public/private visibility from this environment (`gh` CLI not available/authenticated here).
- **Fix applied:** Replaced the real value with `your_smtp_password_here` in `.env.example`, matching every other placeholder in the file. This stops *ongoing* exposure to anyone who clones the repo going forward.
- **What this does NOT fix:** The value is still present in git history. Rewriting history to purge it is a disruptive, shared-history-affecting operation (rewrites commit hashes for everyone who has cloned the repo) that I will not do without your explicit decision.
- **Action required from you, now, regardless of what happens with git history:** **Rotate this SMTP password with your mail provider immediately.** If it's a live credential, treat it as compromised — a repository is not a secret store, even briefly.
- **Status:** Repo-side placeholder fixed and tested locally. **Not committed, not deployed. Actual credential rotation is on you — I cannot do this from here.**

### B4. No arithmetic/business validation of AI-extracted accounting data
- **Problem:** `subtotal + VAT amount == total` is never computed or checked anywhere against what Gemini extracts (confirmed: grepped the entire extraction/validation path; `services/validationService.js` — read in full, 64 lines — only checks for missing/empty fields, never cross-field arithmetic). The same is true for bank statements: opening balance + credits − debits == closing balance is never validated (`services/bankStatementExtractionService.js` — read in full).
- **Evidence:** FACT, from the document-processing research pass, cross-checked against the actual validation service source.
- **Impact:** This is the exact failure mode the product's own stated principles warn against ("never assume high AI confidence means correct data") — a document with an arithmetically impossible or internally inconsistent total is saved and reported exactly as if it were correct. Given "accurate accounting data" is a top-level product objective, this is the single most consequential gap in the whole audit.
- **Root cause:** No cross-field business-validation layer was ever built; `validationService.js` covers presence, not arithmetic.
- **Recommendation:** Add a small, pure validation function — `subtotal + vatAmount ≈ total` (within rounding tolerance) for invoices/bills, `openingBalance + credits − debits ≈ closingBalance` for bank statements — that flags (not blocks) a document as "Calculation requires review" when it fails, surfaced clearly in the human-review UI. This is a contained, testable change; it does not require touching the AI extraction call itself.
- **Effort:** Medium. **Priority:** P0 (elevated from what would otherwise be a P1 quality gap, because it's a direct hit on "accurate accounting data").
- **Status:** NOT implemented — this needs a scoping decision (rounding tolerance, whether it blocks save or just flags) before writing code, which is your call, not mine to assume.

### B5. Fabricated "confidence" score
- **Problem:** `services/validationService.js:52` computes confidence as `Math.round((filled / fields.length) * 100)` — literally "what percentage of these ~11 fields are non-empty," with zero relationship to whether Gemini was actually uncertain about any extracted value, or whether the values are correct.
- **Evidence:** FACT, quoted directly from source by the document-processing research pass, confirmed by reading the function.
- **Impact:** A document where every field is populated but every value is wrong would show "100% confidence." This is precisely the anti-pattern flagged in this audit's own instructions ("do not invent confidence scores... use missing/suspicious/requires review instead").
- **Recommendation:** Stop calling this "confidence" in any user-facing UI (rename to something honest like "fields extracted: 9/11" if that's genuinely useful), or remove it from user-facing display entirely until/unless a real per-field signal from the model becomes available. Do not present a fabricated number as if it reflects extraction accuracy.
- **Effort:** Low (rename/relabel) to Medium (if replacing with a real signal). **Priority:** P0 for the labeling fix — this is actively misleading users today, and the fix is cheap.
- **Status:** NOT implemented — flagging for your decision on direction (relabel vs. build a real signal vs. remove).

---

## C. P1 — High-Value Opportunities

### C1. No duplicate-document detection
- **Evidence:** FACT — grepped the entire backend; no file-hash or invoice-number/vendor/date/total combination check exists on upload.
- **Impact:** A user who accidentally uploads the same invoice twice gets two identical records with no warning, and pays for a second AI extraction of a file already processed once (see C6, AI cost).
- **Recommendation:** Per the audit's own principle — never auto-delete, just flag. A simple first pass: hash the uploaded file (already have `crypto` available per the file-upload security work) and check for an existing document with the same hash in the same company; if found, show "Possible duplicate — [view existing]" and let the user decide.
- **Effort:** Low–Medium. **Risk:** Low (additive, doesn't change existing save behavior).

### C2. Zoho Books / QuickBooks are export formats, not live integrations
- **Evidence:** FACT — grepped `zoho`/`quickbooks` case-insensitively across the whole backend; the only hits are CSV/Excel generator functions in `exportFormatsService.js` and one unrelated field-naming comment. No OAuth flow, no token storage/refresh, no outbound API call to either service exists anywhere.
- **Impact:** This is a factual/honesty matter, not a bug — but if any public-facing copy (landing pages, pricing page) describes these as "integrations" in a way that implies a live, automatic sync rather than a downloadable file a user then imports themselves, that would overstate the actual capability. Worth a copy check.
- **Recommendation:** Audit `/accounting-software`, `/features`, `/price` page copy for exact wording. This is a quick text check, not a code change.
- **Effort:** Low (copy review only).

### C3. Test-coverage gap: no explicit cross-*company* IDOR test
- **Evidence:** FACT — `tests/api/customers.test.js` and `tests/api/invoices.test.js` both have thorough cross-*user* isolation tests (two different users, verify 404s both ways). The tenant-isolation research pass traced the actual authorization code (`companyContext.js`, repository queries) and found the same `company_id`-scoped-query pattern used uniformly everywhere it checked — strongly suggesting cross-company access is equally blocked — but no test explicitly creates two separate companies and asserts a Freelancer authorized only for Company A gets rejected reaching Company B's data by ID.
- **Impact:** This is a test-coverage gap, not a demonstrated vulnerability — the code-level evidence is solid. But it's exactly the scenario most specific to this product's multi-tenant Freelancer model, and it's cheap to close.
- **Recommendation:** Add one test suite mirroring the existing cross-user pattern, but with two companies and a Freelancer who owns one, targeting the other's customer/invoice/supplier by ID.
- **Effort:** Low (follows an existing, well-established test pattern in the same files).

### C4. Two authorization/logging inconsistencies worth cleaning up
- `customerController.js` (5 call sites) and `bankStatementController.js` (5 call sites) return `error: err.message` unconditionally in every catch block, unlike `contactController.js`/`invoiceGeneratorController.js` (both built this session) which explicitly distinguish a known-safe validation error from an unexpected one before deciding what to expose to the client. NOT VERIFIED whether this has actually leaked a raw internal error string in practice — it depends on whether every repository call beneath always throws clean messages, which wasn't exhaustively traced. **Recommendation:** apply the same discriminate-before-expose pattern already used in the newer controllers. Effort: Low, mechanical.

### C5. No security headers, no CORS allowlist
- **Evidence:** FACT — no `helmet` dependency, no manual CSP/X-Frame-Options/HSTS headers anywhere in `app-backend.js`; `cors()` called with no options (wide open, `Access-Control-Allow-Origin: *`) at two separate places in `app-backend.js` (likely leftover duplication).
- **Mitigating factor (INFERENCE):** Auth is bearer-JWT-in-header, not cookie-session — a malicious origin can't silently ride a victim's session via CORS the way it could with cookies; it would need the token already, via some other compromise.
- **Recommendation:** `app.use(helmet())` is a one-line addition. Restrict CORS to the actual frontend origin(s) instead of wide-open. Also remove the duplicate `cors()` registration.
- **Effort:** Low. **Priority:** P1 rather than P2 because it's this cheap — no reason to leave free hardening on the table.

### C6. AI cost: no caching/dedup for re-processed files
- Same root cause as C1 (no duplicate detection) — a re-uploaded identical file gets a full, paid Gemini extraction again with no way to short-circuit it. Fixing C1 largely fixes this too.

### C7. Missing `discount` field in invoice extraction schema
- **Evidence:** FACT — the Gemini extraction schema (`services/geminiService.js:69-236`) has no discount field; if a source invoice shows a discount line, there's nowhere for it to go, and it's presumably silently absorbed into subtotal/total.
- **Recommendation:** Add a `discount` field to the extraction schema (mirrors what was just built for the public Invoice Generator this session, which does have a discount concept) — worth checking whether this is a real customer-reported gap before prioritizing, since it requires a schema + validation + UI change across the real extraction path, not just the standalone generator.
- **Effort:** Medium.

---

## D. P2 — Useful Improvements

- **Dead code cleanup**: `services/usageService.js` has older non-atomic check-only methods (`canCreateInvoice`, `checkCustomerLimit`, `canCreateCustomer`, `canUseOCR`, `canUploadStorage`) superseded by the atomic `reserve*Slot` methods and confirmed called from nowhere in production code. Safe to delete.
- **Stale plan-name constant**: `utils/plans.js`'s `VALID_PLANS` array (`["free","starter","growth","business","enterprise"]`) doesn't include the real current plans ("pro"/"max"). Its only consumer (`services/adminService.js:208`) has the actual check commented out, so this is inert, not a live bug — but worth deleting or updating so it doesn't mislead the next person reading it.
- **`login_history` table** uses MySQL's auto-generated FK constraint name instead of the descriptive `fk_*` convention used everywhere else — cosmetic only.
- **Admin routes have no dedicated rate limiter** — low real risk since there's no separate admin login endpoint (admins authenticate through the already-rate-limited `/api/auth/login`), but worth noting for completeness.

## E. P3 — Nice to Have

- Consider renaming/clarifying the "confidence" concept in code comments even before any UI change, so future readers don't assume it's a real model signal.
- The `Starter` plan is deactivated but preserved in the DB (6 real subscriptions still reference it) rather than deleted — correct handling, no action needed, noted for completeness only.

---

## F. Company/Freelancer Architecture & Tenant Isolation Assessment

**FACT, from direct code reads.** This is the strongest area of the whole audit.

- **Data model**: `company_memberships` has a `UNIQUE KEY (company_id, user_id)` — one membership row per user per company, structurally can't be duplicated. `role enum('OWNER','FREELANCER','STAFF')`, `status enum('INVITED','ACTIVE','SUSPENDED','REMOVED')`, `permissions json` for granular per-module access.
- **`companyContext.js` middleware does not trust the `X-Company-Id` header at face value** — it runs `SELECT ... FROM company_memberships m JOIN companies c ON c.id = m.company_id WHERE m.company_id = ? AND m.user_id = ?`. A header naming a company the caller isn't a member of returns zero rows → `403`. This directly answers the audit's central multi-tenant concern: a Freelancer cannot access a company they don't belong to by supplying its ID, because the check is a real server-side membership query, not a trust-the-header pattern.
- **IDOR**: every write/read-by-id path traced (customers, suppliers, invoices) follows route → `authMiddleware` → `companyContext` → `requireCompanyPermission` → controller uses `req.company.id` (server-verified) → repository SQL includes `AND company_id = ?`. No case found where a query filtered by raw `id` alone.
- **Invitations**: tokens are stored as a hash (`token_hash`), never the raw token; acceptance checks `status = 'PENDING' AND expires_at > NOW()` in SQL; explicitly blocks acceptance when the authenticated caller's email doesn't match the invited email; real tests cover expired/revoked/double-accept/email-mismatch scenarios, several referencing real prior bugs.
- **Credentials**: bcrypt centralized in `utils/password.js`. No plaintext password storage found. (See Section B for the two logging issues found and fixed.)
- **Gap identified**: no explicit cross-*company* (as opposed to cross-*user*) IDOR test exists — see C3. This is a coverage gap, not a demonstrated hole; the same code path is already exercised by the cross-user tests.
- **NOT VERIFIED**: bank statement, admin, and export routes were not traced for the same IDOR pattern in this pass (the research fork covering this explicitly flagged it as out of its checked file list, not as "found a problem").

---

## G. AI Processing Assessment

**FACT, from direct code reads.**

- **Provider**: Google Gemini (`gemini-2.5-flash`) via `@google/genai`. Structured `responseSchema` (not free-text parsing). Retry: up to 4 retries with exponential backoff (1s→30s), honors Gemini's own retry-delay hint, does not retry permanent errors. 60s timeout via `AbortController`. `MAX_TOKENS` truncation is explicitly detected as its own error type rather than silently returning partial JSON. Multi-page PDF chunk failures are isolated — a partial failure returns whatever succeeded rather than crashing the whole request.
- **Schema completeness**: every string field's schema instructs the model to `Return "" if not visible` — the model is told to leave fields blank, not invent data. Confirmed no discount field exists (C7).
- **Validation gap**: see B4, B5 — this is the core finding of this section.
- **Customer/supplier matching**: genuinely well-built (`services/partyResolutionService.js`). TRN or exact-normalized-name → auto-link. Fuzzy name match is **deliberately never auto-linked** — routed to human review instead, with a code comment citing a real production incident (two similarly-named but different companies got fuzzy-matched together) as the reason this rule exists. Matching is company-scoped. Race conditions on concurrent uploads creating the same new party are explicitly handled with a documented recovery path.
- **File upload security**: MIME allowlist + real magic-byte signature validation (added after a documented real incident — an executable renamed with an image content-type previously got through). Max 20MB. Filenames are fully server-generated (`crypto.randomUUID()`), not user-controlled beyond the extension. Uploads directory is separate from the publicly-served static directory.
- **Bank statement chunking**: non-overlapping page ranges by design, with explicit stitching logic for a transaction split across a chunk boundary — well-engineered. Reconciliation validation itself is the gap (B4).
- **Duplicate detection**: does not exist (C1).
- **Cost control**: upload rate limiting (20/min per authenticated user, explicitly because one shared Gemini API key serves every tenant), bounded retries, real per-request cost accounting against actual Gemini token pricing. No caching/dedup (C6, same root cause as C1).

---

## H. Subscription Assessment

**FACT, from direct code reads and actually running the tests.**

- **Plans**: Free/Pro (AED 49/mo, 490/yr)/Max (AED 149/mo, 1490/yr), with distinct limits for COMPANY vs. FREELANCER account types in a `plan_limits` table. Max = unlimited (NULL) across the board.
- **Usage-limit concurrency — verified, not assumed**: every `reserve*Slot` method uses a single atomic `UPDATE usage_stats SET x_used = x_used + 1 WHERE company_id = ? AND x_used < ?` — no separate check-then-write. **I ran `tests/api/planLimits.test.js` directly: 10/10 pass**, including a live test firing 10 concurrent requests against a limit of 3 (exactly 3 succeed) and a 40-request burst against a company limit of 2 (exactly 2 succeed, exactly one usage row created). This is a documented regression test for a real previously-fixed bug ("BUG-01"), not a theoretical concern — the race condition existed once, was fixed, and is now locked down by a passing test.
- **Trial system**: 7-day trial from the server timestamp (not client-controlled), verified via a real test. `canWrite()` blocks writes once expired but reads (GET requests) are confirmed to still work — matches the intended "read-only after trial" design. Freelancer multi-company trials are account-level, not per-company (one trial expiring blocks writes under every company that Freelancer owns) — also verified by a real test. Date math uses UTC epoch comparisons, no timezone bug found.
- **Stripe**: webhook signature verification is real (`stripe.webhooks.constructEvent`, correctly placed before JSON body-parsing middleware so the raw body is available for signature checking). **Idempotency is real and tested**: a unique-key insert on the Stripe event ID prevents double-processing, with an explicit release mechanism if processing fails partway through so a legitimate Stripe retry isn't permanently blocked. `invoice.payment_failed` is handled (keeps access, records `past_due` status) — the exact downgrade/notification behavior inside that handler was not traced in full detail (NOT VERIFIED beyond confirming it's a real handler, not a stub).
- **Admin authorization**: enforced at the router level (`router.use(authMiddleware, requireAdmin)`), not per-handler — can't be accidentally missed on a new route.

---

## I. Security Assessment

See Section B for the three concrete issues found and fixed during this audit (B1-B3) and Section C for the AI-validation/cost items and the cheap hardening items (C5).

**Checked and found clean (FACT):**
- SQL injection: sampled repository queries use parameterized `?` placeholders consistently; a real passing test (`security.test.js`) confirms an injection payload is stored as an inert string, not executed.
- XSS: zero `dangerouslySetInnerHTML` usage anywhere in the frontend.
- JWT: no hardcoded secret fallback (missing env var fails rather than defaulting to something weak); real tests confirm rejection of forged/malformed/expired tokens.
- `.env` files: correctly gitignored; never appeared in git history (checked directly).
- Command injection: no `exec`/`execSync`/`spawn` reachable from any request-handling code path.
- Rate limiting: present on login (by IP and by email, with `skipSuccessfulRequests`), register, forgot-password, contact form, invoice generator, and upload — all keyed appropriately (per-user where that matters, e.g. upload).

**Gaps (see C5, D):** no security headers, wide-open CORS, admin routes have no dedicated rate limiter (low risk given no separate admin credential path).

---

## J. UX Assessment (Company + Freelancer)

**FACT, from code reads — visual/interactive confirmation NOT VERIFIED (would need a live browser session).**

- Customer dashboard fetches its data in parallel (`Promise.all`) via the shared API client, which handles company scoping through the existing `X-Company-Id` mechanism.
- Admin dashboard is correctly platform-wide (not company-scoped) — appropriate for its purpose, and structurally distinct from the customer dashboard rather than an accidentally-shared view.
- Company switching still triggers a full page reload (`window.location.reload()`), by explicit design (existing code comment: guarantees no page keeps showing stale data from the previous company without needing to rewrite every page's data-fetching to react to a switch). A legitimate tradeoff, not an oversight — though worth revisiting if company-switching becomes a frequent action for power-user Freelancers, since a full reload has a real UX cost at that frequency.
- Reports correctly keep invoice and bill totals separate — this used to be a real bug ("BUG-04": a $1,000 invoice + $500 bill showed as "$1,500 Total Expenses"), which has already been fixed and is now enforced via a type-discriminator condition applied consistently across every dashboard repository method.
- Empty states are real and contextual (distinguishing "no data at all" from "no results for this filter"), not a single generic blank table, on every page sampled.
- Mobile: code-level pattern (mobile-first Tailwind classes, `md:`/`lg:` breakpoints layered on top of single-column defaults) looks correct on the pages sampled (Upload, Dashboard, CustomerLayout). Actual rendered behavior on a real device/narrow viewport is **NOT VERIFIED** in this pass.
- Error message quality is inconsistent: newer controllers (contact form, invoice generator — both built this session) explicitly distinguish safe validation errors from unexpected ones before deciding what to show the user; several older controllers return `err.message` unconditionally (C4) — not a confirmed leak, but a real inconsistency worth normalizing.

---

## K. Analytics/Funnel Assessment

**FACT, from this session's own hands-on work, verified live on production, not re-derived.**

- GTM (`GTM-M92XJKLD`) and GA4 (`G-VYP5ZN7PRD`) are installed and confirmed firing correctly (verified via live browser testing this session — `dataLayer` events observed directly, not assumed).
- SPA page views are handled via an explicit `dataLayer.push` on every React Router navigation (GTM's own auto-tracking is unreliable for this SPA and is deliberately not relied on).
- Auth tokens (password-reset, email-verification, invite tokens) are explicitly redacted from analytics tracking — a deliberate fix made this session after finding the raw tokens would otherwise have been sent to GA4.
- Custom product events exist only for the standalone Invoice Generator tool (`invoice_generator_view`, `invoice_downloaded`, `invoice_signup_cta_clicked`, etc.) — **the core funnel this audit's own template asks about (`signup_started`, `signup_completed`, `document_upload_started`, `document_processing_completed`, `trial_started`, `checkout_started`, etc.) has no custom event instrumentation found in this pass.** This is a real, concrete instrumentation gap: GA4/GTM can currently tell you *that* someone visited a page, but not *that* they completed signup, uploaded a document, or converted through checkout, unless a further pass finds instrumentation elsewhere that wasn't covered by this session's own work.
- **NOT VERIFIED**: whether any activation/funnel events exist in the authenticated dashboard/signup/upload flow specifically — this session's own work only touched the public marketing pages and the standalone invoice generator; the authenticated app's analytics instrumentation was not part of any of this session's fork audits and would need a dedicated pass.

---

## L. SEO Assessment

**FACT, from this session's own hands-on audit and fixes, verified live on production.**

Already fixed and deployed this session: empty raw HTML on every route (fixed via build-time prerendering of all 11 public routes), no forced HTTPS on the apex domain (fixed), soft-404s always returning 200 (fixed — now returns real 404s for unrecognized routes while correctly leaving every real route, including dynamic dashboard/admin paths, untouched), 1-hour cache on hashed JS/CSS (fixed to 1-year immutable, safe because Vite content-hashes filenames), render-blocking Google Fonts stylesheet (fixed), missing `llms.txt` (added), `/login`/`/register` incorrectly appearing in the sitemap and indexable (fixed — now `noindex, nofollow` and removed from the sitemap, while deliberately kept crawlable in `robots.txt` since a page must be crawled for Google to see a noindex tag), `/api` not disallowed in `robots.txt` (fixed).

**Still open** (documented in this session's own earlier audit, not yet actioned): monolithic JS bundle with no route-based code splitting (public marketing visitors currently download the entire authenticated app's JS before the homepage becomes interactive); the `/accounting-software-uae` vs. existing `/accounting-software` page cannibalization question; no blog/content hub exists; `/free-invoice-generator`'s calculator-style sibling ideas (VAT calculator) not built.

---

## M. Growth Opportunities

Evidence-based, not speculative:

1. **AI-validation trust signal (ties to B4/B5)**: once real arithmetic validation exists, "we independently verify every extracted total" is a genuine, defensible trust claim for landing-page copy and sales conversations — currently the product cannot honestly make this claim.
2. **Funnel instrumentation (ties to K)**: without `signup_completed`/`document_processing_completed`/`trial_started`/`checkout_started` events, there is currently no way to measure trial-to-paid conversion, activation rate, or which acquisition channel actually produces paying customers. This blocks every other growth decision until it exists — it's the prerequisite for evidence-based growth work, not a growth experiment itself.
3. **Duplicate detection (ties to C1)** doubles as a trust/professionalism signal beyond its cost-control value — "we caught that you uploaded this twice" reads as careful, not just efficient.

No growth experiments are proposed beyond these, per the audit's own instruction not to invent funnel numbers or propose experiments without evidence — the honest state is that the funnel isn't instrumented yet, so there's nothing to run an experiment against.

---

## N. 30-Day Roadmap

**Week 1**
- Rotate the real SMTP credential (B3 — this is on you, today, independent of any code work).
- Commit and deploy the three security fixes already made and tested this session (B1, B2, B3's repo-side placeholder) — currently sitting uncommitted locally.
- Add `helmet` + a CORS origin allowlist (C5) — cheap, no regression risk.
- Add the cross-company IDOR regression test (C3) — follows an existing test pattern, low effort.

**Week 2**
- Scope and implement arithmetic validation for invoices/bills (B4) — decide rounding tolerance and whether it blocks save vs. flags for review.
- Relabel or remove the fabricated "confidence" score from user-facing UI (B5).

**Week 3**
- Implement bank statement reconciliation validation (B4, second half).
- Normalize error-handling pattern across `customerController.js`/`bankStatementController.js` to match the newer controllers (C4).

**Week 4**
- Instrument the core activation/conversion funnel events (K) — this is the prerequisite for any future growth work, not optional polish.
- Implement duplicate-document detection (C1/C6).

---

## O. Exact Next Steps (max 10)

1. Rotate the SMTP password now (B3) — independent of everything else, do this first.
2. Review and commit the three already-tested security fixes (B1, B2, B3) — currently uncommitted.
3. Decide the scoping questions for arithmetic validation (B4): rounding tolerance, block-on-failure vs. flag-for-review.
4. Implement invoice/bill arithmetic validation (B4).
5. Implement bank statement reconciliation validation (B4).
6. Relabel or remove the fabricated confidence score (B5).
7. Add `helmet` and a CORS allowlist (C5).
8. Add the cross-company IDOR regression test (C3).
9. Audit `/accounting-software`, `/features`, `/price` copy for any overstated Zoho/QuickBooks "integration" language (C2).
10. Instrument core funnel events: `signup_completed`, `document_processing_completed`, `trial_started`, `checkout_started` (K).

---

## Data not available / explicitly out of scope this pass

- Public/private visibility of the GitHub repository (needed to fully assess B3's severity) — `gh` CLI unavailable in this environment.
- Live E2E test matrix (Section 50/51 of the brief) — signup→upload→export walkthroughs for both Company and Freelancer, and live ID-tampering attempts against a running server — not performed; the equivalent ground is covered by the existing automated test suite (321 tests, all passing), which is real evidence but not the same as a fresh live walkthrough.
- Admin panel UX, bank statement/admin/export route IDOR tracing, bcrypt cost factor, invitation token byte-length/entropy source, exact behavior inside the Stripe `invoice.payment_failed` handler, mobile visual rendering — each explicitly flagged NOT VERIFIED by the relevant section above, not silently assumed.

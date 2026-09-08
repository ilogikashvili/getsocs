**Getsocs full-stack QA audit — 6 September 2026**

**Release assessment: not ready for an unconditional QA sign-off.** This audit found 12 issues: 2 High, 8 Medium, and 2 Low. No Critical issue was confirmed within the tested scope. Paid membership activation and versioned refresh-token handling should be addressed first. Passing local tests does not establish production security, scalability, or complete accessibility compliance.

The application source was not changed. Audit scripts, test adaptations, logs, JSON results, and screenshots are in this directory. The production client build was regenerated. Local test fixtures and upload files were exercised by the existing test suites.

**Environment and evidence**

Windows; React production build served through the existing Express application. Dedicated runtime: `http://getsocs.localhost:3101`, mapped to loopback by Chromium; JSON test database; local storage; Redis disabled; SMTP explicitly disabled for isolated runs. This exercises the production browser bundle and Express headers, but the backend runs in test mode, not production MySQL mode. Rate limiting was separately exercised outside test mode.

| Check | Result | Evidence |
|---|---|---|
| Original backend command | 542 passed, 1 failed; 28/29 suites passed | [backend.log](backend.log), [JSON](backend-results.json) |
| SMTP-isolated backend rerun | 543/543 tests, 29/29 suites passed | [backend-isolated.log](backend-isolated.log), [JSON](backend-isolated-results.json) |
| Frontend unit/component tests | 56/56 tests, 13/13 suites passed | [frontend.log](frontend.log), [JSON](frontend-results.json) |
| Production build | Passed; main JS 246.83 kB gzip estimate; CSS 54.71 kB | [build.log](build.log) |
| TypeScript checks | Both passed | [typecheck.log](typecheck.log), [services](typecheck-services.log) |
| Original browser journeys | First failed on an ambiguous selector; 3 skipped | [e2e.log](e2e.log), [failure artifacts](e2e-artifacts/) |
| Adapted browser journeys | 4/4 passed, 0 skipped, 9.5 seconds | [final log](adapted-e2e-final.log), [JSON](adapted-e2e-results.json) |
| Responsive public-page matrix | 48 page/width combinations; no document overflow | [browser-results.json](browser-results.json) |
| Accessibility automation | 24 axe-core 4.13.0 scans; 0 definitive violations; manual-review items remain | [accessibility-results.json](accessibility-results.json) |
| Browser interaction checks | Required fields, API failure, theme persistence, touch, back navigation sampled | [interaction-results.json](interaction-results.json) |
| API and rate probes | Findings below | [API probe](api-probe-results.json), [rate probe](rate-results.json) |

Initial backend testing unexpectedly inherited SMTP settings from `server/.env`; the provider rejected authentication. No successful delivery was observed. Subsequent tests explicitly disabled SMTP and did not contact email recipients. The initial failure was a test-environment problem, not proof that rate limiting failed.

The adapted browser suite changes only audit fixtures/selectors: password locator, current 2FA heading, valid first name (`Audit` instead of rejected `E2E`), isolated URLs/database, and independent execution so one failure does not suppress the remaining journeys. Original files remain unchanged. Email/2FA codes come from local fixtures; privileged users are assigned roles in those fixtures. These journeys do not prove email delivery, administrative provisioning, payment settlement, or external channel transfers.

**Issues, severity, and reproduction**

**QA-01 — High: paid memberships activate without payment verification.**

Reproduce: create/verify an ordinary local test account; seed a membership priced at 29; POST `/api/v1/membership/subscribe` with its bearer token and `{"tierId":"qa-paid","billingCycle":"monthly"}`. Supply no payment token, checkout session, or provider confirmation.

Expected: a paid entitlement becomes active only after verified payment, or the request creates a pending checkout. Actual: HTTP 200 returns `status: active`, `amount: 29`, and a fabricated `stripeSubscriptionId: sub_<timestamp>`. This permits self-service activation of paid benefits. Verified against a synthetic paid tier; no money moved. Evidence: [API result](api-probe-results.json). Implementation: [membership service](../../server/services/membershipService.js), `subscribeToTier`, and [membership controller](../../server/controllers/membershipController.js). Gate activation on a verified payment event and make retries idempotent.

**QA-02 — High: versioned authentication cannot refresh its session cookie.**

Reproduce: verify a test account through `/api/v1/auth/verify-email/code`, retain the returned cookie in a real cookie jar, then POST `/api/v1/auth/refresh`. Compare with `/api/auth/refresh` using that jar.

Expected: both supported API prefixes can refresh a valid session. Actual: cookie `Path=/api/auth`; the versioned endpoint receives no cookie and returns 401 `Refresh token required`. The legacy endpoint returns 200. Clients using the versioned API cannot renew access after token expiry. The current React client uses the legacy prefix, so this is not a claim that its normal refresh always fails. Evidence: [API result](api-probe-results.json), [token service](../../server/services/tokenService.js), `cookieOptions`. Align cookie scope and supported routes, including logout/clearing behavior.

**QA-03 — Medium: Content Security Policy blocks both inline startup scripts.**

Reproduce: load the Express-served production homepage and inspect the console. Expected: theme pre-initialization and service-worker registration execute under the configured policy. Actual: two inline-script CSP refusals (`script-src 'self'`) appear on every sampled page. The inline service-worker registration cannot run; theme pre-initialization is blocked, although React later restores the saved theme successfully.

Evidence: [browser console capture](browser-results.json), [HTML template](../../client/public/index.html), [security headers](../../server/middleware/securityHeaders.js). Move scripts to permitted external assets or authorize their exact hashes/nonces. Accessibility scans used CSP bypass only to inject axe; the security reproduction did not bypass CSP.

**QA-04 — Medium: unknown API/assets return HTTP 200 HTML; unknown UI routes lack a not-found view.**

Reproduce: GET `/api/v1/qa-nonexistent`, `/static/js/qa-missing.js`, and browse `/qa-nonexistent`. Expected: API JSON 404, missing asset 404, and a useful UI not-found page. Actual: the API and JS paths return the SPA HTML with 200; the UI shows shell navigation with no not-found message. A missing upload correctly returns 404, so the issue is not universal to all files.

Evidence: [API status samples](browser-results.json), [UI screenshot](unknown-route.png), [server wildcard](../../server/server.js), [React routes](../../client/src/app/routes.jsx). Put API/asset 404 handling before the SPA fallback and add a UI catch-all route.

**QA-05 — Medium: “Remember me” has no effect.**

Reproduce: compare login with the checkbox checked and unchecked; inspect the submission path. Expected: the choice determines session persistence. Actual: `rememberMe` is only local checkbox state and is never passed to `login`; authentication always stores the user/token in localStorage and uses the same refresh-cookie lifetime.

Evidence: [Login.jsx](../../client/src/pages/Login.jsx), `rememberMe` and `submit`; [AuthContext.jsx](../../client/src/context/AuthContext.jsx); [token service](../../server/services/tokenService.js). This is confirmed by source data flow, not a 30-day browser soak test. Implement the choice through the session API or remove the misleading control.

**QA-06 — Medium: initial login has no pending state or duplicate-submit guard.**

Reproduce: delay `/api/auth/login` by 1.6 seconds and submit validly formatted fields. Expected: visible progress and a disabled submission control until completion. Actual: the page continues to show ordinary `Sign In`, with no submitting state; `submit` has no loading guard. A simulated 503 subsequently displays a helpful error. Repeated attempts can be submitted while the first is pending; downstream harm was not stress-tested.

Evidence: [interaction results](interaction-results.json), [failure screenshot](login-api-failure.png), [Login.jsx](../../client/src/pages/Login.jsx). Add a pending state with accessible status feedback and prevent duplicate submission.

**QA-07 — Medium: cold slow-3G page load misses the requested three-second target.**

Reproduce: use the production build, disable browser cache, emulate 400 ms latency and 50,000 bytes/second upload/download, navigate to `/products`. Expected: the requested load target is less than three seconds. Actual: load event 24,803.7 ms; observed LCP 25,020 ms; sampled CLS approximately 0.00018.

The main JS asset is 879,325 bytes and the direct Express response has no Content-Encoding even when gzip/br are requested. The build's gzip size is an estimate, not proof of compressed delivery. Evidence: [timing results](browser-results.json), [asset probe](asset-results.json). Measure the real reverse proxy/CDN, enable compressed delivery where needed, and assess route splitting. This is one local laboratory run; it is not a production percentile or a universal mobile result.

**QA-08 — Medium: skipped email delivery is reported as successfully sent.**

Reproduce: run the isolated server with SMTP empty; register an account. Expected: the response accurately reflects that no email was sent and offers appropriate recovery. Actual: `verificationSent: true` and a “code sent” message; the browser says “We sent a 6-digit code” although the email utility returned `{skipped:true}`. Controllers treat a resolved send operation as success without inspecting that result.

Evidence: [API registration result](api-probe-results.json), [registration screenshot](registration-result.png), [email utility](../../server/utils/email.js), [auth controller](../../server/controllers/authController.js). Treat skipped delivery distinctly and validate required delivery configuration for deployments that rely on email authentication.

**QA-09 — Medium: the shipped critical-flow suite is stale and overstates downstream coverage.**

Reproduce: run `npm test` in `e2e`. Expected: current UI selectors and valid registration fixtures allow all four journeys to execute. Actual: `getByLabel('Password')` matches both the input and “Show password” button. After adapting that, the expected 2FA heading is obsolete. Subsequent API fixtures also use the invalid first name `E2E`, yielding 400. Serial execution suppresses the remaining journeys after the first failure.

Evidence: [original run](e2e.log), [selector diagnostic](browser-results.json), [first adapted run](adapted-first-results.json), [second adapted run](adapted-second-results.json), [final passing audit adaptation](adapted-e2e-final.log). Separately, several rate-limit tests assert `expect(true).toBe(true)`, and test mode skips actual limits. Maintain realistic selectors/fixtures and executable behavior assertions.

**QA-10 — Medium, conditional on scaling: rate-limit counters are process-local.**

Reproduce: construct two independent instances of the actual login limiter outside test mode with a limit of three. Send five requests for one IP to instance A, then one for that IP to instance B. Expected for a distributed deployment: a shared quota. Actual: A produces `200,200,200,429,429`; B still returns 200. Another IP on A also returns 200, as intended. RateLimit and Retry-After headers are present on the limited response.

Evidence: [probe script](rate-probe.cjs), [results](rate-results.json), [middleware](../../server/middleware/rateLimitMiddleware.js). There is no shared store configured. Current PM2 configuration uses one process, so this is a scaling limitation rather than evidence that the current single-process quota can be bypassed. Validate a shared quota before adding replicas; reverse-proxy/IP trust also needs deployment testing.

**QA-11 — Low: invalid and unrecognized response-header directives pollute the console.**

Reproduce: open any Express-served page. Expected: supported policy values with no parsing warnings. Actual: `Referrer-Policy: strict-no-referrer` is rejected by Chromium; several Permissions-Policy features are unrecognized, including `battery`, `vr`, and `wake-lock`. The browser leaves the referrer policy unchanged rather than applying the intended value.

Evidence: exact browser diagnostics in [browser-results.json](browser-results.json); [security headers](../../server/middleware/securityHeaders.js). Use a valid intended referrer policy and supported directives. These warnings are separate from the functional CSP issue.

**QA-12 — Low: community-review subtitle renders an escaped Unicode sequence.**

Reproduce: open the homepage and scroll to Community Reviews. Expected: a normal dash in the subtitle. Actual: literal `\u2014` appears in the sentence. Evidence: [mobile screenshot](home-320.png), [DashboardReviews.jsx](../../client/src/components/reviews/DashboardReviews.jsx), subtitle near line 213. Use a literal character or a JavaScript string expression in JSX.

**Frontend testing — detailed coverage**

| Requested section | Executed and result | Remaining limits |
|---|---|---|
| 1. Visual/UI | Captured six public pages at 320 and 1366 px; visually reviewed mobile home and desktop registration. Shared styling is coherent in those samples. DOM checks found no broken images or missing alt attributes in the 48 public-page samples. QA-12 is visible. | Every authenticated/admin page and every hover/active state were not visually reviewed. Animation smoothness and all image optimization variants are unverified. |
| 2. Responsive design | `/`, `/products`, `/policy`, `/login`, `/register`, `/reset-password` at 320, 375, 414, 768, 1024, 1366, 1920, 2560 px; fixed 900 px height; no document horizontal overflow. Touch-emulated taps worked. Home reflow at 375×812 and 812×375 had no overflow. | Not a real-device test; no complete authenticated-page matrix. No full readability/200% zoom certification. |
| 3. Navigation/UX | Ten protected routes redirected guests to login. Login-to-register link and browser Back worked. Missing product showed “Product not found.” Missing seller showed “Seller not found.” Component tests exercise responsive drawer/rail behavior. | QA-04 affects unknown routes. All individual internal links, breadcrumbs, populated pagination and all menu focus/escape behavior were not exhaustively exercised. |
| 4. Forms | Browser required-field validation identified two empty login inputs. Registration → email-code submission → login → 2FA passed in the adapted journey. Profile upload and listing upload passed. Delayed login and injected API failure exercised error handling. | QA-05, QA-06, QA-08. No complete form-reset/autosave inventory or every slow-submission scenario. Real password-reset email delivery unverified. |
| 5. Performance | Production build/minification succeeded. Sampled local normal load events 16.5–179.7 ms, largely warm cache. Cold slow-3G sample failed the requested target (QA-07). LCP/CLS observer data saved. | No field Web Vitals, INP/FID measurement, separate 4G run, heap/GC leak study, large-dataset load test, or complete lazy-loading audit. Local timings do not establish production performance. |
| 6. Accessibility | axe-core 4.13.0 ran WCAG 2 A/AA and 2.1 AA tagged rules across six public pages × two widths (375/1366) × two themes. Zero definitive automated violations. Sampled fields had labels, sampled images had alt attributes. Tab reached the brand link with a visible outline. | All scans had color-contrast items needing manual review; desktop shell scans also had an ARIA manual-review item. Gradients/transparency prevent treating zero automated violations as contrast compliance. No real screen reader, complete Tab/Enter/Escape traversal, or actual browser zoom at 200%. |
| 7. Browser/device compatibility | Main matrix: bundled Chromium 140.0.7339.16. Installed Chrome 152.0.7977.82 and Edge 152.0.4191.62 each rendered the login heading. Theme toggle/reload persisted light mode in mobile emulation. | Installed versions were observed, not verified as vendor-latest. Chrome/Edge checks were smoke tests, not the full matrix. Firefox/WebKit binaries and real Safari/iOS/Android tests were not available in this run. Extensions comparison untested. |

Screenshots: [home mobile](home-320.png), [home desktop](home-1366.png), [marketplace mobile](products-320.png), [marketplace desktop](products-1366.png), [login mobile](login-320.png), [registration desktop](register-1366.png), [policy mobile](policy-320.png), [reset password mobile](reset-password-320.png). Additional captures are alongside these files. The original failing E2E run retained screenshot/video/trace artifacts; successful adapted journeys were not recorded as videos.

**Backend testing — detailed coverage**

| Requested section | Executed and result | Remaining limits |
|---|---|---|
| 1. API endpoints | Existing 29-suite backend run passed with isolated SMTP. Targeted live GETs returned 200 for health/products/meta, 401 for protected products/admin. Sampled API timings 5–130 ms, below 500 ms. Auth and membership POSTs additionally probed. Adapted E2E exercised upload, purchase, approval, escrow and private download APIs. | QA-02/04. No assertion that every documented endpoint and all PUT/PATCH/DELETE combinations were covered. Individual sampled timings are not latency percentiles. |
| 2. Authentication/authorization | Registration, email verification, login and 2FA passed with local code retrieval. Guest UI/API denial and private ID access enforcement passed. Backend session tests cover refresh rotation/replay and logout-everywhere invalidation. | QA-02/05/08. Actual email reset delivery, social login, and complete user/escrow/admin role matrix remain unverified. |
| 3. Validation/errors | Input validation/sanitization, XSS, field tampering, IDOR and password suites passed. They include missing/type/null/length and injection-like inputs. Search accepted encoded SQL-like and script strings without a server error in the empty local dataset. Corrupt/disguised-image cases passed. | File-adapter tests do not demonstrate MySQL resistance to every SQL injection vector. Passing helper assertions are not equivalent to complete endpoint fuzzing. |
| 4. Database | File-adapter persistence and marketplace single-inventory/idempotency tests passed. MySQL schema tests verify table/constraint/index declarations in SQL text. | No live MySQL connection was used: actual foreign-key enforcement, rollback under failure, concurrent writers, query plans, production duplication prevention, backups/restores and query performance are unverified. |
| 5. Upload/download | Browser listing upload with three images; profile photo save/retrieval; private identity upload; stranger denied and admin allowed. Backend tests cover invalid types, corrupt images, minimum dimensions, resizing, private/public separation and traversal rejection. Storage mocks exercise S3 behavior. | Not a live S3/bucket-policy test. Every configured byte/count boundary, abandoned upload cleanup and long-running temporary-file accumulation were not independently probed. |
| 6. Rate limiting | Real login limiter exercised outside test mode at a reduced limit: 429 after quota, RateLimit/Retry-After headers, separate IP buckets. QA-10 establishes independent instance counters. | Other limiters, window expiry, restart persistence, real reverse-proxy IP handling, all per-user quotas and multi-host load remain unverified. Existing test-mode green suites alone do not establish enforcement. |
| 7. Security | IDOR/private upload/session/validation tests passed. CSP, nosniff, frame and HSTS headers inspected; CSP/header findings recorded. Configured allowed CORS origin echoed; untrusted origin received no allow-origin header. Sampled structured email logs redact email values. | QA-01/02/03/10/11. No comprehensive secret scan/log audit, live TLS certificate/redirect test, CSRF attack simulation or dependency-advisory audit. Refresh cookies use HttpOnly and production code specifies Secure/SameSite=Strict; live HTTPS behavior was not exercised. No claim of a dedicated CSRF-token mechanism. |

**Integration testing — detailed coverage**

1. **Frontend/backend:** the four adapted journeys pass locally: registration/verification/login/2FA; listing creation → approval → buyer reservation → escrow completion; profile photo upload → public retrieval; ID upload → role-gated retrieval. Purchase/escrow transitions are API-driven after browser listing creation, not every click of the buyer UI. A simulated login API failure yields clear text. Pending UI is deficient (QA-06). The main browser client uses `/api`; versioned-cookie breakage is separately reproduced. Membership activation remains a release issue despite the journey passes.

2. **Third parties:** no real payment gateway charge/refund/settlement, SMTP delivery, external YouTube/TikTok/Telegram ownership lookup, webhook delivery/retry/signature verification or social-login flow was exercised. Paid membership currently uses a placeholder subscription identifier (QA-01). S3 and email behavior have local/mocked test evidence only. No external financial transactions or messages were deliberately sent by the audit harnesses.

**Cross-functional testing — detailed coverage**

1. **Search:** the public marketplace renders its empty state; encoded SQL-like/script search requests return 200 without a crash. Search sanitization helper tests pass. Relevance, populated-result pagination, special-character matching semantics and large-dataset performance are not certified by an empty fixture.

2. **Filtering/sorting:** marketplace/filter-panel component suites pass and responsive filters render at all sampled widths. Combined-filter correctness over a populated catalog, ascending/descending ordering and refresh/history persistence of every filter were not exhaustively validated.

3. **Sessions:** refresh rotation/replay protection and logout-everywhere are covered by backend tests. Local browser registration/login/2FA succeeds after test corrections. Refresh cookie prefix mismatch is reproduced (QA-02); Remember me is unwired (QA-05). Multi-device concurrency, real time-based expiry and long-lived-session soak behavior remain unverified.

**Browser console and network**

The “no errors or warnings” requirement fails: CSP refusals, invalid Referrer-Policy, and unrecognized Permissions-Policy features are captured. The public matrix had no broken-image observations. Later deliberate missing-resource/guest probes generated product 404 and profile/refresh 401 responses; these are intentional negative tests, not blanket evidence of ordinary navigation failing. The original dev-server run also emitted webpack middleware deprecation warnings. Unknown API/static resources incorrectly return success (QA-04).

**Final checklist**

| Requested sign-off | Status |
|---|---|
| All critical paths work end-to-end | Partial: four adapted local journeys pass; paid entitlements and versioned sessions fail; external fulfillment unverified |
| No broken links/missing resources | Not signed off: unknown-route behavior fails; link inventory is incomplete |
| No console errors/warnings | Failed |
| Performance meets standards | Failed for the requested slow-network load target; production/field measurements pending |
| Mobile and desktop both work | Partial: public responsive matrix passes; real devices/authenticated matrix pending |
| Security measures are in place | Partial: multiple controls pass local tests; High issues remain |
| Error handling is graceful | Partial: injected login error is clear; pending, missing-route and skipped-email handling need work |
| Accessibility standards met | Unverified: no definitive axe violations, but contrast/manual review and assistive-technology testing remain |

**Reproduction commands**

From the repository root, `node docs/qa-audit/start-local.cjs` starts the dedicated fixture server on port 3101. In another terminal run `node docs/qa-audit/browser-audit.cjs`, `node docs/qa-audit/interaction-audit.cjs`, or `node docs/qa-audit/accessibility-audit.cjs`. Run database-mutating probes sequentially with fresh fixtures: `api-probe.cjs` and adapted E2E share the audit database and must not overlap. The API probe assumes its unique test user is absent. The adapted suite resets/removes its fixture database.

`node docs/qa-audit/run-backend.cjs` runs backend tests with SMTP disabled. `node docs/qa-audit/rate-probe.cjs` independently tests limiter middleware without the application server. To rerun adapted journeys, enter `docs/qa-audit`, run `node prepare-flows.cjs`, then `node ../../e2e/node_modules/playwright/cli.js test --config=playwright.config.cjs` while the isolated server is running. Original tests and source were preserved for review.

Before release, resolve the High findings, repair the original E2E suite, and complete the unverified checks against a staging deployment with representative MySQL data, configured delivery/storage providers, and target devices. This report records observed behavior and explicit coverage gaps; it does not claim every requested test passed.

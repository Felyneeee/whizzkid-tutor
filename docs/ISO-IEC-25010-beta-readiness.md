# Whizzkids local beta readiness review

**Reviewed:** 2026-11-25  
**Scope:** Local Next.js application and MySQL setup; ISO/IEC 25010 quality review and readiness for a closed 50-participant beta.  
**Verdict:** **CONDITIONAL GO for a supervised, staged beta after the open gates below are completed. NO-GO for inviting all 50 participants at once or treating this as production approval.**

This is an evidence-based internal review, not ISO certification or a full independent security assessment. It uses the nine-characteristic product quality model in [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html). Findings marked partial/unverified need evidence before they can be called passing.

## ISO/IEC 25010 assessment

| Quality characteristic | Assessment | Evidence and remaining work |
|---|---|---|
| Functional suitability | **Partial** | Browser checks verified tutee registration/profile, academic booking submission and cancellation, Reading request, chat send, login/logout persistence, and tutor application submission/status gate. Admin approval, assessment scheduling, payment proof/review, tutor matching, and the rest of the feature inventory were not exercised end to end. Tutor resume preview did not open in the browser test and remains unresolved. |
| Performance efficiency | **Partial** | A loopback production build handled 50 concurrent `/api/public` reads with 0 errors, 458 ms average, 500 ms maximum, 573 ms total. This only tests one public read. Authenticated state reads/actions and concurrent writes were not load-tested. Writes use an application-wide database lock; the pool allows 10 connections and queues up to 100 (`src/server/mysql.js`). |
| Compatibility | **Partial** | Next.js production build succeeds and routes are generated. Browser checks used one desktop browser; phone, tablet, screen-reader, and supported-browser coverage is not documented. |
| Interaction capability | **Partial** | The tested booking and registration flows worked and validation messages appeared. A broader keyboard, accessibility, responsive-layout, and user-comprehension review is outstanding. |
| Reliability | **Partial** | `npm run build`, `npm run lint`, and `git diff --check` passed. Local `/api/health` and `/api/public` returned 200; unauthenticated `/api/state` returned 401 as expected. Automated unit/integration/E2E suites and recovery/restore drills were not found or run. |
| Security | **Partial** | Server-side session checks and role authorization are present (`src/server/auth.js`, `src/server/action-access.js`); passwords use scrypt; session cookies are HTTP-only, SameSite strict and Secure in production. Production headers include CSP/HSTS and anti-framing (`next.config.mjs`). CSP allows `unsafe-inline` scripts. Rate limits are process-local, so they require one persistent Node process; a multi-instance deployment needs a shared store. TLS, proxy/IP configuration, backup restore, secret-history scan, dependency audit, and abuse/IDOR testing remain unverified. |
| Maintainability | **Partial/pass for checked items** | Lint and build pass; the source is separated into route, action authorization, state, and relational persistence modules. There is no automated regression suite visible in the package scripts, and broader code/algorithm review remains open. |
| Flexibility | **Partial** | Root app is clearly identified as active; Supabase and SQLite are explicitly documented as disconnected. Future scaling needs domain-level transactions and shared rate limiting, as the README notes. |
| Safety | **Not verified** | The app can hold children’s personal/profile information. Beta consent, data minimization/retention, deletion, incident contacts, and safeguards for handling minors’ information need an owner’s review before external participants use real data. |

## Checks run

- `npm run build` — passed; optimized Next.js production build generated 54 pages/routes.
- `npm run lint` — passed with no output/errors.
- `git diff --check` — passed; Git printed only line-ending conversion warnings.
- Local endpoints — `/api/health` 200, `/api/public` 200, unauthenticated `/api/state` 401.
- Production-mode headers — CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and Referrer Policy observed.
- 50 simultaneous requests — `/api/public` production process: 50/50 successful, average 458 ms, max 500 ms. This is a narrow smoke/load sample, not a 50-user capacity test.
- `npm audit` could not be completed earlier because the package registry endpoint was unavailable; dependency vulnerability status is unknown.
- No staging DAST, full-history secret scan, or backup restore test was performed.

## Fix made during this review

`src/app/api/public/route.js` previously loaded all application state for a public hiring list and read `desc` although persistence names the field `description`. It now queries only open hiring rows, aliases the persisted description correctly, orders results deterministically, and returns 503 on database failure rather than silently presenting an empty hiring list. The local database currently has no open hiring rows, so the non-empty response path still needs one controlled data check.

Earlier local fixes are also present in the working tree: React hook dependency lint cleanup, removal of an unused tutor-matching calculation, and README corrections for booking cancellation/payment behavior. These edits are not committed.

## Beta gates before the first external participant

1. Exercise the full admin lifecycle with dummy records: approve/reject a tutor, schedule an assessment, match/confirm a booking, upload and review payment proof, and verify notifications and resulting records. Resolve the resume PDF preview failure.
2. Run an authenticated production-build test with concurrent reads and writes (booking, chat, and an admin action) using dummy accounts. Ramp participants in small batches and watch response times, database connections, and server errors; stop if actions queue or fail.
3. Decide how the beta will run: one persistent Node.js process for this build, private MySQL access, and HTTPS for any non-loopback/network access. Do not use the dev server for participants.
4. Verify database backup and restore, prepare a rollback and incident contact, and confirm participant/guardian consent, privacy notice, data retention, and deletion handling for minors’ data.
5. Re-run dependency audit when registry access works; resolve or record any findings. Confirm no secrets are tracked and rotate any credential that has been exposed.

## Recommendation

**Do not call the app fully passed yet.** The current evidence supports continuing local defense testing. A closed beta for 50 samples is reasonable only as a staged, supervised beta after gates 1–4 above are completed; begin with a small group and expand based on observed performance. The present 50-request result alone does not demonstrate that all 50 can use booking and admin workflows concurrently.

## Mobile UI and workflow pass (2026-11-25)

Checked the local app in a 320 × 740 CSS-pixel viewport, with route spot checks at 390 × 844. This is browser responsive testing, not coverage on physical iOS/Android devices.

- Public landing, login/registration pages, and all tutee dashboard routes rendered at 320 px without document-level horizontal overflow after hydration. The tutee menu drawer opened and displayed the expected navigation links.
- On mobile, an academic three-week request was selected, submitted, and shown as pending at ₱1,800; the same dummy request was then cancelled successfully, releasing its reserved capacity.
- Mobile chat message submission reached the conversation and the send button returned to its disabled empty state. The message input and Send button were increased from 38 px to 44 px height in `src/components/shared.jsx` for easier touch use.
- Tutee dashboard, booking, booking list, calendar schedule, profile, activity history, chat, materials, and notifications were visually inspected or rendered at the narrow viewport. Materials currently has no sample file, so preview/download behavior was not tested.
- Browser console contained no errors or warnings during the mobile route pass.
- After the 44 px chat control adjustment, `npm run lint` and `npm run build` passed again; `git diff --check` passed.
- Tutor and administrator screens were not exercised in their respective authenticated roles. The current browser session is a tutee; mobile tutor application file upload, tutor session actions, admin approval/payment tables and actions, and those roles’ responsive states remain open.
- A mobile chat test message remains in the dummy conversation. The mobile academic test request was cancelled and is no longer pending.

For a complete mobile sign-off, repeat on at least one real Android phone and one real iPhone, check the on-screen keyboard and file picker, and run the tutor/admin role journeys with dedicated dummy accounts. Test actual file previews and payment receipt handling before inviting participants.

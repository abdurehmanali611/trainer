# Trainer SaaS — Phase 2 Functionality & Integration Canvas

Phase 1 shipped the core apps (`trainer`, `trainer-client`, `trainer-admin`). Phase 2 is about **functionality and integration**: making the three repos behave as one SaaS system — standalone client API, OTP lifecycle, client profile, and the full period/payment/warning/blocking flows.

**Convention:** every feature below carries **two checkboxes** — one for implementation, one for testing. A feature is done only when both are checked. Both are standard Markdown task items — **click a Testing box to check it once you've verified the feature manually.**

- [ ] **Implementation** — ticked by the agent when the feature is implemented
- [ ] **Testing** — ticked by **you**, after manual end-to-end verification (decided: no automated suite)

Numbering is this canvas's own; the original request order is preserved in the cluster titles.

---

## Repos & integration facts (verified)

| Repo | Role | Backend |
|------|------|---------|
| `trainer` | Trainer app (Expo) | `BackEnd/` — apps: `accounts`, `core`, `fitness`, `internal`, `platform_billing` |
| `trainer-client` | Client app (Expo) | `BackEnd/` — standalone apps against shared Trainer DB (gateway proxy removed) |
| `trainer-admin` | Apex console (Next.js) | `BackEnd/` — **`admin_api` only** (unmanaged models on shared DB; volosync apps removed) |

Integration facts this canvas builds on:

- **Shared database.** `trainer/BackEnd/.env` and `trainer-client/BackEnd/.env` point at the **same** MySQL (`DB_NAME=Trainer`, same Aiven host). Shared `JWT_SECRET` + `SERVICE_TOKEN` too.
- **Standalone client API.** `trainer-client/BackEnd` serves client endpoints directly (no `TRAINER_API_BASE_URL` proxy).
- **OTP.** Feature 2 shipped alphanumerical/special OTPs with a DB-level unique constraint on `Client.otp`.
- **Billing models.** `PaymentInstruction`, `SubscriptionPeriod`, `Invoice`, `Payment`; `platform_billing` models **quarterly** fees (`TrainerBilling.quarterly_fee_etb`, `PlatformPayment` kind `quarterly`).
- **trainer-admin quarterly UI.** `app/(shell)/payments/quarterly/page.tsx` → `ApexPaymentsQueue kind="quarterly"`; yearly/console duplicate routes removed.

---

# Cluster A — trainer-client backend & OTP login

## 1. trainer-client `BackEnd` becomes a standalone API

**Behavior.** `trainer-client/BackEnd` must no longer be a gateway/proxy. It gets its own **models, urls, views** structured like `trainer/BackEnd` (app packages under an `apps/` layout, DRF serializers/views, own `config/settings.py` app list), serving the client app's endpoints directly against the shared database.

- [x] Implementation — remove `gateway` proxy (`gateway/views.py::_proxy`), introduce standalone apps + `models.py` / `urls.py` / `views.py` per feature area; client app (`trainer-client/src/lib/api*`) points only at this backend; `TRAINER_API_BASE_URL` usage deleted.
- [ ] Testing — manual: open every trainer-client screen (login, home, plans, schedule, chat, diary, more/*) and confirm data comes from the standalone backend with **zero** requests proxied to `:8000` (network log); exercise each new endpoint through the UI.

## 2. OTP generation — global uniqueness, alphabets & special characters

**Behavior.** The OTP a trainer generates for a client must be **globally unique across all trainers' clients** (not merely unique per trainer) and **may contain alphabets and special characters** (not just 6 digits).

- [x] Implementation — new generator (e.g. `secrets`-based, length ≥ 8, charset `A-Za-z0-9` + specials) with a **DB-level unique constraint** on `Client.otp` (shared DB ⇒ global uniqueness); bump `max_length`, migration, regenerate existing rows; expose via trainer client-details API.
- [ ] Testing — generate OTPs for clients of two different trainers → no collision possible (constraint test); charset verified to include letters/specials; old 6-digit clients still log in after migration.

## 3. Client login via trainer-generated OTP

**Behavior.** Client logs in to `trainer-client` with the OTP their trainer generated (replacing any self-registration credential path).

- [x] Implementation — `trainer-client` auth endpoint validates OTP in the standalone backend and issues its JWT (same `JWT_SECRET`); login screen (`src/app/auth/login.tsx`) accepts the alphanumerical/special-char OTP.
- [ ] Testing — correct OTP → session opens; wrong/expired OTP → rejected; login works for OTPs containing letters and special characters (URL-encoding handled).

---

# Cluster B — OTP lifecycle (trainer side)

## 4. OTP visibility → Reset button after first login

**Behavior.** In the trainer's **client-details** section the OTP is displayed. The moment the client **first logs in**, that OTP is **removed from the UI and replaced by a Reset button**.

- [x] Implementation — track "has logged in at least once" on the client; client-details API + UI (`trainer/src/app/(tabs)/client/[id].tsx`) switch from OTP display to a Reset button on that state; OTP value no longer returned after first login.
- [ ] Testing — before first login: OTP visible; after first login: OTP gone, Reset button present; API response no longer leaks the OTP.

## 5. Reset flow

**Behavior.** Trainer clicks **Reset** → a fresh OTP is generated and shown; when the client logs in with it for the first time, the same rule applies again — OTP removed, Reset button back.

- [x] Implementation — reset endpoint issues new unique OTP (feature-2 generator), clears the "logged in" flag; UI round-trips display → Reset → new OTP → (client logs in) → Reset button.
- [ ] Testing — full cycle twice in a row; old OTP stops working the moment reset happens; uniqueness still enforced.

## 6. Forced credential change on first OTP login

**Behavior.** When the client logs in with an OTP for the first time, they are **asked to change it** using three fields: **Old OTP, New OTP, Confirm New OTP**. (Client repo already routes to `src/app/change-credential.tsx` when `must_change_credential` is set — this feature pins the three-field contract.)

- [x] Implementation — change-credential endpoint validates `old == current OTP`, `new == confirm`, new value meets charset rules, then stores as the login credential and clears `must_change_credential`; UI shows the three fields with clear mismatch/weakness errors.
- [ ] Testing — correct old + matching new → credential replaced, next login uses New OTP; mismatched confirm → error, no change; wrong old → rejected; after success, forced-change gate no longer triggers.

---

# Cluster C — client profile

## 7. Client-detail contents become the client's profile

**Behavior.** Everything the trainer's **client-detail** section shows about a client must appear as that client's **profile** inside `trainer-client` (as seen in `trainer-client/src/app/more/profile.tsx` and detail screens) — the same data, client-facing.

- [x] Implementation — standalone backend exposes a profile endpoint returning the client-detail payload (name, contact, goals, medical history, emergency contact, weights/body-fat, avatar, measurements/prs as applicable); `trainer-client` profile screen renders it read-only (plus existing avatar edit if present).
- [ ] Testing — field-by-field comparison: every client-detail field in `trainer` appears with identical values in the client profile; no trainer-only internals (OTP, billing flags) leak into the client payload.

---

# Cluster D — Add-period, payments, warnings, blocking

## 8. Add-period form logic (free trial ↔ amount)

**Behavior.** In **Add period** (`trainer/src/app/(tabs)/client/[id].tsx`):
- Free-trial switch **ON** → amount field auto-sets to **0** and is **uneditable**.
- Switch **OFF** → amount becomes editable and **must be > 0**.

- [x] Implementation — controlled switch/amount binding; ON forces `amount=0` + disabled input; OFF re-enables and validates `> 0` before save; server-side validation mirrors it (reject trial-with-nonzero, paid-with-zero/negative).
- [ ] Testing — toggle ON → amount shows 0, typing blocked; OFF → editable, `0`/negative rejected with message; API rejects a crafted request that violates the rule.

## 9. One configuration per period; saved configs editable & deletable

**Behavior.** The trainer **cannot add/save two configurations for the same period**. Saved configurations are **editable** and **deletable**.

- [x] Implementation — uniqueness constraint on the period key (client + period) in `SubscriptionPeriod` (DB constraint + API 400); edit and delete endpoints/UI for saved rows in the Add-period section.
- [ ] Testing — second save for the same period → rejected (UI + API); edit persists; delete removes; constraint holds under concurrent saves.

## 10. Effect of a saved configuration on payment

**Behavior.**
- **Trial ON + saved** → client is **not asked for payment** during that period.
- **Trial OFF + amount saved (discount)** → client **must pay that amount**.
- **Config deleted** → client is **no longer administered by it**.
- **Config edited** → client follows the **edited** configuration.

- [x] Implementation — payment-requirement resolver reads the active config for the current period (trial ⇒ none; paid ⇒ configured amount; no config ⇒ default instruction); delete/edit update the resolver input immediately.
- [ ] Testing — one scenario per branch: trial period → zero payment prompts; discount period → invoice/ask equals configured amount; delete → reverts to default; edit → new amount takes effect without re-login.

## 11. Period end → automatic revert to creation-time payment instruction

**Behavior.** When a trial/discount period **ends**, the client **automatically** reverts to the **payment instruction assigned when they were created** (`Client.payment_instruction` FK — no manual action).

- [x] Implementation — resolver falls back to `payment_instruction` as soon as the period's end date passes (scheduled/derived, no cron gap: evaluate on read + on boundary API); notification optional but warning state must flip.
- [ ] Testing — set a period ending tomorrow → before end: config applies; after end: creation instruction applies with **zero trainer intervention**; boundary checked at exact minute.

## 12. Payment submission — channel radio + transaction id

**Behavior.** The client's payment way has two fields: **payment channel** as radio buttons — **Telebirr, CBE (Commercial Bank of Ethiopia), Others** — and a **transaction id/number** input; submitting **sends the request to the trainer**.

- [x] Implementation — payment portal section in `trainer-client` (radio group exactly those three options + transaction-id input, required validation); POST creates a pending `Payment` row (`channel`, `transaction_id`) routed to the owning trainer; existing `fitness/views_billing.py` submission extended to this contract.
- [ ] Testing — each channel submits and lands in the trainer's queue with correct values; empty transaction id blocked; "Others" behaves like the other channels; trainer sees the request.

## 13. 7-day warning icon in client header

**Behavior.** Each payment instruction has a **time frame**; **7 days before the final day**, the client gets a **warning icon in the app header** which **redirects to the payment portal section** (feature 12).

- [x] Implementation — header component in `trainer-client` computes days-left from the active payment instruction (feature-11 resolver) and renders a warning badge inside the ≤7-day window; tap → navigate to payment portal.
- [ ] Testing — 8 days out: no icon; 7 days out: icon appears; tap lands on portal; after period end (blocked state, feature 15) the icon logic doesn't conflict with the block screen.

## 14. Trainer billing — approval-requests-only client payments

**Behavior.** In the trainer's **Billing** section, the client-payment area becomes **empty except incoming approval requests**, each with **Approve** / **Reject**; **Reject pops an alert requiring a reason**.

- [x] Implementation — `trainer/src/app/(tabs)/billing.tsx` + `src/components/billing/payment-instructions.tsx`: replace the current client-payment display with a requests queue (pending `Payment` rows from feature 12); Approve marks paid/unlocks; Reject opens alert → reason required → stored (`Payment` rejection reason / `AdminAuditLog`-style row) and client notified (`fitness/services.py` already notifies on approval).
- [ ] Testing — client submits → request appears in billing; approve → client unlocked, notification received; reject without reason → alert blocks; reject with reason → reason visible to client, status rejected.

## 15. Post-deadline login blocking for clients

**Behavior.** After the payment deadline passes, the client **cannot log in** — they are redirected to the **payment-approval-request portal** until their payment is approved. On approval: **login restored, warning icon removed, normal usage resumes**.

- [x] Implementation — login endpoint checks deadline-vs-payment status and returns a "blocked" state; `trainer-client` routes it to the payment portal (`src/app/lock.tsx` is the existing candidate host screen) instead of the app; approval (feature 14) clears the block and the header warning automatically.
- [ ] Testing — after deadline: login attempt → portal, no app access; in-flight session behavior defined (blocked or read-only — pick one and test it); approve → same login now succeeds, icon gone, features re-enabled; trial/config-delete edge cases (features 10–11) don't false-block.

## 16. Trainer quarterly payment to apex (quarterly — not yearly)

**Behavior.** The trainer's own payment to apex runs **quarterly** (the volosync-admin copy was yearly — **this system is quarterly**):
- Warning appears in the **Billing section, not the header**.
- If unpaid **7 days before the quarter ends** → the **trainer and all their clients are blocked**: clients see a message; the trainer logging in is redirected to the **payment-approval-request portal**.
- Requests land in the **trainer-admin quarterly payment section** with **Approve / Reject + reason**.

- [x] Implementation — quarterly period math on `TrainerBilling` (`paid_quarters_count`, `quarterly_fee_etb` already exist) with a 7-days-before-quarter-end warning state rendered **in billing only**; trainer login gate + client-wide block message driven by that state; submit flow creating `PlatformPayment(kind="quarterly", status="pending")`; trainer-admin approve/reject-with-reason wired to `app/payments/quarterly/page.tsx` (`ApexPaymentsQueue kind="quarterly"`); **remove/redirect** the yearly leftover `trainer-admin/app/(console)/payments/yearly/page.tsx` (and any `yearly` kinds copied from volosync-admin).
- [ ] Testing — 8 days before quarter end: no warning; 7 days: billing warning shows (and **no** header icon); unpaid at deadline: trainer login → approval portal, all their clients see block message; approve in trainer-admin → trainer + clients restored; reject with reason → reason reaches trainer; **no yearly path anywhere** (grep for `yearly` in trainer-admin returns nothing user-facing); two trainers' quarters tracked independently.

## 17. Trainer setup-fee payment — signup without trial vs admin-created free trial

**Behavior.** Two distinct paths (decided):
- **Trainer signs up themselves → no trial at all.** The account starts immediately **without a free trial**, so the trainer **sends the setup-fee payment approval request right away** (payment channel + transaction id) — there is no trial window to wait out.
- **Trainer created in trainer-admin by us → free trial.** Only admin-created trainers get a trial (`free_trial_ends_at`). **10 days before the trial ends** the **Billing section shows a warning** prompting payment of the **setup fee**, with the **payment fields** (payment channel + transaction id — same fields as feature 12). If the setup fee is **not paid within those 10 days** (trial end reached, `setup_fee_paid` still false):
- the trainer's **login is blocked** and they are redirected to the **payment approval requesting panel**;
- their submission is sent to the **trainer-admin setup payments section** (`app/payments/setup/page.tsx` → `ApexPaymentsQueue kind="setup"`, `PlatformPayment` kind `setup`);
- on **approval** → `setup_fee_paid = true`, login restored, warning gone, normal usage resumes.

Note: warning lives in the **billing section** (same rule as feature 16 — not the header), and this is the trainer's **setup fee**, distinct from the quarterly fee in feature 16.

- [x] Implementation — **signup path**: new trainer (self-signup) gets no `free_trial_ends_at` and the setup-fee approval request flow is presented immediately; **admin-created path**: trial countdown from `free_trial_ends_at`, ≤10 days → billing warning + inline payment form (channel + transaction id) creating `PlatformPayment(kind="setup", status="pending")` and setting `setup_submitted_at`; login gate on trial end + unpaid → redirect to approval panel (reuse the same portal as features 15/16); approval in trainer-admin setup section flips `setup_fee_paid`/`setup_approved_at` and unblocks; billing state machine (`trial` → `trial_ending` → … in `platform_billing/services.py`) drives the warning for admin-created trials only.
- [ ] Testing — **self-signup**: no trial period exists, setup-fee approval request flow available from the start, request visible in trainer-admin setup payments queue; **admin-created**: 11 days before trial end → no warning; 10 days → warning + fields in billing (and **no** header icon); unpaid at trial end → trainer login blocked → approval panel, clients not affected by *this* block; approve → login restored, warning cleared, `setup_fee_paid` true; reject with reason → reason reaches trainer; paid-within-window → never blocked; distinct from quarterly (feature 16) — paying setup fee does not satisfy the quarterly fee and vice versa.

---

# Cluster E — Client lifecycle (deactivate vs delete)

## 18. Deactivate client (soft — still listed)

**Behavior.** Deactivating a client in the trainer's client detail **does not delete it**. The client:
- **cannot log in** to their portal, and
- **cannot access trainer services** (e.g. being assigned a session),
- but **stays listed** in the trainer's Clients section (marked inactive).

**Reactivation** restores everything: they can log in again **using the OTP that is still available**, and the trainer can assign sessions to them again.

⚠ Current `deactivate()` in `trainer/src/app/(tabs)/client/[id].tsx` issues a **hard DELETE** — it must become a soft toggle.

- [x] Implementation — deactivate → `is_active=false` (PATCH) instead of DELETE; login endpoint rejects inactive clients; session assignment (add-session picker, plan assignment, etc.) blocks inactive clients; Clients list shows them with an inactive indicator; reactivate → `is_active=true`, OTP untouched.
- [ ] Testing — deactivate → still in list, login attempt rejected, add-session/assignment blocked; reactivate → **same existing OTP** logs in, sessions assignable again; all client data (plans, history, chat) intact through the cycle.

## 19. Trash icon → permanent delete

**Behavior.** The Clients section gets a **trash icon**; deleting there removes the client **completely — all in all**. Not just billing: **every** trace is gone (sessions, periods, payments, chat, diary, plans assignments, auth rows). The client can no longer access trainer-client in any way — for them to return they must be **registered again as a brand-new client with a newly generated OTP** (no continuity with the old record).

- [x] Implementation — trash icon in `trainer/src/app/(tabs)/clients.tsx` with a confirm alert stating the permanence; hard DELETE with explicit cascade over **all** related rows (auth/OTP, sessions, reschedule/permission requests, periods, invoices, payments, chat messages, diary, water, measurements, photos, PRs, streaks, achievements, push tokens); gone from every list/picker/search afterwards.
- [ ] Testing — delete → vanishes from Clients list and all pickers; old OTP/credential **never authenticates again**; zero related rows remain (spot-check each table); re-registering the same person creates a **new** client with a **new** OTP and no link to the old data; **deactivated ≠ deleted** (inactive still listed and reusable after reactivate, deleted is not).

---

# Cluster F — Sessions (online / offline, statuses, rescheduling)

## 20. Two session types: online and offline

**Behavior.**
- **Online session** = with the trainer → the client only receives an **announcement/notification** about it.
- **Offline session** = **without the trainer** (here *offline* means *without the trainer*, **not** without internet) → the client can **open it** to see the **workout and diet plans, detailed exercises, and diet item details**.

- [x] Implementation — session type at creation (model flag `Session.is_online` already exists); online → push/in-app announcement to client, client schedule shows it as announcement only; offline → client opens a detail view rendering `recommended_workouts` / `recommended_diets` incl. exercise detail and meal-item detail.
- [ ] Testing — online session → client gets the announcement, no plan-detail open; offline → client opens it and sees plans + exercise + diet item details; both render correctly in the trainer's schedule section.

## 21. Online session statuses — remark online (4 statuses)

**Behavior.** In the **remark online** part the trainer sets one of four outcomes for an online session: **Approved** (trainer-approved completion), **No show** (client didn't show), **Rescheduling**, and **Cancelling** (the fourth status).

- [x] Implementation — extend `Session.STATUS` (today: `scheduled/completed/canceled/no_show`) to the four remark-online outcomes; trainer applies them from the schedule section's remark online part; status visible to the client.
- [ ] Testing — each of the four settable, persisted, and reflected client-side; approved counts as completed; no-show/cancelled/rescheduled behave distinctly (no false completion, rescheduled shows the new slot).

## 22. Reschedule conflict rule (no overlapping schedules)

**Behavior.** When rescheduling — **trainer-initiated or via a client's reschedule request** — the new time **must not conflict with another schedule**. A conflict exists when:
- the new session's time window **overlaps** another schedule (checked against online schedules **and** pending client reschedule requests), **or**
- the **start date of the reschedule falls between the start and end date of an existing (multi-day) schedule**, **or**
- it clashes with **the client's own** other session (client-side check, not just trainer-vs-trainer).

- [x] Implementation — conflict checker over session start/end windows covering all three rules (DB `unique_together (trainer, date, time)` catches exact clashes only — **overlap + date-containment + client-side logic are needed**); enforced both on trainer reschedules and on approving client requests.
- [ ] Testing — overlapping time rejected with a clear message in **both** flows; back-to-back (end == next start) allowed; reschedule whose **start date lands inside another schedule's start–end range** → conflict even if clock times don't overlap; the **client's own** session at the requested time → rejected; conflicts detected against online schedules and pending client reschedule requests.

## 23. Client reschedule requests — approve / approve with reschedule / decline

**Behavior.** In the trainer's schedule section a client reschedule request can be: **Approve** (use the requested time), **Approve with reschedule** (trainer picks a different time — still conflict-free), or **Decline**.

⚠ Today `schedule.tsx` `decide()` only has a boolean approve/decline — the third action is new.

- [x] Implementation — third action + time picker with conflict check (feature 22); decision pushed to the client with the note.
- [ ] Testing — approve → session moves to requested time (conflict-checked); approve-with-reschedule → moves to trainer's conflict-free time; declined → original time kept, client sees reason.

## 24. Conflict resolution choice: merge or cancel the existing

**Behavior.** Whenever a conflict is detected (in online schedules **or** in a client reschedule request), the trainer gets **two choices**: **merge with the existing** schedule, or **cancel the existing** schedule.

- [x] Implementation — conflict dialog offering both actions: *Merge* → keep the existing schedule and merge the new session/request into it; *Cancel existing* → cancel the conflicting schedule so the new time can take it; applies to both trainer-side conflicts and client-request conflicts.
- [ ] Testing — conflict → both choices shown; merge → existing kept and new one merged (both correctly represented); cancel → existing cancelled, new scheduled; works in online schedules and client reschedule requests alike.

## 25. Offline sessions — remark offline (finished or not)

**Behavior.** For offline sessions, in the **remark offline** section the trainer **only sees whether the client finished the session or not** — nothing else to approve.

- [x] Implementation — client marks the offline session finished/not; trainer's remark offline view is **read-only** (finished / not finished — no approve/decline or other status buttons).
- [ ] Testing — client marks finished → trainer sees "finished"; untouched → "not finished"; no action buttons exist anywhere in remark offline.

---

# Cluster G — Diet adherence (client self-report)

## 26. Diet approved/declined by client with reason (trainer read-only)

**Behavior.** For the diet, the **client** approves or declines **with a reason** — i.e. did he/she implement the diet correctly or not. The **trainer sees** that status but has **no status-changing buttons and no approval/declining controls** on the trainer side.

*Interpretation used here: the client self-reports adherence; trainer's view is read-only — tell me if you meant the reverse.*

- [x] Implementation — client-side diet self-report (Approved / Declined + required reason) on the diet plan/session diet; trainer's diet view shows status + reason **read-only**.
- [ ] Testing — client submits status + reason → trainer sees exactly that with **zero** action buttons; submitting without a reason blocked; the status cannot be changed from the trainer side anywhere.

---

# Cluster H — Communication & engagement (trainer-client)

## 27. Functional chat (client ↔ trainer)

**Behavior.** The chatting section of the client and the trainer should be **functional**.

*Exists on both sides today (`trainer/.../chat/index.tsx`, `trainer-client/.../(tabs)/chat.tsx`, `client/chat/read/`) — this is verify-and-complete.*

- [x] Implementation — end-to-end send/receive both directions, polling/refresh, read state, history pagination.
- [ ] Testing — trainer → client and client → trainer messages arrive; read/unread correct; older-history paging works; no lost messages on reload.

## 28. Notification bell with dropdown (top of trainer-client)

**Behavior.** A **notification bell at the top** of trainer-client; notifications open in a **dropdown**.

*Today there is only a `NotificationBanner` in `_layout.tsx` + a `more/notifications` page.*

- [x] Implementation — bell icon in the client app header with unread badge; dropdown listing notifications inline; mark-read from the dropdown; deep-link to the relevant screen where applicable (session announcement, payment warning, feedback…).
- [ ] Testing — notification arrives → badge updates; dropdown lists it; tapping marks read (count drops); links navigate correctly; banner and dropdown don't double-count.

## 29. Diary entries — food & beverage for trainer review

**Behavior.** A **diary entry section** for entering **food and beverage** entries the client is **using or intends to use**, to be **reviewed by the trainer**.

*Mostly exists (`more/diary.tsx`, `FoodDiaryEntry` + water logs, trainer `more/diary-review.tsx`) — verify coverage of "intended to use" (future entries) and all beverage types.*

- [x] Implementation — client can log actual **and intended** entries for food + beverages; entries land in the trainer's review queue; trainer feedback returns to the client.
- [ ] Testing — actual + intended entries both save and appear for the trainer; food and beverage both covered; after review the client sees the trainer's feedback.

## 30. Client access to feedback / recommendations

**Behavior.** The trainer has a **feedback/recommendation** feature — clients must also be able to **access and see** those.

*Trainer side exists (`more/diary-review.tsx` sends feedback/recommendations; `trainer_feedback` stored on diary/water entries).*

- [x] Implementation — client-facing section listing all trainer feedback + recommendations (diary/water reviews, session `recommended_workouts`/`recommended_diets`, review recommendations).
- [ ] Testing — trainer sends feedback/recommendation → shows up in the client's section; older history visible; per-item context (which entry/plan) clear.

## 31. Push notifications for critical events

**Behavior.** Real push notifications (device-level, not just in-app) for the events that matter: **session announcements** (online sessions), **reschedule decisions** (approve / approve-with-reschedule / decline), **payment warnings** (7-day warning, blocked state), **feedback/recommendations** from the trainer, and **chat messages**. (`PushToken` model already exists in `fitness/models.py`.)

- [x] Implementation — register device push tokens on login (both apps); server-side dispatch from the event producers listed above; permission-denied falls back to in-app bell only (feature 28); notification tap deep-links to the relevant screen.
- [ ] Testing — each event type produces a push on a real device/emulator; token stored per user and cleaned on logout; tapping a push opens the right screen; in-app bell still marks the same notification read (no double-count); permission denied → app remains fully usable.

---

# Cluster I — Payment exemption (illustrative / exempt)

## 32. Illustrative/exempt parties pay nothing — ever

**Behavior.** Payment happens **trainer → apex** or **client → trainer** **if and only if** they are **not exempt/illustrative**. If a trainer or client is **illustrative** (model: `Client.mode = "illustrative"`, trainer: `TrainerBilling.account_status = "exempt"`), they are **never requested any payment** — no payment, no free trial, no discount — **free from all payment-related cases**.

- [x] Implementation — exemption gate applied across **all** payment flows (features 8–17): illustrative client → no period asks, no invoices, no payment portal, no 7-day warning, no login block; exempt trainer → no setup-fee or quarterly warnings/blocks; payment sections hidden for both; non-exempt behavior untouched.
- [ ] Testing — illustrative client never sees any payment UI/request/warning/block, through period start/end and deadline; exempt trainer never sees setup/quarterly warnings or blocks; **toggling** exemption updates behavior live; paying and trial/discount clients unaffected (each feature's own tests still pass).

---

## Suggested build order

1. **Feature 2** (OTP charset + uniqueness) — everything in Clusters A/B depends on it.
2. **Feature 1** (standalone API) → **3** (login) → **4–6** (lifecycle).
3. **Feature 7** (profile) — quick win on top of 1.
4. **8–11** (Add-period logic, backend-first) → **12–15** (payment loop end-to-end) → **17** (setup-fee: signup / trial warning) → **16** (quarterly apex) → **32** (exemption gate — cut across all payment features, land before or with them).
5. **18–19** (deactivate/trash) → **20–25** (session types, statuses, reschedule + conflicts) → **26** (diet self-report).
6. **27–31** (chat verify, notification bell, diary coverage, client feedback view, push notifications).

---

## Decisions log (from the recommendations review)

| # | Recommendation | Decision |
|---|----------------|----------|
| 1 | Login attempt limiting / lockout on OTP endpoint | **No need** — not in scope |
| 2 | Automated test suite | **No** — all Testing checkboxes are **manual** end-to-end verification |
| 3 | Receipt/evidence upload on payment approval | **No need** — transaction id/number is sufficient evidence |
| 4 | Push notifications for critical events | **Included → feature 31** |
| 5 | Trainer signup → trial → warning chain | **Clarified → feature 17**: self-signup starts **without trial** (setup-fee approval request sent right away); free trial exists only for trainers **created in trainer-admin by us** |
| 6 | "Offline" caching for no-internet | **Misunderstanding** — *offline* means **without the trainer**, not without internet; dropped. Feature 20 wording now says this explicitly |
| 7 | Client-side conflict check | **Accepted + extended → feature 22**: also a conflict if the **reschedule start date falls between the start and end date of an existing schedule** |
| 8 | Permanent delete vs billing audit | **Clarified → feature 19**: permanent delete removes the client **completely — all in all** (not just billing); to return they must be registered again as new with a new OTP |
| 9 | In-flight session after the client payment deadline (feature 15) | **Read-only** — an already-logged-in session keeps reading (the home "Account on hold" banner shows), but every write **and** the token refresh answer `403 {blocked:true}` until approval; next login goes to the portal. Gate rule: **only `blocked_unpaid`** (unpaid invoice past the pay window) blocks login/writes/refresh — `blocked_no_period` (never-configured, settled, or a deleted period config; features 10–11) never false-blocks, it stays a soft banner + trainer chip |

---

## Definition of done (per feature)

- Implementation checkbox ticked only when the code path works in the running system (not just compiles).
- Testing checkbox ticked only after the scenario in that feature's *Testing* line passes — **manual E2E** (decided: no automated suite).

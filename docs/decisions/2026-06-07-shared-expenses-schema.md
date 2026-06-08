# ADR: Shared expenses — schema and write strategy

**Date:** 2026-06-07
**Status:** Accepted
**Scope:** `radar-app` — HU-17 (gastos compartidos)

---

## Context

RADAR's second value pillar is shared expenses: groups of users divide costs,
see who owes whom, and settle. Young adults in Argentina currently do this
informally over WhatsApp — no traceability, accumulated debt. HU-17 introduces
groups, membership with consent, shared expense capture, and balance/settlement.

Open choices at the start of this feature:

1. **Shared expense storage** — reuse `expenses` + `group_id` vs a separate table.
2. **Membership consent** — invite-only vs auto-add; when does a member enter splits.
3. **RLS recursion** — how to let group members read each other's group expenses without
   infinite loops in policy evaluation.
4. **Email lookup** — registered users are invited by email, but clients cannot read `auth.users`.
5. **Split math location** — DB-side vs TypeScript.
6. **Multi-currency balances** — whether to convert or keep ARS/USD separate.
7. **Deferred scope** — what is explicitly left out of MVP.
8. **Entry points** — where the user can trigger a shared expense (in-group only vs everywhere).
9. **Personal-share accounting** — whether the dashboard shows full amounts or user's share.
10. **Shared expense edit** — whether shared expenses can be edited after creation.
11. **Member management** — whether the owner can rename placeholders or remove members.

---

## Decision

### 1. Reuse `expenses` + nullable `group_id` (not a separate table)

Shared expenses are still expenses. Adding `group_id uuid` and
`paid_by_member_id uuid` (both nullable) to the `expenses` table means:

- The existing OCR pipeline, item capture (HU-18), categories (HU-16), and form UX
  work unchanged for shared expenses.
- A single `createExpense`-family RPC handles both personal and shared cases.
- Reporting and AI insights query one table.
- `group_id IS NULL` = personal expense; `group_id IS NOT NULL` = shared.

A separate `shared_expenses` table was considered for a clean boundary. Rejected
because: every consumer of expenses (`listExpenses`, `ExpenseForm`, OCR prefill,
line items) would need to union or join; the FK from `expense_splits` would need to
reference two tables or a view; and the data is structurally identical — only the
`group_id` column distinguishes the two use cases.

**Backward compat**: `group_id` and `paid_by_member_id` are nullable. Existing personal
expenses and all code paths that do not set these columns are unaffected.

### 2. Consent model via `group_members.status`

Registered users are invited by exact email and begin with `status='pending'`. They
must explicitly accept in-app before they participate in splits or balances. RLS
policies that govern group data (expenses, splits, settlements) filter on
`status='active'`.

Alternatives considered:

- **Auto-add on invite** (like many splitwise-style apps): rejected. The user expressed
  explicit concern about abuse — a malicious actor creating fake shared expenses that
  manipulate another user's balance. Requiring consent prevents this.
- **SMS/push invite**: out of scope (no `device_tokens` table yet).

Non-registered users (placeholders) have `user_id null` and are `active` from creation —
they have no RADAR account that can be harmed by a balance entry.

The `declined` state allows re-invitation: `invite_group_member` detects `declined`
and resets to `pending` rather than failing on the unique index.

### 3. `is_group_member()` SECURITY DEFINER to break RLS recursion

The core problem: checking "is the caller a member of this group?" from inside an RLS
policy on `group_members` would cause the policy to call itself recursively.

Solution: a standalone helper function

```sql
create function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.status = 'active'
  );
$$;
revoke execute on function public.is_group_member(uuid, uuid) from anon, public, authenticated;
```

Because it is SECURITY DEFINER, it runs as the function owner (postgres), bypassing
the RLS evaluation that would otherwise recurse. It is scoped narrowly (reads only
`group_members`, filters `status='active'`), and EXECUTE is revoked from `anon` and
`public`. **`authenticated` MUST retain EXECUTE**: RLS policies are evaluated in the
querying role's context; revoking from `authenticated` causes every query involving
group RLS to fail with 403. (Migration `20260608013250` mistakenly revoked it, breaking
all expense reads/writes; migration `20260608033734` re-granted it.) The Supabase
security advisor lint `authenticated_security_definer_function_executable` is an
**accepted false positive** — the function is a pure boolean membership check with no
side effects. It is only called from within RLS policies, never directly by the client.

The `expenses` SELECT policy was extended:

```sql
create policy expenses_select_own_or_group on public.expenses for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (group_id is not null and public.is_group_member(group_id, (select auth.uid())))
  );
```

INSERT/UPDATE/DELETE on `expenses` remain owner-only.

### 4. `invite_group_member()` SECURITY DEFINER for email lookup

Clients cannot query `auth.users` — it is not exposed via PostgREST. An RPC running
under the caller's RLS (INVOKER) cannot look up another user by email either.

`invite_group_member` is declared SECURITY DEFINER so it runs with the function
owner's privileges, allowing the `SELECT id FROM auth.users WHERE lower(email) = ...`
query that is the only way to resolve an email to a user id.

This function applies its own authorization guard:

```sql
if not (
  public.is_group_member(p_group_id, v_uid)
  or exists (select 1 from public.groups g where g.id = p_group_id and g.created_by = v_uid)
) then
  raise exception 'not a group member';
end if;
```

EXECUTE is revoked from `anon` and `public`. `authenticated` retains EXECUTE so the
app can call it as an RPC. The Supabase security advisor will flag this function with
`authenticated_security_definer_function_executable` — **this lint is intentional and
accepted by design**. The function's own authz guard prevents unauthorized use.

All other group RPCs (`create_group`, `add_group_member`, `respond_group_invite`,
`create_shared_expense`, `update_shared_expense`, `create_settlement`,
`get_group_balances`, `get_personal_totals`) are SECURITY INVOKER — caller RLS
applies normally.

`user_exists_by_email(p_email) → boolean` (migration `20260608042550`) is a second
SECURITY DEFINER RPC, needed to check if a given email exists in `auth.users` without
exposing that table via PostgREST. REVOKE from `anon`/`public`; `authenticated`
retains EXECUTE. **Email enumeration trade-off:** any authenticated user can determine
whether an email is registered in RADAR. This is accepted because: (a) the check is
required to validate invite inputs in real time, (b) the same information is implicitly
available via `invite_group_member` response codes, and (c) enumeration requires a
valid RADAR session. The Supabase advisor flags it — documented in the migration file.

### 5. Split math in TypeScript (`lib/split-math.ts`)

The split computation lives in the client (`computeShares`, `simplifyDebts`), not in
the DB. Reasons:

- **Testability**: pure functions, no DB dependency.
- **Real-time UI feedback**: the `SplitEditor` needs to recompute on every keystroke;
  an RPC round-trip per keystroke would be unacceptable UX.
- **DB-side enforcement**: `create_shared_expense` validates `|Σsplits − amount| ≤ 0.01`
  as the final server-side gate. The client pre-validates for UX; the DB validates for
  integrity.

`computeShares(amount, members, mode, values)`:

- `equal`: converts to integer cents, divides evenly, assigns the remainder (from
  floating-point division) to the last member. Guarantees Σ == amount exactly.
- `custom`: passes values through; client validates Σ before submit.
- `percent`: converts each percentage to amount (same cent-rounding), assigns remainder
  to last.

`simplifyDebts(balances)`: greedy pairwise algorithm — sort by net descending, match
the largest creditor with the largest debtor, record the transfer (min of the two
absolute values), repeat. Runs separately per currency.

### 6. Balances per currency — no conversion

`get_group_balances` returns rows keyed by `(member_id, currency)`. ARS and USD amounts
are never mixed or converted. Reasons:

- No FX rate source is defined for the project yet (BCRA vs Bluelytics decision pending).
- Mixing currencies would require assumptions about exchange rate at expense time vs
  settlement time.
- The correct UX is to show two balance rows per member when a group has both ARS and
  USD expenses.

### 7. Deferred scope

Explicitly excluded from HU-17 MVP:

### 8. Shared expense entry point: toggle in the standard form

A `¿Gasto compartido?` toggle is available in the standard expense form and the OCR
review screen, in addition to the in-group "Registrar gasto" button. This avoids
forcing the user to navigate to a group to record a shared expense — a friction
identified in UX review.

The toggle is shown even when the user has no groups, presenting a CTA "Crear grupo"
to guide onboarding. Selecting a group inline reveals the who-paid and split fields
within the same form.

### 9. Personal-share accounting on the dashboard

The Home "Este mes" total and the personal expense list use the user's split share for
shared expenses (via `get_personal_totals` RPC), not the full ticket amount. Reasons:

- The user's financial reality is their share, not the total others owe.
- Showing the full amount would inflate the personal spending figures.

The expense detail and edit screens still display the full amount plus the split
breakdown, so the total is always accessible.

Shared expenses are differentiated in the list and dashboard with a `Users` icon and
a "Compartido" label.

### 10. Shared expense edit via `update_shared_expense`

A shared expense can be edited after creation (amount, category, items, who paid,
splits) using the `update_shared_expense` RPC (owner-only, SECURITY INVOKER). The
RPC validates Σsplits == amount and replaces the full split set atomically (delete +
reinsert), consistent with the `expense_items` update pattern.

Personal ↔ shared conversion (attaching or detaching `group_id`) is explicitly out of
scope — it would require migrating split records and resolving balance history.

### 11. Member management: rename placeholders + remove members

The group owner can rename placeholder members and remove any member via
`MemberManageSheet`. Removal cascades to `expense_splits` and `group_settlements`.
The owner is blocked from removing themselves.

The owner is warned before removal that historical split/settlement data will be lost.
This is acceptable because placeholders represent people without RADAR accounts (no
account to protect), and removing a registered member is a deliberate owner action
with explicit confirmation.

- **Push reminders** ("Recordar a X") — requires `device_tokens` table and push wiring.
- **Placeholder → account linking** — when a placeholder's named person later creates
  a RADAR account, no automatic merge occurs. Future HU.
- **Re-split of an existing shared expense** — MVP creates, deletes, and recreates.
  Splits do not have stable identity across saves (consistent with `expense_items`).
- **Roles/permissions beyond owner vs member** — no admin role or fine-grained write permissions.
- **Invite rate-limiting** — no cap on pending invitations per user for MVP.
- **Saldo validation ≤ deuda** — settlements can exceed the computed debt; MVP records
  the amount as-is. A future HU can add the validation and "saldar todo" UX.

---

## Alternatives considered

### A. Separate `shared_expenses` table

A dedicated table for shared expenses with its own RLS. Rejected because every expense
consumer would need a UNION or JOIN, the OCR/items/categories plumbing would need
adapting, and the data model is identical — only `group_id` distinguishes the use case.
The nullable column approach is consistent with how HU-16 distinguished system vs
user-owned categories.

### B. Auto-add invited users as `active`

Skip the `pending`/accept flow — the invited user is immediately `active` and appears
in splits. Rejected for the consent reason stated in Decision 2: users must not have
balance entries created for them without their agreement.

### C. Join-based RLS (no helper function)

Instead of `is_group_member()`, every policy could join `group_members` inline:

```sql
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = id and gm.user_id = auth.uid() and gm.status = 'active'
  )
)
```

This works on `groups` but fails on `group_members` itself (infinite recursion).
Using it on `groups` and then having `group_members` reference `groups` also recurses.
The SECURITY DEFINER helper is the standard Supabase pattern for this class of problem.

### D. Split math in PL/pgSQL

All split computation in the DB. Rejected: real-time UI feedback would require a
round-trip per keystroke; testing is harder; and the DB already validates the final
sum — the TS computation is just UX, not the authority.

### E. Single ARS/USD balance with conversion

Convert USD to ARS using a stored rate at expense time. Rejected: no FX source is
decided; historical rates would need to be recorded per-expense; and the correct
user expectation is to see the two currencies separately.

---

## Consequences

**Benefits:**

- OCR/items/categories UX works unchanged for shared expenses — no second form path.
- The standard-form toggle allows recording shared expenses from anywhere, not just from a group screen.
- Personal-share accounting (`get_personal_totals`) keeps the dashboard financially accurate.
- Consent model prevents balance abuse by third parties.
- `is_group_member` DEFINER centralizes the membership check in one place; RLS policies
  are readable and consistent.
- `invite_group_member` + `user_exists_by_email` DEFINER are the only viable ways to
  look up registered users by email without exposing `auth.users`; both accepted lints
  are documented.
- Split math in TS enables real-time feedback with no network cost; DB validates integrity.
- ARS/USD balances are always unambiguous; no FX risk.

**Tradeoffs:**

- `invite_group_member` and `user_exists_by_email` lints
  (`authenticated_security_definer_function_executable`) are permanently present in the
  security advisor. Annotated in migration files and documented here.
- `user_exists_by_email` enables email enumeration by authenticated users — accepted
  trade-off (see Decision 4 addendum).
- `is_group_member` MUST retain EXECUTE for `authenticated` or all group RLS breaks.
  The advisor lint for this function is a false positive that must never be "fixed" by
  revoking `authenticated`. Documented in §7 AGENTS.md.
- `pending` members add UI complexity (badge, invite inbox screen).
- Re-split on edit requires delete + recreate (split ids rotate); consistent with the
  `expense_items` pattern.
- Balances separated by currency require the UI to handle the "two rows per member" case.

---

## Implementation

1. `supabase/migrations/20260608012650_shared_expenses_schema.sql` — create `groups`,
   `group_members`, `expense_splits`, `group_settlements`; alter `expenses`; create
   `is_group_member()` DEFINER + REVOKE; RLS on all tables including extended
   `expenses` SELECT policy.
2. `supabase/migrations/20260608013250_revoke_is_group_member_authenticated.sql` —
   REVOKE of `authenticated` from `is_group_member` (broke RLS — kept for history).
3. `supabase/migrations/20260608013859_shared_expenses_rpcs.sql` — `create_group`,
   `add_group_member`, `invite_group_member` (DEFINER), `respond_group_invite`,
   `create_shared_expense`, `create_settlement`, `get_group_balances`.
4. `supabase/migrations/20260608033734_grant_is_group_member_execute.sql` — re-GRANT
   EXECUTE on `is_group_member` to `authenticated` (corrects `013250`).
5. `supabase/migrations/20260608042550_user_exists_by_email.sql` — `user_exists_by_email`
   DEFINER RPC for on-blur email validation.
6. `supabase/migrations/20260608050920_get_personal_totals.sql` — `get_personal_totals`
   INVOKER RPC for personal-share accounting.
7. `supabase/migrations/20260608052600_update_shared_expense.sql` — `update_shared_expense`
   INVOKER RPC for owner-only edit.
8. `lib/split-math.ts` — `computeShares`, `simplifyDebts`; `resolveIncluded` for
   participant subset.
9. `lib/group-balance.ts` — wraps `get_group_balances` RPC results.
10. `lib/schemas/group.ts` — zod schemas for group, member, split.
11. `lib/repositories/groups.ts` + `shared-expenses.ts` — typed repository functions
    (`checkUserExists`, `updateMember`, `removeMember`).
12. `hooks/use-groups.ts` — TanStack Query hooks.
13. `components/groups/*` — `group-form` (con-cuenta + sin-cuenta), `group-card`,
    `member-avatars-row`, `split-editor` (participant subset + "Vos" label),
    `balance-row`, `member-selector-sheet` ("Vos" label), `member-manage-sheet`.
14. `app/(protected)/groups/{_layout,index,new,[id],expense}.tsx` — screens.
15. `ExpenseForm` + OCR review screen — `¿Gasto compartido?` toggle integration.
16. Home wiring: "Grupos" quick-action + "Mis grupos" section + invite badge +
    personal-share totals via `get_personal_totals`.

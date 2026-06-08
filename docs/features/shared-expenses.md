# Shared expenses (HU-17)

## Overview

HU-17 implements RADAR's second value pillar: shared expense tracking with groups.
Users can create groups, add members (registered via email invite or unregistered
as placeholders), record shared expenses with flexible split options, see net balances
per member and currency, and mark debts as settled.

This replaces the informal WhatsApp debt-tracking that is the current behavior for
the target persona.

**Branch:** `feat/shared-expenses`
**Release:** Entrega 3
**Complexity:** MEDIO (8 atomic changes)
**Test baseline after this feature:** 996 tests, 68 suites

---

## Requirements

### Functional

| #   | Requirement                                                                            | Status  |
| --- | -------------------------------------------------------------------------------------- | ------- |
| 1   | Create a group with name, icon, and color                                              | Shipped |
| 2   | Add unregistered participants as named placeholders                                    | Shipped |
| 3   | Invite registered users by exact email (consent model); add con/sin cuenta in one step | Shipped |
| 4   | Accept or decline a group invitation in-app                                            | Shipped |
| 5   | Record a shared expense with full form (OCR, items, category, currency)                | Shipped |
| 6   | Choose who paid (any active member or placeholder); current user labeled "Vos"         | Shipped |
| 7   | Split by equal shares, custom amounts, or percentages over a participant subset        | Shipped |
| 8   | View net balances per member, separated by currency                                    | Shipped |
| 9   | Mark a debt as settled (`group_settlements`)                                           | Shipped |
| 10  | Record a shared expense via toggle in the standard form and OCR review screen          | Shipped |
| 11  | Dashboard and expense list show user's share for shared expenses (not full total)      | Shipped |
| 12  | Edit a shared expense (amount, category, items, who paid, splits)                      | Shipped |
| 13  | Owner can rename placeholders and remove members (`MemberManageSheet`)                 | Shipped |
| 14  | Email existence validated on blur with `user_exists_by_email` RPC                      | Shipped |

### Non-functional

- **Security:** Registered users only enter splits/balances after accepting. `is_group_member()` SECURITY DEFINER prevents RLS recursion; `authenticated` MUST retain EXECUTE (revoking breaks all group RLS — see ADR). `invite_group_member()` and `user_exists_by_email()` are SECURITY DEFINER RPCs for email lookup in `auth.users` (intentional advisor lints — see ADR). `user_exists_by_email` permits email enumeration by authenticated users (accepted trade-off).
- **Integrity:** `create_shared_expense` validates Σsplits == amount (±0.01) and membership of `paid_by` and all split members. All writes are atomic.
- **Backward compat:** `expenses.group_id` and `expenses.paid_by_member_id` are nullable; all personal expense flows are unaffected.
- **Performance:** Indexes on `group_id`, `user_id`, `expense_id` on all new tables. Balances computed via `get_group_balances` RPC (single aggregate query).

---

## Edge cases

### Consent and membership

| Edge case                            | Behavior                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Invite email not found               | Returns `{status:'not_found'}`; UI suggests adding as placeholder                             |
| Invite already-member email          | Returns `{status:'already_member'}`; no duplicate row                                         |
| Re-invite after decline              | Resets `declined` → `pending`; returns `{status:'invited'}`                                   |
| Pending member reads group data      | RLS denies: `status='active'` required. Member sees own `group_members` row to accept/decline |
| Another user responds foreign invite | RPC filters `user_id = auth.uid()`; raises exception                                          |
| External user reads group            | `is_group_member` returns false → RLS → empty result                                          |

### Split math

| Edge case                        | Behavior                                                           |
| -------------------------------- | ------------------------------------------------------------------ |
| Σsplits ≠ amount                 | UI blocks submit; RPC rejects with `'splits must sum to amount'`   |
| Equal split with remainder       | `computeShares` assigns remainder to last member; Σ == total       |
| Percent does not sum to 100      | UI shows running total in red; submit disabled                     |
| `share_amount = 0` for a member  | Allowed (≥ 0); member owes nothing for that expense                |
| `paid_by_member_id` not in group | RPC rejects                                                        |
| Split `member_id` not in group   | RPC rejects                                                        |
| Single active member in group    | Trivial split (100% to owner); net = 0; UI suggests adding members |

### Balances and settlement

| Edge case                        | Behavior                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ARS + USD expenses in same group | Balances shown as two rows per member; never converted                                                |
| Settlement amount > debt         | MVP records it as-is (may produce positive net for debtor); documented limitation                     |
| Delete group with expenses       | CASCADE removes members/splits/settlements; `expenses.group_id` → null (expense survives as personal) |
| Remove member with open balance  | CASCADE on splits/settlements; owner warned that history is lost                                      |

---

## Architecture

### Database schema

See [ADR: Shared expenses schema](../decisions/2026-06-07-shared-expenses-schema.md) for full decision rationale.

#### New tables

| Table               | Key columns                                                                                                              | RLS                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `groups`            | `name` (1–60), `icon`, `color`, `created_by`                                                                             | Select: active member or creator; insert: own; update/delete: creator only                                           |
| `group_members`     | `user_id` nullable, `display_name`, `role` (owner/member), `status` (active/pending/declined), `invited_by`, `joined_at` | Select: own row or via `is_group_member`; insert: active member or creator; update: self or creator; delete: creator |
| `expense_splits`    | `expense_id`, `group_id`, `member_id`, `share_amount numeric(14,2) ≥ 0`                                                  | Select + all writes: `is_group_member`                                                                               |
| `group_settlements` | `from_member_id`, `to_member_id`, `amount numeric(14,2) > 0`, `currency` (ARS/USD), `created_by`, `settled_at`           | Select + all writes: `is_group_member`                                                                               |

#### Modified table

`expenses` gained two nullable columns:

- `group_id uuid` references `public.groups(id) ON DELETE SET NULL`
- `paid_by_member_id uuid` references `public.group_members(id) ON DELETE SET NULL`

The SELECT policy was replaced:

```sql
-- was: user_id = auth.uid()
-- now:
user_id = auth.uid()
  OR (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
```

INSERT/UPDATE/DELETE remain owner-only.

#### Helper function

`is_group_member(p_group_id uuid, p_user_id uuid) → boolean`

- SECURITY DEFINER, `set search_path = ''`
- REVOKE from anon, public, authenticated
- Used by all group RLS policies; breaks the recursion that would otherwise occur if `group_members` RLS referenced `group_members`

### RPCs

| RPC                     | Security    | Purpose                                                                                     |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `create_group`          | INVOKER     | Group + owner member + placeholders + pending invites in one transaction                    |
| `add_group_member`      | INVOKER     | Add placeholder to existing group                                                           |
| `invite_group_member`   | **DEFINER** | Email lookup in `auth.users`; own authz guard; intentional advisor lint                     |
| `respond_group_invite`  | INVOKER     | Accept/decline own invitation                                                               |
| `create_shared_expense` | INVOKER     | Validates + inserts expense + items + splits atomically                                     |
| `update_shared_expense` | INVOKER     | Owner-only edit: patch expense fields, replace items, replace splits atomically             |
| `create_settlement`     | INVOKER     | Inserts settlement row after validation                                                     |
| `get_group_balances`    | INVOKER     | Net per (member_id, currency); non-members get empty via RLS                                |
| `user_exists_by_email`  | **DEFINER** | On-blur email check for group forms; intentional lint; email enumeration trade-off accepted |
| `get_personal_totals`   | INVOKER     | Personal-share totals per currency/date-range; uses split share for shared expenses         |

### TypeScript modules

- **`lib/split-math.ts`**: `computeShares(amount, members, mode, values?)` — equal/custom/percent with cent-level remainder to last member. `resolveIncluded(members, includedIds)` — filters to participant subset. `simplifyDebts(balances)` — greedy pairwise, per currency.
- **`lib/group-balance.ts`**: wraps `get_group_balances` RPC; maps to typed `GroupBalance[]`.
- **`lib/schemas/group.ts`**: zod schemas for `Group`, `GroupMember`, `GroupSplit`.
- **`lib/repositories/groups.ts`** + **`lib/repositories/shared-expenses.ts`**: typed wrappers over RPCs (`checkUserExists`, `updateMember`, `removeMember`, `getPersonalTotals`).
- **`hooks/use-groups.ts`**: TanStack Query hooks; invalidates `groupKeys.*` on mutations.

### UI components

| Component                                     | Purpose                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `components/groups/group-form.tsx`            | Name + icon + color + con-cuenta/sin-cuenta members in one step         |
| `components/groups/group-card.tsx`            | Group list card with summarized balance                                 |
| `components/groups/member-avatars-row.tsx`    | Initials avatars on hash-derived color circles                          |
| `components/groups/split-editor.tsx`          | Three-mode split + participant subset toggles + "Vos" label             |
| `components/groups/balance-row.tsx`           | Per-member balance row (green/red/neutral)                              |
| `components/groups/member-selector-sheet.tsx` | Bottom sheet to pick "who paid"; current user labeled "Vos"             |
| `components/groups/member-manage-sheet.tsx`   | Owner sheet: rename placeholders, remove members (cascade confirmation) |

### Screens

| Screen                               | Purpose                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `app/(protected)/groups/_layout.tsx` | Stack navigator                                            |
| `app/(protected)/groups/index.tsx`   | Group list + empty state                                   |
| `app/(protected)/groups/new.tsx`     | Create group form                                          |
| `app/(protected)/groups/[id].tsx`    | Group detail: tabs Gastos / Saldos, members, invite        |
| `app/(protected)/groups/expense.tsx` | Shared expense form (ExpenseForm + who paid + SplitEditor) |

Groups are accessed from the Home quick-action "Grupos" and the "Mis grupos" section. No new tab is added; the tab bar stays at 4 items.

The standard `ExpenseForm` (new/edit) and the OCR review screen include a
`¿Gasto compartido?` toggle that exposes the group selector and split fields inline,
so users can record shared expenses without navigating to the group first.

### Migrations

| File                                                                          | Applied |
| ----------------------------------------------------------------------------- | ------- |
| `supabase/migrations/20260608012650_shared_expenses_schema.sql`               | Yes     |
| `supabase/migrations/20260608013250_revoke_is_group_member_authenticated.sql` | Yes     |
| `supabase/migrations/20260608013859_shared_expenses_rpcs.sql`                 | Yes     |
| `supabase/migrations/20260608033734_grant_is_group_member_execute.sql`        | Yes     |
| `supabase/migrations/20260608042550_user_exists_by_email.sql`                 | Yes     |
| `supabase/migrations/20260608050920_get_personal_totals.sql`                  | Yes     |
| `supabase/migrations/20260608052600_update_shared_expense.sql`                | Yes     |

---

## Out of scope (explicit)

- **Push reminders** — requires `device_tokens` table (still pending).
- **Placeholder → account linking** — when a placeholder's person later creates a RADAR account, no automatic merge.
- **Personal ↔ shared conversion** — `group_id` cannot be added or removed from an existing expense; edit supports changes within the shared context only.
- **Advanced roles** — only owner vs member.
- **Invite rate-limiting** — no cap on pending invites for MVP.
- **Settlement validation ≤ debt** — MVP registers any positive amount.

---

## Related documents

- [HU-17 user flow](../user-flows/HU-17-gastos-compartidos.md)
- [ADR: Shared expenses schema](../decisions/2026-06-07-shared-expenses-schema.md)
- [HU-18 expense line items](../user-flows/HU-18-items-detallados.md) — reused in shared expense form
- [HU-16 custom categories](../user-flows/HU-16-categorias-personalizadas.md) — reused in shared expense form

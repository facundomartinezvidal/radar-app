# Docs Complete: HU-17 Gastos compartidos (-docs atomic)

Date: 2026-06-08
Branch: feat/shared-expenses-docs

## Files created

- `docs/user-flows/HU-17-gastos-compartidos.md` — 11-section user flow (repo canonical)
- `/Users/fmartinezvidal/Documents/github/obsidian-vaults/uade/seminario/user-flows/HU-17-gastos-compartidos.md` — Obsidian mirror (identical)
- `docs/decisions/2026-06-07-shared-expenses-schema.md` — ADR (7 decisions, alternatives, consequences)
- `docs/features/shared-expenses.md` — consolidated feature doc

## Files edited

- `AGENTS.md`:
  - §6 DB schema table: added groups/group_members/expense_splits/group_settlements rows; updated expenses row; added shared-expenses schema paragraph
  - §7: added "SECURITY DEFINER RPCs — intentional advisor lints" section documenting the is_group_member and invite_group_member patterns
  - §9: test baseline 603 → 834
  - §10: added HU-17 shipped entry with doc links; updated pending item #1 (groups done, device_tokens still pending)

## Quality gates

- format:check: PASS
- lint: PASS
- typecheck: PASS
- test: 834/834 PASS (64 suites)

## Notes

- Prettier reformatted AGENTS.md, HU-17 user flow, and shared-expenses feature doc — Obsidian mirror re-synced after formatting

## ADDED Requirements

### Requirement: Queries are gated to linked users

Movement queries SHALL only be answered for numbers that resolve to a linked user. Queries from unlinked numbers SHALL be refused with a prompt to link.

#### Scenario: Unlinked sender cannot query
- **WHEN** an unlinked number asks "¿cuánto gasté este mes?"
- **THEN** no data is returned and the bot prompts the user to link from the app

### Requirement: Natural-language movement queries

A linked user SHALL be able to ask about their movements in natural language. The webhook SHALL classify the query intent, extract the period and optional category/currency, resolve the period to `from`/`to` timestamps server-side, and answer from the share-aware DEFINER read RPCs (`get_personal_totals_for`, `get_expense_by_category_for`, `get_expense_by_period_for`, `get_income_by_period_for`). Queries SHALL be read-only and SHALL NOT require confirmation.

#### Scenario: Total spent this month
- **WHEN** a linked user asks "¿cuánto gasté este mes?"
- **THEN** the bot resolves the current month range, calls `get_personal_totals_for`, and replies with the totals per currency

#### Scenario: Spending by category
- **WHEN** a linked user asks "¿en qué gasté esta semana?"
- **THEN** the bot calls `get_expense_by_category_for` for the week and replies with the top categories and amounts

#### Scenario: Group splits counted as the user's share
- **WHEN** the user's expenses include shared group expenses
- **THEN** the query totals count only the user's split amount (share-aware), matching the in-app values

#### Scenario: No data for the period
- **WHEN** a query period has no movements
- **THEN** the bot replies that there are no movements for that period rather than erroring

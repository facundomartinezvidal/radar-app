## ADDED Requirements

### Requirement: Recommendations are gated to linked users

Recommendations SHALL only be produced for numbers that resolve to a linked user. Requests from unlinked numbers SHALL be refused with a prompt to link.

#### Scenario: Unlinked sender cannot get recommendations
- **WHEN** an unlinked number asks "¿cómo vengo este mes?"
- **THEN** no recommendation is produced and the bot prompts the user to link from the app

### Requirement: Natural-language recommendations from aggregated data

A linked user SHALL be able to request spending recommendations in natural language. The webhook SHALL build the `generate-insights` input payload (`currency`, `period`, `totals`, `byCategory`, `trend`, `prevPeriodExpenses`) from the DEFINER read RPCs for the current and previous period, call `generate-insights` (with a service-role internal credential), and reply with the top 1–3 insights formatted for WhatsApp. Recommendations SHALL be read-only.

#### Scenario: Recommendation reply
- **WHEN** a linked user asks "dame un consejo de gastos"
- **THEN** the bot assembles the insights payload from the user's aggregated data, calls `generate-insights`, and replies with the top recommendations

#### Scenario: Insufficient data fallback
- **WHEN** the user has little or no data for the period
- **THEN** the bot replies with a graceful message instead of an empty or erroring response

#### Scenario: Insight service failure
- **WHEN** `generate-insights` times out or errors
- **THEN** the bot replies that it cannot generate recommendations right now and does not crash the conversation

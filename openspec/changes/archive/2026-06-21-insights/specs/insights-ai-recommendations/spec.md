# Spec delta: insights-ai-recommendations

## ADDED Requirements

### Requirement: AI recommendations from spending aggregates

The system SHALL generate actionable, Spanish (rioplatense) recommendations from the active period's aggregates via a Groq edge function (`generate-insights`). The edge function SHALL receive client-computed aggregates (it does not query the database), require a Bearer JWT, validate the user, and return 2–4 normalized insights.

#### Scenario: Recommendations generated from aggregates
- **GIVEN** the period has expenses and incomes
- **WHEN** the Insights view requests AI recommendations
- **THEN** the edge function returns `{ data: { insights: [...] } }` with 2–4 insights, each having a `kind`, a `title` (≤48 chars) and a `body` (≤160 chars) in Spanish

#### Scenario: Authentication required
- **GIVEN** a request without a valid Bearer JWT
- **WHEN** it reaches the edge function
- **THEN** it responds with an `UNAUTHENTICATED` error and no insights

#### Scenario: Output is normalized
- **GIVEN** the LLM returns more than 4 insights or over-long fields
- **WHEN** the edge function processes the response
- **THEN** it caps to 4 insights, clamps field lengths, and drops invalid `kind` values before returning

### Requirement: Transparent fallback to local heuristics

When the edge function fails for any reason (timeout, missing quota, network error, invalid JSON), the client SHALL fall back to locally computed heuristic insights so the user always sees useful output, without surfacing an error.

#### Scenario: Groq times out
- **GIVEN** the edge function does not respond within its timeout
- **WHEN** the client requests recommendations
- **THEN** the client computes local heuristic insights and renders them with no visible error

#### Scenario: Local heuristics rules
- **GIVEN** aggregates where the net balance is negative
- **WHEN** local heuristics run
- **THEN** they include a warning insight about spending more than earned, among up to 4 prioritized insights

#### Scenario: No movements yields no card
- **GIVEN** the period has no expenses and no incomes
- **WHEN** recommendations are requested (LLM or heuristics)
- **THEN** an empty insights list is returned and the recommendations card is not shown

### Requirement: Client-side caching of recommendations

Recommendations SHALL be cached per `(period, currency)` key with a long staleTime (1 hour) to limit Groq cost. Switching to an already-cached period/currency SHALL not trigger a new request.

#### Scenario: Cached period does not refetch
- **GIVEN** recommendations were already fetched for "Este mes" in ARS within the staleTime window
- **WHEN** the user returns to that same period and currency
- **THEN** the cached insights are shown without a new edge-function call

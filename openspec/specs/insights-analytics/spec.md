# insights-analytics Specification

## Purpose
TBD - created by archiving change insights. Update Purpose after archive.
## Requirements
### Requirement: Temporal filtering of the Insights view (HU-23)

The Insights view SHALL let the user scope all charts and aggregates to a time period via presets (Este mes, Mes pasado, Últimos 3 meses, Este año) and a month selector with previous/next navigation. The active period SHALL drive every aggregation query.

#### Scenario: Selecting a preset rescopes the data
- **GIVEN** the user is on the Insights view
- **WHEN** they tap the "Mes pasado" preset
- **THEN** all charts re-query for the previous calendar month's date range and re-render with that period's data

#### Scenario: Navigating months
- **GIVEN** the month selector shows the current month
- **WHEN** the user taps the previous-month arrow
- **THEN** the selector shows the prior month and the charts re-query for that month

#### Scenario: Future months are not selectable
- **GIVEN** the month selector shows the current month
- **WHEN** the user attempts to navigate to a future month
- **THEN** navigation is clamped and the period does not advance past the current month

### Requirement: Expenses bar chart with filter (HU-24)

The Insights view SHALL render a bar chart of expense totals bucketed by period (day/week/month depending on the selected range), reflecting the active temporal filter and currency.

#### Scenario: Bars reflect the active filter
- **GIVEN** a period spanning three months is selected
- **WHEN** the expenses bar chart renders
- **THEN** it shows one bar per month with the share-aware expense total for that bucket in the active currency

#### Scenario: Bars update on currency toggle
- **GIVEN** the bar chart is showing ARS totals
- **WHEN** the user switches the currency toggle to USD
- **THEN** the chart re-queries and shows USD bucket totals without mixing currencies

### Requirement: Category donut chart

The Insights view SHALL render a donut chart of expense totals grouped by category for the active period and currency, using each category's own color and icon.

#### Scenario: Donut groups by category
- **GIVEN** the user has expenses across multiple categories in the period
- **WHEN** the donut renders
- **THEN** each segment represents one category, colored with that category's color, sized by its share-aware total

#### Scenario: Uncategorized expenses
- **GIVEN** an expense has no category
- **WHEN** the donut renders
- **THEN** its amount is grouped under a "Sin categoría" segment with a default color and icon

### Requirement: Income-vs-expense and monthly trend charts

The Insights view SHALL render an income-vs-expense comparison and a monthly trend line, composed client-side by joining monthly expense and income buckets by date.

#### Scenario: Income vs expense comparison
- **GIVEN** the period has both incomes and expenses
- **WHEN** the comparison chart renders
- **THEN** it shows income and expense totals per month for the active currency

#### Scenario: Trend over months
- **GIVEN** a multi-month period is selected
- **WHEN** the trend line renders
- **THEN** it plots one point per month of total expenses in the active currency

### Requirement: Multi-currency isolation via toggle

The Insights view SHALL never sum ARS and USD together. A currency toggle (reusing `CurrencyToggle`) SHALL select a single active currency, and all charts and aggregates SHALL reflect only that currency.

#### Scenario: Switching currency re-keys queries
- **GIVEN** charts are showing ARS data
- **WHEN** the user selects USD
- **THEN** all charts re-query for USD and show only USD amounts

### Requirement: Share-aware aggregation RPCs

Aggregation SHALL be performed in Postgres via `get_expense_by_category`, `get_expense_by_period` and `get_income_by_period`, all SECURITY INVOKER (running under the caller's RLS). The expense RPCs SHALL count only the caller's `share_amount` for group expenses, using the same rule as `get_personal_totals`.

#### Scenario: Group expense counts only the user's share
- **GIVEN** an expense belongs to a group and the caller's split is a fraction of the total
- **WHEN** `get_expense_by_category` or `get_expense_by_period` aggregates it
- **THEN** only the caller's `share_amount` is added to the total, matching `get_personal_totals` for the same range

#### Scenario: RPC runs under caller RLS
- **GIVEN** a caller authenticated as user A
- **WHEN** an aggregation RPC executes
- **THEN** it returns only user A's rows and never another user's data

### Requirement: Empty state for periods without movements

When the selected period and currency have no expenses or incomes, the view SHALL show an illustrated empty state with a CTA, instead of empty or zeroed charts.

#### Scenario: No data in period
- **GIVEN** the selected period has no expenses and no incomes in the active currency
- **WHEN** the view renders
- **THEN** an illustrated empty state with a call to action is shown and charts are not rendered


# RADAR — App UI Kit

Mobile-first dark UI kit. Pixel-ish mock, not production code.

## Files

- `index.html` — interactive demo. Tap tab bar, `+` to open the new-expense bottom sheet.
- `RadarComponents.jsx` — primitives: `Button`, `Card`, `Avatar`, `AvatarStack`, `ExpenseRow`, `TabBar`, `StatusBar`, `Icon`.
- `RadarScreens.jsx` — full screens: `HomeScreen`, `ExpensesScreen`, `GroupsScreen`, `ProfileScreen`, `AddExpenseSheet`.

## Screens

1. **Home** — saldo unificado hero, billeteras conectadas (scroll horizontal), últimos movimientos.
2. **Gastos** — lista agrupada por día, filtros tipo chip, mezcla ARS/USD con conversión.
3. **Grupos** — cards de grupos con avatares apilados, balance "debés/te deben", estado "saldada".
4. **Perfil** — datos, integraciones (billeteras, WhatsApp bot), preferencias de moneda.
5. **Nuevo gasto (sheet)** — toggle ARS/USD, monto grande, descripción, grid de categorías, CTA.

## Not covered (out of MVP scope)

- Onboarding/auth
- Detalle de gasto individual
- Saldar deuda con alias CBU (flow)
- Chat con WhatsApp bot

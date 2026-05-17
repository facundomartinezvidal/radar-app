# HU-04 — Menú principal

## 1. Identificación

| Campo            | Valor                                            |
| ---------------- | ------------------------------------------------ |
| **ID**           | HU-04                                            |
| **Historia**     | Menú principal                                   |
| **Persona**      | Cualquier usuario autenticado                    |
| **Estado**       | MVP                                              |
| **Relevancia**   | Alta                                             |
| **Release**      | Release 1                                        |
| **Trazabilidad** | `feat(expenses)` — home wire-up + tab bar Gastos |

## 2. Historia

> **Como** usuario autenticado de RADAR,
> **quiero** un menú principal con resumen del mes y accesos directos,
> **para** entender de un vistazo cómo voy de plata y saltar rápido a la
> acción que necesito (registrar, ver historial, escanear, ver grupos).

## 3. Pre-condiciones

- El usuario completó HU-01 (login) o HU-02/HU-03 (registro + OTP).
- `useAuthStore.isAuthenticated === true`.
- Existe conexión a internet (o caché de TanStack Query con datos del
  último fetch).

## 4. Post-condiciones

- El usuario ve su balance del mes en ARS + USD.
- El usuario ve las 4 transacciones más recientes con icono y color de
  categoría.
- Los accesos directos están disponibles y son navegables.
- Las pestañas inferiores (Inicio / Gastos / Cámara / Insights) están
  visibles y operativas.

## 5. Flujo principal

1. El usuario aterriza en `/(protected)/(tabs)` después de iniciar sesión.
2. La app renderiza el Home (`(tabs)/index.tsx`):
   - Saludo: "Hola, {nombre derivado del email}" o "Hola".
   - Avatar con la inicial; campana de notificaciones (placeholder).
   - **Card hero "Este mes"**: `display` con total ARS, subtítulo con
     total USD, pill con cantidad de gastos.
   - **Quick actions** (4 botones): Agregar, Grupos, Escanear, Más.
   - **Mis grupos**: chips horizontales (placeholder de Release 2).
   - **Últimos gastos**: card con las últimas 4 filas (icono + nombre +
     meta + monto).
   - **Insight IA**: card decorativa (Release 2+).
   - **Cerrar sesión**: botón ghost al pie (temporal para QA).
3. La app dispara dos queries en paralelo vía TanStack Query:
   - `useExpenseTotals({})` → `sumExpensesByCurrency`.
   - `useExpenses({ limit: 4 })` → `listExpenses`.
4. Mientras cargan, las secciones permanecen renderizadas con valores
   por defecto (`$ 0,00` / "Todavía no cargaste nada este mes.").
5. Al recibir datos, los totales y la lista se actualizan; los iconos
   adoptan el color de la categoría correspondiente.
6. El usuario interactúa con cualquier acceso:
   - **Agregar** → `router.push('/(protected)/expense/new')` (HU-13).
   - **Tab "Gastos"** → `/(protected)/(tabs)/expenses` (HU-07).
   - **Tap en fila de Últimos gastos** →
     `/(protected)/expense/{id}` (edición — HU-12).
   - **Tab "Cámara"** y **"Insights"** → placeholders (Release 2+).

## 6. Flujos alternativos

### 6.a — Sin gastos cargados

- `useExpenses({limit:4})` devuelve `[]`.
- La card "Últimos gastos" muestra `"Todavía no cargaste nada este mes."`
- El hero balance queda en `$ 0,00` / `+ US$ 0,00`.

### 6.b — Error al cargar

- Si la query falla (caída de red, RLS deniega, etc.), TanStack Query
  reintenta según política. El usuario no ve una pantalla de error
  bloqueante en el Home; los totales se muestran como `$ 0,00`.

### 6.c — Sesión expirada en background

- Si el `accessToken` expira mientras la app está abierta,
  `autoRefreshToken: true` lo renueva. Si la refresh falla, el listener
  emite `SIGNED_OUT` y `(protected)/_layout.tsx` redirige a sign-in.

## 7. Diagrama

```mermaid
flowchart TD
    A([Usuario autenticado]) --> B[Home (tabs)/index.tsx]
    B -->|useExpenseTotals| C[(Supabase: expenses)]
    B -->|useExpenses limit=4| C
    C -->|datos| B

    B --> D{Acción}
    D -->|Tap "Agregar" / pill Plus| E[Nuevo gasto<br/>HU-13]
    D -->|Tab "Gastos"| F[Historial<br/>HU-07]
    D -->|Tap fila| G[Editar gasto<br/>HU-12]
    D -->|Tab "Cámara"| H[Placeholder]
    D -->|Tab "Insights"| I[Placeholder]
```

## 8. Pantallas involucradas

| Ruta                           | Archivo                               | Rol                 |
| ------------------------------ | ------------------------------------- | ------------------- |
| `/(protected)/(tabs)/_layout`  | `app/(protected)/(tabs)/_layout.tsx`  | Tab bar (4 tabs)    |
| `/(protected)/(tabs)/index`    | `app/(protected)/(tabs)/index.tsx`    | Home / dashboard    |
| `/(protected)/(tabs)/expenses` | `app/(protected)/(tabs)/expenses.tsx` | Historial (HU-07)   |
| `/(protected)/expense/new`     | `app/(protected)/expense/new.tsx`     | Nuevo gasto (HU-13) |
| `/(protected)/expense/[id]`    | `app/(protected)/expense/[id].tsx`    | Editar (HU-12)      |

## 9. Criterios de aceptación

- [ ] Al iniciar sesión, el usuario aterriza directamente en el Home.
- [ ] El Home muestra el saludo personalizado con el nombre derivado del
      email (mayúscula inicial).
- [ ] El balance del mes en ARS se renderiza con punto miles + coma
      decimal y `tabular-nums` (`$ 0,00` cuando no hay datos).
- [ ] El balance USD se muestra como subtítulo (`+ US$ 0,00`).
- [ ] Cada fila de "Últimos gastos" usa el color de su categoría (no
      siempre rojo).
- [ ] "Agregar" abre la pantalla de nuevo gasto.
- [ ] Tap en una fila abre la edición del gasto correspondiente.
- [ ] "Ver todos" abre el tab Gastos.
- [ ] La tab bar inferior contiene: Inicio, Gastos, Cámara, Insights
      con iconos Lucide stroke 1.5 y color brand[400] al estar activo.

## 10. Notas técnicas

- **Hooks**: `useSession`, `useExpenses`, `useExpenseTotals`.
- **Cache invalidation**: cualquier mutación (HU-12 / HU-13) invalida
  `expenseKeys.all` y refresca el Home automáticamente.
- **Saludo**: deriva del `user.email` antes del `@`, con mayúscula
  inicial.
- **Formato dinero**: `lib/format/money.ts` → `formatMoney`.
- **Icono de categoría**: lucide-react-native, nombre stored en
  `categories.icon`, color stored en `categories.color`.
- **Tests**: `app/(protected)/(tabs)/__tests__/index.test.tsx` — saludo,
  totales, navegación de quick actions, sign-out.

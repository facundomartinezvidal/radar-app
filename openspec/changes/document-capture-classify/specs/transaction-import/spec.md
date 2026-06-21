## ADDED Requirements

### Requirement: Ruteo de transacción única por dirección

Cuando `extract-document` devuelve **una** transacción, el sistema SHALL precargar el formulario de
**gasto** si `direction = 'expense'` o el formulario de **ingreso** si `direction = 'income'`, mostrando
un indicador del tipo de documento detectado.

#### Scenario: Transferencia enviada precarga gasto
- **WHEN** el resultado tiene 1 transacción con `direction = 'expense'`
- **THEN** se muestra `ExpenseForm` precargado con monto, moneda, fecha, contraparte/comercio y categoría sugerida

#### Scenario: Transferencia recibida precarga ingreso
- **WHEN** el resultado tiene 1 transacción con `direction = 'income'`
- **THEN** se muestra el formulario de ingreso precargado (`IncomePrefill`) con monto, moneda, fecha, descripción y categoría

#### Scenario: Usuario invierte la dirección
- **WHEN** el usuario cambia el toggle ingreso/gasto en la revisión
- **THEN** el sistema cambia al formulario correspondiente conservando los datos ya extraídos

#### Scenario: Documento sin monto o tipo unknown
- **WHEN** la transacción no tiene monto o `documentType = 'unknown'`
- **THEN** se muestra el formulario vacío con un aviso de que no se detectaron datos

### Requirement: Import en lote de múltiples transacciones

Cuando `extract-document` devuelve **varias** transacciones (resumen de tarjeta), el sistema SHALL mostrar
una lista en la que cada fila puede seleccionarse/deseleccionarse, con monto, fecha, comercio, categoría
editable y un toggle gasto/ingreso, y SHALL importar **solo** las filas seleccionadas.

#### Scenario: Selección parcial
- **WHEN** el usuario tilda 3 de 8 consumos y confirma "Importar"
- **THEN** el sistema crea exactamente 3 registros y deja los otros 5 sin crear

#### Scenario: Sin filas seleccionadas
- **WHEN** el usuario no tilda ninguna fila e intenta importar
- **THEN** el botón de import está deshabilitado o muestra un aviso, y no se crea ningún registro

#### Scenario: Filas mixtas gasto/ingreso
- **WHEN** la selección incluye filas marcadas como gasto y otras como ingreso
- **THEN** las filas de gasto se insertan en `expenses` y las de ingreso en `incomes`

### Requirement: Import atómico y respetuoso de RLS

El import en lote SHALL ejecutarse mediante un RPC transaccional `import_transactions` (SECURITY INVOKER)
de modo que, o bien se crean todas las filas seleccionadas, o bien ninguna, y SHALL insertar siempre bajo
el `user_id` autenticado respetando las políticas RLS.

#### Scenario: Fallo a mitad del import
- **WHEN** una de las filas falla la validación durante el import
- **THEN** ninguna fila se persiste y se informa el error al usuario

#### Scenario: Aislamiento por usuario
- **WHEN** el RPC inserta las transacciones
- **THEN** todos los registros quedan asociados al usuario autenticado y RLS impide insertar para otro usuario

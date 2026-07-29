## ADDED Requirements

### Requirement: Conversión de PDF a imagen server-side

La edge function `extract-document` SHALL convertir un PDF recibido a imágenes (PNG) del lado del
servidor antes del OCR, procesando como máximo **3 páginas**. Las imágenes SHALL pasarse directo sin
conversión.

#### Scenario: PDF de una página
- **WHEN** el cliente envía un PDF de una página a `extract-document`
- **THEN** la función rasteriza esa página y corre el OCR sobre la imagen resultante

#### Scenario: PDF de más de 3 páginas
- **WHEN** el cliente envía un PDF de 5 páginas
- **THEN** la función procesa sólo las primeras 3 páginas y señala que el documento fue truncado

#### Scenario: PDF corrupto o ilegible
- **WHEN** el PDF no puede rasterizarse
- **THEN** la función responde con error `PDF_CONVERT_ERROR` y no rompe el cliente

### Requirement: Clasificación del tipo de documento

`extract-document` SHALL devolver un campo `documentType` con uno de los valores
`receipt`, `transfer`, `card_statement`, `screenshot` o `unknown`, junto con un `confidence` en [0, 1].

#### Scenario: Comprobante de transferencia
- **WHEN** el documento es una captura/PDF de una transferencia bancaria o de billetera
- **THEN** `documentType = 'transfer'`

#### Scenario: Resumen de tarjeta
- **WHEN** el documento es un estado de cuenta con múltiples consumos
- **THEN** `documentType = 'card_statement'`

#### Scenario: Documento no reconocible
- **WHEN** el modelo no puede determinar el tipo ni extraer datos útiles
- **THEN** `documentType = 'unknown'` y `transactions` vacío o sin montos

### Requirement: Inferencia de dirección de transferencia

Para documentos de tipo `transfer`, `extract-document` SHALL inferir si la transferencia fue **enviada**
o **recibida** por el usuario y reflejarlo en cada transacción como `direction` (`expense` para enviada,
`income` para recibida). Si no puede determinarse, SHALL usar `expense` por defecto.

#### Scenario: Transferencia recibida
- **WHEN** el comprobante indica que el usuario es el destinatario/beneficiario
- **THEN** la transacción tiene `direction = 'income'`

#### Scenario: Transferencia enviada
- **WHEN** el comprobante indica que el usuario es el emisor
- **THEN** la transacción tiene `direction = 'expense'`

#### Scenario: Dirección indeterminada
- **WHEN** no puede determinarse la dirección
- **THEN** la transacción tiene `direction = 'expense'` por defecto

### Requirement: Extracción de transacciones

`extract-document` SHALL devolver un arreglo `transactions`, donde cada transacción incluye `amount`,
`currency` (`ARS`/`USD`/null), `occurredAt` (ISO date o null), `merchant` (comercio o contraparte),
`direction`, `categoryHint`, `suggestedNewCategory` e `items`. Documentos de una sola transacción
(`receipt`, `transfer`, `screenshot`) SHALL producir un arreglo de longitud 1; un `card_statement` SHALL
producir N transacciones.

#### Scenario: Ticket de compra
- **WHEN** el documento es un ticket
- **THEN** `transactions` tiene 1 elemento con `direction = 'expense'` y, si aplica, `items` con el detalle

#### Scenario: Resumen con varios consumos
- **WHEN** el documento es un resumen de tarjeta con varios consumos
- **THEN** `transactions` contiene un elemento por consumo detectado

#### Scenario: Validación de esquema en el cliente
- **WHEN** el cliente recibe la respuesta de `extract-document`
- **THEN** la valida contra `documentOcrResultSchema` y, si no cumple, trata el resultado como fallo de OCR con fallback a formulario vacío

# document-capture Specification

## Purpose
TBD - created by archiving change document-capture-classify. Update Purpose after archive.
## Requirements
### Requirement: Selección de documento (PDF o imagen)

El sistema SHALL ofrecer en el flujo de captura una opción **"Documento"** que abre un selector de
archivos (`expo-document-picker`) aceptando **PDF e imágenes** (jpg, jpeg, png, heic, webp), además de
los modos existentes de cámara y galería.

#### Scenario: Usuario elige un PDF
- **WHEN** el usuario toca "Documento" y selecciona un archivo `.pdf`
- **THEN** el sistema navega a la pantalla de revisión pasando `uri`, `mimeType`, `name` y `kind = 'pdf'`

#### Scenario: Usuario elige una imagen desde archivos
- **WHEN** el usuario toca "Documento" y selecciona un `.jpg`/`.png`/`.heic`/`.webp`
- **THEN** el sistema navega a la pantalla de revisión con `kind = 'image'`

#### Scenario: Usuario cancela el selector
- **WHEN** el usuario abre el selector y lo cierra sin elegir archivo
- **THEN** el sistema permanece en el tab de captura sin error ni navegación

### Requirement: Validación de tipo y tamaño de archivo

El sistema SHALL rechazar archivos cuyo tipo no esté soportado o cuyo tamaño supere ~10 MB, mostrando un
mensaje claro en español, y NO SHALL iniciar el OCR en esos casos.

#### Scenario: Archivo de tipo no soportado
- **WHEN** el usuario selecciona un archivo que no es PDF ni imagen soportada (p.ej. `.docx`)
- **THEN** el sistema muestra un mensaje "Formato no soportado" y no navega a la revisión

#### Scenario: Archivo demasiado grande
- **WHEN** el archivo seleccionado supera el límite de ~10 MB
- **THEN** el sistema muestra "El archivo es muy grande" y no inicia el OCR

### Requirement: Permisos en español

El selector de documentos y cualquier permiso asociado SHALL presentar sus textos en **español
rioplatense**, consistente con el mercado argentino.

#### Scenario: Texto del permiso
- **WHEN** el sistema solicita acceso para abrir el selector de archivos
- **THEN** el texto mostrado está en español


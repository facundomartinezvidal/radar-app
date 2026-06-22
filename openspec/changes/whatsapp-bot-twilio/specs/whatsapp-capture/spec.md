## ADDED Requirements

### Requirement: Capture is gated to linked users

Expense/income capture SHALL only proceed for a number that resolves to a linked user. Capture requests from unlinked numbers SHALL be refused with a prompt to link.

#### Scenario: Unlinked sender cannot capture
- **WHEN** an unlinked number sends a capture-like message ("gasté 5000 en el súper")
- **THEN** no transaction is created and the bot prompts the user to link from the app

### Requirement: Capture from natural-language text

A linked user SHALL be able to register an expense or income by sending free-form text in the Twilio `Body` field. The webhook SHALL classify intent and extract entities (amount, currency, merchant/description, date, category hint, direction) with a Groq text model, and map them to a transaction row using the existing `ImportTransactionRow` shape.

#### Scenario: Clear text produces a pending transaction
- **WHEN** a linked user sends "gasté 4500 en el súper hoy"
- **THEN** the bot builds a pending expense of 4500 ARS with description/category derived from the message and asks for confirmation

#### Scenario: Income is detected
- **WHEN** a linked user sends "cobré 200000 de sueldo"
- **THEN** the bot builds a pending income transaction and asks for confirmation

### Requirement: Capture from audio

The webhook SHALL accept audio messages, fetch the bytes from the Twilio `MediaUrl0` with HTTP Basic auth (`TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN`), transcribe with Groq Whisper `whisper-large-v3`, and feed the transcript into the text-capture pipeline.

#### Scenario: Audio is transcribed and captured
- **WHEN** a linked user sends a voice note saying an expense
- **THEN** the audio is transcribed and the resulting text is processed into a pending transaction for confirmation

#### Scenario: Transcription failure is handled
- **WHEN** the audio cannot be fetched or transcription returns empty
- **THEN** the bot replies asking the user to type the expense or send a photo, and creates no transaction

### Requirement: Capture from image and PDF

The webhook SHALL accept image and PDF media, fetch each `MediaUrl{i}` with HTTP Basic auth (MIME from `MediaContentType{i}`), and call the existing `extract-document` function (with a service-role internal credential) to classify and extract transactions. A single extracted transaction SHALL become one pending confirmation; a `card_statement` with multiple transactions SHALL be summarized as a single import-all confirmation.

#### Scenario: Single receipt image
- **WHEN** a linked user sends a photo of one receipt
- **THEN** `extract-document` returns one transaction and the bot asks to confirm that single transaction

#### Scenario: Multi-transaction card statement
- **WHEN** a linked user sends a PDF classified as `card_statement` with N transactions
- **THEN** the bot summarizes the count and total and asks to confirm importing all of them

#### Scenario: Low OCR confidence is flagged
- **WHEN** `extract-document` returns a confidence below threshold
- **THEN** the bot still builds the pending row but flags the uncertainty and asks the user to verify before confirming

#### Scenario: Media fetch failure is handled
- **WHEN** the Twilio `MediaUrl` cannot be fetched
- **THEN** the bot asks the user to resend the file and creates no transaction

### Requirement: Writes require explicit confirmation

The bot SHALL NOT persist any transaction without an explicit user confirmation. A pending transaction SHALL be stored in `whatsapp_conversations.pending_action`; on a `confirm` intent the bot SHALL persist it via `import_transactions_for(p_user_id, p_rows)` (SECURITY DEFINER, Pattern 1) and clear the pending state; on `cancel` or expiry it SHALL discard the pending action.

#### Scenario: Confirmation persists the transaction
- **WHEN** a user replies "sí" to a pending transaction summary
- **THEN** the transaction is inserted under the user's id, the pending state is cleared, and the bot reports the inserted count

#### Scenario: Cancellation discards the pending transaction
- **WHEN** a user replies "no" / "cancelá" to a pending transaction
- **THEN** no transaction is written and the pending state is cleared

#### Scenario: Expired pending confirmation
- **WHEN** a user confirms after the pending action's expiry has passed
- **THEN** nothing is written and the bot asks the user to send the capture again

#### Scenario: Duplicate confirmation does not double-write
- **WHEN** a user sends "sí" twice for the same pending action
- **THEN** the transaction is inserted once because the pending action is cleared on first consume

### Requirement: Ambiguous or invalid captures are clarified, not guessed

When required entities are missing or the parse confidence is low, the bot SHALL ask one clarifying question instead of creating a pending write. Currency SHALL default to ARS when unspecified but SHALL be surfaced in the confirmation so the user can correct it; USD SHALL be used only when explicitly stated. Zero or negative amounts SHALL be rejected before any write.

#### Scenario: Missing amount triggers a clarifying question
- **WHEN** a message lacks a parseable amount
- **THEN** the bot asks for the amount and does not create a pending transaction

#### Scenario: Currency defaults to ARS but is shown
- **WHEN** a message states an amount without a currency
- **THEN** the pending confirmation shows the amount as ARS so the user can correct it before confirming

#### Scenario: USD only when explicit
- **WHEN** a message says "gasté 50 dólares"
- **THEN** the pending transaction uses USD

#### Scenario: Non-positive amount is rejected
- **WHEN** a parsed amount is zero or negative
- **THEN** the bot replies that the amount must be greater than zero and creates no transaction

## ADDED Requirements

### Requirement: Webhook answers Meta's verification handshake

The `whatsapp-webhook` edge function SHALL run with `verify_jwt = false`. On a `GET` request carrying `hub.mode=subscribe` and a `hub.verify_token` matching `WHATSAPP_VERIFY_TOKEN`, it SHALL respond 200 echoing the `hub.challenge` value verbatim. On a token mismatch it SHALL respond 403.

#### Scenario: Correct verify token completes subscription
- **WHEN** Meta sends `GET ?hub.mode=subscribe&hub.verify_token=<correct>&hub.challenge=<value>`
- **THEN** the webhook responds 200 with the `hub.challenge` value as the body

#### Scenario: Wrong verify token is rejected
- **WHEN** the `hub.verify_token` does not match `WHATSAPP_VERIFY_TOKEN`
- **THEN** the webhook responds 403 and does not subscribe

### Requirement: Webhook authenticates inbound payloads by signature

The webhook SHALL authenticate every inbound `POST` by validating the `X-Hub-Signature-256` header (HMAC-SHA256 of the raw request body using `WHATSAPP_APP_SECRET`) before any other processing. Requests with a missing or invalid signature SHALL be rejected with HTTP 403 and no side effects.

#### Scenario: Valid signature is accepted
- **WHEN** Meta POSTs an inbound event with a correct `X-Hub-Signature-256`
- **THEN** the webhook proceeds to process the event

#### Scenario: Invalid signature is rejected
- **WHEN** a request arrives with a missing or incorrect `X-Hub-Signature-256`
- **THEN** the webhook responds 403 and performs no database writes and sends no reply

### Requirement: Inbound messages are idempotent

The webhook SHALL parse the Cloud API JSON payload (`entry[].changes[].value.messages[]`) and record each inbound message keyed by the Meta message `id` with a UNIQUE constraint. If a message with the same `id` is delivered again (Meta retry on non-200), the webhook SHALL short-circuit and respond 200 without re-processing or re-writing data. Non-message events (status callbacks) SHALL be acknowledged with 200 and ignored.

#### Scenario: First delivery is processed
- **WHEN** a message with a new Meta message `id` arrives
- **THEN** a `whatsapp_messages` row is inserted and the message is processed

#### Scenario: Duplicate delivery is ignored
- **WHEN** a message whose Meta `id` already exists arrives again
- **THEN** the webhook responds 200 and does not process or persist the message a second time

#### Scenario: Status callback is ignored
- **WHEN** the payload is a delivery/read status event rather than a message
- **THEN** the webhook responds 200 and takes no further action

### Requirement: User can generate a one-time link code in the app

The app SHALL let an authenticated user generate a one-time WhatsApp link code via the `create_link_code()` RPC (SECURITY INVOKER, keyed on `auth.uid()`). The code SHALL expire after 10 minutes, and generating a new code SHALL invalidate the user's prior unconsumed codes.

#### Scenario: Generate a fresh code
- **WHEN** an authenticated user opens the WhatsApp link screen and requests a code
- **THEN** a `whatsapp_link_codes` row is created for that user with a 10-minute expiry and the code is displayed

#### Scenario: New code invalidates the previous one
- **WHEN** a user who already has an unconsumed code requests another
- **THEN** the previous code can no longer be redeemed and only the new code is valid

### Requirement: Bot redeems a link code to bind the number

An inbound message from an **unlinked** number whose body matches a link code SHALL be redeemed via `redeem_link_code(p_code, p_wa)` (SECURITY DEFINER, Pattern 1, revoked from anon/public/authenticated). On success the WhatsApp number (normalized to E.164) SHALL be bound to the code's user in `whatsapp_links` with `status='linked'` and the code marked consumed. The redeemer SHALL return a discrete outcome: `linked`, `expired`, `reused`, `invalid`, or `already_linked`.

#### Scenario: Valid code links the number
- **WHEN** an unlinked number sends a valid, unexpired, unconsumed code
- **THEN** the number is bound to the user, the code is marked consumed, and the bot replies that the number is now linked

#### Scenario: Expired code is refused
- **WHEN** an unlinked number sends a code whose `expires_at` has passed
- **THEN** the bot replies that the code expired and asks the user to generate a new one in the app, and no binding is created

#### Scenario: Reused code is refused
- **WHEN** a number sends a code that was already consumed
- **THEN** the redeemer returns `reused` and the bot replies asking for a fresh code without revealing the code was once valid

#### Scenario: Invalid code is refused
- **WHEN** a number sends a string that matches no code
- **THEN** the redeemer returns `invalid` and the bot asks the user to copy the code exactly from the app

#### Scenario: Number already linked to another account
- **WHEN** a number that is already linked to a different user sends a code
- **THEN** the redeemer returns `already_linked` and the bot refuses, instructing the user to unlink first

### Requirement: Inbound number resolves to a RADAR user

The webhook SHALL resolve the verified sender number to a user via `resolve_wa_user(p_wa)` (SECURITY DEFINER, Pattern 1). The Cloud API `wa_id` (digits without `+`, from `messages[].from`) SHALL be normalized to E.164 before lookup and storage. A number with no `status='linked'` row SHALL resolve to NULL.

#### Scenario: Linked number resolves to its user
- **WHEN** the webhook resolves a number that has a linked binding
- **THEN** the bound `user_id` is returned and used for all subsequent actions

#### Scenario: Unlinked number is refused financial actions
- **WHEN** an unlinked number sends any message other than a link code or help request
- **THEN** the bot performs no financial action and replies instructing the user to link from the app (Perfil → WhatsApp)

### Requirement: User can unlink a number

A user SHALL be able to unlink from the app (updating their own `whatsapp_links` row to `status='unlinked'` under RLS) and from the bot (intent `unlink` → `unlink_wa(p_user_id)`). After unlinking, the number SHALL resolve to NULL and become available to link again.

#### Scenario: Unlink from the bot
- **WHEN** a linked number sends an unlink request
- **THEN** the binding status becomes `unlinked`, the bot confirms, and subsequent messages from that number are treated as unlinked

#### Scenario: Unlink from the app frees the number
- **WHEN** a user unlinks from the WhatsApp profile screen
- **THEN** their binding becomes `unlinked` and the number can be bound to any account again

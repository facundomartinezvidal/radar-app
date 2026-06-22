# whatsapp-bot-twilio

Twilio variant of the WhatsApp bot (HU-26..29). Same schema/RPCs/business logic as `whatsapp-bot`; swaps only the transport adapter (Meta Cloud API → Twilio WhatsApp Sandbox): `X-Twilio-Signature` auth, form-encoded inbound, Messages API reply, basic-auth media fetch. Motivation: Meta test mode does not deliver to AR numbers; Twilio Sandbox does.

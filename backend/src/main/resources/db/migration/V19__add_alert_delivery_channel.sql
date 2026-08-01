-- How the notification actually reached somebody.
--
-- The debt V10 wrote down in its own comment: "the delivery channel is added in
-- Faza 5 when channels exist". Both channels have existed since then, and the
-- table has been answering "was this person told" without ever answering "by
-- what" - so an outage on one channel is indistinguishable from a quiet night.
--
-- Nullable on purpose, and the null means something. The row is claimed before
-- delivery is attempted, because the claim is what makes "once and only once"
-- hold across two racing channels; the channel is only known afterwards. A row
-- left with a null channel is therefore one where the process died between the
-- claim and the send - rare, worth being able to count, and not the same thing
-- as a failure (which deletes the row and gives the claim back).
ALTER TABLE alert_delivery
    ADD COLUMN channel VARCHAR(16)
        CONSTRAINT alert_delivery_channel_check CHECK (channel IN ('websocket', 'push'));

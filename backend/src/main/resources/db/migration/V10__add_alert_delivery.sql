-- Who has already been told about which alert.
--
-- The unique key is (alert_id, user_id), not (alert_id, saved_location_id):
-- one meteorological event is one arrival for a person. A user with three
-- locations inside the same storm gets one notification naming all three, not
-- three vibrations in a row - see markdown/follow-up.md point 10.
--
-- A row here means "this person has been told", so it is written by whatever
-- actually delivers the notification, not by ingest. The delivery channel
-- (WebSocket vs push) is added in Faza 5 when channels exist; recording it now
-- would be inventing a column with nothing to put in it.
CREATE TABLE alert_delivery (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES alert (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (alert_id, user_id)
);

CREATE INDEX alert_delivery_user_id_idx ON alert_delivery (user_id);

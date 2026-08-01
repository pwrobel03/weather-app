-- What a warning said before IMGW changed it.
--
-- IMGW amends warnings in place: a storm gets upgraded from level 2 to level 3,
-- an end time moves by four hours. The feed carries the same imgw_id throughout,
-- which is what the deduplication in V8 relies on - and the consequence was that
-- every amendment overwrote its predecessor silently. "Podniesione z 2. na 3.
-- stopień o 14:20" is information somebody changes their plans over, and until
-- now it existed nowhere.
--
-- A full snapshot of the row per change, not a diff (decision 21). Two reasons,
-- and the second is the one that decided it:
--
--   1. "What did this warning say at 14:00" is answered by one row rather than
--      by replaying a chain from the beginning.
--   2. Adding a field to `alert` later needs no migration of the history and no
--      code able to read two shapes of diff. A field has already been added once
--      (V11, the MeteoAlarm enrichment), so this is not hypothetical.
--
-- The cost is disk, and it is small: a few hundred bytes per row, and units of
-- amendments per warning rather than thousands.
--
-- recorded_at is when we noticed, not when IMGW published - published_at is
-- carried in the snapshot itself. The two differ by up to one polling interval,
-- and conflating them would let the app claim a precision it does not have.
CREATE TABLE alert_revision (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES alert (id) ON DELETE CASCADE,
    event VARCHAR(255) NOT NULL,
    severity VARCHAR(1) NOT NULL CHECK (severity IN ('1', '2', '3')),
    probability_percent SMALLINT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    content TEXT,
    imgw_comment TEXT,
    office VARCHAR(255),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every read is "the history of this warning, oldest first".
CREATE INDEX alert_revision_alert_id_idx ON alert_revision (alert_id, recorded_at);

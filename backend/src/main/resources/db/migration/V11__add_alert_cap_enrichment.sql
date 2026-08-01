-- MeteoAlarm relays IMGW's warnings as CAP, adding what the IMGW feed itself
-- does not carry: normalised severity/urgency/certainty, an English event
-- name, and the awareness_level/awareness_type pair used across Europe.
--
-- Joined on IMGW's own id, which MeteoAlarm embeds in its CAP identifier
-- ("2.49.0.0.616.0.PL.Sk20260722102818137.PL2208"), so no fuzzy matching is
-- involved. Every column is nullable: MeteoAlarm can lag behind IMGW, and a
-- warning must be usable the moment it arrives rather than waiting to be
-- decorated.
ALTER TABLE alert
    ADD COLUMN event_en VARCHAR(255),
    ADD COLUMN cap_severity VARCHAR(32),
    ADD COLUMN cap_urgency VARCHAR(32),
    ADD COLUMN cap_certainty VARCHAR(32),
    ADD COLUMN awareness_level VARCHAR(64),
    ADD COLUMN awareness_type VARCHAR(64),
    ADD COLUMN enriched_at TIMESTAMPTZ;

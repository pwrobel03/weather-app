-- Which saved location was covered by which alert.
--
-- Recorded per location, not per user, because the per-location alert timeline
-- (GET /api/alerts/history) needs to know which place was affected by what.
-- Notification granularity is a separate concern and is deduplicated per user
-- in alert_delivery - see markdown/follow-up.md point 10.
CREATE TABLE alert_location_match (
    alert_id BIGINT NOT NULL REFERENCES alert (id) ON DELETE CASCADE,
    saved_location_id BIGINT NOT NULL REFERENCES saved_location (id) ON DELETE CASCADE,
    matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (alert_id, saved_location_id)
);

-- Drives the per-location timeline; the primary key already covers the
-- alert-first direction used during ingest.
CREATE INDEX alert_location_match_saved_location_idx
    ON alert_location_match (saved_location_id);

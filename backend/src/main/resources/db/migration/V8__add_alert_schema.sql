-- IMGW warnings, polled on a schedule.
--
-- imgw_id is the deduplication key: the feed republishes the same warning on
-- every poll for its whole lifetime (often 9+ hours), so without this a single
-- storm would accumulate dozens of rows and fan out dozens of notifications.
CREATE TABLE alert (
    id BIGSERIAL PRIMARY KEY,
    imgw_id VARCHAR(64) NOT NULL UNIQUE,
    event VARCHAR(255) NOT NULL,
    severity VARCHAR(1) NOT NULL CHECK (severity IN ('1', '2', '3')),
    probability_percent SMALLINT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    content TEXT,
    imgw_comment TEXT,
    office VARCHAR(255),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Serving "which alerts are active right now" is the common read.
CREATE INDEX alert_valid_to_idx ON alert (valid_to);

-- The warning's area: IMGW publishes no geometry, only powiat codes, so this
-- is the entire spatial model on the alert side.
CREATE TABLE alert_teryt (
    alert_id BIGINT NOT NULL REFERENCES alert (id) ON DELETE CASCADE,
    teryt_code VARCHAR(4) NOT NULL,
    PRIMARY KEY (alert_id, teryt_code)
);

-- Matching joins from a powiat code to the alerts covering it, mirroring
-- saved_location_teryt_code_idx on the other side of the join.
CREATE INDEX alert_teryt_teryt_code_idx ON alert_teryt (teryt_code);

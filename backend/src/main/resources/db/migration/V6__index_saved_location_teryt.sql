-- Alert matching resolves to `WHERE teryt_code IN (...)` over saved_location.
-- A single IMGW warning can cover ~50 powiat codes, so this lookup runs on
-- every ingest and is the hot path the whole alert core is built on.
CREATE INDEX saved_location_teryt_code_idx ON saved_location (teryt_code);

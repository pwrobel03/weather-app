-- A user-chosen order for saved places.
--
-- Until now the list came back in save order, which is a fine default and a
-- poor answer once someone keeps more than a handful: the place looked at daily
-- is wherever it happened to be added. On mobile the order also decides which
-- way the home screen pages, so it is not merely cosmetic.
--
-- Deliberately not UNIQUE (user_id, position). Reordering a list rewrites every
-- row between the old and new slot, and a unique constraint would reject the
-- intermediate states of that rewrite unless it were deferrable - buying an
-- invariant nothing depends on at the cost of a fragile update. Duplicate
-- positions degrade to "these two sort together", which created_at then breaks.
ALTER TABLE saved_location
    ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- Existing rows keep the order they already appeared in, so nobody's list
-- rearranges itself the moment this ships.
WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1 AS pos
    FROM saved_location
)
UPDATE saved_location
SET position = ranked.pos
FROM ranked
WHERE saved_location.id = ranked.id;

CREATE INDEX saved_location_user_position_idx ON saved_location (user_id, position);

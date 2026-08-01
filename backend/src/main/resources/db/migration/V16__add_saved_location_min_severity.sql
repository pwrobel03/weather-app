-- The lowest IMGW level this place is worth a notification for.
--
-- Per place rather than per account, because that is how people actually think
-- about it: everything for the house, only serious warnings for the allotment.
-- An account-wide setting would force the two into one answer, and whichever
-- answer won would be wrong for the other place.
--
-- Stored as the IMGW level itself ('1'/'2'/'3') rather than as an ordinal, so
-- the column reads the same as WarningSeverity.level and as the wire contract.
-- A CHECK rather than an enum type: three values that IMGW owns, and adding a
-- fourth would be their decision, not a schema migration we would want to
-- couple to a Postgres type.
--
-- Defaults to '1', which is what every existing row is already living with -
-- every matched warning notifies. The default is a description of today's
-- behaviour, not a guess at what anybody wants.
--
-- Deliberately NOT a filter on matching (decision 25): this governs whether a
-- notification is sent, never whether the warning is recorded or shown. A
-- warning below the threshold still appears on the place's screen and still
-- enters its history.
ALTER TABLE saved_location
    ADD COLUMN min_severity VARCHAR(1) NOT NULL DEFAULT '1'
        CONSTRAINT saved_location_min_severity_check CHECK (min_severity IN ('1', '2', '3'));

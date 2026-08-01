-- The zone a device wants its quiet hours measured in.
--
-- On the token beside the locale (V15) and for the same reason (decision 20):
-- quiet hours are a property of the phone lying next to the bed, not of the
-- account and not of the place. Somebody who travels wants silence by their own
-- clock, not by the coordinates of an allotment near Płock - and a column on
-- `users` would have to pick one device's answer for all of them.
--
-- An IANA identifier rather than a fixed offset, because an offset is wrong for
-- half the year and this column exists to be right at 3am.
--
-- Defaults to Europe/Warsaw, which is where every device registered before this
-- column existed actually is - the app resolves places by TERYT, so all of them
-- are in Poland.
ALTER TABLE user_push_token
    ADD COLUMN time_zone VARCHAR(64) NOT NULL DEFAULT 'Europe/Warsaw';

-- The language a device wants its notifications in.
--
-- On the token rather than on the user, deliberately (follow-up.md point 12):
-- iOS and Android both let a language be set per application, so the same
-- account can legitimately want Polish on the phone and English on the tablet.
-- A column on `users` would have to pick one of them and be wrong on the other.
--
-- Defaults to Polish for rows registered before this column existed. Those
-- devices are already receiving Polish, so the default is a description of
-- what is happening rather than a guess.
ALTER TABLE user_push_token
    ADD COLUMN locale VARCHAR(2) NOT NULL DEFAULT 'pl';

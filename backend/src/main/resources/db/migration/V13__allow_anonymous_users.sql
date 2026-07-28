-- Anonymous users: a device that has not registered is still a `users` row.
--
-- The alternative was a second kind of subject alongside the user - a device
-- table that saved locations, push tokens, TERYT matching and delivery would
-- all have to learn about. Everything downstream already keys off users.id, so
-- making the row itself credential-less leaves every one of those untouched,
-- and registration becomes "attach credentials to this row" rather than a
-- migration of data between two subjects.
--
-- The price is that the schema no longer guarantees a user has an email. The
-- CHECK keeps the weaker invariant that actually matters: credentials arrive
-- together or not at all, so no row can sit half-registered with an email and
-- no way to authenticate (or the reverse).
ALTER TABLE users
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL,
    ADD CONSTRAINT users_credentials_complete
        CHECK ((email IS NULL) = (password_hash IS NULL));

-- The pre-existing UNIQUE on email already tolerates this: in Postgres, NULLs
-- are distinct, so any number of anonymous rows coexist while registered
-- addresses stay unique.
COMMENT ON CONSTRAINT users_credentials_complete ON users IS
    'An anonymous device has neither email nor password; a registered user has both.';

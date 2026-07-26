-- Administrative operations (starting with the TERYT rebuild in
-- POST /api/admin/boundaries/refresh) authorize off the existing JWT rather
-- than a second, parallel auth mechanism. Everyone is USER until promoted
-- deliberately - there is no self-service path to ADMIN by design.
ALTER TABLE users
    ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'USER'
        CHECK (role IN ('USER', 'ADMIN'));

-- Push notification tokens registered by mobile devices running Expo.
--
-- A user may install the application on multiple devices (e.g. phone and tablet),
-- so tokens are stored 1:N per user. Tokens are unique across the table: if a
-- token is re-assigned or re-registered, ON CONFLICT (token) DO UPDATE reassigns
-- it to the current user and refreshes updated_at.
CREATE TABLE user_push_token (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_push_token_user_id_idx ON user_push_token (user_id);

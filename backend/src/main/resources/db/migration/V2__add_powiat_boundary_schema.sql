CREATE TABLE powiat_boundary (
    id BIGSERIAL PRIMARY KEY,
    teryt_code VARCHAR(4) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    voivodeship VARCHAR(255) NOT NULL,
    boundary geography(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX powiat_boundary_boundary_gist_idx ON powiat_boundary USING GIST (boundary);

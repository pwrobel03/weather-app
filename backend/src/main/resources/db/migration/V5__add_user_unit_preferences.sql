ALTER TABLE users
    ADD COLUMN temperature_unit VARCHAR(10) NOT NULL DEFAULT 'CELSIUS'
        CHECK (temperature_unit IN ('CELSIUS', 'FAHRENHEIT')),
    ADD COLUMN wind_speed_unit VARCHAR(10) NOT NULL DEFAULT 'KMH'
        CHECK (wind_speed_unit IN ('KMH', 'MPH')),
    ADD COLUMN precipitation_unit VARCHAR(10) NOT NULL DEFAULT 'MM'
        CHECK (precipitation_unit IN ('MM', 'IN'));

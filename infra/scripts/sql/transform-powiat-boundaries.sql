-- Transforms rows fetched by import-powiat-boundaries.sh (ogr2ogr WFS ->
-- powiat_boundary_staging, raw PRG attribute names) into powiat_boundary.
-- Re-runnable: truncates the target table first.

TRUNCATE powiat_boundary;

INSERT INTO powiat_boundary (teryt_code, name, voivodeship, boundary)
SELECT
    jpt_kod_je,
    jpt_nazwa_,
    -- First two digits of the TERYT code are the województwo code -
    -- stable since the 1999 territorial reform, no lookup table needed.
    CASE substring(jpt_kod_je, 1, 2)
        WHEN '02' THEN 'dolnośląskie'
        WHEN '04' THEN 'kujawsko-pomorskie'
        WHEN '06' THEN 'lubelskie'
        WHEN '08' THEN 'lubuskie'
        WHEN '10' THEN 'łódzkie'
        WHEN '12' THEN 'małopolskie'
        WHEN '14' THEN 'mazowieckie'
        WHEN '16' THEN 'opolskie'
        WHEN '18' THEN 'podkarpackie'
        WHEN '20' THEN 'podlaskie'
        WHEN '22' THEN 'pomorskie'
        WHEN '24' THEN 'śląskie'
        WHEN '26' THEN 'świętokrzyskie'
        WHEN '28' THEN 'warmińsko-mazurskie'
        WHEN '30' THEN 'wielkopolskie'
        WHEN '32' THEN 'zachodniopomorskie'
    END,
    -- Source geometries are a Polygon/MultiPolygon mix; normalize to
    -- MultiPolygon to match the powiat_boundary.boundary column type.
    ST_Multi(geom)::geography
FROM powiat_boundary_staging;

DROP TABLE powiat_boundary_staging;

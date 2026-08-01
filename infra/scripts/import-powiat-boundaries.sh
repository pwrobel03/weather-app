#!/usr/bin/env bash
# Imports powiat (district) boundaries from PRG GUGiK (Państwowy Rejestr
# Granic) into the powiat_boundary table (see V2__add_powiat_boundary_schema.sql).
#
# Source: open WFS at mapy.geoportal.gov.pl, feature type A02_Granice_powiatow.
# Free to use for any purpose, no API key or license agreement - PRG has been
# fully open since the July 2020 amendment to Prawo geodezyjne i kartograficzne
# (see markdown/follow-up.md, "Decyzje blokujące" #6).
#
# Requires: the postgres container from infra/docker-compose.yml running, and
# a local `docker` CLI - ogr2ogr itself runs in a throwaway GDAL container, no
# local GDAL install needed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
fi

POSTGRES_USER="${POSTGRES_USER:-weather}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-weather}"
POSTGRES_DB="${POSTGRES_DB:-weather}"
CONTAINER_NAME="weather-app-postgres"
WFS_URL="https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
GDAL_IMAGE="ghcr.io/osgeo/gdal:alpine-normal-latest"

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    echo "Postgres container '$CONTAINER_NAME' is not running." >&2
    echo "Start it with: docker compose -f infra/docker-compose.yml up -d" >&2
    exit 1
fi

NETWORK="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$CONTAINER_NAME")"

echo "Fetching powiat boundaries from PRG WFS (A02_Granice_powiatow) into a staging table..."
docker run --rm --network "$NETWORK" "$GDAL_IMAGE" \
    ogr2ogr -f PostgreSQL \
    "PG:host=$CONTAINER_NAME port=5432 dbname=$POSTGRES_DB user=$POSTGRES_USER password=$POSTGRES_PASSWORD" \
    "WFS:$WFS_URL" A02_Granice_powiatow \
    -nln powiat_boundary_staging \
    -t_srs EPSG:4326 \
    -overwrite \
    -forceNullable \
    -lco GEOMETRY_NAME=geom

echo "Transforming staging data into powiat_boundary..."
docker exec -i "$CONTAINER_NAME" \
    psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" \
    < "$SCRIPT_DIR/sql/transform-powiat-boundaries.sql"

COUNT="$(docker exec "$CONTAINER_NAME" \
    psql -tA "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" \
    -c 'SELECT count(*) FROM powiat_boundary;')"
echo "Done. powiat_boundary now has $COUNT rows."

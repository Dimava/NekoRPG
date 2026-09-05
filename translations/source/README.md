# Extraction source

`catalog.raw.json` is extracted from the `maxrau/main..maxrau/english` diff and
committed, so `bun run compile` never needs those branches. Refresh it with
`bun run --cwd tools extract-translations` from a clone that has the maxrau
remote. Everything else is generated into `translations/gen/`.

# @data-fair/processing-sensor-community

Data-fair processing plugin that imports the measures of [Sensor Community](https://sensor.community/)
sensors (particulate matter PM1, PM10, PM2.5, humidity, temperature) into a data-fair REST dataset.

## How it works

The user declares a list of sites, each with a label and the ids of its sensors. Each run reads the
[sensor.community JSON feed](https://data.sensor.community/static/v2/data.json) and adds one line per
site to the dataset, with the measures of all its sensors, so the dataset keeps the history of the
measures.

- **Create mode**: creates the REST dataset with the selected measure columns, then switches the
  processing config to update mode.
- **Update mode**: adds the lines to the existing dataset.

Sensors absent from the feed are reported as an error in the run log.

## Development

- Node 24 (`nvm use`), native TypeScript (no build step).
- `npm install`
- `npm run build-types` generates the types from the JSON schemas.
- `npm test` runs the `node:test` suite (`test-it/`, no data-fair instance needed).
- `npm run lint` / `npm run lint-fix`.

## Release

Publishing to the registry is done by GitHub Actions: a push on `master` publishes to staging,
a `v*` tag publishes to production. Never publish manually.

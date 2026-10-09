export type Measure = {
  timestamp: string
  location: { latitude: string, longitude: string, altitude: string }
  sensor?: { id: number }
  sensordatavalues: { value: string, value_type: string }[]
}

export type Site = { title?: string, ids?: number[] }

export const DEFAULT_SOURCE_URL = 'https://data.sensor.community/static/v2/data.json'

// the worker axios sends the data-fair API key to data-fair urls, a free url would let a config read data-fair with it
export const checkSourceUrl = (url: string) => {
  const { protocol, host } = new URL(url)
  if (protocol !== 'https:' || host !== 'data.sensor.community') throw new Error(`URL non autorisée, seules les URLs https://data.sensor.community sont acceptées : ${url}`)
  return url
}

type SensorData = { timestamp: string, location: Measure['location'], values: Record<string, number> }

/**
 * Build one line per site from the sensor.community feed, merging the measures of all its sensors.
 * Returns the lines and the ids of the sensors absent from the feed.
 */
export const buildLines = (measures: Measure[], sites: Site[], columns: string[]) => {
  const ids = sites.flatMap(s => s.ids ?? [])
  const sensors: Record<number, SensorData> = {}
  for (const m of measures) {
    if (!m.sensor || !ids.includes(m.sensor.id)) continue
    // a sensor can appear in several entries of the feed, each one carrying some of its values
    const sensor = sensors[m.sensor.id] ??= { timestamp: m.timestamp, location: m.location, values: {} }
    if (m.timestamp > sensor.timestamp) sensor.timestamp = m.timestamp
    for (const v of m.sensordatavalues) {
      if (columns.includes(v.value_type)) sensor.values[v.value_type] = Number(v.value)
    }
  }

  const lines = sites.filter(s => s.ids?.some(id => sensors[id])).map(s => {
    const found = s.ids!.filter(id => sensors[id])
    const first = sensors[found[0]]
    return {
      title: s.title,
      timestamp: first.timestamp.replace(' ', 'T') + 'Z',
      latitude: Number(first.location.latitude),
      longitude: Number(first.location.longitude),
      altitude: Number(first.location.altitude),
      ...Object.assign({}, ...found.map(id => sensors[id].values)),
      ids: found.join(',')
    }
  })
  return { lines, missing: ids.filter(id => !sensors[id]) }
}

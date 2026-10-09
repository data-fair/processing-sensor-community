import { describe, it } from 'node:test'
import assert from 'assert'
import processingConfigSchema from '../processing-config-schema.json' with { type: 'json' }
import { buildLines, checkSourceUrl, type Measure } from '../lib/process.ts'

const measure = (id: number, timestamp: string, values: Record<string, string>): Measure => ({
  timestamp,
  location: { latitude: '48.5', longitude: '-2.7', altitude: '' },
  sensor: { id },
  sensordatavalues: Object.entries(values).map(([type, value]) => ({ value_type: type, value }))
})

describe('Sensor Community processing', () => {
  it('exposes a processing config schema for users', () => {
    assert.equal(processingConfigSchema.type, 'object')
  })

  it('carries no legacy vjsf 2 keyword', () => {
    const legacy = JSON.stringify(processingConfigSchema).match(/"x-(?!i18n-|exports)[\w-]+"/g)
    assert.equal(legacy, null)
  })

  it('builds one line per site, merging its sensors', () => {
    const { lines, missing } = buildLines([
      measure(1, '2026-10-09 14:25:19', { P1: '3.90', P2: '1.20', durP1: '5013' }),
      measure(2, '2026-10-09 14:25:20', { humidity: '80.5', temperature: '12.1', pressure: '101000' }),
      measure(3, '2026-10-09 14:25:20', { P1: '99' })
    ], [
      { title: 'Siège', ids: [1, 2] },
      { title: 'Faux capteur', ids: [4] }
    ], ['P1', 'P2', 'humidity', 'temperature'])
    assert.deepEqual(missing, [4])
    assert.deepEqual(lines, [{
      title: 'Siège',
      ids: '1,2',
      timestamp: '2026-10-09T14:25:19Z',
      latitude: 48.5,
      longitude: -2.7,
      altitude: 0,
      P1: 3.9,
      P2: 1.2,
      humidity: 80.5,
      temperature: 12.1
    }])
  })

  it('merges the entries of a sensor repeated in the feed', () => {
    const { lines } = buildLines([
      measure(1, '2026-10-09 14:25:19', { P1: '3.90' }),
      measure(1, '2026-10-09 14:25:20', { humidity: '80' })
    ], [{ title: 'Site', ids: [1] }], ['P1', 'humidity'])
    assert.equal(lines[0].P1, 3.9)
    assert.equal(lines[0].humidity, 80)
  })

  it('only accepts sensor.community source urls', () => {
    assert.equal(checkSourceUrl('https://data.sensor.community/static/v2/data.1h.json'), 'https://data.sensor.community/static/v2/data.1h.json')
    assert.throws(() => checkSourceUrl('https://koumoul.com/data-fair/api/v1/datasets'))
    assert.throws(() => checkSourceUrl('http://data.sensor.community/static/v2/data.json'))
    assert.throws(() => checkSourceUrl('https://data.sensor.community.evil.com/data.json'))
  })
})

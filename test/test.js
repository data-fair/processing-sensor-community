process.env.NODE_ENV = 'test'
const config = require('config')
const assert = require('assert').strict
const sensorCommunity = require('../')
const testUtils = require('@data-fair/processings-test-utils')

describe('Hello world processing', () => {
  it('should expose a plugin config schema for super admins', async () => {
    const schema = require('../plugin-config-schema.json')
    assert.equal(schema.properties.dataUrl.default, 'https://data.sensor.community/static/v2/data.json')
  })

  it('should expose a processing config schema for users', async () => {
    const schema = require('../processing-config-schema.json')
    assert.equal(schema.type, 'object')
  })

  it('should run a task', async function () {
    this.timeout(60000)

    const context = testUtils.context({
      pluginConfig: { dataUrl: 'https://data.sensor.community/static/v2/data.24h.json' },
      processingConfig: {
        datasetMode: 'create',
        dataset: { title: 'Sensor community test' },
        sensors: [
          { id: '73542', title: 'Lannion 1' },
          { id: '74365', title: 'Lannion 2' },
          { id: '47455', title: 'St Brieuc 1' },
          { id: '72813', title: 'St Brieuc 2' },
          { id: '73571', title: 'St Brieuc 3' },
          { id: '75620', title: 'St Brieuc 4' },
          { id: 'falseid', title: 'Faux capteur' }
        ]
      }
    }, config, false)

    await sensorCommunity.run(context)
    assert.equal(context.processingConfig.datasetMode, 'update')
    assert.equal(context.processingConfig.dataset.title, 'Sensor community test')
    const datasetId = context.processingConfig.dataset.id
    // assert.ok(datasetId.startsWith('sensor-community-test'))
    await context.ws._reconnect()

    // another execution should update the dataset, not create it
    // await new Promise(resolve => setTimeout(resolve, 4000))
    await sensorCommunity.run(context)
    assert.equal(context.processingConfig.dataset.id, datasetId)
    context.ws._ws.terminate()
  })
})

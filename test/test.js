process.env.NODE_ENV = 'test'
const config = require('config')
const assert = require('assert').strict
const sensorCommunity = require('../')
const testUtils = require('@data-fair/processings-test-utils')

describe('Hello world processing', () => {
  it('should expose a plugin config schema for super admins', async () => {
    const schema = require('../plugin-config-schema.json')
    assert.equal(Object.keys(schema.properties).length, 0)
  })

  it('should expose a processing config schema for users', async () => {
    const schema = require('../processing-config-schema.json')
    assert.equal(schema.type, 'object')
    assert.equal(schema.allOf[1].properties.dataUrl.default, 'https://data.sensor.community/static/v2/data.json')
  })

  it('should run a task', async function () {
    this.timeout(60000)

    const context = testUtils.context({
      pluginConfig: { },
      processingConfig: {
        datasetMode: 'create',
        dataset: { title: 'Sensor community test' },
        dataUrl: 'https://data.sensor.community/static/v2/data.24h.json',
        sensors: [
          { title: 'Conseil Départemental - Siège', ids: [72813, 72814] },
          { title: 'MdD St-Brieuc', ids: [73571, 73572] },
          { title: 'MdD de Dinan', ids: [76612, 76613] },
          { title: 'Faux capteur', ids: [99999999] }
        ],
        columns: ['P1', 'P2', 'humidity', 'temperature']
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

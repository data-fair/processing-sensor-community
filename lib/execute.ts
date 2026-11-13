import type { RunFunction } from '@data-fair/lib-common-types/processings.js'
import type { ProcessingConfig } from '#types/processingConfig/index.ts'
import { datasetSchema, columns } from './schema.ts'
import { buildLines, checkSourceUrl, DEFAULT_SOURCE_URL, type Measure } from './process.ts'
import { dfRetry } from './retry.ts'

// the full v2 feed weighs a few tens of MB, it is parsed in memory
const MAX_SOURCE_BYTES = 500 * 1024 * 1024

let shouldBeStopped = false
export const stop = async (): Promise<void> => { shouldBeStopped = true }

export const run: RunFunction<ProcessingConfig> = async ({ processingConfig, processingId, axios, log, patchConfig, ws }) => {
  shouldBeStopped = false
  const selectedColumns: string[] = processingConfig.columns ?? []

  let dataset: { id: string, title: string, status?: string }
  if (processingConfig.datasetMode === 'create') {
    await log.step('Create the dataset')
    dataset = (await dfRetry(() => axios.post('api/v1/datasets', {
      // 1.x create configs carried the title in dataset.title
      title: processingConfig.datasetTitle || (processingConfig as { dataset?: { title?: string } }).dataset?.title || 'Capteurs Sensor Community',
      isRest: true,
      schema: [...datasetSchema, ...columns.filter(c => selectedColumns.includes(c.key))],
      extras: { processingId }
    }), log, { label: 'POST dataset', creates: true })).data
    await log.info(`Dataset created, id="${dataset.id}", title="${dataset.title}"`)
    // switch to update right away, a later failure must not create a second dataset
    await patchConfig({ datasetMode: 'update', dataset: { id: dataset.id, title: dataset.title } })
    if (dataset.status !== 'finalized') await ws.waitForJournal(dataset.id, 'finalize-end')
  } else {
    await log.step('Check the dataset')
    dataset = (await axios.get(`api/v1/datasets/${(processingConfig.dataset as { id: string }).id}`)).data
    await log.info(`Dataset found, id="${dataset.id}", title="${dataset.title}"`)
  }

  await log.step('Fetch the sensor.community feed')
  // the worker axios refuses redirects and has no timeout or size limit, all needed for an external host
  const { data } = await axios.get<Measure[]>(checkSourceUrl(processingConfig.dataUrl ?? DEFAULT_SOURCE_URL), {
    maxRedirects: 5,
    timeout: 120000,
    maxContentLength: MAX_SOURCE_BYTES
  })
  await log.info(`${data.length} measure entries fetched`)
  if (shouldBeStopped) return

  const { lines, missing } = buildLines(data, processingConfig.sensors ?? [], selectedColumns)
  if (missing.length) await log.error(`No data found in the feed for ${missing.length} sensor(s): ${missing.join(', ')}`)
  if (!lines.length) return

  await log.info(`Sending the measures of ${lines.length} site(s)`)
  // lines carry no _id, a replayed bulk would insert them twice: retry on 429 only
  const res = (await dfRetry(() => axios.post(`api/v1/datasets/${dataset.id}/_bulk_lines`, lines), log, { label: 'POST lines', creates: true })).data
  if (res.nbErrors) {
    await log.error(`${res.nbErrors} of ${lines.length} line(s) failed to insert`, res.errors)
    throw new Error(`Failed to insert ${res.nbErrors} line(s) into the dataset`)
  }
  await log.info(`${lines.length} line(s) written`)
  await ws.waitForJournal(dataset.id, 'finalize-end')
}

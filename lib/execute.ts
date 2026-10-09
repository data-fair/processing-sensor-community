import type { RunFunction } from '@data-fair/lib-common-types/processings.js'
import type { ProcessingConfig } from '#types/processingConfig/index.ts'
import { datasetSchema, columns } from './schema.ts'
import { buildLines, checkSourceUrl, DEFAULT_SOURCE_URL, type Measure } from './process.ts'

let shouldBeStopped = false
export const stop = async (): Promise<void> => { shouldBeStopped = true }

export const run: RunFunction<ProcessingConfig> = async ({ processingConfig, processingId, axios, log, patchConfig, ws }) => {
  shouldBeStopped = false
  const selectedColumns: string[] = processingConfig.columns ?? []

  let dataset: { id: string, title: string, status?: string }
  if (processingConfig.datasetMode === 'create') {
    await log.step('Création du jeu de données')
    dataset = (await axios.post('api/v1/datasets', {
      title: processingConfig.datasetTitle || 'Capteurs Sensor Community',
      isRest: true,
      schema: [...datasetSchema, ...columns.filter(c => selectedColumns.includes(c.key))],
      extras: { processingId }
    })).data
    await log.info(`jeu de donnée créé, id="${dataset.id}", title="${dataset.title}"`)
    // switch to update right away, a later failure must not create a second dataset
    await patchConfig({ datasetMode: 'update', dataset: { id: dataset.id, title: dataset.title } })
    if (dataset.status !== 'finalized') await ws.waitForJournal(dataset.id, 'finalize-end')
  } else {
    await log.step('Vérification du jeu de données')
    dataset = (await axios.get(`api/v1/datasets/${(processingConfig.dataset as { id: string }).id}`)).data
    await log.info(`le jeu de donnée existe, id="${dataset.id}", title="${dataset.title}"`)
  }

  await log.step('Récupération des données')
  // the worker axios refuses redirects and has no timeout, both needed for an external host
  const { data } = await axios.get<Measure[]>(checkSourceUrl(processingConfig.dataUrl ?? DEFAULT_SOURCE_URL), { maxRedirects: 5, timeout: 120000 })
  await log.info(`Données de ${data.length} capteurs récupérées`)
  if (shouldBeStopped) return

  const { lines, missing } = buildLines(data, processingConfig.sensors ?? [], selectedColumns)
  if (missing.length) await log.error(`Aucune donnée trouvée pour le(s) capteur(s) ${missing.join(', ')}`)
  if (!lines.length) return

  await log.info(`Envoi des données pour ${lines.length} site(s)`)
  const res = (await axios.post(`api/v1/datasets/${dataset.id}/_bulk_lines`, lines)).data
  if (res.nbErrors) {
    await log.error(`${res.nbErrors} échecs sur ${lines.length} lignes à insérer`, res.errors)
    throw new Error('échec à l\'insertion des lignes dans le jeu de données')
  }
  await log.info(`${lines.length} ligne(s) de donnée écrite(s)`)
  await ws.waitForJournal(dataset.id, 'finalize-end')
}

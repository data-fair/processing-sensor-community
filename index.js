const datasetSchema = [
  {
    key: 'title',
    type: 'string',
    title: 'Libellé',
    'x-refersTo': 'http://www.w3.org/2000/01/rdf-schema#label',
    'x-concept': {
      id: 'label',
      title: 'Libellé',
      primary: true
    }
  },
  { key: 'ids', type: 'string', title: 'Identifiants des capteurs', separator: ',' },
  {
    key: 'latitude',
    type: 'number',
    title: 'Latitude',
    'x-refersTo': 'http://schema.org/latitude',
    'x-concept': {
      id: 'latitude',
      title: 'Latitude',
      primary: true
    }
  },
  {
    key: 'longitude',
    type: 'number',
    title: 'Longitude',
    'x-refersTo': 'http://schema.org/longitude',
    'x-concept': {
      id: 'longitude',
      title: 'Longitude',
      primary: true
    }
  },
  { key: 'altitude', type: 'number', title: 'Altitude' },
  {
    key: 'timestamp',
    type: 'string',
    format: 'date-time',
    title: 'Date et heure',
    'x-refersTo': 'http://schema.org/Date',
    'x-concept': {
      id: 'date',
      title: "Date d'évènement",
      primary: true
    }
  }
]

const columns = [
  { key: 'P0', type: 'number', title: 'PM1' },
  { key: 'P1', type: 'number', title: 'PM10' },
  { key: 'P2', type: 'number', title: 'PM2.5' },
  { key: 'humidity', type: 'number', title: 'Hygrométrie' },
  { key: 'temperature', type: 'number', title: 'Température' }
]

// a global variable to manage interruption
// let stopped

// main running method of the task
// pluginConfig: an object matching the schema in plugin-config-schema.json
// processingConfig: an object matching the schema in processing-config-schema.json
// processingId: the id of the processing configuration in @data-fair/processings
// dir: a persistent directory associated to the processing configuration
// tmpDir: a temporary directory that will automatically destroyed after running
// axios: an axios instance configured so that its base url is a data-fair instance and it sends proper credentials
// log: contains async debug/info/warning/error methods to store a log on the processing run
// patchConfig: async method accepting an object to be merged with the configuration
// ws: an event emitter to wait for some state changes coming through web socket from the data-fair server
// sendMail: an async function to send an email (see https://nodemailer.com/usage/#sending-mail)
exports.run = async ({ processingConfig, processingId, axios, log, patchConfig, ws }) => {
  let dataset
  if (processingConfig.datasetMode === 'create') {
    await log.step('Création du jeu de données')
    dataset = (await axios.post('api/v1/datasets', {
      id: processingConfig.dataset.id,
      title: processingConfig.dataset.title,
      isRest: true,
      schema: datasetSchema.concat(columns.filter(c => processingConfig.columns.includes(c.key))),
      extras: { processingId }
    })).data
    await log.info(`jeu de donnée créé, id="${dataset.id}", title="${dataset.title}"`)
    await patchConfig({ datasetMode: 'update', dataset: { id: dataset.id, title: dataset.title } })
    await ws.waitForJournal(dataset.id, 'finalize-end')
  } else if (processingConfig.datasetMode === 'update') {
    await log.step('Vérification du jeu de données')
    dataset = (await axios.get(`api/v1/datasets/${processingConfig.dataset.id}`)).data
    if (!dataset) throw new Error(`le jeu de données n'existe pas, id="${processingConfig.dataset.id}"`)
    await log.info(`le jeu de donnée existe, id="${dataset.id}", title="${dataset.title}"`)
  }

  await log.step('Récupération des données')
  const { data } = await axios.get(processingConfig.dataUrl)
  await log.info(`Données de ${data.length} capteurs récupérées`)
  await log.info('Filtrage des données')
  const ids = [].concat(...processingConfig.sensors.map(s => s.ids))
  const sensors = {}
  data.forEach(d => {
    if (d.sensor && ids.includes(d.sensor.id)) {
      sensors[d.sensor.id] = d
      sensors[d.sensor.id].sensordatavalues = Object.assign({}, ...sensors[d.sensor.id].sensordatavalues.filter(v => processingConfig.columns.includes(v.value_type)).map(v => ({ [v.value_type]: Number(v.value) })))
    }
  })
  const errors = ids.filter(id => !sensors[id])
  if (errors.length) await log.error(`Aucune donnée trouvée pour le(s) capteur(s) ${errors.join(', ')}`)
  for (const id of errors) delete sensors[id]

  await log.info(`Envoi des données pour ${Object.keys(sensors).length} capteurs`)
  const bulk = processingConfig.sensors.filter(s => s.ids.find(id => sensors[id])).map(s => {
    const sensor = s.ids.map(id => sensors[id]).pop()
    const line = {
      title: s.title,
      ids: [],
      timestamp: sensor.timestamp.replace(' ', 'T') + 'Z',
      latitude: Number(sensor.location.latitude),
      longitude: Number(sensor.location.longitude),
      altitude: Number(sensor.location.altitude)
    }
    s.ids.filter(id => sensors[id]).forEach(id => {
      line.ids.push(id)
      Object.assign(line, sensors[id].sensordatavalues)
    })
    line.ids = line.ids.join(',')
    return line
  })
  await axios.post(`api/v1/datasets/${dataset.id}/_bulk_lines`, bulk)
  await log.info(`${Object.keys(sensors).filter(id => sensors[id].data).length} ligne(s) de donnée écrite`)
  await ws.waitForJournal(dataset.id, 'finalize-end')
}

// used to manage interruption
// not required but it is a good practice to prevent incoherent state a smuch as possible
// the run method should finish shortly after calling stop, otherwise the process will be forcibly terminated
// the grace period before force termination is 20 seconds
exports.stop = async () => {
  // stopped = true
}

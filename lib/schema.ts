export const datasetSchema = [
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

export const columns = [
  { key: 'P0', type: 'number', title: 'PM1' },
  { key: 'P1', type: 'number', title: 'PM10' },
  { key: 'P2', type: 'number', title: 'PM2.5' },
  { key: 'humidity', type: 'number', title: 'Hygrométrie' },
  { key: 'temperature', type: 'number', title: 'Température' }
]

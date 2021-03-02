import csv from 'minimal-csv-formatter'
import _ from 'lodash/fp'
import F from 'futil'

export let transformLabels = _.map(_.get('label'))

export let writeCSV = ({
  stream, // writable stream target stream
  iterableData, // iterator for each page of an array of objects
  transform, // [{ field1: 'Label' }, 'fieldA', { field2: 'Label 1' }], // ordered list of fields and/or field:label pairs
  onWrite = _.noop, // function to intercept writing a page of records
}) => {
  stream.write(csv(transformLabels(transform)))
  let cancel = false
  let recordsWritten = 0

  return {
    promise: (async () => {
      for await (let r of iterableData) {
        if( cancel ) break
        stream.write(csv(_.map(t => t.display(r[t.key]), transform)))
        recordsWritten = recordsWritten + 1
      }
      await stream.end()
    })(),
    cancel: () => { cancel = true }
  }
}
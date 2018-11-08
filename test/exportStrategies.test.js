import _ from 'lodash/fp'
import * as exportStrategies from '../src/exportStrategies'

describe('exportStrategies', () => {
  let getSimpleStrategy = getNext => {
    let page = 1
    let totalPages = 3
    return {
      getTotalRecords: () => 4,
      hasNext: () => page < totalPages,
      getNext() {
        let result = [page]
        page++
        if (getNext) return getNext()
        return result
      },
    }
  }

  describe('paged', () => {
    it('should work', async () => {
      let strategy = getSimpleStrategy()
      let onChange = jest.fn()
      await exportStrategies.paged({ strategy, onChange })
      expect(onChange.mock.calls).toEqual([[[1]], [[2]]])
    })
  })

  describe('bulk', async () => {
    it('should work', async () => {
      let strategy = getSimpleStrategy()
      let result = await exportStrategies.bulk({ strategy })
      expect(result).toEqual([1, 2])
    })
  })

  describe('stream', () => {
    it('should work', async () => {
      let strategy = getSimpleStrategy()
      let stream = {
        write: jest.fn(),
        end: jest.fn(),
      }
      await exportStrategies.stream({ strategy, stream })
      expect(stream.write.mock.calls).toEqual([[[1]], [[2]]])
      expect(stream.end).toHaveBeenCalled()
    })
  })

  describe('CSVStream', () => {
    it('should work', async () => {
      let getNext = () => [
        {
          firstProperty: 'first',
          secondProperty: 'second',
        },
        {
          firstProperty: 'first',
          secondProperty: 'second',
        },
      ]
      let strategy = getSimpleStrategy(getNext)
      let stream = {
        write: jest.fn(),
        end: jest.fn(),
      }
      let independentTotalCount = 0
      let beforeWrite = async ({ chunk, totalRecords }) => {
        independentTotalCount += chunk.length
        if (independentTotalCount === 4) {
          chunk = chunk.slice(0, -1)
          totalRecords -= 1
        }
        return {
          chunk,
          totalRecords,
        }
      }
      let onWrite = jest.fn()
      let logger = jest.fn()
      let formatRules = {
        firstProperty: {
          label: 'First Prop',
          display: _.toUpper,
        },
        secondProperty: {
          display: _.toUpper,
        },
      }
      await exportStrategies.CSVStream({
        strategy,
        stream,
        beforeWrite,
        onWrite,
        formatRules,
        logger,
      })
      expect(stream.write.mock.calls).toEqual([
        [
          `First Prop,Second Property
FIRST,SECOND
FIRST,SECOND
`,
        ],
        ['FIRST,SECOND\n'],
      ])
      expect(onWrite.mock.calls).toEqual([
        [
          {
            chunk: [],
            totalRecords: 4,
          },
        ],
        [
          {
            chunk: [
              {
                'First Prop': 'FIRST',
                'Second Property': 'SECOND',
              },
              {
                'First Prop': 'FIRST',
                'Second Property': 'SECOND',
              },
            ],
            records: 2,
            totalRecords: 4,
          },
        ],
        [
          {
            chunk: [
              {
                'First Prop': 'FIRST',
                'Second Property': 'SECOND',
              },
            ],
            records: 3,
            totalRecords: 3,
          },
        ],
      ])
      // 1 per page because of our getNext function,
      // Contexture is responsible for making sure the query is consistent with
      // the database results.
      expect(logger.mock.calls).toEqual([
        ['CSVStream', '2 of 4'],
        ['CSVStream', '3 of 3'],
      ])
      expect(stream.end).toHaveBeenCalled()
    })
  })
})

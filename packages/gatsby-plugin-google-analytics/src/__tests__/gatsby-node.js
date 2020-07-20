import * as gatsbyNode from "../gatsby-node"

describe(`gatsby-plugin-google-analytics`, () => {
  describe(`onPreInit`, () => {
    let reporter

    beforeEach(() => {
      reporter = {
        warn: jest.fn(),
      }
    })

    it(`should run preInit without problems`, () => {
      gatsbyNode.onPreInit({ reporter }, { trackingId: `1234` })

      expect(reporter.warn).not.toHaveBeenCalled()
    })

    it(`should warn when no trackingId is provided`, () => {
      gatsbyNode.onPreInit({ reporter }, {})

      expect(reporter.warn).toHaveBeenCalled()
      expect(reporter.warn).toHaveBeenCalledWith(
        `The Google Analytics plugin requires a tracking ID. Did you mean to add it?`
      )
    })
  })
})

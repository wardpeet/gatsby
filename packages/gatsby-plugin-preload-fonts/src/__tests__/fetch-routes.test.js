const { request } = require(`graphql-request`)
const { isCI } = require(`gatsby-core-utils`)
const createMockLogger = require(`logger-mock`)
const fetchRoutes = require(`../prepare/fetch-routes`)

jest.mock(`graphql-request`, () => {
  return { request: jest.fn() }
})

jest.mock(`gatsby-core-utils`, () => {
  return { isCI: jest.fn() }
})

describe(`fetch-routes`, () => {
  const endpoint = `http://localhost:3000/___graphql`
  let cache
  let logger

  beforeEach(() => {
    cache = {
      timestamp: Date.now(),
      hash: `initial-run`,
      assets: {},
    }
    logger = createMockLogger()
  })

  it(`doesn't throw when no routes are present`, async () => {
    expect.assertions(2)

    request.mockImplementationOnce(() => {
      return {
        allSitePage: {
          nodes: [],
        },
      }
    })

    const routes = await fetchRoutes({ logger, endpoint, cache })

    expect(request).toHaveBeenCalled()
    expect(routes).toEqual([])
  })

  it(`generates an array of routes`, async () => {
    expect.assertions(1)

    request.mockImplementationOnce(() => {
      return {
        allSitePage: {
          nodes: [{ path: `/foo` }, { path: `/bar` }, { path: `/baz` }],
        },
      }
    })

    const routes = await fetchRoutes({ logger, endpoint, cache })

    expect(routes).toEqual([`/foo`, `/bar`, `/baz`])
  })

  it(`prompts the user when the list of routes has not changed since last run`, async () => {
    expect.assertions(1)

    request.mockImplementationOnce(() => {
      return {
        allSitePage: {
          nodes: [{ path: `/foo` }, { path: `/bar` }, { path: `/baz` }],
        },
      }
    })
    logger.confirm.mockImplementationOnce(() =>
      Promise.resolve(false /* don't crawl routes */)
    )

    cache.hash = `09f5b092fb87d859e0ac53dbae299a9e`
    await expect(fetchRoutes({ logger, endpoint, cache })).resolves.toEqual([])
  })

  it(`doesn't prompt the user when the list of routes has not changed since last run if run in CI`, async () => {
    expect.assertions(1)

    request.mockImplementationOnce(() => {
      return {
        allSitePage: {
          nodes: [{ path: `/foo` }, { path: `/bar` }, { path: `/baz` }],
        },
      }
    })
    isCI.mockImplementationOnce(true)

    cache.hash = `09f5b092fb87d859e0ac53dbae299a9e`
    await expect(fetchRoutes({ logger, endpoint, cache })).resolves.toEqual([])
  })
})

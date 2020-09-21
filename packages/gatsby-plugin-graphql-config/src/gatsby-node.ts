import * as fs from "fs-extra"
import { resolve, join } from "path"
import { GraphQLSchema, printSchema } from "gatsby/graphql"
import type { GatsbyNode, NodePluginArgs } from "gatsby"
import type { GatsbyReduxStore } from "gatsby/src/redux"

async function cacheGraphQLConfig(
  program: ReturnType<GatsbyReduxStore["getState"]>["program"],
  reporter: NodePluginArgs["reporter"]
): Promise<void> {
  try {
    const base = program.directory
    const configJSONString = JSON.stringify(
      {
        schema: resolve(base, `.cache/schema.graphql`),
        documents: [
          resolve(base, `src/**/**.{ts,js,tsx,jsx,esm}`),
          resolve(base, `.cache/fragments.graphql`),
        ],
        extensions: {
          endpoints: {
            default: {
              url: `${program.https ? `https://` : `http://`}${program.host}:${
                program.port
              }/___graphql`,
            },
          },
        },
      },
      null,
      2
    )

    fs.writeFileSync(
      resolve(base, `.cache`, `graphql.config.json`),
      configJSONString
    )
    reporter.info(`[gatsby-plugin-graphql-config] wrote config file to .cache`)
  } catch (err) {
    reporter.panic(
      `[gatsby-plugin-graphql-config] failed to write config file to .cache`,
      err
    )
  }
}

const createFragmentCacheHandler = (
  cacheDirectory: string,
  store: NodePluginArgs["store"],
  reporter: NodePluginArgs["reporter"]
) => async (): Promise<void> => {
  try {
    const currentDefinitions = (store.getState() as ReturnType<
      GatsbyReduxStore["getState"]
    >).definitions

    const fragmentString = Array.from(currentDefinitions.entries())
      .filter(([_, def]) => def.isFragment)
      .map(([_, def]) => `# ${def.filePath}\n${def.printedAst}`)
      .join(`\n`)

    await fs.writeFile(
      join(cacheDirectory, `fragments.graphql`),
      fragmentString
    )

    reporter.info(
      `[gatsby-plugin-graphql-config] wrote fragments file to .cache`
    )
  } catch (err) {
    reporter.panic(
      `[gatsby-plugin-graphql-config] failed writing fragments file to .cache`,
      err
    )
  }
}

const cacheSchema = async (
  cacheDirectory: string,
  schema: GraphQLSchema,
  reporter: NodePluginArgs["reporter"]
): Promise<void> => {
  try {
    reporter.verbose(`[gatsby-plugin-graphql-config] printing schema`)
    const schemaSDLString = printSchema(schema, { commentDescriptions: true })

    await fs.writeFile(join(cacheDirectory, `schema.graphql`), schemaSDLString)

    reporter.info(`[gatsby-plugin-graphql-config] wrote SDL file to .cache`)
  } catch (err) {
    reporter.error(
      `[gatsby-plugin-graphql-config] failed writing schema file to .cache`,
      err
    )
  }
}

const createSchemaCacheHandler = (
  cacheDirectory: string,
  store: NodePluginArgs["store"],
  reporter: NodePluginArgs["reporter"]
) => async (): Promise<void> => {
  const { schema } = store.getState() as ReturnType<
    GatsbyReduxStore["getState"]
  >
  await cacheSchema(cacheDirectory, schema, reporter)
}

export const onPostBootstrap: GatsbyNode["onPreBootstrap"] = async function onPostBootstrap({
  store,
  emitter,
  reporter,
}): Promise<void> {
  const { program, schema } = store.getState() as ReturnType<
    GatsbyReduxStore["getState"]
  >

  const cacheDirectory = resolve(program.directory, `.cache`)
  await fs.ensureDir(cacheDirectory)

  // cache initial schema
  await cacheSchema(cacheDirectory, schema, reporter)
  // cache graphql config file
  await cacheGraphQLConfig(program, reporter)
  // Important! emitter.on is an internal Gatsby API. It is highly discouraged to use in plugins and can break without a notice.
  // FIXME: replace it with a more appropriate API call when available.
  emitter.on(
    `SET_GRAPHQL_DEFINITIONS`,
    createFragmentCacheHandler(cacheDirectory, store, reporter)
  )
  emitter.on(
    `SET_SCHEMA`,
    createSchemaCacheHandler(cacheDirectory, store, reporter)
  )
}

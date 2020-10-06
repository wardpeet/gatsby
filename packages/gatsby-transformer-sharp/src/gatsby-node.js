exports.onCreateNode = require(`./on-node-create`)
exports.createSchemaCustomization = require(`./customize-schema`)
exports.createResolvers = require(`./create-resolvers`)

exports.onPostBootstrap = async (
  { cache, actions, getNode, reporter },
  pluginOptions
) => {
  if (
    pluginOptions.skipProcesingOnDevelop &&
    process.env.gatsby_executing_command === `develop`
  ) {
    return
  }

  const unfullfilledJobs = (await cache.get(`test`)) || []

  for (const imageId of unfullfilledJobs) {
    try {
      // check if node still exists, if not than we don't do anything
      const node = await getNode(imageId)
      const file = await getNode(node.parent)

      if (node) {
        // eslint-disable-next-line no-unused-vars
        const { owner, ...internalWithoutOwner } = node.internal
        await actions.createNode({
          ...node,
          internal: {
            ...internalWithoutOwner,
            contentDigest: `${file.internal.contentDigest}`,
          },
        })
      }
    } catch (err) {
      reporter.panic(err)
    }
  }

  await cache.set(`test`, [])
}

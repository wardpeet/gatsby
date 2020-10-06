const { createContentDigest } = require(`gatsby-core-utils`)
const { supportedExtensions } = require(`./supported-extensions`)

module.exports = async function onCreateNode(
  { node, actions, createNodeId },
  pluginOptions
) {
  const { createNode, createParentChildLink } = actions

  if (!supportedExtensions[node.extension]) {
    return
  }

  const imageNode = {
    id: createNodeId(`${node.id} >> ImageSharp`),
    children: [],
    parent: node.id,
    internal: {
      contentDigest: `${node.internal.contentDigest}`,
      type: `ImageSharp`,
    },
  }

  if (
    pluginOptions.skipProcesingOnDevelop &&
    process.env.gatsby_executing_command === `develop`
  ) {
    imageNode.internal.contentDigest = createContentDigest(
      `${node.internal.contentDigest}` + `skip`
    )
  }

  createNode(imageNode)
  createParentChildLink({ parent: node, child: imageNode })

  return
}

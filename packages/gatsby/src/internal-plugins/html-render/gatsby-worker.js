"use strict"

const fs = require(`fs-extra`)
const slash = require(`gatsby-core-utils`)

const { getPageHtmlFilePath } = require(`../../utils/page-html`)

exports.RENDER_HTML = ({ inputPaths, outputDir, args }) => {
  const { pagePath } = args

  const readFile = filePath => {
    const inputPath = inputPaths.find(({ path }) =>
      path.endsWith(slash(filePath))
    )

    return fs.readFileSync(inputPath.path, `utf8`)
  }

  let htmlRendererPath
  inputPaths.forEach(({ path: filePath }) => {
    if (filePath.endsWith(`render-page.js`)) {
      htmlRendererPath = filePath
    }
  })
  const htmlComponentRenderer = require(htmlRendererPath)
  const appDataPath = `page-data/app-data.json`

  return new Promise((resolve, reject) => {
    try {
      htmlComponentRenderer.default(
        {
          pagePath,
          appDataPath,
          readFile,
        },
        (_throwAway, htmlString) => {
          resolve(
            fs.outputFile(getPageHtmlFilePath(outputDir, pagePath), htmlString)
          )
        }
      )
    } catch (e) {
      e.context = {
        path: pagePath,
      }
      reject(e)
    }
  })
}
// # sourceMappingURL=gatsby-worker.js.map

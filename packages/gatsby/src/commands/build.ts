import path from "path"
import report from "gatsby-cli/lib/reporter"
import signalExit from "signal-exit"
import fs from "fs-extra"
import telemetry from "gatsby-telemetry"

import { buildHTML } from "./build-html"
import { buildProductionBundle } from "./build-javascript"
import bootstrap from "../bootstrap"
import apiRunnerNode from "../utils/api-runner-node"
import { GraphQLRunner } from "../query/graphql-runner"
import { copyStaticDirs } from "../utils/get-static-dir"
import { initTracer, stopTracer } from "../utils/tracer"
import db from "../db"
import { store, readState } from "../redux"
import queryUtil from "../query"
import * as appDataUtil from "../utils/app-data"
import * as WorkerPool from "../utils/worker/pool"
import { structureWebpackErrors } from "../utils/webpack-error-utils"
import {
  userPassesFeedbackRequestHeuristic,
  showFeedbackRequest,
} from "../utils/feedback"
import * as buildUtils from "./build-utils"
import { boundActionCreators } from "../redux/actions"
import { waitUntilAllJobsComplete } from "../utils/wait-until-jobs-complete"
import { IProgram, Stage } from "./types"
import { PackageJson } from "../.."

let cachedPageData
let cachedWebpackCompilationHash
if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
  const { pageData, webpackCompilationHash } = readState()
  // extract only data that we need to reuse and let v8 garbage collect rest of state
  cachedPageData = pageData
  cachedWebpackCompilationHash = webpackCompilationHash
}

interface IBuildArgs extends IProgram {
  directory: string
  sitePackageJson: PackageJson
  prefixPaths: boolean
  noUglify: boolean
  profile: boolean
  graphqlTracing: boolean
  openTracingConfigFile: string
}

module.exports = async function build(program: IBuildArgs): Promise<void> {
  if (program.profile) {
    report.warn(
      `React Profiling is enabled. This can have a performance impact. See https://www.gatsbyjs.org/docs/profiling-site-performance-with-react-profiler/#performance-impact`
    )
  }

  const publicDir = path.join(program.directory, `public`)
  initTracer(program.openTracingConfigFile)
  const buildActivity = report.phantomActivity(`build`)
  buildActivity.start()

  telemetry.trackCli(`BUILD_START`)
  signalExit(exitCode => {
    telemetry.trackCli(`BUILD_END`, { exitCode })
  })

  const buildSpan = buildActivity.span
  buildSpan.setTag(`directory`, program.directory)

  const { graphqlRunner: bootstrapGraphQLRunner } = await bootstrap({
    ...program,
    parentSpan: buildSpan,
  })

  const graphqlRunner = new GraphQLRunner(store, {
    collectStats: true,
    graphqlTracing: program.graphqlTracing,
  })

  const {
    processPageQueries,
    processStaticQueries,
  } = queryUtil.getInitialQueryProcessors({
    parentSpan: buildSpan,
    graphqlRunner,
  })

  await processStaticQueries()

  await apiRunnerNode(`onPreBuild`, {
    graphql: bootstrapGraphQLRunner,
    parentSpan: buildSpan,
  })

  // Copy files from the static directory to
  // an equivalent static directory within public.
  copyStaticDirs()

  const buildActivityTimer = report.activityTimer(
    `Building production JavaScript and CSS bundles`,
    { parentSpan: buildSpan }
  )
  buildActivityTimer.start()
  let stats
  try {
    stats = await buildProductionBundle(program, buildActivityTimer.span)
  } catch (err) {
    buildActivityTimer.panic(structureWebpackErrors(Stage.BuildJavascript, err))
  } finally {
    buildActivityTimer.end()
  }

  const workerPool = WorkerPool.create()

  const webpackCompilationHash = stats.hash
  if (
    webpackCompilationHash !== store.getState().webpackCompilationHash ||
    !appDataUtil.exists(publicDir)
  ) {
    store.dispatch({
      type: `SET_WEBPACK_COMPILATION_HASH`,
      payload: webpackCompilationHash,
    })

    const rewriteActivityTimer = report.activityTimer(
      `Rewriting compilation hashes`,
      {
        parentSpan: buildSpan,
      }
    )
    rewriteActivityTimer.start()

    await appDataUtil.write(publicDir, webpackCompilationHash)

    rewriteActivityTimer.end()
  }

  await processPageQueries()

  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
    const { pages } = store.getState()
    if (cachedPageData) {
      cachedPageData.forEach((_value, key) => {
        if (!pages.has(key)) {
          boundActionCreators.removePageData({
            id: key,
          })
        }
      })
    }
  }

  if (telemetry.isTrackingEnabled()) {
    // transform asset size to kB (from bytes) to fit 64 bit to numbers
    const bundleSizes = stats
      .toJson({ assets: true })
      .assets.filter(asset => asset.name.endsWith(`.js`))
      .map(asset => asset.size / 1000)
    const pageDataSizes = [...store.getState().pageDataStats.values()]

    telemetry.addSiteMeasurement(`BUILD_END`, {
      bundleStats: telemetry.aggregateStats(bundleSizes),
      pageDataStats: telemetry.aggregateStats(pageDataSizes),
      queryStats: graphqlRunner.getStats(),
    })
  }

  boundActionCreators.setProgramStatus(`BOOTSTRAP_QUERY_RUNNING_FINISHED`)

  await db.saveState()

  await waitUntilAllJobsComplete()

  // we need to save it again to make sure our latest state has been saved
  await db.saveState()

  let pagePaths = [...store.getState().pages.keys()]

  // Rebuild subset of pages if user opt into GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES
  // if there were no source files (for example components, static queries, etc) changes since last build, otherwise rebuild all pages
  if (
    process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES &&
    cachedWebpackCompilationHash === store.getState().webpackCompilationHash
  ) {
    pagePaths = buildUtils.getChangedPageDataKeys(
      store.getState(),
      cachedPageData
    )
  }

  const buildHTMLActivityProgress = report.createProgress(
    `Building static HTML for pages`,
    pagePaths.length,
    0,
    {
      parentSpan: buildSpan,
    }
  )
  buildHTMLActivityProgress.start()
  try {
    await buildHTML({
      program,
      stage: Stage.BuildHTML,
      pagePaths,
      activity: buildHTMLActivityProgress,
      workerPool,
      store,
    })
  } catch (err) {
    let id = `95313` // TODO: verify error IDs exist
    const context = {
      errorPath: err.context && err.context.path,
      ref: ``,
    }

    const match = err.message.match(
      /ReferenceError: (window|document|localStorage|navigator|alert|location) is not defined/i
    )
    if (match && match[1]) {
      id = `95312`
      context.ref = match[1]
    }

    buildHTMLActivityProgress.panic({
      id,
      context,
      error: err,
    })
  }
  buildHTMLActivityProgress.end()

  let deletedPageKeys: string[] = []
  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
    const deletePageDataActivityTimer = report.activityTimer(
      `Delete previous page data`
    )
    deletePageDataActivityTimer.start()
    deletedPageKeys = buildUtils.collectRemovedPageData(
      store.getState(),
      cachedPageData
    )
    await buildUtils.removePageFiles(publicDir, deletedPageKeys)

    deletePageDataActivityTimer.end()
  }

  const postBuildActivityTimer = report.activityTimer(`onPostBuild`, {
    parentSpan: buildSpan,
  })
  postBuildActivityTimer.start()
  await apiRunnerNode(`onPostBuild`, {
    graphql: bootstrapGraphQLRunner,
    parentSpan: buildSpan,
  })
  postBuildActivityTimer.end()

  await waitUntilAllJobsComplete()

  // Make sure we saved the latest state so we have all jobs cached
  await db.saveState()

  report.info(`Done building in ${process.uptime()} sec`)

  buildSpan.finish()
  await stopTracer()
  workerPool.end()
  buildActivity.end()

  if (
    process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES &&
    process.argv.includes(`--log-pages`)
  ) {
    if (pagePaths.length) {
      report.info(
        `Built pages:\n${pagePaths
          .map(path => `Updated page: ${path}`)
          .join(`\n`)}`
      )
    }

    if (deletedPageKeys.length) {
      report.info(
        `Deleted pages:\n${deletedPageKeys
          .map(path => `Deleted page: ${path}`)
          .join(`\n`)}`
      )
    }
  }

  if (
    process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES &&
    process.argv.includes(`--write-to-file`)
  ) {
    const createdFilesPath = path.resolve(
      `${program.directory}/.cache`,
      `newPages.txt`
    )
    const deletedFilesPath = path.resolve(
      `${program.directory}/.cache`,
      `deletedPages.txt`
    )

    if (pagePaths.length) {
      await fs.writeFile(createdFilesPath, `${pagePaths.join(`\n`)}\n`, `utf8`)
      report.info(`.cache/newPages.txt created`)
    }
    if (deletedPageKeys.length) {
      await fs.writeFile(
        deletedFilesPath,
        `${deletedPageKeys.join(`\n`)}\n`,
        `utf8`
      )
      report.info(`.cache/deletedPages.txt created`)
    }
  }

  if (await userPassesFeedbackRequestHeuristic()) {
    showFeedbackRequest()
  }
}

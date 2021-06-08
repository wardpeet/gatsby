const path = require(`path`)
const glob = require(`glob`)
const fs = require(`fs-extra`)

const ROOT_DIR = path.join(__dirname, `..`)
const packageRules = new Map()

const globalPackageRules = [
  // bundle well known monorepos
  {
    groupName: `babel monorepo`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    sourceUrlPrefixes: [`https://github.com/babel/babel`],
  },
  {
    groupName: `lodash monorepo`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    sourceUrlPrefixes: [`https://github.com/lodash`],
  },
  {
    groupName: `gatsby monorepo`,
    matchPaths: [`+(package.json)`],
    dependencyDashboardApproval: false,
  },

  // group eslint & prettier
  {
    groupName: `formatting & linting`,
    commitMessageTopic: `ormatting & linting`,
    updateTypes: [`major`, `minor`, `patch`, `pin`],
    matchPaths: [`+(package.json)`],
    packageNames: [`eslint`, `prettier`],
    packagePatterns: [`^eslint-`],
    dependencyDashboardApproval: false,
  },

  // some widely used packages
  {
    groupName: `cross-env`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`cross-env`],
    dependencyDashboardApproval: false,
  },
  {
    groupName: `execa`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`execa`],
    dependencyDashboardApproval: false,
  },
  {
    groupName: `mini-css-extract-plugin`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`mini-css-extract-plugin`],
  },
  {
    groupName: `sharp`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`sharp`, `@types/sharp`],
    dependencyDashboardApproval: false,
  },
  {
    groupName: `typescript`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`typescript`],
    packagePatterns: [`^@typescript-eslint/`],
    dependencyDashboardApproval: false,
  },
  {
    groupName: `chalk`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`chalk`],
    dependencyDashboardApproval: false,
  },
  {
    groupName: `fs-extra`,
    matchPaths: [`+(package.json)`, `packages/**/package.json`],
    packageNames: [`fs-extra`, `@types/fs-extra`],
    dependencyDashboardApproval: false,
  },
]

const globalExcludePackages = []
const globalExcludePackagePatterns = []
globalPackageRules.forEach(group => {
  if (group.packagePatterns) {
    globalExcludePackagePatterns.push(...group.packagePatterns)
  }
  if (group.packageNames) {
    globalExcludePackages.push(...group.packageNames)
  }
})

// our default rules
const defaultPackageRules = [
  // disable engine upgrades
  {
    depTypeList: [`engines`],
    enabled: false,
  },
  {
    packageNames: [`gatsby-interface`],
    // update internal packages immediately after publish instead of waiting 3 days
    stabilityDays: 0,
  },

  // update our examples and starters automatically
  {
    groupName: `starters and examples`,
    commitMessageTopic: `starters and examples`,
    groupSlug: `starters-examples-minor`,
    matchPaths: [`starters/**`, `examples/**`],
    schedule: `before 7am on Monday`,
    matchUpdateTypes: [`patch`, `minor`],
  },
  {
    extends: [`monorepo:gatsby`],
    commitMessageTopic: `starters and examples Gatsby packages`,
    groupName: `starters and examples - Gatsby`,
    groupSlug: `starters-examples-gatsby-minor`,
    matchPaths: [`starters/**`, `examples/**`],
    automerge: true,
    stabilityDays: 0,
    prPriority: 50,
    schedule: `at any time`,
    matchUpdateTypes: [`patch`, `minor`],
  },
  {
    groupName: `starters and examples`,
    commitMessageTopic: `starters and examples`,
    matchPaths: [`starters/**`, `examples/**`],
    schedule: `before 7am on Monday`,
    matchUpdateTypes: [`major`],
    groupSlug: `starters-examples-major`,
    dependencyDashboardApproval: false,
  },
  {
    extends: [`monorepo:gatsby`],
    commitMessageTopic: `starters and examples Gatsby packages`,
    groupName: `starters and examples - Gatsby`,
    matchPaths: [`starters/**`, `examples/**`],
    stabilityDays: 0,
    prPriority: 50,
    schedule: `at any time`,
    matchUpdateTypes: [`major`],
    groupSlug: `starters-examples-gatsby-major`,
    dependencyDashboardApproval: false,
  },

  ...globalPackageRules,
]
const monorepoPackages = glob
  .sync(`packages/*/package.json`)
  .map(file => file.match(/packages\/([^/]+)/)[1])

// generate package specific groups
monorepoPackages.forEach(pkg => {
  const preFirstMajorPackages = []
  try {
    const pkgJson = fs.readJSONSync(
      path.join(ROOT_DIR, `packages`, pkg, `package.json`)
    )

    for (const dep in pkgJson.dependencies) {
      if (
        dep !== `sharp` &&
        dep !== `@types/sharp` &&
        pkgJson.dependencies[dep] &&
        (pkgJson.dependencies[dep].startsWith(`~0.`) ||
          pkgJson.dependencies[dep].startsWith(`^0.`))
      ) {
        preFirstMajorPackages.push(dep)
      }
    }
  } catch (err) {
    // ignore
  }

  const packageRule = [
    {
      matchPaths: [`packages/${pkg}/package.json`],
      matchDepTypes: [`devDependencies`],
      matchUpdateTypes: [`patch`, `minor`],
      groupName: `[DEV] minor and patch dependencies for ${pkg}`,
      groupSlug: `${pkg}-dev-minor`,
      automerge: true,
      excludePackageNames: globalExcludePackages,
      excludePackagePatterns: globalExcludePackagePatterns,
    },
    {
      matchPaths: [`packages/${pkg}/package.json`],
      matchDepTypes: [`devDependencies`],
      matchUpdateTypes: [`major`],
      groupName: `[DEV] major dependencies for ${pkg}`,
      groupSlug: `${pkg}-dev-major`,
      automerge: true,
      dependencyDashboardApproval: false,
      excludePackageNames: globalExcludePackages,
      excludePackagePatterns: globalExcludePackagePatterns,
    },
    {
      matchPaths: [`packages/${pkg}/package.json`],
      matchDepTypes: [`dependencies`],
      matchUpdateTypes: [`patch`, `minor`],
      groupName: `minor and patch dependencies for ${pkg}`,
      groupSlug: `${pkg}-prod-minor`,
      excludePackageNames: globalExcludePackages,
      excludePackagePatterns: globalExcludePackagePatterns,
    },
    {
      matchPaths: [`packages/${pkg}/package.json`],
      matchDepTypes: [`dependencies`],
      matchUpdateTypes: [`major`],
      groupName: `major dependencies for ${pkg}`,
      groupSlug: `${pkg}-prod-major`,
      excludePackageNames: globalExcludePackages,
      excludePackagePatterns: globalExcludePackagePatterns,
    },
    // all deps below <1.0.0 will get special treatment.
    {
      matchPaths: [`packages/${pkg}/package.json`],
      matchDepTypes: [`dependencies`],
      groupName: `minor and patch dependencies for ${pkg}`,
      groupSlug: `${pkg}-prod-minor`,
      matchPackageNames: preFirstMajorPackages,
      matchUpdateTypes: [`patch`],
      excludePackageNames: globalExcludePackages,
      excludePackagePatterns: globalExcludePackagePatterns,
    },
    {
      matchPaths: [`packages/${pkg}/package.json`],
      matchDepTypes: [`dependencies`],
      groupName: `major dependencies for ${pkg}`,
      groupSlug: `${pkg}-prod-major`,
      matchPackageNames: preFirstMajorPackages,
      matchUpdateTypes: [`major`, `minor`],
      excludePackageNames: globalExcludePackages,
      excludePackagePatterns: globalExcludePackagePatterns,
    },
  ]

  packageRules.set(pkg, packageRule)
})

const renovateConfig = {
  extends: [
    `:separateMajorReleases`,
    `:combinePatchMinorReleases`,
    `:ignoreUnstable`,
    `:prImmediately`,
    `:semanticPrefixFixDepsChoreOthers`,
    `:automergeDisabled`,
    `:disablePeerDependencies`,
    `:maintainLockFilesDisabled`,
    `:disableRateLimiting`,
    `:label(topic: automation)`,
    `:ignoreModulesAndTests`,
    `:enableVulnerabilityAlerts`,
  ],
  includePaths: [`package.json`, `packages/**`, `starters/**`, `examples/**`],
  major: {
    dependencyDashboardApproval: true,
  },
  dependencyDashboard: true,
  ignoreDeps: [`react`, `react-dom`, `uuid`],
  rangeStrategy: `bump`,
  bumpVersion: null,
  prHourlyLimit: 0,
  // Wait for 2 days to update a package so we can check if it's stable
  stabilityDays: 2,
  postUpdateOptions: [`yarnDedupeHighest`],
  timezone: `GMT`,
  schedule: [`before 7am on the first day of the month`],
  packageRules: defaultPackageRules.concat(
    Array.from(packageRules.values()).flat()
  ),
}

fs.writeJSONSync(path.join(ROOT_DIR, `renovate.json5`), renovateConfig, {
  spaces: 2,
})

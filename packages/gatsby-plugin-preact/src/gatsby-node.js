exports.onCreateWebpackConfig = ({ stage, actions }) => {
  actions.setWebpackConfig({
    resolve: {
      alias: {
        react: `preact/compat`,
        "react-dom": `preact/compat`,
        "react-dom/server": `preact/compat`,
      },
    },
  })
}

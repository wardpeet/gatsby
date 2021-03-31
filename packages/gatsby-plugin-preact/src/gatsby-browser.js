const singletonKey = `__webpack_hot_middleware_reporter__`

function messageHandler(message) {
  switch (message.type) {
    case `ok`:
    case `still-ok`:
    case `warnings`: {
      // TODO: Implement handling for warnings
      handleCompileSuccess()
      break
    }
    case `errors`: {
      handleCompileErrors(message.data)
      break
    }
    default: {
      // Do nothing.
    }
  }
}

exports.onClientEntry = () => {
  if (process.env.NODE_ENV !== `production`) {
    require(`preact/debug`)
  }

  const client =
    window[singletonKey] || require(`webpack-hot-middleware/client`)

  client.useCustomOverlay({
    showProblems: function showProblems(type, data) {
      const error = {
        data: data,
        type: type,
      }

      messageHandler(error)
    },
    clear: function clear() {
      messageHandler({ type: `ok` })
    },
  })
}

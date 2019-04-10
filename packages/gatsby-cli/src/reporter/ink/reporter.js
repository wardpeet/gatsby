import React from "react"
import { Static, Box } from "ink"
import { isCI } from "ci-info"
import { createProgressBar, createSpinner } from "./activities"
import Activity from "./components/activity"
import ProgressBar from "./components/progressbar"
import { Message } from "./components/messages"

const showProgress = process.stdout.isTTY && !isCI

const getActivitiesByType = (activities, type) => {
  const filteredActivities = {}
  Object.keys(activities).forEach(key => {
    if (activities[key].type === type) {
      filteredActivities[key] = activities[key]
    }
  })

  return filteredActivities
}

export default class GatsbyReporter extends React.Component {
  verbose = process.env.gatsby_log_level === `verbose`
  state = {
    verbose: false,
    messages: [],
    activities: {},
  }

  createActivity = (name, { type, ...options }) => {
    switch (type) {
      case `progress`:
        return createProgressBar(this)(name, options)
      case `spinner`:
      default:
        return createSpinner(this)(name, options)
    }
  }

  setColors(useColors = false) {
    this.setState({
      disableColors: !useColors,
    })
  }

  setVerbose(isVerbose = true) {
    this.verbose = isVerbose
  }

  _addMessage(type, str) {
    // threat null/undefind as an empty character, it seems like ink can't handle empty str
    if (!str) {
      str = `\u2800`
    }

    this.setState(state => {
      return {
        messages: [
          ...state.messages,
          {
            text: str,
            type,
          },
        ],
      }
    })
  }

  onLog = this._addMessage.bind(this, null)
  onInfo = this._addMessage.bind(this, `info`)
  onSuccess = this._addMessage.bind(this, `success`)
  onWarn = this._addMessage.bind(this, `warn`)
  onError = this._addMessage.bind(this, `error`)
  onVerbose = str => {
    if (!this.verbose) {
      return
    }

    this._addMessage(`verbose`, str)
  }

  render() {
    const { disableColors, activities, messages } = this.state

    return (
      <Box flexDirection="column">
        <Box flexDirection="column">
          <Static>
            {messages.map((msg, index) => (
              <Box textWrap="wrap" key={index}>
                <Message type={msg.type} hideColors={disableColors}>
                  {msg.text}
                </Message>
              </Box>
            ))}
          </Static>

          <Box flexDirection="column">
            {showProgress &&
              Object.keys(getActivitiesByType(activities, `spinner`)).map(
                activityName => (
                  <Activity
                    key={activityName}
                    name={activityName}
                    {...this.state.activities[activityName]}
                  />
                )
              )}
          </Box>

          <Box flexDirection="column" marginTop={1}>
            {showProgress &&
              Object.keys(getActivitiesByType(activities, `process`)).map(
                progressMsg => (
                  <ProgressBar
                    key={progressMsg}
                    message={progressMsg}
                    total={this.state.progressbars[progressMsg].total}
                    current={this.state.progressbars[progressMsg].current}
                  />
                )
              )}
          </Box>
        </Box>
      </Box>
    )
  }
}

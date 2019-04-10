import { calcElapsedTime } from "./util"

const generateActivityFinishedText = (message, activity) => {
  let successText = `${message} - ${calcElapsedTime(activity.startTime)} s`
  if (activity.status) {
    successText += ` — ${activity.status}`
  }

  return successText
}

export default reporter => message => {
  const getActivity = state => state.activities[message]

  /**
   * Helper function to set state, removes some boilerplate
   */
  const setState = (oldState, newState) => {
    return {
      activities: {
        ...oldState.activities,
        [message]: newState,
      },
    }
  }

  return {
    start: () => {
      reporter.setState(state =>
        setState(state, {
          type: `spinner`,
          status: ``,
          startTime: process.hrtime(),
        })
      )
    },
    setStatus: status => {
      reporter.setState(state =>
        setState(state, {
          ...getActivity(state),
          status: status,
        })
      )
    },
    end: () => {
      reporter.onSuccess(
        generateActivityFinishedText(message, getActivity(reporter.state))
      )

      reporter.setState(state => {
        const activities = { ...state.activities }
        delete activities[message]

        return {
          activities,
        }
      })
    },
  }
}

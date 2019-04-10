import { calcElapsedTime } from "./util"

export default reporter => (message, options) => {
  const isFinished = activity => activity.total - activity.current <= 1
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

  const completeProgress = state => {
    const activity = getActivity(state)
    reporter.onSuccess(
      `${message} — ${activity.current}/${activity.total} - ${calcElapsedTime(
        activity.startTime
      )} s`
    )

    reporter.setState(state => {
      const activities = { ...state.activities }
      delete activities[message]

      return {
        activities,
      }
    })
  }

  return {
    start: () => {
      reporter.setState(state =>
        setState(state, {
          type: `progress`,
          current: options.start,
          total: options.total,
          startTime: process.hrtime(),
        })
      )
    },

    tick: () => {
      const activity = getActivity(reporter.state)
      if (!activity) {
        // activity already stopped
        return
      }

      if (isFinished(activity)) {
        completeProgress(reporter.state)
        return
      }

      reporter.setState(state =>
        setState(state, {
          ...getActivity(state),
          current: getActivity(state).current + 1,
        })
      )
    },

    get total() {
      const activity = getActivity(reporter.state)

      return activity ? activity.total : options.total
    },

    /**
     * You can override the total, we have to set the state to let ink know it updated
     */
    set total(value) {
      reporter.setState(state => {
        const activity = getActivity(state)

        if (!activity) {
          options.total = value
          return state
        }

        return setState(state, {
          ...activity,
          total: value,
        })
      })
    },
  }
}

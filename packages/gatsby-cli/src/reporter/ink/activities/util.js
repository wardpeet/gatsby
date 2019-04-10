import convertHrtime from "convert-hrtime"

export const calcElapsedTime = startTime => {
  const elapsed = process.hrtime(startTime)

  return convertHrtime(elapsed)[`seconds`].toFixed(3)
}

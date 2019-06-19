let experiments

exports.initExperiments = listOfExperiments => {
  experiments = listOfExperiments
}

exports.inExperiment = experiment => {
  console.log(experiments)

  return !!experiments[experiment]
}

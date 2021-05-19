import React from "react"
import { graphql } from "gatsby"

export default ({ data }) => {
  if (!data?.allTest?.nodes?.length) {
    throw new Error("Wrong data")
  }
  return <div>{JSON.stringify(data)}</div>
}

export const query = graphql`
  query($regex: String, $sort: TestSortInput) {
    allTest(filter: { id: { regex: $regex } }, sort: $sort, limit: 5) {
      nodes {
        nodeNum
        text
      }
    }
  }
`

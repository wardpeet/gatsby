import React from "react"
import { useStaticQuery, graphql } from "gatsby"

export default function Inline() {
  const { site } = useStaticQuery(graphql`
    {
      site {
        siteMetadata {
          title
        }
      }
    }
  `)
  return <div>hi1 {site.siteMetadata.title}</div>
}

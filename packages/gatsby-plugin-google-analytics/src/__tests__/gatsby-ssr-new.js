import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import * as gatsbySSR from "../gatsby-ssr"

function render(components) {
  return renderToStaticMarkup(components)
}

describe(`gatsby-plugin-google-analytics`, () => {
  let headComponents = []
  let bodyComponents = []

  const setHeadComponents = components => {
    headComponents.push(...components)
  }

  const setPostBodyComponents = components => {
    bodyComponents.push(...components)
  }

  const actions = {
    setHeadComponents,
    setPostBodyComponents,
  }

  beforeEach(() => {
    headComponents = []
    bodyComponents = []
  })

  describe(`onRenderBody`, () => {
    it(`should preconnect to google analytics`, () => {
      gatsbySSR.onRenderBody(actions, {
        trackingId: `1234`,
      })

      expect(render(headComponents)).toBe(
        `<link rel="preconnect" href="https://www.google-analytics.com"/><link rel="dns-prefetch" href="https://www.google-analytics.com"/>`
      )
    })

    it(`should add google analytics script to the body`, () => {
      gatsbySSR.onRenderBody(actions, {
        trackingId: `1234`,
      })

      expect(render(bodyComponents)).toBe(
        `<script src="https://www.google-analytics.com/analytics.js" async=""></script>`
      )
    })

    it(`should add google analytics script to the head`, () => {
      gatsbySSR.onRenderBody(actions, {
        trackingId: `1234`,
        head: true,
      })

      expect(bodyComponents.length).toBe(0)
      expect(render(headComponents)).toContain(
        `<script src="https://www.google-analytics.com/analytics.js" async=""></script>`
      )
    })

    it(`shouldn't add google analytics when no trackingId is provided`, () => {
      gatsbySSR.onRenderBody(actions, {})

      expect(headComponents.length).toBe(0)
      expect(bodyComponents.length).toBe(0)
    })
  })
})

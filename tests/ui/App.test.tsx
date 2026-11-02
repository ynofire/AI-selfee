import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { App } from '../../src/ui/App'

describe('App routing', () => {
  it('routes by pathname', () => {
    const cases: [string, string][] = [
      ['/', 'screen-owner'],
      ['/r', 'screen-rater'],
      ['/b', 'screen-reply'],
      ['/x', 'screen-notfound'],
    ]
    for (const [path, id] of cases) {
      const { getByTestId, unmount } = render(<App pathname={path} hash="" />)
      expect(getByTestId(id)).toBeTruthy()
      unmount()
    }
  })
})

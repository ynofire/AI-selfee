import { render, screen } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { EXPIRY_MS } from '../../src/core/storage'
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

describe('App sweeps expired saved answers when it opens', () => {
  afterEach(() => window.localStorage.clear())
  const put = (key: string, lastActiveAt: number) => window.localStorage.setItem(key, JSON.stringify({ lastActiveAt }))

  it('removes another invite\'s expired key and keeps a fresh one', () => {
    put('pq:rater:oldoldold1', Date.now() - EXPIRY_MS - 60_000)
    put('pq:rater:freshfresh1', Date.now() - 60_000)
    render(<App pathname="/" hash="" />)
    expect(window.localStorage.getItem('pq:rater:oldoldold1')).toBeNull()
    expect(window.localStorage.getItem('pq:rater:freshfresh1')).not.toBeNull()
  })

  it('still tells the owner that their own answers expired (the sweep runs after the screen has read them)', () => {
    put('pq:owner:v1', Date.now() - EXPIRY_MS - 60_000)
    render(<App pathname="/" hash="" />)
    expect(screen.getByTestId('banner-expired')).toBeTruthy()
    expect(window.localStorage.getItem('pq:owner:v1')).toBeNull()
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const cfg = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8'))

describe('vercel.json', () => {
  it('rewrites /r and /b to /index.html', () => {
    for (const src of ['/r', '/b']) {
      const rule = cfg.rewrites.find((r: { source: string }) => r.source === src)
      expect(rule?.destination).toBe('/index.html')
    }
  })

  it('CSP forbids network', () => {
    const headers = cfg.headers.flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
    const csp = headers.find((h: { key: string }) => h.key === 'Content-Security-Policy')
    expect(csp.value).toContain("connect-src 'none'")
  })
})

import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { encodeInvite } from '../../src/core/codec'
import { Root } from '../../src/ui/Root'

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
  window.localStorage.clear()
})

const inviteFrom = (label: string, nonce: string): string =>
  `#${encodeInvite({ v: 1, bank: 'v1', nonce, label, axes: [['filter', 65, 60]] })}`

describe('Root', () => {
  it('shows the new invite when only the hash changes in the same tab', async () => {
    window.history.pushState({}, '', `/r${inviteFrom('첫째사람', 'aaaaaaaa1111')}`)
    render(<Root />)
    expect(screen.getByTestId('disclosure-sender').textContent).toContain('첫째사람')

    act(() => {
      window.location.hash = inviteFrom('둘째사람', 'bbbbbbbb2222')
    })
    await waitFor(() => expect(screen.getByTestId('disclosure-sender').textContent).toContain('둘째사람'))
    expect(screen.getByTestId('disclosure-sender').textContent).not.toContain('첫째사람')
  })

  it('drops consent and answers given for the first invite when the hash switches to another invite', async () => {
    window.history.pushState({}, '', `/r${inviteFrom('첫째사람', 'aaaaaaaa1111')}`)
    render(<Root />)
    ;(screen.getByTestId('consent') as HTMLInputElement).click()
    expect((screen.getByTestId('consent') as HTMLInputElement).checked).toBe(true)

    act(() => {
      window.location.hash = inviteFrom('둘째사람', 'bbbbbbbb2222')
    })
    await waitFor(() => expect(screen.getByTestId('disclosure-sender').textContent).toContain('둘째사람'))
    expect((screen.getByTestId('consent') as HTMLInputElement).checked).toBe(false)
  })
})

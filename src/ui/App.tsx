import { useMemo } from 'react'
import bankJson from '../data/bank.v1.json'
import { validateBank } from '../core/bank'
import { getStore } from '../core/storage'
import { OwnerApp } from './owner/OwnerApp'

const BANK = validateBank(bankJson)

export interface AppProps {
  pathname: string
  hash: string
}

function OwnerRoute() {
  const store = useMemo(() => getStore(), [])
  return <OwnerApp bank={BANK} store={store} now={Date.now} />
}

export function App({ pathname }: AppProps) {
  switch (pathname) {
    case '/':
      return <OwnerRoute />
    case '/r':
      return <div data-testid="screen-rater" />
    case '/b':
      return <div data-testid="screen-reply" />
    default:
      return <div data-testid="screen-notfound">페이지를 찾을 수 없어요</div>
  }
}

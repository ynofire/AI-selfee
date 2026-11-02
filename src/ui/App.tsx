import { useMemo } from 'react'
import bankJson from '../data/bank.v1.json'
import { validateBank } from '../core/bank'
import { getStore } from '../core/storage'
import { OwnerApp } from './owner/OwnerApp'
import { ReplyScreen } from './owner/ReplyScreen'
import { RaterApp } from './rater/RaterApp'

const BANK = validateBank(bankJson)

export interface AppProps {
  pathname: string
  hash: string
}

export function App({ pathname, hash }: AppProps) {
  const store = useMemo(() => getStore(), [])
  switch (pathname) {
    case '/':
      return <OwnerApp bank={BANK} store={store} now={Date.now} />
    case '/r':
      return <RaterApp hash={hash} bank={BANK} store={store} now={Date.now} />
    case '/b':
      return <ReplyScreen hash={hash} bank={BANK} store={store} now={Date.now} />
    default:
      return <div data-testid="screen-notfound">페이지를 찾을 수 없어요</div>
  }
}

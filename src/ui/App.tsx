import { useEffect, useMemo } from 'react'
import bankJson from '../data/bank.v1.json'
import { validateBank } from '../core/bank'
import { getStore, sweepExpired } from '../core/storage'
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
  // 화면이 자기 상태를 먼저 읽은 뒤(렌더 중) 효과에서 정리하므로, 만료 안내는 그대로 뜬다.
  useEffect(() => {
    sweepExpired(store, Date.now())
  }, [store])
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

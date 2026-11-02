import { useEffect, useState } from 'react'
import { App } from './App'

const read = () => ({ pathname: window.location.pathname, hash: window.location.hash })

/**
 * 브라우저 주소를 읽어 App에 넘긴다. 같은 탭에서 `/r#A` → `/r#B`처럼 해시만 바뀌면 페이지가 새로 로드되지 않으므로
 * hashchange를 듣고, key로 화면 상태(동의·답변 입력)를 통째로 새로 시작한다.
 */
export function Root() {
  const [loc, setLoc] = useState(read)
  useEffect(() => {
    const onChange = () => setLoc(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return <App key={`${loc.pathname}${loc.hash}`} pathname={loc.pathname} hash={loc.hash} />
}

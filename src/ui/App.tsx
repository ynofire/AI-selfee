export interface AppProps {
  pathname: string
  hash: string
}

export function App({ pathname }: AppProps) {
  switch (pathname) {
    case '/':
      return <div data-testid="screen-owner" />
    case '/r':
      return <div data-testid="screen-rater" />
    case '/b':
      return <div data-testid="screen-reply" />
    default:
      return <div data-testid="screen-notfound">페이지를 찾을 수 없어요</div>
  }
}

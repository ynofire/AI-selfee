import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './ui/styles.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App pathname={window.location.pathname} hash={window.location.hash} />)
}

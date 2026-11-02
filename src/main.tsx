import { createRoot } from 'react-dom/client'
import { Root } from './ui/Root'
import './ui/styles.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<Root />)
}

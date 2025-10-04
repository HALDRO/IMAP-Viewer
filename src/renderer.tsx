import './index.css'
import { createRoot } from 'react-dom/client'

import App from './app'

const container = document.getElementById('root')

if (container) {
  const root = createRoot(container)
  root.render(<App />)
} else {
  throw new Error('Could not find root element to mount to')
}

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Inbox from './pages/Inbox'
import logoUrl from './assets/logo.svg'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold tracking-tight text-blue-600 flex items-center gap-2">
              <img src={logoUrl} alt="WebhookSink Logo" className="w-8 h-8" />
              <a href="/">WebhookSink</a>
            </h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/webhook-inbox/:uuid" element={<Inbox />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App

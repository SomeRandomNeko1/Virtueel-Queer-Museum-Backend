import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.jsx"
import Login from "./Login.jsx"
import "./App.css"

const LOG_STORAGE_KEY = "activityLog"

function Root() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [token, setToken] = useState("")
  const [logs, setLogs] = useState(() => {
    try {
      const stored = sessionStorage.getItem(LOG_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    sessionStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs))
  }, [logs])

  function addLog(message, status = "success") {
    const entry = {
      id: crypto.randomUUID(),
      message,
      status,
      at: new Date().toISOString(),
    }
    setLogs(prev => [entry, ...prev].slice(0, 100))
  }

  function handleLogin(jwt) {
    setToken(jwt)
    setLoggedIn(true)
    addLog("Ingelogd", "success")
  }

  function handleLogout() {
    setToken("")
    setLoggedIn(false)
    addLog("Uitgelogd", "info")
  }

  return loggedIn
    ? <App token={token} onLogout={handleLogout} logs={logs} addLog={addLog} />
    : <Login onLogin={handleLogin} addLog={addLog} />
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
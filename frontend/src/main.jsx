import { useState } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import Login from "./Login"
import "./App.css"

const LOG_STORAGE_KEY = "activityLog"

// crypto.randomUUID() requires a secure context (HTTPS / localhost).
// When running on a plain HTTP local-IP address we fall back to a
// simple time+random string that is unique enough for UI log entries.
function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // fallback: 8-char hex timestamp + 8-char random hex
  return (
    Date.now().toString(16).padStart(12, "0") +
    Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0")
  )
}

function Root() {
  const [token, setToken] = useState(() => localStorage.getItem("cms_token"))
  const [logs, setLogs] = useState(() => {
    try {
      const stored = sessionStorage.getItem(LOG_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  function addLog(message, status = "info") {
    const entry = {
      id: generateId(),
      message,
      status,
      at: new Date().toISOString(),
    }
    setLogs(prev => {
      const updated = [entry, ...prev].slice(0, 100)
      sessionStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  function handleLogin(newToken) {
    setToken(newToken)
    addLog("Ingelogd", "success")
  }

  function handleLogout() {
    localStorage.removeItem("cms_token")
    setToken(null)
    addLog("Uitgelogd", "info")
  }

  if (!token) {
    return <Login onLogin={handleLogin} addLog={addLog} />
  }

  return (
    <App
      token={token}
      onLogout={handleLogout}
      logs={logs}
      addLog={addLog}
    />
  )
}

createRoot(document.getElementById("root")).render(<Root />)
import { useState, useCallback } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import Login from "./Login"
import "./App.css"

const API = "http://10.120.5.132:8000"

function Root() {
  const [token, setToken] = useState(() => localStorage.getItem("cms_token"))

  const addLog = useCallback((message, status = "info") => {
    const currentToken = localStorage.getItem("cms_token")
    if (!currentToken) return

    fetch(`${API}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ message, status }),
    }).catch(() => {
      // Stille fout — log schrijven mag nooit de UI breken
    })
  }, [])

  function handleLogin(newToken) {
    setToken(newToken)
    // Login log wordt al door PHP geschreven via de auth route
  }

  function handleLogout() {
    addLog("Uitgelogd", "info")
    // Kleine vertraging zodat het log-request nog verstuurd wordt
    setTimeout(() => {
      localStorage.removeItem("cms_token")
      setToken(null)
    }, 100)
  }

  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <App
      token={token}
      onLogout={handleLogout}
      addLog={addLog}
    />
  )
}

createRoot(document.getElementById("root")).render(<Root />)
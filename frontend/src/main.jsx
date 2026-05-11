import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.jsx"
import Login from "./Login.jsx"
import "./App.css"

function Root() {
  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem("auth") === "1"
  )

  function handleLogin() {
    sessionStorage.setItem("auth", "1")
    setLoggedIn(true)
  }

  function handleLogout() {
    sessionStorage.removeItem("auth")
    setLoggedIn(false)
  }

  return loggedIn
    ? <App onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
import { useState } from "react"
import { FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi"

const API = "/api"

export default function Login({ onLogin, addLog }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!username || !password) {
      setError("Vul je gebruikersnaam en wachtwoord in.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(API + "/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Inloggen mislukt.")
      }

      if (!data.token) {
        throw new Error("Backend gaf geen token terug.")
      }

      onLogin(data.token)
    } catch (err) {
      addLog?.(`Inloggen mislukt: ${err.message}`, "error")
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      <div
        className="hidden md:flex w-[42%] flex-col justify-between px-12 py-12"
        style={{
          backgroundColor: "var(--color-ink)",
          backgroundImage:
            "radial-gradient(ellipse at 0% 0%, rgba(255,255,255,.07) 0%, transparent 60%)," +
            "radial-gradient(ellipse at 100% 100%, rgba(255,255,255,.04) 0%, transparent 50%)",
        }}
      >
        <span className="font-display text-[22px] font-semibold text-white tracking-[.01em]">
          Kunstwerk
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center bg-warm-bg px-6">
        <div className="w-full max-w-90">

          <p className="md:hidden font-display text-[20px] font-semibold text-ink mb-8 tracking-[.01em]">
            Kunstwerk
          </p>

          <h1 className="font-display text-[26px] font-semibold text-ink mb-1 tracking-[.005em]">
            Welkom terug
          </h1>
          <p className="font-body text-[13px] font-light text-muted mb-8">
            Log in met je account om door te gaan.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            <div className="flex flex-col gap-1.5">
              <label className="font-body text-[11.5px] font-medium text-accent tracking-wider uppercase">
                Gebruikersnaam
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Jouw gebruikersnaam"
                autoComplete="username"
                className="bg-paper border border-border rounded-md px-3.5 py-2.5
                           font-body text-[13px] text-ink placeholder:text-muted placeholder:font-light
                           outline-none transition-all duration-150
                           focus:border-ink focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-body text-[11.5px] font-medium text-accent tracking-wider uppercase">
                  Wachtwoord
                </label>
                <button
                  type="button"
                  className="font-body text-[11.5px] text-muted hover:text-ink transition-colors duration-120 bg-transparent border-none cursor-pointer p-0"
                >
                  Wachtwoord vergeten?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-paper border border-border rounded-md px-3.5 py-2.5 pr-10
                             font-body text-[13px] text-ink placeholder:text-muted placeholder:font-light
                             outline-none transition-all duration-150
                             focus:border-ink focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             bg-transparent border-none cursor-pointer text-muted hover:text-ink
                             transition-colors duration-120 flex items-center p-0"
                >
                  {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
                <FiAlertCircle size={13} className="text-red-500 shrink-0" />
                <p className="font-body text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-ink text-white rounded-md py-2.75 font-body text-[13px] font-medium
                         tracking-[.02em] border-none cursor-pointer
                         transition-all duration-150
                         hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {loading
                ? <><Spinner /> Inloggen</>
                : "Inloggen"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
    />
  )
}
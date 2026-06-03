import { useState, useEffect, useCallback } from "react"
import { FiRefreshCw, FiTrash2 } from "react-icons/fi"

const API = "http://10.120.5.132:8000"

function formatLogTime(dateString) {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dateString))
  } catch {
    return dateString
  }
}

function timeAgo(dateString) {
  try {
    const now = new Date()
    const then = new Date(dateString)
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return "zojuist"
    if (diffMin < 60) return `${diffMin} min geleden`
    if (diffHr < 24) return `${diffHr} uur geleden`
    if (diffDay < 30) return `${diffDay} dagen geleden`
    return formatLogTime(dateString)
  } catch {
    return dateString
  }
}

export default function LogView({ token }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [clearing, setClearing] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/logs?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error("Kon logs niet ophalen")
      const data = await res.json()
      setLogs(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadLogs()

    // Auto-refresh elke 30 seconden
    const interval = setInterval(loadLogs, 30000)
    return () => clearInterval(interval)
  }, [loadLogs])

  const handleClearAll = async () => {
    if (!confirm("Weet je zeker dat je alle logs wilt verwijderen?")) return
    setClearing(true)
    try {
      await fetch(`${API}/logs`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setLogs([])
    } catch {
      // ignore
    } finally {
      setClearing(false)
    }
  }

  const statusDot = (status) => {
    switch (status) {
      case "success": return "bg-green-500"
      case "error":   return "bg-red-500"
      default:        return "bg-slate-400"
    }
  }

  const statusBg = (status) => {
    switch (status) {
      case "error": return "bg-red-50/50"
      default:      return ""
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center mt-20 gap-2 text-muted">
        <div className="w-4 h-4 border-2 border-border border-t-muted rounded-full animate-spin" />
        <span className="font-body text-[13px]">Logs laden…</span>
      </div>
    )
  }

  if (error && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 gap-3">
        <p className="font-body text-[13px] text-red-500">{error}</p>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-paper font-body text-[12px] text-muted hover:text-ink cursor-pointer"
        >
          <FiRefreshCw size={12} /> Opnieuw proberen
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-170">
      <div className="bg-paper border border-border rounded-[10px] overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between">
          <div>
            <p className="font-display text-[16px] font-semibold text-ink">Activiteitenlogboek</p>
            <p className="font-body text-[12px] text-muted mt-1">
              {logs.length} {logs.length === 1 ? "vermelding" : "vermeldingen"} · wordt automatisch opgeschoond na 30 dagen
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadLogs}
              disabled={loading}
              title="Vernieuwen"
              className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-paper hover:bg-warm-bg text-muted hover:text-ink cursor-pointer disabled:opacity-40"
            >
              <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                title="Alle logs wissen"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-paper hover:bg-red-50 text-muted hover:text-red-500 cursor-pointer disabled:opacity-40"
              >
                <FiTrash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Logs list */}
        {logs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-body text-[13px] text-muted italic">Nog geen activiteit</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[calc(100vh-250px)] overflow-y-auto">
            {logs.map(entry => (
              <div
                key={entry.LogId}
                className={`px-5 py-3.5 flex items-start gap-3 ${statusBg(entry.Status)}`}
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusDot(entry.Status)}`} />

                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] text-ink leading-snug">{entry.Message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-body text-[11px] text-muted">
                      {timeAgo(entry.CreatedAt)}
                    </span>
                    {entry.Username && (
                      <>
                        <span className="text-border">·</span>
                        <span className="font-body text-[11px] text-muted font-medium">
                          {entry.Username}
                        </span>
                      </>
                    )}
                    <span className="text-border">·</span>
                    <span className="font-body text-[10px] text-muted/60">
                      {formatLogTime(entry.CreatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
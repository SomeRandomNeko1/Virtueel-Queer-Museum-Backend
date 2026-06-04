import { useState, useEffect, useRef, useCallback } from "react"
import { FiBell, FiCheckCircle, FiAlertCircle, FiInfo } from "react-icons/fi"

const API = "http://10.120.5.132:8000"

function timeAgo(dateString) {
  try {
    const diffMs = new Date() - new Date(dateString)
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr  = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)
    if (diffMin < 1)  return "zojuist"
    if (diffMin < 60) return `${diffMin} min geleden`
    if (diffHr  < 24) return `${diffHr} uur geleden`
    if (diffDay < 30) return `${diffDay} dagen geleden`
    return new Intl.DateTimeFormat("nl-NL", { dateStyle: "short" }).format(new Date(dateString))
  } catch { return dateString }
}

const STATUS = {
  success: { icon: FiCheckCircle, dot: "bg-emerald-500" },
  error:   { icon: FiAlertCircle, dot: "bg-red-500"     },
  default: { icon: FiInfo,        dot: "bg-slate-300"   },
}

export default function NotifBell({ token }) {
  const [open, setOpen]               = useState(false)
  const [logs, setLogs]               = useState([])
  const [loading, setLoading]         = useState(false)
  const [readIds, setReadIds]         = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("readLogIds") || "[]")) }
    catch { return new Set() }
  })
  const ref = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/logs?limit=20`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setLogs(await res.json())
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const markAllRead = () => {
    const next = new Set(logs.map(l => l.LogId))
    setReadIds(next)
    try { localStorage.setItem("readLogIds", JSON.stringify([...next])) } catch {}
  }

  const markRead = id => {
    setReadIds(prev => {
      const next = new Set(prev).add(id)
      try { localStorage.setItem("readLogIds", JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const unread = logs.filter(l => !readIds.has(l.LogId)).length

  return (
    <div className="relative" ref={ref}>

      <button
        aria-label="Meldingen"
        onClick={() => { setOpen(p => !p); if (!open) load() }}
        className="relative p-2 rounded-md bg-transparent border-none cursor-pointer text-muted flex items-center hover:bg-warm-bg hover:text-ink transition-all duration-100"
      >
        <FiBell size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-ink rounded-full border-2 border-paper pointer-events-none" />
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-72 bg-paper border border-border rounded-lg shadow-[0_10px_30px_rgba(0,0,0,.10)] z-50 overflow-hidden">

          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-display text-[15px] font-semibold text-ink">Meldingen</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 bg-transparent border-none cursor-pointer font-body text-[11px] text-muted hover:text-ink transition-colors p-0"
              >
                <FiCheckCircle size={13} /> Alles gelezen
              </button>
            )}
          </div>

          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted">
              <div className="w-3.5 h-3.5 border-2 border-border border-t-muted rounded-full animate-spin" />
              <span className="font-body text-[12px]">Laden…</span>
            </div>
          ) : logs.length === 0 ? (
            <p className="font-body text-[12px] text-muted text-center py-10">Geen meldingen.</p>
          ) : (
            <ul className="list-none max-h-72 overflow-y-auto">
              {logs.map(l => {
                const isRead = readIds.has(l.LogId)
                const s = STATUS[l.Status] ?? STATUS.default
                const Icon = s.icon
                return (
                  <li
                    key={l.LogId}
                    onClick={() => markRead(l.LogId)}
                    className={`
                      flex items-start gap-3 px-4 py-3 cursor-pointer
                      border-b border-border last:border-b-0
                      transition-colors duration-100
                      ${!isRead ? "bg-warm-bg hover:bg-border/30" : "hover:bg-warm-bg"}
                    `}
                  >
                    {/* dot column — always reserve width for alignment */}
                    <div className="shrink-0 w-2 flex justify-center pt-1.5">
                      {!isRead && <span className={`w-1.5 h-1.5 rounded-full block ${s.dot}`} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[13px] font-medium text-ink leading-snug mb-0.5">{l.Message}</p>
                      <div className="flex items-center gap-1.5">
                        <Icon size={10} className={l.Status === "error" ? "text-red-500" : l.Status === "success" ? "text-emerald-500" : "text-muted"} />
                        <span className="font-body text-[11px] text-muted">{timeAgo(l.CreatedAt)}</span>
                        {l.Username && (
                          <>
                            <span className="text-border text-[10px]">·</span>
                            <span className="font-body text-[11px] text-muted font-medium">{l.Username}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </div>
      )}
    </div>
  )
}
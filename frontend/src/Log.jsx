import { useState, useEffect, useCallback, useRef } from "react"
import { FiRefreshCw, FiTrash2, FiSearch, FiX, FiAlertCircle, FiCheckCircle, FiMinus } from "react-icons/fi"

const API = "http://10.120.5.132:8000"
const PAGE_SIZE = 30

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

function DeleteModal({ count, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="relative bg-paper border border-border rounded-xl shadow-xl p-6 w-85 mx-4">
        <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <FiTrash2 size={16} className="text-red-500" />
        </div>
        <p className="font-display text-[15px] font-semibold text-ink mb-1">Alle logs wissen?</p>
        <p className="font-body text-[13px] text-muted mb-5">
          Dit verwijdert {count} {count === 1 ? "vermelding" : "vermeldingen"} definitief. Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-border font-body text-[13px] text-muted hover:text-ink hover:bg-warm-bg cursor-pointer transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 font-body text-[13px] text-white cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ filtered }) {
  return (
    <div className="px-5 py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-warm-bg border border-border flex items-center justify-center mx-auto mb-4">
        {filtered
          ? <FiSearch size={16} className="text-muted" />
          : <FiMinus size={16} className="text-muted" />
        }
      </div>
      <p className="font-body text-[13px] text-muted">
        {filtered ? "Geen logs gevonden voor deze zoekopdracht." : "Nog geen activiteit geregistreerd."}
      </p>
      {filtered && (
        <p className="font-body text-[12px] text-muted/60 mt-1">Probeer een andere zoekterm of filter.</p>
      )}
    </div>
  )
}

const STATUS_CONFIG = {
  success: {
    dot: "bg-emerald-500",
    bg: "",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: FiCheckCircle,
    label: "Succes",
  },
  error: {
    dot: "bg-red-500",
    bg: "bg-red-50/40",
    badge: "bg-red-50 text-red-600 border-red-100",
    icon: FiAlertCircle,
    label: "Fout",
  },
  default: {
    dot: "bg-slate-300",
    bg: "",
    badge: "bg-slate-50 text-slate-500 border-slate-100",
    icon: FiMinus,
    label: "Info",
  },
}

function getStatus(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.default
}

export default function LogView({ token }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Filters
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("all") // "all" | "success" | "error"
  const [page, setPage] = useState(1)

  const searchRef = useRef(null)

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
    const interval = setInterval(loadLogs, 30000)
    return () => clearInterval(interval)
  }, [loadLogs])

  // Reset pagination when filters change
  useEffect(() => { setPage(1) }, [search, activeFilter])

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await fetch(`${API}/logs`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setLogs([])
      setShowDeleteModal(false)
    } catch {
      // ignore
    } finally {
      setClearing(false)
    }
  }

  // Derived data
  const counts = {
    all: logs.length,
    success: logs.filter(l => l.Status === "success").length,
    error: logs.filter(l => l.Status === "error").length,
  }

  const filtered = logs.filter(entry => {
    const matchesFilter =
      activeFilter === "all" ||
      entry.Status === activeFilter
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      entry.Message?.toLowerCase().includes(q) ||
      entry.Username?.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isFiltered = search.trim() !== "" || activeFilter !== "all"

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
    <>
      {showDeleteModal && (
        <DeleteModal
          count={logs.length}
          onConfirm={handleClearAll}
          onCancel={() => setShowDeleteModal(false)}
          loading={clearing}
        />
      )}

      <div className="max-w-170">
        <div className="bg-paper border border-border rounded-[10px] overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-start justify-between">
            <div>
              <p className="font-display text-[16px] font-semibold text-ink">Activiteitenlogboek</p>
              <p className="font-body text-[12px] text-muted mt-1">
                {logs.length} {logs.length === 1 ? "vermelding" : "vermeldingen"} · automatisch opgeschoond na 30 dagen
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadLogs}
                disabled={loading}
                title="Vernieuwen"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-paper hover:bg-warm-bg text-muted hover:text-ink cursor-pointer disabled:opacity-40 transition-colors"
              >
                <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>

              {logs.length > 0 && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  title="Alle logs wissen"
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-paper hover:bg-red-50 text-muted hover:text-red-500 cursor-pointer transition-colors"
                >
                  <FiTrash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Toolbar: search + filters */}
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative flex-1 min-w-40">
              <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Zoeken in logs…"
                className="w-full h-8 pl-8 pr-7 rounded-[7px] border border-border bg-warm-bg font-body text-[12px] text-ink placeholder:text-muted focus:outline-none focus:border-muted/50 focus:bg-paper transition-colors"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); searchRef.current?.focus() }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                >
                  <FiX size={12} />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { key: "all", label: "Alles" },
                { key: "success", label: "Succes" },
                { key: "error", label: "Fout" },
              ].map(({ key, label }) => {
                const active = activeFilter === key
                const count = counts[key]
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`
                      h-7 px-2.5 rounded-md flex items-center gap-1.5 font-body text-[12px] border cursor-pointer transition-colors
                      ${active
                        ? "bg-ink text-paper border-ink"
                        : "bg-paper text-muted border-border hover:border-muted/40 hover:text-ink"
                      }
                    `}
                  >
                    {key !== "all" && (
                      <span className={`w-1.5 h-1.5 rounded-full ${key === "success" ? "bg-emerald-400" : "bg-red-400"} ${active ? "opacity-100" : "opacity-70"}`} />
                    )}
                    {label}
                    <span className={`text-[10px] tabular-nums ${active ? "opacity-60" : "opacity-50"}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Logs list */}
          {paginated.length === 0 ? (
            <EmptyState filtered={isFiltered} />
          ) : (
            <div className="divide-y divide-border">
              {paginated.map(entry => {
                const s = getStatus(entry.Status)
                const Icon = s.icon
                return (
                  <div
                    key={entry.LogId}
                    className={`px-5 py-3.5 flex items-start gap-3 ${s.bg}`}
                  >
                    {/* Status dot */}
                    <div className={`mt-1.25 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[13px] text-ink leading-snug">{entry.Message}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border font-body text-[10px] font-medium ${s.badge}`}>
                          <Icon size={9} />
                          {s.label}
                        </span>

                        <span className="font-body text-[11px] text-muted">
                          {timeAgo(entry.CreatedAt)}
                        </span>

                        {entry.Username && (
                          <>
                            <span className="text-border text-[10px]">·</span>
                            <span className="font-body text-[11px] text-muted font-medium">
                              {entry.Username}
                            </span>
                          </>
                        )}

                        <span className="text-border text-[10px]">·</span>
                        <span className="font-body text-[10px] text-muted/60">
                          {formatLogTime(entry.CreatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="font-body text-[11px] text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} van {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2.5 rounded-md border border-border font-body text-[12px] text-muted hover:text-ink hover:bg-warm-bg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ←
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce((acc, n, i, arr) => {
                    if (i > 0 && n - arr[i - 1] > 1) acc.push("…")
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) =>
                    n === "…"
                      ? <span key={`ellipsis-${i}`} className="w-7 text-center font-body text-[12px] text-muted/40">…</span>
                      : <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`
                            h-7 w-7 rounded-md font-body text-[12px] cursor-pointer transition-colors
                            ${page === n
                              ? "bg-ink text-paper border border-ink"
                              : "border border-border text-muted hover:text-ink hover:bg-warm-bg"
                            }
                          `}
                        >
                          {n}
                        </button>
                  )
                }
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2.5 rounded-md border border-border font-body text-[12px] text-muted hover:text-ink hover:bg-warm-bg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
import { useState, useEffect, useCallback } from "react"
import { FiTrash2, FiClock } from "react-icons/fi"
import { apiFetch } from "./api"

/**
 * Gastenboek — read-only overzicht van ontvangen feedback
 *
 * Verwachte API endpoints:
 *   GET    /gastenboek       → [{ Id, Naam, Bericht, Datum }]
 *   DELETE /gastenboek/:id   → 204
 *
 * Props:
 *   token   – JWT-token (string)
 *   addLog  – (message, level) => void
 */
export default function Gastenboek({ token, addLog }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res  = await apiFetch("/gastenboek")
      if (!res.ok) throw new Error(`Server antwoordde met ${res.status}`)
      const data = await res.json()
      setEntries(data)
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id, naam) => {
    try {
      const res = await apiFetch(`/gastenboek/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Verwijderen mislukt.")
      setEntries(prev => prev.filter(e => e.Id !== id))
      addLog?.(`Gastenboekinvoer verwijderd (${naam})`, "warning")
    } catch (e) {
      addLog?.(`Fout: ${e.message}`, "error")
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">

      {/* Teller */}
      {!loading && !err && (
        <p className="font-body text-[12px] text-muted mb-4">
          {entries.length === 0
            ? "Nog geen berichten ontvangen."
            : `${entries.length} bericht${entries.length !== 1 ? "en" : ""} ontvangen`}
        </p>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3.5 mt-15">
          <div className="w-6.5 h-6.5 border-2 border-border border-t-ink rounded-full animate-spin" />
          <p className="font-body text-[13px] text-muted">Laden…</p>
        </div>
      )}

      {err && (
        <p className="text-ink text-[13px] text-center mt-10 font-body">Fout: {err}</p>
      )}

      {!loading && !err && entries.length === 0 && (
        <p className="text-muted text-[13px] italic text-center mt-10 font-body">
          Geen berichten gevonden.
        </p>
      )}

      {!loading && !err && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map(entry => (
            <EntryCard
              key={entry.Id}
              entry={entry}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EntryCard({ entry, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const doDelete = async () => {
    setDeleting(true)
    await onDelete(entry.Id, entry.Naam)
    setDeleting(false)
  }

  const datum = entry.Datum
    ? new Date(entry.Datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <div className="bg-paper border border-border rounded-lg p-4.5 transition-all duration-150">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7.5 h-7.5 bg-ink text-white rounded-full text-[11px] font-medium flex items-center justify-center font-display shrink-0">
            {(entry.Naam || "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-display text-[14px] font-semibold text-ink leading-tight truncate">
              {entry.Naam || "Anoniem"}
            </p>
            {datum && (
              <p className="font-body text-[10px] text-muted flex items-center gap-1 mt-px">
                <FiClock size={9} />{datum}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <button onClick={doDelete} disabled={deleting}
                className="px-2.5 py-1 rounded-md bg-red-500 text-white font-body text-[11px] border-none cursor-pointer hover:bg-red-600 disabled:opacity-50">
                {deleting ? "…" : "Verwijder"}
              </button>
              <button onClick={() => setConfirming(false)}
                className="px-2.5 py-1 rounded-md border border-border bg-paper font-body text-[11px] text-muted hover:text-ink cursor-pointer">
                Nee
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-paper hover:bg-red-50 hover:border-red-200 text-muted hover:text-red-500 cursor-pointer">
              <FiTrash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <p className="font-body text-[13px] text-ink leading-[1.6] whitespace-pre-wrap">
        {entry.Bericht}
      </p>
    </div>
  )
}
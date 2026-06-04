import { useState, useEffect, useCallback } from "react"
import { FiTrash2, FiClock, FiRefreshCw } from "react-icons/fi"
import { apiFetch } from "./api"

// Zet ruwe API-data om naar vaste sleutelnamen
function normalise(raw) {
  return {
    Id:      raw.GastenboekId ?? raw.Id ?? raw.id ?? raw.ID ?? null,
    Naam:    raw.Naam    ?? raw.naam    ?? raw.Name    ?? raw.name    ?? "",
    Bericht: raw.Bericht ?? raw.bericht ?? raw.Message ?? raw.message ?? "",
    Datum:   raw.CreatedAt ?? raw.Datum ?? raw.datum ?? raw.Date ?? raw.date ?? null,
    Sterren: raw.Sterren ?? raw.sterren ?? null,
  }
}

export default function Gastenboek({ token, addLog }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await apiFetch("/gastenboek")
      if (!res.ok) throw new Error(`Server antwoordde met ${res.status}`)
      const data = await res.json()

      if (!Array.isArray(data)) throw new Error("Onverwacht antwoordformaat van server.")

      const normalised = data.map((raw, i) => {
        const entry = normalise(raw)
        // Waarschuw als Id nog steeds ontbreekt na normalisatie
        if (entry.Id === null && import.meta.env.DEV) {
          console.warn(
            `[Gastenboek] Geen id gevonden op index ${i}. ` +
            `Sleutels: ${Object.keys(raw).join(", ")}. ` +
            `Pas normalise() aan in Gastenboek.jsx.`,
            raw
          )
        }
        return entry
      })

      setEntries(normalised)
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (id, naam) => {
    try {
      const res = await apiFetch(`/gastenboek/${id}`, { method: "DELETE" })
      if (res.status === 401) throw new Error("Sessie verlopen.")
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || "Verwijderen mislukt.")
      }
      setEntries(prev => prev.filter(e => e.Id !== id))
      addLog?.(`Gastenboekinvoer verwijderd (${naam || "anoniem"})`, "warning")
    } catch (e) {
      addLog?.(`Fout: ${e.message}`, "error")
    }
  }, [addLog])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">

      {/* Teller + vernieuwknop */}
      {!loading && !err && (
        <div className="flex items-center justify-between mb-4">
          <p className="font-body text-[12px] text-muted">
            {entries.length === 0
              ? "Nog geen berichten ontvangen."
              : `${entries.length} bericht${entries.length !== 1 ? "en" : ""} ontvangen`}
          </p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-paper font-body text-[11px] text-muted hover:text-ink hover:bg-warm-bg cursor-pointer transition-colors duration-120"
          >
            <FiRefreshCw size={11} />
            Vernieuwen
          </button>
        </div>
      )}

      {/* Laden */}
      {loading && (
        <div className="flex flex-col items-center gap-3.5 mt-15">
          <div className="w-6.5 h-6.5 border-2 border-border border-t-ink rounded-full animate-spin" />
          <p className="font-body text-[13px] text-muted">Laden…</p>
        </div>
      )}

      {/* Fout */}
      {err && (
        <div className="flex flex-col items-center gap-3 mt-10">
          <p className="text-ink text-[13px] text-center font-body">Fout: {err}</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-paper font-body text-[12px] text-muted hover:text-ink cursor-pointer"
          >
            <FiRefreshCw size={12} />
            Opnieuw proberen
          </button>
        </div>
      )}

      {/* Leeg */}
      {!loading && !err && entries.length === 0 && (
        <p className="text-muted text-[13px] italic text-center mt-10 font-body">
          Geen berichten gevonden.
        </p>
      )}

      {/* Lijst */}
      {!loading && !err && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry, index) => (
            <EntryCard
              // Id als key, anders index als noodoplossing
              key={entry.Id !== null ? String(entry.Id) : `fallback-${index}`}
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
    setConfirming(false)
  }

  // Datum opmaken naar Nederlands formaat
  const datum = entry.Datum
    ? new Date(entry.Datum).toLocaleDateString("nl-NL", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null

  const initial = (entry.Naam || "?")[0].toUpperCase()

  return (
    <div className="bg-paper border border-border rounded-lg p-4.5 transition-all duration-150">
      <div className="flex items-start justify-between gap-3 mb-2.5">

        {/* Avatar + naam + datum */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7.5 h-7.5 bg-ink text-white rounded-full text-[11px] font-medium flex items-center justify-center font-display shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-display text-[14px] font-semibold text-ink leading-tight truncate">
              {entry.Naam || "Anoniem"}
            </p>
            {datum && (
              <p className="font-body text-[10px] text-muted flex items-center gap-1 mt-px">
                <FiClock size={9} />
                {datum}
              </p>
            )}
            {/* Sterren tonen indien aanwezig */}
            {entry.Sterren && (
              <p className="font-body text-[10px] text-yellow-500 mt-px tracking-wide">
                {"★".repeat(entry.Sterren)}{"☆".repeat(5 - entry.Sterren)}
              </p>
            )}
          </div>
        </div>

        {/* Verwijderknop */}
        <div className="flex items-center gap-1.5 shrink-0">
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <span className="font-body text-[11px] text-red-500">Zeker weten?</span>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="px-2.5 py-1 rounded-md bg-red-500 text-white font-body text-[11px] border-none cursor-pointer hover:bg-red-600 disabled:opacity-50 transition-colors duration-120"
              >
                {deleting ? "…" : "Verwijder"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="px-2.5 py-1 rounded-md border border-border bg-paper font-body text-[11px] text-muted hover:text-ink cursor-pointer disabled:opacity-50"
              >
                Nee
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-paper hover:bg-red-50 hover:border-red-200 text-muted hover:text-red-500 cursor-pointer transition-colors duration-120"
              title="Verwijder bericht"
            >
              <FiTrash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Berichttekst */}
      <p className="font-body text-[13px] text-ink leading-[1.6] whitespace-pre-wrap">
        {entry.Bericht || <span className="italic text-muted">Geen bericht</span>}
      </p>
    </div>
  )
}
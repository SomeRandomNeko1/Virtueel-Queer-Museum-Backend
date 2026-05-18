import { useState, useRef } from "react"
import { FiImage, FiX, FiCheck } from "react-icons/fi"

const API = "/api"

const FRAME_STYLES = [
  { id: "black",  label: "Zwart modern",  bg: "#111111" },
  { id: "gold",   label: "Goud klassiek", bg: "#C9A84C" },
  { id: "white",  label: "Wit minimaal",  bg: "#E8E6DE" },
  { id: "walnut", label: "Walnoot hout",  bg: "#5C3A1E" },
]

const WALLS = [
  { id: "back",  label: "Achterwand"  },
  { id: "left",  label: "Linkerwand"  },
  { id: "right", label: "Rechterwand" },
]

const FRAMES = [
  { id: 1, wallId: "back",  label: "Achterwand - links"   },
  { id: 2, wallId: "back",  label: "Achterwand - rechts"  },
  { id: 3, wallId: "left",  label: "Linkerwand - voor"    },
  { id: 4, wallId: "left",  label: "Linkerwand - achter"  },
  { id: 5, wallId: "right", label: "Rechterwand - voor"   },
  { id: 6, wallId: "right", label: "Rechterwand - achter" },
]

export default function UploadView({ token, addLog }) {
  const fileRef = useRef(null)

  const [naam,         setNaam]         = useState("")
  const [type,         setType]         = useState("Schilderij")
  const [beschrijving, setBeschrijving] = useState("")
  const [frameId,      setFrameId]      = useState(null)
  const [frameStyle,   setFrameStyle]   = useState("black")
  const [preview,      setPreview]      = useState(null)
  const [file,         setFile]         = useState(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [submitError,  setSubmitError]  = useState(null)
  const [submitting,   setSubmitting]   = useState(false)

  const selectedFrame = FRAMES.find(f => f.id === frameId)
  const canSubmit     = naam && type && file && frameId

  const readFile = (f) => {
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  const handleReset = () => {
    setNaam(""); setType("Schilderij"); setBeschrijving(""); setFrameId(null)
    setFrameStyle("black"); setPreview(null); setFile(null)
    setSubmitted(false); setSubmitError(null)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      const data = new FormData()
      data.append("naam", naam)
      data.append("Type", type)
      data.append("beschrijving", beschrijving)
      data.append("frameId", String(frameId))
      data.append("frameStyle", frameStyle)
      data.append("afbeelding", file)

      const res = await fetch(API + "/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      })

      const payload = await res.json().catch(() => ({}))
      if (res.status === 401) {
        throw new Error("Sessie verlopen. Log opnieuw in.")
      }
      if (!res.ok) {
        throw new Error(payload.error || "Opslaan mislukt.")
      }

      addLog?.(`Afbeelding toegevoegd: ${naam}`, "success")
      setSubmitted(true)
    } catch (error) {
      addLog?.(`Upload mislukt: ${error.message || "Opslaan mislukt."}`, "error")
      setSubmitError(error.message || "Opslaan mislukt.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-130">
        <div className="bg-paper border border-border rounded-[10px] p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center">
            <FiCheck size={22} color="#fff" />
          </div>
          <p className="font-display text-[16px] font-semibold text-ink">Opgeslagen!</p>
          <p className="font-body text-[13px] text-muted">
            "{naam}" is klaar om te worden verwerkt en opgehangen in {selectedFrame?.label}.
          </p>
          <button
            onClick={handleReset}
            className="mt-2 px-5 py-2 rounded-md bg-ink text-white font-body text-[13px] font-medium cursor-pointer border-none hover:bg-accent transition-colors duration-150"
          >
            Nieuw werk toevoegen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-130 flex flex-col gap-4">

      <div className="bg-paper border border-border rounded-[10px] p-5">
        <p className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase mb-3">
          Afbeelding
        </p>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e  => { e.preventDefault(); setDragOver(true)  }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e  => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]) }}
          className={`border-2 border-dashed rounded-lg cursor-pointer transition-all duration-150 overflow-hidden
            ${dragOver ? "border-ink bg-accent-light" : "border-border bg-warm-bg hover:border-accent"}`}
        >
          {preview ? (
            <div className="relative group">
              <img src={preview} alt="Preview" className="w-full max-h-52 object-contain block" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-150 flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-body text-[12px] text-white bg-black/50 px-3 py-1 rounded-full transition-all duration-150">
                  Andere afbeelding kiezen
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-9">
              <FiImage size={28} color="#ccc" />
              <p className="font-body text-[13px] text-muted">Klik of sleep een afbeelding</p>
              <p className="font-body text-[11px] text-muted">PNG · JPG · WEBP — max. 50 MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => readFile(e.target.files?.[0])}
        />
        {preview && (
          <button
            onClick={() => { setPreview(null); setFile(null) }}
            className="flex items-center gap-1 mt-2 font-body text-[11px] text-muted hover:text-ink cursor-pointer bg-transparent border-none p-0 transition-colors duration-120"
          >
            <FiX size={11} /> Verwijderen
          </button>
        )}

        {submitError && (
          <p className="mt-2 font-body text-[12px] text-red-600">{submitError}</p>
        )}
      </div>

      <div className="bg-paper border border-border rounded-[10px] p-5 flex flex-col gap-3">
        <p className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase">
          Informatie
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-[11px] font-medium text-accent tracking-wider uppercase">
            Type
          </label>
          <input
            value={type}
            onChange={e => setType(e.target.value)}
            list="art-types"
            placeholder="Bijv. Schilderij"
            className="border border-border rounded-md px-3.5 py-2.5 font-body text-[13px] text-ink placeholder:text-muted placeholder:font-light outline-none transition-all duration-150 focus:border-ink focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)]"
          />
          <datalist id="art-types">
            <option value="Schilderij" />
            <option value="Beeldhouwwerk" />
            <option value="Fotografie" />
            <option value="Illustratie" />
            <option value="Installatie" />
            <option value="Overig" />
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-[11px] font-medium text-accent tracking-wider uppercase">Naam</label>
          <input
            value={naam} onChange={e => setNaam(e.target.value)} placeholder="Titel van het werk"
            className="border border-border rounded-md px-3.5 py-2.5 font-body text-[13px] text-ink placeholder:text-muted placeholder:font-light outline-none transition-all duration-150 focus:border-ink focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-[11px] font-medium text-accent tracking-wider uppercase">
            Beschrijving <span className="normal-case tracking-normal font-light text-muted">(optioneel)</span>
          </label>
          <textarea
            value={beschrijving} onChange={e => setBeschrijving(e.target.value)}
            placeholder="Korte omschrijving van het werk…" rows={3}
            className="border border-border rounded-md px-3.5 py-2.5 font-body text-[13px] text-ink placeholder:text-muted placeholder:font-light outline-none resize-none transition-all duration-150 focus:border-ink focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)]"
          />
        </div>
      </div>

      <div className="bg-paper border border-border rounded-[10px] p-5 flex flex-col gap-4">
        <p className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase">
          Plaatsing
        </p>
        {WALLS.map(wall => (
          <div key={wall.id}>
            <p className="font-body text-[11px] text-muted mb-2">{wall.label}</p>
            <div className="flex gap-2">
              {FRAMES.filter(f => f.wallId === wall.id).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFrameId(prev => prev === f.id ? null : f.id)}
                  className={`flex-1 py-2.5 rounded-md border font-body text-[12px] font-medium cursor-pointer transition-all duration-150
                    ${frameId === f.id
                      ? "bg-ink text-white border-ink"
                      : "bg-warm-bg text-muted border-border hover:border-accent hover:text-ink"}`}
                >
                  Frame #{f.id}
                </button>
              ))}
            </div>
          </div>
        ))}
        {selectedFrame && (
          <p className="font-body text-[12px] text-muted -mt-1">
            Gekozen: <span className="text-ink font-medium">{selectedFrame.label}</span>
          </p>
        )}
      </div>

      <div className="bg-paper border border-border rounded-[10px] p-5">
        <p className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase mb-3">
          Kader stijl
        </p>
        <div className="flex flex-col gap-2">
          {FRAME_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setFrameStyle(s.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer text-left transition-all duration-150
                ${frameStyle === s.id ? "border-ink bg-warm-bg" : "border-border bg-paper hover:border-accent"}`}
            >
              <div className="relative w-11 h-8 rounded shrink-0 overflow-hidden" style={{ background: s.bg }}>
                <div className="absolute inset-1.5 rounded-sm bg-[#E8DECA]" />
              </div>
              <span className="font-body text-[13px] text-ink">{s.label}</span>
              {frameStyle === s.id && <span className="ml-auto font-body text-[12px] text-ink">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="px-4 py-2.5 rounded-md border border-border bg-paper font-body text-[13px] text-muted hover:text-ink hover:bg-warm-bg transition-colors duration-120 cursor-pointer"
        >
          Wissen
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1 py-2.5 rounded-md bg-ink text-white font-body text-[13px] font-medium border-none cursor-pointer transition-colors duration-150 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Opslaan..."
            : canSubmit
              ? "Opslaan"
              : "Vul alle verplichte velden in"
          }
        </button>
      </div>

    </div>
  )
}
import { useState, useEffect, useRef } from "react"
import { FiImage, FiMusic, FiX, FiCheck, FiUpload, FiEdit2, FiAlertCircle } from "react-icons/fi"
import { apiFetch } from "./api"

const API = "http://10.120.5.132:8000" //this must be changed due to idk what happend in that stupid POS pc
const ART_TYPES = ["Schilderij", "Beeldhouwwerk", "Fotografie", "Illustratie", "Installatie", "Overig"]

/* ─────────────────────────────────────────────────────────────────────────
   Wall normaliser
   Accepts any casing/language from the DB: muur field can be
   "achterwand", "back", "achter", "linkerwand", "left", "links",
   "rechterwand", "right", "rechts"
───────────────────────────────────────────────────────────────────────── */
function toWallKey(plaatsNr) {
  if (plaatsNr <= 3) return "back"
  // Als je de kamer binnenkomt is de muur aan de linkerhand 
  // blijkbaar gekoppeld aan 7, 8, 9 in de database
  if (plaatsNr <= 6) return "right" 
  return "left"
}

/* ─────────────────────────────────────────────────────────────────────────
   RoomPicker
   Props:
     frames    – [{ Id, Naam, Muur?, Positie? }]
     selected  – currently selected frame Id (or null)
     onSelect  – (id) => void
     artImg    – preview URL to show inside selected frame
───────────────────────────────────────────────────────────────────────── */
function RoomPicker({ frames, selected, onSelect, artImg }) {
  const [activeWall, setActiveWall] = useState("back")

  // Groepeer frames op basis van de nieuwe toWallKey
  const grouped = { back: [], left: [], right: [] }
  frames.forEach(f => {
    const key = toWallKey(f.PlaatsNr)
    grouped[key].push(f)
  })

  // We houden de visuele volgorde van de muren hetzelfde: 
  // [Links] [Achter] [Rechts]
  const WALLS = [
    { key: "left", label: "Links" },
    { key: "back", label: "Achter" },
    { key: "right", label: "Rechts" },
  ]

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">

      {/* ── Unfolded room diagram ── */}
      <div className="flex rounded-lg overflow-hidden border border-border shrink-0" style={{ height: "160px" }}>

        {/* Left wall panel */}
        <WallPanel
          wall={WALLS[0]}
          frames={grouped.left}
          selected={selected}
          onSelect={onSelect}
          artImg={artImg}
          active={activeWall === "left"}
          onActivate={() => setActiveWall("left")}
          width="22%"
          perspective="left"
        />

        {/* Back wall panel – widest */}
        <WallPanel
          wall={WALLS[1]}
          frames={grouped.back}
          selected={selected}
          onSelect={onSelect}
          artImg={artImg}
          active={activeWall === "back"}
          onActivate={() => setActiveWall("back")}
          width="56%"
          perspective="back"
        />

        {/* Right wall panel */}
        <WallPanel
          wall={WALLS[2]}
          frames={grouped.right}
          selected={selected}
          onSelect={onSelect}
          artImg={artImg}
          active={activeWall === "right"}
          onActivate={() => setActiveWall("right")}
          width="22%"
          perspective="right"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {grouped[activeWall].length === 0 ? (
          <p className="font-body text-[11px] text-muted italic px-0.5 pt-1">
            Geen frames op deze wand.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {grouped[activeWall].map(f => {
              const isSelected = selected === f.FramePlaatsId
              return (
                <button
                  key={f.FramePlaatsId}
                  onClick={() => onSelect(isSelected ? null : f.FramePlaatsId)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md border font-body text-[12px] font-medium cursor-pointer text-left
                    ${isSelected
                      ? "bg-ink text-white border-ink"
                      : "bg-warm-bg text-muted border-border hover:border-accent hover:text-ink"}`}
                >
                  {/* mini frame swatch */}
                  <div className={`w-7 h-6 rounded shrink-0 border flex items-center justify-center overflow-hidden
                    ${isSelected ? "border-white/20" : "border-border"}`}
                    style={{ background: "#e8deca" }}
                  >
                    {artImg
                      ? <img src={artImg} alt="" className="w-full h-full object-cover opacity-80" />
                      : <div className="w-3.5 h-3 bg-muted/20 rounded-sm" />
                    }
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate">Positie {f.PlaatsNr}</span>
                    <span className="block font-normal text-[10px] opacity-50">#{f.FramePlaatsId}</span>
                  </div>
                  {isSelected && <FiCheck size={11} className="ml-auto shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function WallPanel({ wall, frames, selected, onSelect, artImg, active, onActivate, width, perspective }) {
  const hasSelected = frames.some(f => f.FramePlaatsId === selected)

  const skewStyle = perspective === "left"
    ? { background: "#f0ede6", borderRight: "1px solid #ddd" }
    : perspective === "right"
      ? { background: "#f0ede6", borderLeft: "1px solid #ddd" }
      : { background: "#faf9f6" }

  return (
    <div
      onClick={onActivate}
      className={`relative flex flex-col cursor-pointer select-none overflow-hidden
        ${active ? "ring-2 ring-inset ring-ink/20" : "hover:brightness-95"}`}
      style={{ width, ...skewStyle, transition: "filter 120ms" }}
    >
      <div className={`px-2 py-1 font-body text-[9px] tracking-[.07em] uppercase font-semibold
        ${active ? "text-ink" : "text-muted"}`}>
        {wall.label}
        {hasSelected && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-ink align-middle" />
        )}
      </div>

      <div className="flex-1 flex flex-wrap items-center justify-center gap-1.5 px-2 pb-2">
        {frames.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-10 border border-dashed border-border/60 rounded-sm" />
          </div>
        ) : (
          frames.map(f => {
            const isSel = selected === f.FramePlaatsId
            return (
              <button
                key={f.FramePlaatsId}
                onClick={e => { e.stopPropagation(); onSelect(isSel ? null : f.FramePlaatsId) }}
                title={`Positie ${f.PlaatsNr}`}
                className={`relative rounded-sm overflow-hidden cursor-pointer border-none p-0 shrink-0
                  ${isSel ? "ring-2 ring-ink shadow-md" : "opacity-60 hover:opacity-100"}`}
                style={{ width: 36, height: 44 }}
              >

                <div className={`absolute inset-0 rounded-sm ${isSel ? "bg-ink/10" : "bg-[#c8b89a]/40"}`} />
                <div className="absolute inset-0.75 rounded-[1px] overflow-hidden bg-[#e8deca]">
                  {isSel && artImg
                    ? <img src={artImg} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-[#d9cdb8]" />
                  }
                </div>

                <div className="absolute bottom-0 right-0 bg-black/40 px-0.5 rounded-tl-sm">
                  <span className="font-body text-[8px] text-white leading-none">{f.PlaatsNr}</span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink" />}
    </div>
  )
}

export default function UploadView({ token, addLog, item: editItem, onSaved, onCancel }) {
  const isEdit = !!editItem

  const imageRef = useRef(null)
  const audioRef = useRef(null)

  const [naam, setNaam] = useState(editItem?.Naam ?? "")
  const [type, setType] = useState(editItem?.Type ?? "Schilderij")
  const [auteur, setAuteur] = useState(editItem?.Auteur ?? "")
  const [beschrijving, setBeschrijving] = useState(editItem?.Beschrijving ?? "")
  const [framePlaatsId, setFramePlaatsId] = useState(editItem?.FramePlaatsId ?? null)
  const [frameless, setFrameless] = useState(editItem?.Frameless === 1 || editItem?.Frameless === true)
  const [kamerId, setKamerId] = useState(null)

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(editItem?.ImageUrl ?? null)
  const [audioFile, setAudioFile] = useState(null)
  const [audioName, setAudioName] = useState(
    editItem?.Audiopath ? editItem.Audiopath.split("/").pop() : null
  )
  const [dragOver, setDragOver] = useState(false)

  const [kamers, setKamers] = useState([])
  const [frames, setFrames] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metaError, setMetaError] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const [rK, rF] = await Promise.all([apiFetch("/kamers"), apiFetch("/frames")])
          const k = await rK.json()
          const f = await rF.json()
          if (cancelled) return
          setKamers(k)
          setFrames(f)
          if (editItem?.FramePlaatsId) {
            const ef = f.find(fr => fr.FramePlaatsId === editItem.FramePlaatsId)
            if (ef) setKamerId(ef.KamerId)
          }
        } catch (e) {
          if (!cancelled) setMetaError("Kon kamers/frames niet laden.")
        } finally {
          if (!cancelled) setLoadingMeta(false)
        }
      })()
    return () => { cancelled = true }
  }, [editItem?.FramePlaatsId])

  const framesInKamer = kamerId ? frames.filter(f => f.KamerId === kamerId) : []
  const selectedKamer = kamers.find(k => k.KamerId === kamerId)
  const selectedFrame = frames.find(f => f.FramePlaatsId === framePlaatsId)
  const canSubmit = naam.trim() && type && (isEdit || imageFile) && (frameless || framePlaatsId)

  const readImage = (f) => {
    if (!f) return
    setImageFile(f)
    const r = new FileReader()
    r.onload = e => setImagePreview(e.target.result)
    r.readAsDataURL(f)
  }

  const readAudio = (f) => {
    if (!f) return
    setAudioFile(f)
    setAudioName(f.name)
  }

  const toggleFrameless = () => {
    setFrameless(p => {
      if (!p) setFramePlaatsId(null)
      return !p
    })
  }

  const handleKamerChange = (id) => {
    setKamerId(id)
    setFramePlaatsId(null)
    setFrameless(false)
  }

  const handleReset = () => {
    setNaam(""); setType("Schilderij"); setAuteur(""); setBeschrijving("")
    setFramePlaatsId(null); setFrameless(false); setKamerId(null)
    setImageFile(null); setImagePreview(null)
    setAudioFile(null); setAudioName(null)
    setSubmitted(false); setSubmitError(null)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitError(null); setSubmitting(true)
    try {
      const data = new FormData()
      data.append("naam",         naam)
      data.append("Type",         type)
      data.append("auteur",       auteur)
      data.append("beschrijving", beschrijving)
      data.append("frameless",    frameless ? "1" : "0")
      if (!frameless && framePlaatsId) data.append("framePlaatsId", String(framePlaatsId))
      if (imageFile) data.append("afbeelding", imageFile)
      if (audioFile) data.append("audio",      audioFile)

      const url    = isEdit ? `${API}/items/${editItem.Id}` : `${API}/upload`
      const method = "POST" // Gebruik altijd POST, ongeacht edit of create

      const res = await fetch(url, { 
          method, 
          headers: { Authorization: `Bearer ${token}` }, 
          body: data 
      })
      const payload = await res.json().catch(() => ({}))
      if (res.status === 401) throw new Error("Sessie verlopen.")
      if (!res.ok) throw new Error(payload.error || "Opslaan mislukt.")

      addLog?.(`${isEdit ? "Bijgewerkt" : "Toegevoegd"}: ${naam}`, "success")
      if (isEdit) {
        onSaved?.({
          ...editItem, Naam: naam, Type: type, Auteur: auteur, Beschrijving: beschrijving,
          FramePlaatsId: frameless ? null : framePlaatsId, Frameless: frameless ? 1 : 0
        })
      } else {
        setSubmitted(true)
      }
    } catch (e) {
      addLog?.(`Fout: ${e.message}`, "error")
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted && !isEdit) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-paper border border-border rounded-[10px] px-8 py-10 flex flex-col items-center text-center gap-3 max-w-sm w-full">
          <div className="w-11 h-11 rounded-full bg-ink flex items-center justify-center">
            <FiCheck size={20} color="#fff" />
          </div>
          <div>
            <p className="font-display text-[16px] font-semibold text-ink mb-1">Opgeslagen!</p>
            <p className="font-body text-[13px] text-muted leading-relaxed">
              <span className="text-ink font-medium">"{naam}"</span> is klaar voor verwerking
              {!frameless && selectedFrame && (
                <> en wordt opgehangen in{" "}
                  <span className="text-ink font-medium">
                    {selectedKamer?.Naam} — {selectedFrame.Naam ?? `Frame #${selectedFrame.Id}`}
                  </span>
                </>
              )}.
            </p>
          </div>
          <button onClick={handleReset}
            className="mt-1 flex items-center gap-2 px-5 py-2 rounded-md bg-ink text-white font-body text-[13px] font-medium cursor-pointer border-none">
            <FiUpload size={13} /> Nieuw werk toevoegen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-5 h-full min-h-0 max-h-[calc(100vh-116px)]">

      <div className="flex flex-col gap-3 w-77.5 shrink-0 min-h-0">

        <div
          onClick={() => imageRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); readImage(e.dataTransfer.files?.[0]) }}
          className={`border-2 border-dashed rounded-lg cursor-pointer overflow-hidden shrink-0
            ${dragOver ? "border-ink bg-warm-bg"
              : imagePreview ? "border-border"
                : "border-border bg-warm-bg hover:border-accent"}`}
          style={{ height: imagePreview ? "150px" : "90px" }}
        >
          {imagePreview ? (
            <div className="relative group w-full h-full">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-body text-[12px] text-white bg-black/55 px-3 py-1 rounded-full">
                  Andere afbeelding
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 h-full">
              <FiImage size={18} color="#ccc" />
              <p className="font-body text-[12px] text-muted">
                {isEdit ? "Nieuwe afbeelding (optioneel)" : "Klik of sleep afbeelding"}
              </p>
              <p className="font-body text-[10px] text-muted">PNG · JPG · WEBP — max. 50 MB</p>
            </div>
          )}
        </div>
        <input ref={imageRef} type="file" accept="image/*" className="hidden"
          onChange={e => readImage(e.target.files?.[0])} />

        {imagePreview && imageFile && (
          <button onClick={() => { setImageFile(null); setImagePreview(isEdit ? (editItem?.ImageUrl ?? null) : null) }}
            className="flex items-center gap-1 -mt-1.5 font-body text-[11px] text-muted hover:text-red-500 cursor-pointer bg-transparent border-none p-0">
            <FiX size={11} /> Verwijderen
          </button>
        )}

        <div
          onClick={() => audioRef.current?.click()}
          className={`flex items-center gap-2.5 px-3 py-2 border rounded-lg cursor-pointer shrink-0
            ${audioName ? "border-border bg-paper" : "border-border bg-warm-bg hover:border-accent"}`}
        >
          <FiMusic size={13} className={audioName ? "text-ink" : "text-muted"} />
          <div className="flex-1 min-w-0">
            {audioName
              ? <p className="font-body text-[12px] text-ink truncate">{audioName}</p>
              : <p className="font-body text-[12px] text-muted">{isEdit ? "Nieuw audio (optioneel)" : "Audio toevoegen (optioneel)"}</p>
            }
          </div>
          {audioName && (
            <button onClick={e => { e.stopPropagation(); setAudioFile(null); setAudioName(isEdit ? (editItem?.Audiopath?.split("/").pop() ?? null) : null) }}
              className="text-muted hover:text-red-500 bg-transparent border-none cursor-pointer p-0">
              <FiX size={12} />
            </button>
          )}
        </div>
        <input ref={audioRef} type="file" accept="audio/*" className="hidden"
          onChange={e => readAudio(e.target.files?.[0])} />

        <div className="bg-paper border border-border rounded-[10px] p-4 flex flex-col gap-2.5 flex-1 min-h-0">
          <FieldLabel>Type</FieldLabel>
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
            {ART_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <FieldLabel>Naam</FieldLabel>
          <input value={naam} onChange={e => setNaam(e.target.value)}
            placeholder="Titel van het werk" className={inputCls} />

          <FieldLabel>Auteur</FieldLabel>
          <input value={auteur} onChange={e => setAuteur(e.target.value)}
            placeholder="Naam van de kunstenaar" className={inputCls} />

          <FieldLabel>
            Beschrijving{" "}
            <span className="normal-case tracking-normal font-light text-muted">(optioneel)</span>
          </FieldLabel>
          <textarea value={beschrijving} onChange={e => setBeschrijving(e.target.value)}
            placeholder="Korte omschrijving…" rows={2}
            className={`${inputCls} resize-none`} />
        </div>

        {submitError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg shrink-0">
            <FiAlertCircle size={13} className="text-red-500 shrink-0" />
            <p className="font-body text-[12px] text-red-600">{submitError}</p>
          </div>
        )}

        <div className="flex gap-2 shrink-0">
          <button onClick={isEdit ? onCancel : handleReset}
            className="px-4 py-2 rounded-md border border-border bg-paper font-body text-[13px] text-muted hover:text-ink cursor-pointer">
            {isEdit ? "Annuleren" : "Wissen"}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-ink text-white font-body text-[13px] font-medium border-none cursor-pointer hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting
              ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Opslaan…</>
              : isEdit
                ? <><FiEdit2 size={13} /> Bijwerken</>
                : canSubmit
                  ? <><FiUpload size={13} /> Opslaan</>
                  : "Vul alle velden in"
            }
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-0">

        {metaError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg shrink-0">
            <FiAlertCircle size={13} className="text-red-500 shrink-0" />
            <p className="font-body text-[12px] text-red-600">{metaError}</p>
          </div>
        )}

        <div className="bg-paper border border-border rounded-[10px] px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-[13px] font-medium text-ink">Geen vaste plaatsing</p>
              <p className="font-body text-[11px] text-muted mt-0.5">Sla op zonder frame te kiezen</p>
            </div>
            <button onClick={toggleFrameless}
              className={`relative w-10 h-5.5 rounded-full border cursor-pointer shrink-0
        ${frameless ? "bg-ink border-ink" : "bg-warm-bg border-border"}`}>
              <span className={`absolute top-0.75 w-4 h-4 rounded-full bg-white shadow-sm
        ${frameless ? "left-[calc(100%-19px)]" : "left-0.75"}`} />
            </button>
          </div>
        </div>

        <div className={`bg-paper border border-border rounded-[10px] p-4 flex flex-col gap-3 flex-1 min-h-0
          ${frameless ? "opacity-40 pointer-events-none select-none" : ""}`}>

          <SectionLabel>Kamer</SectionLabel>

          {loadingMeta ? (
            <div className="flex items-center gap-2 text-muted shrink-0">
              <div className="w-3.5 h-3.5 border-2 border-border border-t-muted rounded-full animate-spin" />
              <span className="font-body text-[12px]">Laden…</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {kamers.map(k => (
                <button key={k.KamerId} onClick={() => handleKamerChange(k.KamerId)}
                  className={`px-3 py-1.5 rounded-md border font-body text-[12px] font-medium cursor-pointer
                    ${kamerId === k.KamerId
                      ? "bg-ink text-white border-ink"
                      : "bg-warm-bg text-muted border-border hover:border-accent hover:text-ink"}`}>
                  {k.Naam}
                </button>
              ))}
            </div>
          )}

          {kamerId && !loadingMeta && (
            <>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex-1 h-px bg-border" />
                <span className="font-body text-[10px] text-muted tracking-[.06em] uppercase">
                  Kies een positie in {selectedKamer?.Naam}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <RoomPicker
                frames={framesInKamer}
                selected={framePlaatsId}
                onSelect={setFramePlaatsId}
                artImg={imagePreview}
              />
            </>
          )}

          {framePlaatsId && !frameless && (
            <div className="flex items-center gap-2 px-3 py-2 bg-warm-bg rounded-lg border border-border shrink-0 mt-auto">
              <FiCheck size={11} className="text-ink shrink-0" />
              <p className="font-body text-[11px] text-muted">
                <span className="text-ink font-medium">{selectedKamer?.Naam}</span>
                {" · "}
                <span className="text-ink font-medium">
                  {selectedFrame?.Naam ?? selectedFrame?.Positie ?? `Frame #${framePlaatsId}`}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls = "border border-border rounded-md px-3 py-2 font-body text-[13px] text-ink placeholder:text-muted placeholder:font-light outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)] w-full bg-paper"

function FieldLabel({ children }) {
  return (
    <label className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase">
      {children}
    </label>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase">
      {children}
    </p>
  )
}
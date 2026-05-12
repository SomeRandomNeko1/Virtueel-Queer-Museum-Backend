import { useState, useEffect, useCallback, useRef } from "react"
import { FiHome, FiList, FiSettings, FiSearch, FiX, FiImage,FiChevronDown, FiLogOut, FiUser, FiUpload, FiCheck } from "react-icons/fi"
import NotifBell from "./NotifBell"
import "./App.css"
const API = "/api"

const navItems = [
  { id: "home",     label: "Home",         Icon: FiHome },
  { id: "upload",   label: "Upload",       Icon: FiUpload },
  { id: "log",      label: "Log",          Icon: FiList },
  { id: "settings", label: "Instellingen", Icon: FiSettings },
]

export default function App({ onLogout }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState("")
  const [typeFilter, setTypeFilter] = useState(null)
  const [page, setPage] = useState("home")
  const [picked, setPicked] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(API + "/")
      if (!res.ok) throw new Error("server error " + res.status)
      setItems(await res.json())
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const types = [...new Set(items.map(x => x.Type).filter(Boolean))]

  const filtered = items
    .filter(x => !typeFilter || x.Type === typeFilter)
    .filter(x => {
      if (!q) return true
      const s = q.toLowerCase()
      return [x.Naam, x.Beschrijving, x.Type].some(v => v && v.toLowerCase().includes(s))
    })

  const currentPage = navItems.find(n => n.id === page)

  return (
    <div className="flex min-h-screen">

      {!isMobile && (
        <aside
          className="w-57.5 bg-ink fixed top-0 left-0 h-full z-10 flex flex-col"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 0% 0%, rgba(255,255,255,.06) 0%, transparent 60%)," +
              "radial-gradient(ellipse at 100% 100%, rgba(255,255,255,.04) 0%, transparent 50%)",
          }}
        >
          <div className="px-5.5 h-15 flex items-center font-display text-[22px] font-semibold text-white tracking-[.01em] border-b border-white/8 leading-none">
            Kunstwerk
          </div>

          <nav className="px-2.5 py-3.5 flex flex-col gap-px">
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`flex items-center gap-2.75 w-full px-3 py-2.25 rounded-md border-none cursor-pointer font-body text-[13px] font-normal tracking-[.01em] text-left transition-all duration-150
                  ${page === id
                    ? "bg-white/[.14] text-white/95"
                    : "bg-transparent text-white/38 hover:bg-white/6 hover:text-white/75"}`}
              >
                <Icon size={15} /><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>
      )}

      <div className="flex-1 ml-0 md:ml-57.5 flex flex-col min-h-screen">

        <header className="h-15 bg-paper border-b border-border flex items-center justify-between px-7 sticky top-0 z-5">
          <span className="font-display text-[20px] font-semibold text-ink tracking-[.01em]">
            {currentPage?.label}
          </span>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-warm-bg border border-border rounded-md px-2.5 py-1.5 text-muted transition-colors duration-150 focus-within:border-accent">
              <FiSearch size={13} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Zoeken…"
                className="border-none bg-transparent outline-none font-body text-[13px] font-light text-ink
                           w-25 md:w-37.5 focus:w-35 md:focus:w-52.5
                           transition-all duration-200 placeholder:text-muted placeholder:italic"
              />
              {q && (
                <button onClick={() => setQ("")} className="bg-transparent border-none cursor-pointer text-muted hover:text-ink flex items-center p-0">
                  <FiX size={12} />
                </button>
              )}
            </div>

            <NotifBell />

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(p => !p)}
                className="flex items-center gap-1.5 border border-border rounded-[20px] py-1 pr-2.25 pl-1 cursor-pointer text-muted text-[13px] hover:bg-warm-bg transition-colors duration-120 bg-transparent"
              >
                <div className="w-6.5 h-6.5 bg-ink text-white rounded-full text-[11px] font-medium flex items-center justify-center font-display">
                  O
                </div>
                <FiChevronDown
                  size={12}
                  style={{
                    transform: showMenu ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 150ms ease",
                  }}
                />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] w-48 bg-paper border border-border rounded-lg shadow-[0_8px_30px_rgba(0,0,0,.12)] overflow-hidden z-50"
                  style={{ animation: "menuFadeIn 120ms ease" }}
                >
                  <div className="px-3.5 py-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-ink text-white rounded-full text-[12px] font-medium flex items-center justify-center font-display shrink-0">
                        O
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-[13px] font-semibold text-ink leading-tight truncate">Admin</p>
                        <p className="font-body text-[11px] text-muted truncate">Beheerder</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md bg-transparent border-none cursor-pointer font-body text-[13px] text-muted hover:bg-warm-bg hover:text-ink transition-colors duration-120 text-left"
                    >
                      <FiUser size={13} />
                      <span>Profiel</span>
                    </button>

                    <div className="my-1 border-t border-border" />

                    <button
                      onClick={() => { setShowMenu(false); onLogout?.() }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md bg-transparent border-none cursor-pointer font-body text-[13px] text-red-500 hover:bg-red-50 transition-colors duration-120 text-left"
                    >
                      <FiLogOut size={13} />
                      <span>Uitloggen</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4.5 pb-20 md:p-7 md:pb-7 flex-1 overflow-y-auto md:overflow-hidden flex flex-col">
          {page === "home" && (
            <HomeView
              items={filtered} loading={loading} err={err}
              types={types} typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              picked={picked} setPicked={setPicked} isMobile={isMobile}
            />
          )}
          {page === "upload" && <UploadView />}
          {page === "log" && (
            <div className="flex items-center justify-center mt-20 text-muted text-[14px] italic">
              <p>Log nog niet beschikbaar</p>
            </div>
          )}
          {page === "settings" && (
            <div className="flex items-center justify-center mt-20 text-muted text-[14px] italic">
              <p>Instellingen nog niet beschikbaar</p>
            </div>
          )}
        </main>
      </div>

      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 bg-paper border-t border-border flex z-10"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex-1 flex flex-col items-center gap-0.75 py-2.5 px-1 border-none bg-transparent cursor-pointer font-body text-[10px] tracking-[.04em] uppercase transition-colors duration-120
                ${page === id ? "text-ink" : "text-muted"}`}
            >
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      <style>{`
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

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
  { id: 1, wallId: "back",  label: "Achterwand – links"   },
  { id: 2, wallId: "back",  label: "Achterwand – rechts"  },
  { id: 3, wallId: "left",  label: "Linkerwand – voor"    },
  { id: 4, wallId: "left",  label: "Linkerwand – achter"  },
  { id: 5, wallId: "right", label: "Rechterwand – voor"   },
  { id: 6, wallId: "right", label: "Rechterwand – achter" },
]

function UploadView() {
  const fileRef = useRef(null)

  const [naam,         setNaam]         = useState("")
  const [beschrijving, setBeschrijving] = useState("")
  const [frameId,      setFrameId]      = useState(null)
  const [frameStyle,   setFrameStyle]   = useState("black")
  const [preview,      setPreview]      = useState(null)
  const [file,         setFile]         = useState(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [submitted,    setSubmitted]    = useState(false)

  const selectedFrame = FRAMES.find(f => f.id === frameId)
  const canSubmit     = naam && file && frameId

  const readFile = (f) => {
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  const handleReset = () => {
    setNaam(""); setBeschrijving(""); setFrameId(null)
    setFrameStyle("black"); setPreview(null); setFile(null)
    setSubmitted(false)
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    // TODO: POST FormData naar /api/upload
    // const data = new FormData()
    // data.append("naam", naam)
    // data.append("beschrijving", beschrijving)
    // data.append("frameId", frameId)
    // data.append("frameStyle", frameStyle)
    // data.append("afbeelding", file)
    // await fetch("/api/upload", { method: "POST", body: data })
    setSubmitted(true)
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
              <p className="font-body text-[11px] text-muted">PNG · JPG · WEBP — max. 10 MB</p>
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
      </div>

      <div className="bg-paper border border-border rounded-[10px] p-5 flex flex-col gap-3">
        <p className="font-body text-[10px] font-semibold text-accent tracking-[.07em] uppercase">
          Informatie
        </p>
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
          disabled={!canSubmit}
          className="flex-1 py-2.5 rounded-md bg-ink text-white font-body text-[13px] font-medium border-none cursor-pointer transition-colors duration-150 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canSubmit ? "Opslaan" : "Vul alle verplichte velden in"}
        </button>
      </div>

    </div>
  )
}

function IFramePanel({ picked }) {
  return (
    <div className="w-[48%] shrink-0 flex flex-col bg-paper border border-border rounded-[10px] overflow-hidden">
      {picked && (
        <div className="flex items-center gap-1.75 px-3.5 py-1.75 bg-accent-light border-b border-border text-[11.5px] text-muted shrink-0 tracking-[.02em]">
          <FiImage size={11} />
          <span className="font-medium text-ink whitespace-nowrap overflow-hidden text-ellipsis">
            {picked.Naam || "Geselecteerd werk"}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <iframe
          src={picked?.url || ""}
          title="Extern paneel"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="w-full h-full border-none block"
        />
      </div>
    </div>
  )
}

function HomeView({ items, loading, err, types, typeFilter, setTypeFilter, picked, setPicked, isMobile }) {
  return (
    <div className="flex gap-5.5 flex-1 min-h-0 flex-col md:flex-row h-auto md:h-[calc(100vh-116px)]">

      <div className="flex-1 min-w-0 overflow-y-auto pr-1">

        {types.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5.5">
            {types.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(prev => prev === t ? null : t)}
                className={`px-3.5 py-1 rounded-[3px] border font-body text-[12px] font-normal tracking-[.04em] uppercase cursor-pointer transition-all duration-150
                  ${typeFilter === t
                    ? "bg-ink text-white border-ink"
                    : "bg-paper text-muted border-border hover:border-accent hover:text-accent"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3.5 mt-15">
            <div className="w-6.5 h-6.5 border-2 border-border border-t-ink rounded-full animate-spin" />
            <p>Laden…</p>
          </div>
        )}

        {err && (
          <p className="text-ink text-[13px] text-center mt-10">Fout: {err}</p>
        )}

        {!loading && !err && (
          items.length === 0
            ? <p className="text-muted text-[13px] italic text-center mt-10">Geen resultaten gevonden.</p>
            : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 md:gap-4">
                {items.map(item => (
                  <Card
                    key={item.Id}
                    item={item}
                    active={picked?.Id === item.Id}
                    onClick={() => setPicked(p => p?.Id === item.Id ? null : item)}
                  />
                ))}
              </div>
            )
        )}
      </div>

      {!isMobile && <IFramePanel picked={picked} />}
    </div>
  )
}

function Card({ item, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`group bg-paper border border-border rounded-lg overflow-hidden cursor-pointer
        transition-all duration-180 ease-in-out
        hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,.09)]
        ${active ? "shadow-[0_0_0_2px_#111111]" : ""}`}
    >
      <div className="h-30 bg-warm-bg flex items-center justify-center overflow-hidden relative">
        {item.Afbeelding
          ? <img
              src={item.Afbeelding}
              alt={item.Naam}
              className="w-full h-full object-cover transition-transform duration-350 ease-in-out group-hover:scale-[1.04]"
            />
          : <FiImage size={26} color="#ccc" />
        }
        {active && <div className="absolute inset-0 bg-black/5" />}
      </div>

      <div className="px-3.25 pt-2.75 pb-3.25">
        <p className="font-display text-[15px] font-semibold text-ink mb-1.5 leading-tight">
          {item.Naam || "Naamloos"}
        </p>
        {item.Type && (
          <span className="inline-block text-[10px] font-normal tracking-[.07em] uppercase text-muted mb-1.25">
            {item.Type}
          </span>
        )}
        {item.Beschrijving && (
          <p className="text-[12px] font-light text-muted leading-[1.55] line-clamp-2">
            {item.Beschrijving}
          </p>
        )}
      </div>
    </div>
  )
}
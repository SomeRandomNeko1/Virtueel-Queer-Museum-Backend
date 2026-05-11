import { useState, useEffect, useCallback } from "react"
import { FiHome, FiList, FiSettings, FiSearch, FiX, FiImage, FiChevronDown } from "react-icons/fi"
import NotifBell from "./NotifBell"
import "./App.css"

const API = "/api"

const navItems = [
  { id: "home", label: "Home", Icon: FiHome },
  { id: "log", label: "Log", Icon: FiList },
  { id: "settings", label: "Instellingen", Icon: FiSettings },
]

export default function App() {
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

            <div className="flex items-center gap-1.5 border border-border rounded-[20px] py-1 pr-2.25 pl-1 cursor-pointer text-muted text-[13px] hover:bg-warm-bg transition-colors duration-120">
              <div className="w-6.5 h-6.5 bg-ink text-white rounded-full text-[11px] font-medium flex items-center justify-center font-display">
                O
              </div>
              <FiChevronDown size={12} />
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
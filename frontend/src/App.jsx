import { useState, useEffect, useCallback, useRef } from "react"
import { FiHome, FiList, FiSettings, FiSearch, FiX, FiImage, FiChevronDown, FiLogOut, FiUser, FiUpload } from "react-icons/fi"
import { setLogoutCallback, apiFetch, decodeToken } from "./api"
import NotifBell from "./NotifBell"
import LogView from "./Log"
import UploadView from "./Upload"
import "./App.css"

const navItems = [
  { id: "home", label: "Home", Icon: FiHome },
  { id: "upload", label: "Upload", Icon: FiUpload },
  { id: "log", label: "Log", Icon: FiList },
  { id: "settings", label: "Instellingen", Icon: FiSettings },
]

export default function App({ token, onLogout, logs, addLog }) {
  const logoutTimerRef = useRef(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ✅ Register global logout callback (zodat api.js logout kan triggeren bij 401)
  useEffect(() => {
    setLogoutCallback(() => {
      localStorage.removeItem("cms_token")
      onLogout?.()
    })
    return () => setLogoutCallback(null)
  }, [onLogout])

  // ✅ Proactive token expiration check
  useEffect(() => {
    if (!token) return

    const payload = decodeToken(token)
    if (!payload?.exp) return

    const timeUntilExpiry = (payload.exp * 1000) - Date.now() - 5000 // 5s buffer

    if (timeUntilExpiry > 0) {
      logoutTimerRef.current = setTimeout(() => {
        addLog?.("Sessie verlopen", "warning")
        localStorage.removeItem("cms_token")
        onLogout?.()
      }, timeUntilExpiry)
    } else {
      // Token al verlopen
      localStorage.removeItem("cms_token")
      onLogout?.()
    }

    return () => clearTimeout(logoutTimerRef.current)
  }, [token, onLogout, addLog])

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

  // ✅ load gebruikt apiFetch — auto 401 → logout via globale callback
  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res = await apiFetch("/")
      const data = await res.json()
      setItems(data)
    } catch (e) {
      setErr(e.message)
      // Geen onLogout() nodig hier - apiFetch heeft dit al gedaan bij 401
    }
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
          {page === "upload" && <UploadView addLog={addLog} />}
          {page === "log" && <LogView logs={logs} />}
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
  const imageSrc = item.ImageUrl || item.Afbeelding || ""

  return (
    <div
      onClick={onClick}
      className={`group bg-paper border border-border rounded-lg overflow-hidden cursor-pointer
        transition-all duration-180 ease-in-out
        hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,.09)]
        ${active ? "shadow-[0_0_0_2px_#111111]" : ""}`}
    >
      <div className="h-30 bg-warm-bg flex items-center justify-center overflow-hidden relative">
        {imageSrc
          ? <img
            src={imageSrc}
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
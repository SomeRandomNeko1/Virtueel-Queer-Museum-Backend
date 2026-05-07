import { useState, useEffect, useCallback } from "react"
import { FiHome, FiList, FiSettings, FiSearch, FiX, FiImage, FiBookmark, FiChevronDown, FiBell } from "react-icons/fi"
import "./App.css"

const API = "/api"

// nav items
const navItems = [
  { id: "home", label: "Home", Icon: FiHome },
  { id: "log", label: "Log", Icon: FiList },
  { id: "settings", label: "Instellingen", Icon: FiSettings },
]

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return width
}

export default function App() {
  const isMobile = useWindowWidth() < 768

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState("")
  const [typeFilter, setTypeFilter] = useState(null)
  const [page, setPage] = useState("home")
  const [picked, setPicked] = useState(null)

  // fetch all kunstwerken van de api
  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(API + "/")
      if (!res.ok) throw new Error("server error " + res.status)
      const data = await res.json()
      setItems(data)
    } catch(e) {
      setErr(e.message)
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
      return [x.Naam, x.Beschrijving, x.Type]
        .some(v => v && v.toLowerCase().includes(s))
    })

  const currentPage = navItems.find(n => n.id === page)

  return (
    <div className="layout">
      {!isMobile && (
        <aside className="sidebar">
          <div className="sidebar-title">Kunstwerk</div>
          <nav>
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={"nav-btn" + (page === id ? " active" : "")}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>
      )}

      <div className="main-col">
        <header className="topbar">
          <span className="topbar-title">{currentPage?.label}</span>

          <div className="topbar-right">
            <div className="searchbox">
              <FiSearch size={13} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Zoeken…"
              />
              {q && (
                <button onClick={() => setQ("")} className="clear-btn">
                  <FiX size={12} />
                </button>
              )}
            </div>

            <button className="topbar-icon-btn notif-wrap">
              <FiBell size={18} />
              <span className="notif-dot" />
            </button>

            <div className="user-menu">
              <div className="avatar">O</div>
              <FiChevronDown size={13} />
            </div>
          </div>
        </header>

        <main className="content">
          {page === "home" && (
            <HomeView
              items={filtered}
              loading={loading}
              err={err}
              types={types}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              picked={picked}
              setPicked={setPicked}
            />
          )}
          {page === "log" && <ComingSoon label="Log" />}
          {page === "settings" && <ComingSoon label="Instellingen" />}
        </main>
      </div>

      {isMobile && (
        <nav className="mobile-nav">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={"mob-btn" + (page === id ? " active" : "")}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

function HomeView({ items, loading, err, types, typeFilter, setTypeFilter, picked, setPicked }) {
  return (
    <div>

      {types.length > 0 && (
        <div className="filters">
          {types.map(t => (

            <button

              key={t}
              onClick={() => setTypeFilter(prev => prev === t ? null : t)}
              className={"filter-chip" + (typeFilter === t ? " selected" : "")}

            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>
            Laaden…

          </p>
        </div>
      )}

      {err && <p className="error-msg">Fout: {err}</p>}

      {!loading && !err && (
        items.length === 0
          ? <p className="empty-msg">Geen resultaten gevonden.</p>
          : (

            <div className="grid">
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
  )
}

function Card({ item, active, onClick }) {
  return (
    <div className={"card" + (active ? " card-active" : "")} onClick={onClick}>
      <div className="card-img">
        {item.Afbeelding? <img src={item.Afbeelding} alt={item.Naam} />
          : <FiImage size={28} color="#ccc" />
        }
      </div>
      <div className="card-info">
        <p className="card-name">{item.Naam || "Naamloos"}</p>

        {item.Type && <span className="card-type">{item.Type}</span>}
        
        
        {item.Beschrijving && <p className="card-desc">{item.Beschrijving}</p>}
      </div>
    </div>
  )
}

function ComingSoon({ label }) {
  return (
    <div className="coming-soon">
      <p>{label}nog niet beschiekbaar</p>
    </div>
  )
}
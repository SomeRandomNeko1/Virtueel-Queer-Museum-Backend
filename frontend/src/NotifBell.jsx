import { useState, useEffect, useRef } from "react"
import { FiBell, FiCheckCircle } from "react-icons/fi"

// TODO: vervangen door API-aanroep
const mockNotifications = [
  { id: 1, title: "Nieuw kunstwerk toegevoegd", body: '"Zonsondergang boven de polder" is beschikbaar.', time: "2 min geleden", read: false },
  { id: 2, title: "Collectie bijgewerkt",       body: "3 werken zijn voorzien van een nieuwe beschrijving.", time: "1 uur geleden", read: false },
  { id: 3, title: "Welkom!",                    body: "Fijn dat je er bent. Verken de collectie.",           time: "gisteren",     read: true  },
]

export default function NotifBell() {
  const [showNotif, setShowNotif]         = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)
  const notifRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  return (
    <div className="relative" ref={notifRef}>

      <button
        aria-label="Meldingen"
        onClick={() => setShowNotif(prev => !prev)}
        className="relative p-1.75 rounded-md bg-transparent border-none cursor-pointer text-muted flex items-center hover:bg-warm-bg hover:text-ink transition-all duration-120"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.25 right-1.25 w-1.75 h-1.75 bg-ink rounded-full border-2 border-paper pointer-events-none" />
        )}
      </button>

      {showNotif && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-73.75 bg-paper border border-border rounded-lg shadow-[0_10px_30px_rgba(0,0,0,.10)] z-100 overflow-hidden">

          <div className="flex items-center justify-between px-3.75 py-3 border-b border-border font-display text-[15px] font-semibold text-ink">
            <span>Meldingen</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 bg-transparent border-none cursor-pointer font-body text-[11.5px] font-light text-muted hover:text-ink transition-colors duration-150 p-0"
              >
                <FiCheckCircle size={13} />
                Alles gelezen
              </button>
            )}
          </div>

          <ul className="list-none max-h-70 overflow-y-auto">
            {notifications.map(n => (
              <li
                key={n.id}
                onClick={() =>
                  setNotifications(prev =>
                    prev.map(x => x.id === n.id ? { ...x, read: true } : x)
                  )
                }
                className={`flex items-start gap-2.5 px-3.75 py-3 cursor-pointer border-b border-border last:border-b-0 transition-colors duration-120
                  ${!n.read ? "bg-accent-light hover:bg-[#dddddd]" : "hover:bg-warm-bg"}`}
              >
                {!n.read && (
                  <span className="shrink-0 w-1.5 h-1.5 bg-ink rounded-full mt-1.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[13px] font-medium text-ink mb-0.5">{n.title}</p>
                  <p className="text-[12px] font-light italic text-muted leading-[1.45] mb-1">{n.body}</p>
                  <p className="text-[11px] text-[#aaaaaa]">{n.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
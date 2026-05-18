function formatLogTime(isoString) {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export default function LogView({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center justify-center mt-20 text-muted text-[14px] italic">
        <p>Nog geen activiteit</p>
      </div>
    )
  }

  return (
    <div className="max-w-170">
      <div className="bg-paper border border-border rounded-[10px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-display text-[16px] font-semibold text-ink">Activiteitenlogboek</p>
          <p className="font-body text-[12px] text-muted mt-1">Recente inlog- en uploadacties</p>
        </div>

        <div className="divide-y divide-border">
          {logs.map(entry => (
            <div key={entry.id} className="px-5 py-4 flex items-start gap-3">
              <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${entry.status === "success"
                  ? "bg-green-500"
                  : entry.status === "error"
                    ? "bg-red-500"
                    : "bg-slate-400"
                }`} />
              <div className="min-w-0 flex-1">
                <p className="font-body text-[13px] text-ink">{entry.message}</p>
                <p className="font-body text-[11px] text-muted mt-1">{formatLogTime(entry.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
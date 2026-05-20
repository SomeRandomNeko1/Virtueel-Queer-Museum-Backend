import { FiImage } from "react-icons/fi"

export default function IFramePanel({ picked, fullPage = false }) {
  return (
    <div
      className={`flex flex-col bg-paper border border-border rounded-[10px] overflow-hidden
        ${fullPage ? "flex-1 w-full min-h-0" : "w-[48%] shrink-0"}`}
    >
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
          key={picked?.url ?? "default"}
          src={picked?.url || "http://10.120.5.132:8090/Main-rooms/"}
          title="Extern paneel"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="absolute inset-0 w-full h-full border-none block"
        />
      </div>
    </div>
  )
}
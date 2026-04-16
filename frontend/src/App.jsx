import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "/api";

export default function KunstwerkenCMS() {
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("Alle");
  const [selected, setSelected] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArtworks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const types = ["Alle", ...new Set(artworks.map(a => a.Type).filter(Boolean))];

  const filtered = artworks
    .filter(a => activeType === "Alle" || a.Type === activeType)
    .filter(a => {
      const q = search.toLowerCase();
      return !q || ["Naam", "Beschrijving", "Type"].some(k =>
        String(a[k] ?? "").toLowerCase().includes(q)
      );
    });

  const handleDelete = async (id) => {
    await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    setArtworks(prev => prev.filter(a => a.Id !== id));
    if (selected?.Id === id) setSelected(null);
  };

  return (
    <div>
      {/* jouw design hier */}
    </div>
  );
}
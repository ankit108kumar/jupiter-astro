"use client";

import { useEffect, useRef, useState } from "react";

interface LatLng { lat: number; lng: number; }
interface MapPickerProps {
  initialCoords: LatLng;
  onSelect: (latlng: LatLng, name: string) => void;
}

export default function MapPicker({ initialCoords, onSelect }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      return data.address?.city || data.address?.town || data.address?.village || data.address?.county || data.display_name || "";
    } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
  };

  useEffect(() => {
    let isMounted = true; // <-- Flag to prevent async race conditions

    import("leaflet").then((L) => {
      // If the component unmounted while Leaflet was loading, abort!
      if (!isMounted || !containerRef.current) return;

      const el = containerRef.current;
      
      // Clear out any stray Leaflet IDs just in case
      if ((el as any)._leaflet_id) {
        (el as any)._leaflet_id = null;
      }
      
      // If a map reference somehow exists, destroy it
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(el, {
        center: [initialCoords.lat, initialCoords.lng],
        zoom: 5,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 18,
      }).addTo(map);

      const marker = L.marker([initialCoords.lat, initialCoords.lng], { draggable: true }).addTo(map);

      marker.on("dragend", async () => {
        const pos  = marker.getLatLng();
        const name = await reverseGeocode(pos.lat, pos.lng);
        onSelect({ lat: pos.lat, lng: pos.lng }, name);
      });

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        const name = await reverseGeocode(lat, lng);
        onSelect({ lat, lng }, name);
      });

      mapRef.current    = map;
      markerRef.current = marker;
    });

    return () => {
      isMounted = false; // Flag that the component has unmounted
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchPlace = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
      const data = await res.json();
      setResults(data);
    } catch { setResults([]); }
    setSearching(false);
  };

  const selectResult = (r: any) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], 10);
    }
    const name = r.address?.city || r.address?.town || r.address?.village || r.display_name;
    onSelect({ lat, lng }, name);
    setResults([]);
    setQuery(r.display_name);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f1117] transition-colors relative z-0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />

      {/* Search bar */}
      <div className="relative flex gap-2 p-2.5 bg-gray-50/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm border-b border-gray-200 dark:border-white/[0.06] flex-shrink-0 z-10">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && searchPlace()}
          placeholder="Search city or place…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-gray-950 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#fc4c02]/20 focus:border-[#fc4c02]/40 transition shadow-sm"
        />
        <button
          type="button"
          onClick={searchPlace}
          disabled={searching}
          className="px-4 py-2 rounded-lg bg-[#fc4c02] text-white text-sm font-semibold hover:bg-[#e04400] transition disabled:opacity-40 shadow-md shadow-[#fc4c02]/20"
        >
          {searching ? "…" : "Search"}
        </button>

        {results.length > 0 && (
          <div className="absolute top-[110%] left-2.5 right-2.5 z-[9999] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-left px-4 py-3 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] border-b border-gray-100 dark:border-white/[0.04] last:border-none transition font-medium"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1 z-0" style={{ minHeight: 0 }} />
    </div>
  );
}
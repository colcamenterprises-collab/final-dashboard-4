import { FormEvent, useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, MapPin, Search } from "lucide-react";

declare global {
  interface Window { L?: any; }
}

type Props = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (value: { address: string; latitude: number; longitude: number }) => void;
  label?: string;
  hint?: string;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise<any>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L), { once: true });
      existing.addEventListener("error", () => reject(new Error("Map failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Map failed to load"));
    document.body.appendChild(script);
  });
}

async function reverseGeocode(latitude: number, longitude: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) return "";
  const data = await response.json();
  return String(data?.display_name || "");
}

export default function LocationPicker({ address, latitude, longitude, onChange, label = "Location", hint }: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [query, setQuery] = useState(address || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { setQuery(address || ""); }, [address]);

  const applyPoint = async (lat: number, lng: number, preferredAddress?: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let nextAddress = preferredAddress || "";
    if (!nextAddress) {
      try { nextAddress = await reverseGeocode(lat, lng); } catch { /* keep existing address */ }
    }
    nextAddress = nextAddress || address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    onChange({ address: nextAddress, latitude: lat, longitude: lng });
    setQuery(nextAddress);
    setResults([]);
    if (mapRef.current) mapRef.current.setView([lat, lng], 17);
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else if (window.L && mapRef.current) markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
  };

  useEffect(() => {
    if (!mapNode.current) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapNode.current || mapRef.current) return;
      const initialLat = latitude ?? 7.7796;
      const initialLng = longitude ?? 98.3254;
      const map = L.map(mapNode.current, { zoomControl: true }).setView([initialLat, initialLng], latitude != null && longitude != null ? 16 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      if (latitude != null && longitude != null) markerRef.current = L.marker([latitude, longitude]).addTo(map);
      map.on("click", (event: any) => { void applyPoint(Number(event.latlng.lat), Number(event.latlng.lng)); });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 50);
    }).catch((error) => setMessage(error?.message || "Map failed to load."));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.L || latitude == null || longitude == null) return;
    if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
    else markerRef.current = window.L.marker([latitude, longitude]).addTo(mapRef.current);
  }, [latitude, longitude]);

  async function searchAddress(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 3) return setMessage("Enter at least 3 characters to search for an address or place.");
    setSearching(true); setMessage("");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("q", value);
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("countrycodes", "th");
      const response = await fetch(url.toString(), { headers: { Accept: "application/json", "Accept-Language": "en" } });
      if (!response.ok) throw new Error("Location search is temporarily unavailable.");
      const data = await response.json();
      const nextResults = Array.isArray(data) ? data as SearchResult[] : [];
      setResults(nextResults);
      if (!nextResults.length) setMessage("No matching location found. Try a venue name, road, hotel or nearby landmark.");
    } catch (error: any) { setMessage(error?.message || "Unable to search for this location."); }
    finally { setSearching(false); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return setMessage("Location is not available on this device.");
    setLocating(true); setMessage("");
    navigator.geolocation.getCurrentPosition((position) => {
      void applyPoint(position.coords.latitude, position.coords.longitude).finally(() => setLocating(false));
    }, () => { setMessage("Could not access this device location. Search for the address or tap the map instead."); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  const googleMapsUrl = latitude != null && longitude != null ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : "";

  return <div className="space-y-3">
    <div><div className="text-sm font-semibold text-neutral-800">{label}</div>{hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}</div>
    <form onSubmit={searchAddress} className="flex flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search address or place</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-neutral-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search address, venue, hotel or landmark" className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pl-10 pr-3 text-base outline-none focus:border-neutral-950" /></label>
      <button type="submit" disabled={searching} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{searching ? "Searching…" : "Search"}</button>
      <button type="button" onClick={useCurrentLocation} disabled={locating} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold text-neutral-800 disabled:opacity-50"><Crosshair size={16}/>{locating ? "Locating…" : "Current location"}</button>
    </form>
    {results.length > 0 && <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">{results.map((result) => <button key={`${result.lat}-${result.lon}`} type="button" onClick={() => void applyPoint(Number(result.lat), Number(result.lon), result.display_name)} className="block w-full border-b border-neutral-100 px-4 py-3 text-left text-sm text-neutral-700 last:border-b-0 hover:bg-neutral-50"><strong className="block text-neutral-950">{result.display_name.split(",")[0]}</strong><span className="mt-1 block text-xs text-neutral-500">{result.display_name}</span></button>)}</div>}
    <div ref={mapNode} className="h-72 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100" />
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600"><div className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0"/><div>{latitude != null && longitude != null ? <><strong className="block text-neutral-900">Pin selected</strong><span>{latitude.toFixed(6)}, {longitude.toFixed(6)}</span></> : <><strong className="block text-neutral-900">No pin selected</strong><span>Search above or tap the exact point on the map.</span></>}</div></div>{googleMapsUrl && <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-neutral-800 underline">Open in Google Maps <ExternalLink size={13}/></a>}</div>
    {message && <div className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900">{message}</div>}
  </div>;
}

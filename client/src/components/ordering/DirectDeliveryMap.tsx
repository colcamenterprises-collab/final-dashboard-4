import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, MapPin } from "lucide-react";

declare global {
  interface Window { L?: any; }
}

type Props = {
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
  radiusKm: number;
  latitude: number | null;
  longitude: number | null;
  onLocation: (latitude: number, longitude: number, distanceKm: number, inRange: boolean) => void;
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

export default function DirectDeliveryMap(props: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapError, setMapError] = useState("");
  const [locating, setLocating] = useState(false);

  const configured = Number.isFinite(props.restaurantLatitude) && Number.isFinite(props.restaurantLongitude) && props.radiusKm > 0;
  const currentDistance = useMemo(() => {
    if (!configured || props.latitude == null || props.longitude == null) return null;
    return distanceKm(props.restaurantLatitude!, props.restaurantLongitude!, props.latitude, props.longitude);
  }, [configured, props.restaurantLatitude, props.restaurantLongitude, props.latitude, props.longitude]);

  useEffect(() => {
    if (!configured || !mapNode.current) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapNode.current || mapRef.current) return;
      const map = L.map(mapNode.current, { zoomControl: true }).setView([props.latitude ?? props.restaurantLatitude!, props.longitude ?? props.restaurantLongitude!], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      L.circle([props.restaurantLatitude!, props.restaurantLongitude!], {
        radius: props.radiusKm * 1000,
        color: "#111827",
        weight: 2,
        fillColor: "#FFD400",
        fillOpacity: 0.08,
      }).addTo(map);
      const setPoint = (lat: number, lng: number) => {
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else markerRef.current = L.marker([lat, lng]).addTo(map);
        const km = distanceKm(props.restaurantLatitude!, props.restaurantLongitude!, lat, lng);
        props.onLocation(lat, lng, km, km <= props.radiusKm);
      };
      if (props.latitude != null && props.longitude != null) setPoint(props.latitude, props.longitude);
      map.on("click", (event: any) => setPoint(Number(event.latlng.lat), Number(event.latlng.lng)));
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 50);
    }).catch((error) => setMapError(error?.message || "Map failed to load"));
    return () => { cancelled = true; };
  }, [configured]);

  useEffect(() => {
    if (!mapRef.current || !window.L || props.latitude == null || props.longitude == null) return;
    const point = [props.latitude, props.longitude];
    if (markerRef.current) markerRef.current.setLatLng(point);
    else markerRef.current = window.L.marker(point).addTo(mapRef.current);
  }, [props.latitude, props.longitude]);

  function useMyLocation() {
    if (!navigator.geolocation) return setMapError("Location is not available on this device.");
    setLocating(true); setMapError("");
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const km = configured ? distanceKm(props.restaurantLatitude!, props.restaurantLongitude!, lat, lng) : 0;
      props.onLocation(lat, lng, km, configured ? km <= props.radiusKm : false);
      mapRef.current?.setView([lat, lng], 16);
      setLocating(false);
    }, () => { setMapError("We could not access your location. Drop the pin on the map instead."); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  if (!configured) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Delivery map is not configured yet.</strong><div className="mt-1 text-xs">The restaurant latitude, longitude and delivery radius must be set in Online Ordering → Settings before direct delivery can be accepted.</div></div>;

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div><div className="text-sm font-bold text-neutral-900">Choose your delivery location</div><div className="text-xs text-neutral-500">Use your location or tap the exact villa, hotel or building on the map.</div></div>
      <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-800 disabled:opacity-50"><Crosshair size={15}/>{locating ? "Locating…" : "Use my location"}</button>
    </div>
    <div ref={mapNode} className="h-64 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100" />
    {mapError && <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{mapError}</div>}
    {props.latitude != null && props.longitude != null && currentDistance != null && <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${currentDistance <= props.radiusKm ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}><MapPin size={17} className="mt-0.5 shrink-0"/><div><strong>{currentDistance <= props.radiusKm ? "Inside the delivery area" : "Outside the delivery area"}</strong><div className="text-xs opacity-80">Approximately {currentDistance.toFixed(2)} km from the restaurant · delivery radius {props.radiusKm.toFixed(1)} km.</div></div></div>}
  </div>;
}

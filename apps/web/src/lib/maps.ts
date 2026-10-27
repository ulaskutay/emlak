/** Google Maps JavaScript API'yi bir kez yükler (istemci). */
let mapsPromise: Promise<any> | null = null;
export function loadMaps(key: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  mapsPromise ??= new Promise((resolve, reject) => {
    w.__arsaMapsReady = () => resolve(w.google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=tr&region=TR&callback=__arsaMapsReady`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Haritalar yüklenemedi"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

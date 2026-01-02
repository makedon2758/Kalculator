declare global {
  interface Window { XLSX?: any; }
}

let _promise: Promise<any> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Load failed: " + src));
    document.head.appendChild(s);
  });
}

/**
 * Грузим XLSX локально: /vendor/xlsx.full.min.js
 * (файл должен лежать в renderer/public/vendor/)
 */
export async function ensureXlsx() {
  if (window.XLSX) return window.XLSX;

  if (!_promise) {
    _promise = (async () => {
      await loadScript("/vendor/xlsx.full.min.js");
      if (!window.XLSX) throw new Error("XLSX not available after load");
      return window.XLSX;
    })();
  }
  return _promise;
}

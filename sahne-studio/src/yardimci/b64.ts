/** UTF-8 güvenli base64url kodlama (URL parametrelerinde proje/parsel taşımak için). */
export function b64UrlKodla(metin: string): string {
  const baytlar = new TextEncoder().encode(metin);
  let ikili = "";
  for (const b of baytlar) ikili += String.fromCharCode(b);
  return btoa(ikili).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64UrlCoz(kod: string): string {
  const dolgu = "=".repeat((4 - (kod.length % 4)) % 4);
  const b64 = kod.replace(/-/g, "+").replace(/_/g, "/") + dolgu;
  const ikili = atob(b64);
  const baytlar = Uint8Array.from(ikili, (k) => k.charCodeAt(0));
  return new TextDecoder().decode(baytlar);
}

export function googleAnahtari(): string {
  return String(import.meta.env.VITE_GOOGLE_API_KEY ?? "").trim();
}

export interface UrlBayraklari {
  yakalaModu: boolean;
  aciNo: number | null;
  projeB64: string | null;
  parselB64: string | null;
  parselUrl: string | null;
  glbUrl: string | null;
}

export function urlBayraklari(arama: string = window.location.search): UrlBayraklari {
  const p = new URLSearchParams(arama);
  const b64Al = (ad: string): string | null => {
    const v = p.get(ad);
    if (!v) return null;
    return v.startsWith("b64:") ? v.slice(4) : v;
  };
  const aciHam = p.get("aci");
  return {
    yakalaModu: p.get("yakala") === "1",
    aciNo: aciHam !== null && aciHam !== "" ? Number(aciHam) : null,
    projeB64: b64Al("proje"),
    parselB64: b64Al("parsel"),
    parselUrl: p.get("parselUrl"),
    glbUrl: p.get("glbUrl"),
  };
}

import { b64UrlCoz } from "../yardimci/b64";
import { parselDogrula, type ParselPaketi } from "../semalar";
import type { UrlBayraklari } from "../yardimci/ortam";

export class ParselAlmaHatasi extends Error {
  hatalar: string[];
  constructor(hatalar: string[]) {
    super(hatalar.join(" · "));
    this.hatalar = hatalar;
  }
}

function jsonIsle(metin: string): ParselPaketi {
  let veri: unknown;
  try {
    veri = JSON.parse(metin);
  } catch {
    throw new ParselAlmaHatasi(["Geçersiz JSON — içerik ayrıştırılamadı"]);
  }
  const sonuc = parselDogrula(veri);
  if (!sonuc.tamam) throw new ParselAlmaHatasi(sonuc.hatalar);
  return sonuc.deger;
}

export function metindenParselAl(metin: string): ParselPaketi {
  return jsonIsle(metin);
}

export async function dosyadanParselAl(dosya: File): Promise<ParselPaketi> {
  const metin = await dosya.text();
  return jsonIsle(metin);
}

/** ?parsel=b64:... veya ?parselUrl=... ile gelen parseli çözer; yoksa null. */
export async function urldenParselAl(bayraklar: UrlBayraklari): Promise<ParselPaketi | null> {
  if (bayraklar.parselB64) {
    return jsonIsle(b64UrlCoz(bayraklar.parselB64));
  }
  if (bayraklar.parselUrl) {
    const yanit = await fetch(bayraklar.parselUrl);
    if (!yanit.ok) throw new ParselAlmaHatasi([`Parsel adresi okunamadı (HTTP ${yanit.status})`]);
    return jsonIsle(await yanit.text());
  }
  return null;
}

/** Köprüden (Parsel Pro Studio) son bırakılan paketi çeker; paket yoksa null. */
export async function koprudenParselAl(): Promise<ParselPaketi | null> {
  const yanit = await fetch("/api/parsel/son");
  if (yanit.status === 204) return null;
  if (!yanit.ok) throw new ParselAlmaHatasi([`Köprü yanıt vermedi (HTTP ${yanit.status})`]);
  return jsonIsle(await yanit.text());
}

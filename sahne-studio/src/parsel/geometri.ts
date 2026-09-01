/**
 * Saf geometri yardımcıları — Cesium'a bağımlı değildir, Node'da (vitest) test edilir.
 * Tüm koordinatlar EPSG:4326 [boylam, enlem] derecedir.
 */

export type LonLat = [number, number];

export class GeometriHatasi extends Error {}

const DUNYA_YARICAPI_M = 6371008.8;
const RAD = Math.PI / 180;

/** Yerel eşit-aralıklı düzleme izdüşüm (küçük parseller için fazlasıyla hassas). */
function yerelDuzlem(halka: LonLat[]) {
  const [lon0, lat0] = halka[0];
  const kx = Math.cos(lat0 * RAD);
  const noktalar = halka.map(([lon, lat]) => [(lon - lon0) * kx, lat - lat0] as LonLat);
  const geri = ([x, y]: LonLat): LonLat => [lon0 + x / kx, lat0 + y];
  return { noktalar, geri, kx };
}

function imzaliAlan(noktalar: LonLat[]): number {
  let toplam = 0;
  for (let i = 0; i < noktalar.length; i++) {
    const [x1, y1] = noktalar[i];
    const [x2, y2] = noktalar[(i + 1) % noktalar.length];
    toplam += x1 * y2 - x2 * y1;
  }
  return toplam / 2;
}

function dogruParcalariKesisiyor(a: LonLat, b: LonLat, c: LonLat, d: LonLat): boolean {
  const yon = (p: LonLat, q: LonLat, r: LonLat) => {
    const deger = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
    if (Math.abs(deger) < 1e-18) return 0;
    return deger > 0 ? 1 : 2;
  };
  const y1 = yon(a, b, c);
  const y2 = yon(a, b, d);
  const y3 = yon(c, d, a);
  const y4 = yon(c, d, b);
  return y1 !== y2 && y3 !== y4;
}

function kendiniKesiyorMu(noktalar: LonLat[]): boolean {
  const n = noktalar.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // komşu kenarlar ortak köşe paylaşır, atla
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const a = noktalar[i];
      const b = noktalar[(i + 1) % n];
      const c = noktalar[j];
      const d = noktalar[(j + 1) % n];
      if (dogruParcalariKesisiyor(a, b, c, d)) return true;
    }
  }
  return false;
}

/**
 * Ham GeoJSON halkasını normalleştirir: z bileşeni atılır, kapanış tekrarı silinir,
 * saat yönünün tersine (CCW) çevrilir; dejenere/kendini kesen halka reddedilir.
 */
export function halkaNormallestir(hamHalka: number[][]): LonLat[] {
  const noktalar = hamHalka.map((k) => [k[0], k[1]] as LonLat);
  if (noktalar.length >= 2) {
    const ilk = noktalar[0];
    const son = noktalar[noktalar.length - 1];
    if (Math.abs(ilk[0] - son[0]) < 1e-12 && Math.abs(ilk[1] - son[1]) < 1e-12) noktalar.pop();
  }
  if (noktalar.length < 3) throw new GeometriHatasi("parsel halkası en az 3 farklı köşe içermeli");

  const { noktalar: yerel } = yerelDuzlem(noktalar);
  const alan = imzaliAlan(yerel);
  if (Math.abs(alan) < 1e-14) throw new GeometriHatasi("parsel halkası çizgisel/dejenere görünüyor");

  const ccw = alan > 0 ? noktalar : [...noktalar].reverse();
  const { noktalar: ccwYerel } = yerelDuzlem(ccw);
  if (kendiniKesiyorMu(ccwYerel)) throw new GeometriHatasi("parsel halkası kendini kesiyor");
  return ccw;
}

/** Alan ağırlıklı merkez (eğik/çokgen parsellerde köşe ortalamasından doğrudur). */
export function merkezHesapla(halka: LonLat[]): LonLat {
  const { noktalar, geri } = yerelDuzlem(halka);
  const alan = imzaliAlan(noktalar);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < noktalar.length; i++) {
    const [x1, y1] = noktalar[i];
    const [x2, y2] = noktalar[(i + 1) % noktalar.length];
    const carpim = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * carpim;
    cy += (y1 + y2) * carpim;
  }
  return geri([cx / (6 * alan), cy / (6 * alan)]);
}

/** En uzun kenarın kuzeyden saat yönüne azimutu (derece, 0-360) — bina yönü önerisi. */
export function enUzunKenarAcisi(halka: LonLat[]): number {
  let enUzun = -1;
  let aci = 0;
  for (let i = 0; i < halka.length; i++) {
    const [lon1, lat1] = halka[i];
    const [lon2, lat2] = halka[(i + 1) % halka.length];
    const ortaLat = ((lat1 + lat2) / 2) * RAD;
    const dx = (lon2 - lon1) * Math.cos(ortaLat);
    const dy = lat2 - lat1;
    const uzunluk = dx * dx + dy * dy;
    if (uzunluk > enUzun) {
      enUzun = uzunluk;
      aci = (Math.atan2(dx, dy) / RAD + 360) % 360;
    }
  }
  return aci;
}

/** Parselin yaklaşık çapı (metre) — eğim yüzdesi ve kamera mesafeleri için. */
export function yaklasikCapM(halka: LonLat[]): number {
  const lonlar = halka.map((k) => k[0]);
  const latlar = halka.map((k) => k[1]);
  const ortaLat = ((Math.min(...latlar) + Math.max(...latlar)) / 2) * RAD;
  const genislikM = (Math.max(...lonlar) - Math.min(...lonlar)) * Math.cos(ortaLat) * RAD * DUNYA_YARICAPI_M;
  const yukseklikM = (Math.max(...latlar) - Math.min(...latlar)) * RAD * DUNYA_YARICAPI_M;
  return Math.max(genislikM, yukseklikM);
}

/** Bir noktadan verilen azimut yönünde metre cinsinden ötelenmiş koordinat. */
export function metreOtele([lon, lat]: LonLat, mesafeM: number, azimutDeg: number): LonLat {
  const dKuzeyM = mesafeM * Math.cos(azimutDeg * RAD);
  const dDoguM = mesafeM * Math.sin(azimutDeg * RAD);
  const dLat = dKuzeyM / (DUNYA_YARICAPI_M * RAD);
  const dLon = dDoguM / (DUNYA_YARICAPI_M * RAD * Math.cos(lat * RAD));
  return [lon + dLon, lat + dLat];
}

const TR_HARF: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

function asciiSlug(metin: string): string {
  return metin
    .split("")
    .map((h) => TR_HARF[h] ?? h)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Windows-güvenli, ASCII klasör adı: izmir-karsiyaka-1234-ada-5-parsel */
export function parselSlug(kimlik: { il: string; ilce: string; ada: string; parsel: string }): string {
  return [
    asciiSlug(kimlik.il),
    asciiSlug(kimlik.ilce),
    `${asciiSlug(kimlik.ada)}-ada`,
    `${asciiSlug(kimlik.parsel)}-parsel`,
  ]
    .filter(Boolean)
    .join("-");
}

/** Bir konumu metre cinsinden doğuya/kuzeye kaydırır (küçük mesafelerde düzlem yaklaşımı yeterli). */
export function metreKaydir(lon: number, lat: number, doguM: number, kuzeyM: number): LonLat {
  const metreBoylam = 111320 * Math.cos(lat * RAD);
  const metreEnlem = 111132;
  return [lon + doguM / metreBoylam, lat + kuzeyM / metreEnlem];
}

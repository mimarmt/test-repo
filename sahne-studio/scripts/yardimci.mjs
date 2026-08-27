import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** sahne-studio kök klasörü (scripts'in bir üstü). */
export const KOK = fileURLToPath(new URL("..", import.meta.url));

export function ortamYukle() {
  const yol = path.join(KOK, ".env");
  try {
    process.loadEnvFile(yol);
  } catch {
    // .env yoksa sorun değil — anahtar ortam değişkeninden de gelebilir
  }
}

export function bugunTarih() {
  return new Date().toISOString().slice(0, 10);
}

/** out/<slug>/<tarih>/aci-NN klasörünü oluşturur ve yolunu döner. */
export function aciKlasoru(cikisKoku, slug, tarih, aciNo) {
  const yol = path.join(cikisKoku, slug, tarih, `aci-${String(aciNo).padStart(2, "0")}`);
  mkdirSync(yol, { recursive: true });
  return yol;
}

/** metadata.json'u okuyup yamayı birleştirir; renderlar listesi eklemeli büyür. */
export function metadataBirlestir(klasor, yama) {
  const yol = path.join(klasor, "metadata.json");
  let eski = {};
  if (existsSync(yol)) {
    try {
      eski = JSON.parse(readFileSync(yol, "utf8"));
    } catch {
      eski = {};
    }
  }
  const yeni = {
    ...eski,
    ...yama,
    renderlar: [...(eski.renderlar ?? []), ...(yama.renderlar ?? [])],
  };
  writeFileSync(yol, JSON.stringify(yeni, null, 2));
  return yeni;
}

/** Basit argüman ayrıştırıcı: --ad deger çiftleri ve --bayrak'lar. */
export function argumanlar(argv, bayrakAdlari = []) {
  const sonuc = {};
  for (let i = 0; i < argv.length; i++) {
    const parca = argv[i];
    if (!parca.startsWith("--")) continue;
    const ad = parca.slice(2);
    if (bayrakAdlari.includes(ad)) {
      sonuc[ad] = true;
    } else {
      sonuc[ad] = argv[i + 1];
      i++;
    }
  }
  return sonuc;
}

export function b64url(metin) {
  return Buffer.from(metin, "utf8").toString("base64url");
}

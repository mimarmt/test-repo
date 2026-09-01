#!/usr/bin/env node
/**
 * Yakalanmış ham kareyi (raw.jpg) Gemini ile hiper-gerçekçi görsele dönüştürür.
 * Tüm kare dönüştürülür: gerçek çevre "şablon", AI "cila" — hiçbir yapı eklenmez/çıkarılmaz.
 *
 * Kullanım:
 *   node scripts/render.mjs --klasor out/<slug>/<tarih>/aci-01 --stil gunduz
 *   node scripts/render.mjs --klasor ... --stil gunduz,aksam --varyant 2
 *   node scripts/render.mjs --klasor ... --taslak            # ucuz/hızlı deneme modeli
 *   node scripts/render.mjs --klasor ... --kuru              # API çağrısı yok: plan + maliyet
 *
 * Modeller: varsayılan gemini-3-pro-image (4K, Nano Banana Pro); --taslak → gemini-3.1-flash-image (2K)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { KOK, argumanlar, metadataBirlestir, ortamYukle } from "./yardimci.mjs";

const arg = argumanlar(process.argv.slice(2), ["taslak", "kuru"]);

function hataylaCik(mesaj) {
  console.error(`✗ ${mesaj}`);
  process.exit(1);
}

if (!arg.klasor) hataylaCik("--klasor out/<slug>/<tarih>/aci-01 zorunlu");
const klasor = path.resolve(arg.klasor);
const hamYol = path.join(klasor, "raw.jpg");
if (!existsSync(hamYol)) hataylaCik(`raw.jpg bulunamadı: ${hamYol} — önce npm run yakala çalıştırın`);

ortamYukle();
const anahtar = String(process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY || "").trim();

const stilDosyasi = JSON.parse(readFileSync(path.join(KOK, "scripts", "stiller.json"), "utf8"));
const istenen = String(arg.stil ?? "gunduz")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const stiller = istenen.map((slug) => {
  const stil = stilDosyasi.stiller.find((s) => s.slug === slug);
  if (!stil) {
    hataylaCik(
      `Bilinmeyen stil: ${slug} — mevcut stiller: ${stilDosyasi.stiller.map((s) => s.slug).join(", ")}`
    );
  }
  return stil;
});

const varyantSayisi = Math.max(1, Number(arg.varyant ?? 1));
const taslak = Boolean(arg.taslak);
const modelId = arg.model ?? (taslak ? "gemini-3.1-flash-image" : "gemini-3-pro-image");
const imageSize = taslak ? "2K" : "4K";

const MALIYET_USD = {
  "gemini-3-pro-image": 0.24,
  "gemini-3.1-flash-image": 0.1,
};
const birimMaliyet = MALIYET_USD[modelId] ?? null;

// Geometri kilidi: gerçek çevre korunur, kare bütün olarak foto-gerçekçileşir
const ORTAK_GEOMETRI_KILIDI =
  "Transform this 3D scene capture into a single hyper-realistic architectural photograph. " +
  "Preserve every building, road, tree, vehicle and terrain form exactly in its place, shape and proportion. " +
  "Keep the camera angle, framing, horizon line and perspective identical to the input. " +
  "Do not add or remove any structures. Sharpen and photo-realistically re-render ALL of it together — " +
  "the surrounding city context (which may look soft or melted) AND the main building — so the result looks " +
  "like one real photograph taken in this exact real location. Keep the thin attribution bar at the very " +
  "bottom of the image untouched and legible. Style: ";

const gorevler = [];
for (const stil of stiller) {
  for (let v = 0; v < varyantSayisi; v++) gorevler.push(stil);
}

console.log(`Klasör : ${klasor}`);
console.log(`Model  : ${modelId} (${imageSize})`);
console.log(
  `İş     : ${stiller.map((s) => s.slug).join(", ")} × ${varyantSayisi} varyant = ${gorevler.length} görsel`
);
if (birimMaliyet !== null) {
  console.log(`Tahmini maliyet: ~$${(birimMaliyet * gorevler.length).toFixed(2)}`);
}

if (arg.kuru) {
  console.log("— Kuru mod: API çağrısı yapılmadı. Gerçek üretim için --kuru bayrağını kaldırın.");
  process.exit(0);
}

if (!anahtar) hataylaCik("GEMINI_API_KEY / VITE_GOOGLE_API_KEY boş — .env dosyasını doldurun");

const { GoogleGenAI } = await import("@google/genai");
const sharp = (await import("sharp")).default;

const ai = new GoogleGenAI({ apiKey: anahtar });
const hamVeri = readFileSync(hamYol);
const hamMeta = await sharp(hamVeri).metadata();
const genislik = hamMeta.width ?? 3840;
const yukseklik = hamMeta.height ?? 2160;
const bantYuksekligi = Math.max(28, Math.round(yukseklik * 0.024));
const atifSeridi = await sharp(hamVeri)
  .extract({ left: 0, top: yukseklik - bantYuksekligi, width: genislik, height: bantYuksekligi })
  .png()
  .toBuffer();

function sonrakiSurum(stilSlug) {
  const desen = new RegExp(`^render-${stilSlug}-v(\\d+)\\.jpg$`);
  let enBuyuk = 0;
  for (const ad of readdirSync(klasor)) {
    const eslesme = desen.exec(ad);
    if (eslesme) enBuyuk = Math.max(enBuyuk, Number(eslesme[1]));
  }
  return enBuyuk + 1;
}

async function beklet(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gorseliDonustur(stil) {
  const istek = {
    model: modelId,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: hamVeri.toString("base64") } },
          { text: ORTAK_GEOMETRI_KILIDI + stil.prompt },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "16:9", imageSize },
    },
  };

  let sonHata = null;
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      const yanit = await ai.models.generateContent(istek);
      const parcalar = yanit.candidates?.[0]?.content?.parts ?? [];
      const gorsel = parcalar.find((p) => p.inlineData?.data);
      if (!gorsel) {
        const metin = parcalar
          .filter((p) => p.text)
          .map((p) => p.text)
          .join(" ");
        throw new Error(`model görsel döndürmedi${metin ? ` — yanıt: ${metin.slice(0, 300)}` : ""}`);
      }
      return Buffer.from(gorsel.inlineData.data, "base64");
    } catch (h) {
      sonHata = h;
      const mesaj = h instanceof Error ? h.message : String(h);
      const geciciMi = /429|500|503|RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL/i.test(mesaj);
      if (!geciciMi || deneme === 2) break;
      const bekleme = 2000 * 2 ** deneme;
      console.log(`    geçici hata (${mesaj.slice(0, 80)}…) — ${bekleme / 1000} sn sonra tekrar`);
      await beklet(bekleme);
    }
  }
  throw sonHata;
}

for (const stil of gorevler) {
  const surum = sonrakiSurum(stil.slug);
  const dosyaAdi = `render-${stil.slug}-v${surum}.jpg`;
  process.stdout.write(`  → ${dosyaAdi} üretiliyor (${stil.ad})… `);
  const baslangic = Date.now();

  const aiGorsel = await gorseliDonustur(stil);

  // AI çıktısını ham kare boyutuna getir ve Google atıf şeridini deterministik olarak geri bas
  await sharp(aiGorsel)
    .resize(genislik, yukseklik, { fit: "fill" })
    .composite([{ input: atifSeridi, left: 0, top: yukseklik - bantYuksekligi }])
    .jpeg({ quality: 92 })
    .toFile(path.join(klasor, dosyaAdi));

  metadataBirlestir(klasor, {
    renderlar: [
      {
        dosya: dosyaAdi,
        model: modelId,
        stil: stil.slug,
        stilAdi: stil.ad,
        cozunurluk: `${genislik}x${yukseklik}`,
        tahminiMaliyetUSD: birimMaliyet,
        sureMs: Date.now() - baslangic,
        zaman: new Date().toISOString(),
      },
    ],
  });
  console.log(`tamam (${Math.round((Date.now() - baslangic) / 1000)} sn)`);
}

console.log(`✓ Bitti — renderlar: ${klasor}`);

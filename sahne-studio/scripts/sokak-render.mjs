#!/usr/bin/env node
/**
 * Gerçek Street View fotoğrafının içine projedeki modeli yerleştirir.
 *
 * Boru hattı:
 *   ① Parsel merkezine en yakın dış-mekân panoraması bulunur (Street View metadata API)
 *   ② O panodan parsele bakan ÇIPLAK fotoğraf çekilir (Static API — arayüz yazıları yoktur)
 *   ③ Aynı kamera konumundan (gerçek pano lat/lng, zemin+2,5 m) modelli 3D kare yakalanır
 *   ④ İki görsel Gemini'ye verilir: fotoğrafın boş parseline model foto-gerçekçi işlenir;
 *      çevre/ışık/kadraj aynen korunur; yazı ve bulanık yamalar temizlenir
 *   ⑤ Çıktının altına zorunlu Google atıf şeridi geri basılır
 *
 * Kullanım:
 *   node scripts/sokak-render.mjs --proje ./proje.json --glb ./bina.glb
 * Seçenekler:
 *   --pitch 15        kamera yukarı bakış (derece; varsayılan 0 = ufka dik)
 *   --fov 80          görüş açısı (10–120; varsayılan 80)
 *   --yukseklik 2.5   pano kamera yüksekliği, zemin üstü metre (Google aracı ≈2,5 m)
 *   --heading 183     bakış yönünü elle sabitle (varsayılan: panodan parsel merkezine)
 *   --kuru            Gemini'ye GİTMEZ — foto + 3D kare üretir, hizayı gözle kontrol için
 *   --taslak          ucuz model (gemini-3.1-flash-image, 2K, ~0,10 $) — varsayılan pro 4K
 *   --out out         çıkış kökü · --url http://localhost:4173 hazır sunucu kullan
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { KOK, argumanlar, b64url, bugunTarih, metadataBirlestir, ortamYukle } from "./yardimci.mjs";

const arg = argumanlar(process.argv.slice(2), ["kuru", "taslak"]);

function hataylaCik(mesaj) {
  console.error(`✗ ${mesaj}`);
  process.exit(1);
}

if (!arg.proje) hataylaCik("--proje ./proje.json zorunlu");
if (!arg.glb) hataylaCik("--glb ./bina.glb zorunlu — bu betiğin amacı modeli fotoğrafa yerleştirmek");
ortamYukle();

const projeYolu = path.resolve(arg.proje);
const glbYolu = path.resolve(arg.glb);
if (!existsSync(projeYolu)) hataylaCik(`proje dosyası yok: ${projeYolu}`);
if (!existsSync(glbYolu)) hataylaCik(`GLB yok: ${glbYolu}`);

let proje;
try {
  proje = JSON.parse(readFileSync(projeYolu, "utf8"));
} catch {
  hataylaCik("proje.json geçerli JSON değil");
}
if (!proje.parsel?.geometri?.coordinates?.[0]) hataylaCik("proje.json'da parsel geometrisi yok");
if (!proje.model?.konum) hataylaCik("proje.json'da model yerleşimi yok (zeminMedyanM gerekli)");

const googleAnahtar = String(process.env.VITE_GOOGLE_API_KEY ?? "").trim();
if (!googleAnahtar) hataylaCik("VITE_GOOGLE_API_KEY boş — Street View + Map Tiles için gerekli");

const pitchDeg = Number(arg.pitch ?? 0);
const fovDeg = Math.min(120, Math.max(10, Number(arg.fov ?? 80)));
const kameraYukselikM = Number(arg.yukseklik ?? 2.5);
const taslak = Boolean(arg.taslak);
const modelId = taslak ? "gemini-3.1-flash-image" : "gemini-3-pro-image";
const birimMaliyetUSD = taslak ? 0.1 : 0.24;

/* ---------- geometri yardımcıları (küçük mesafelerde düzlem yaklaşımı yeter) ---------- */

/**
 * Kapalı halkanın alan-ağırlıklı merkezi (shoelace). Dönen değer [lon, lat].
 * Koordinatlar önce ilk köşeye göre yerelleştirilir: 28,84×41,01 gibi büyük
 * sayıların çarpım farkı kayan noktada anlamlı basamak bırakmıyor ve merkez
 * parselin dışına düşüyordu (ölçüldü — projedeki eski hatalı merkezin kökü bu).
 */
function halkaMerkezi(halka) {
  const [x0, y0] = halka[0];
  let alan = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < halka.length - 1; i++) {
    const x1 = halka[i][0] - x0;
    const y1 = halka[i][1] - y0;
    const x2 = halka[i + 1][0] - x0;
    const y2 = halka[i + 1][1] - y0;
    const c = x1 * y2 - x2 * y1;
    alan += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  if (Math.abs(alan) < 1e-14) {
    const n = halka.length - 1;
    return [
      halka.slice(0, n).reduce((t, k) => t + k[0], 0) / n,
      halka.slice(0, n).reduce((t, k) => t + k[1], 0) / n,
    ];
  }
  alan *= 0.5;
  return [x0 + cx / (6 * alan), y0 + cy / (6 * alan)];
}

/** from → to pusula yönü, derece (0 = kuzey, 90 = doğu). Girdiler [lon, lat]. */
function azimutDeg(from, to) {
  const ortalamaLat = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const dDogu = (to[0] - from[0]) * Math.cos(ortalamaLat);
  const dKuzey = to[1] - from[1];
  return (Math.atan2(dDogu, dKuzey) * (180 / Math.PI) + 360) % 360;
}

/** İki [lon, lat] arası metre. */
function mesafeM(from, to) {
  const ortalamaLat = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const dDogu = (to[0] - from[0]) * Math.cos(ortalamaLat) * 111_320;
  const dKuzey = (to[1] - from[1]) * 111_320;
  return Math.hypot(dDogu, dKuzey);
}

/** [lon, lat] noktasını verilen pusula yönünde mesafeM metre öteler. */
function metreOtele(nokta, mesafe, azimut) {
  const rad = azimut * (Math.PI / 180);
  const dKuzey = Math.cos(rad) * mesafe;
  const dDogu = Math.sin(rad) * mesafe;
  return [
    nokta[0] + dDogu / (111_320 * Math.cos(nokta[1] * (Math.PI / 180))),
    nokta[1] + dKuzey / 111_320,
  ];
}

/* ---------- sunucu (capture.mjs ile aynı düzen) ---------- */

const npmKomutu = process.platform === "win32" ? "npm.cmd" : "npm";
let sunucu = null;
let temelUrl = arg.url ?? null;

async function sunucuBekle(adres, denemeSuresiMs = 90_000) {
  const baslangic = Date.now();
  while (Date.now() - baslangic < denemeSuresiMs) {
    try {
      const yanit = await fetch(adres, { redirect: "manual" });
      if (yanit.status < 500) return;
    } catch {
      // henüz hazır değil
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Sunucu ${adres} adresinde açılmadı`);
}

/** Anahtar derlemeye gömülür; dist'teki bayatsa sayfa kilit ekranında kalır. */
function derlemeAnahtariGuncelMi() {
  const varliklar = path.join(KOK, "dist", "assets");
  if (!existsSync(varliklar)) return false;
  return readdirSync(varliklar)
    .filter((ad) => ad.endsWith(".js"))
    .some((ad) => readFileSync(path.join(varliklar, ad), "utf8").includes(googleAnahtar));
}

/** src'de dist'ten yeni dosya varsa derleme bayattır (kod değişti, paket eski). */
function distKoddanEskiMi() {
  const distYolu = path.join(KOK, "dist", "index.html");
  if (!existsSync(distYolu)) return true;
  const { statSync } = fsSync;
  const distZamani = statSync(distYolu).mtimeMs;
  return readdirSync(path.join(KOK, "src"), { recursive: true })
    .filter((ad) => typeof ad === "string" && /\.(ts|css|html)$/.test(ad))
    .some((ad) => statSync(path.join(KOK, "src", ad)).mtimeMs > distZamani);
}

async function sunucuKur() {
  if (temelUrl) return;
  const distYok = !existsSync(path.join(KOK, "dist", "index.html"));
  if (distYok || !derlemeAnahtariGuncelMi() || distKoddanEskiMi()) {
    console.log(distYok ? "• dist yok — derleniyor…" : "• dist bayat (anahtar ya da kod değişmiş) — yeniden derleniyor…");
    await new Promise((coz, reddet) => {
      const derleme = spawn(npmKomutu, ["run", "build"], { cwd: KOK, stdio: "inherit" });
      derleme.on("exit", (kod) => (kod === 0 ? coz() : reddet(new Error(`build ${kod} koduyla bitti`))));
      derleme.on("error", reddet);
    });
  }
  console.log("• Önizleme sunucusu başlatılıyor (vite preview :4173)…");
  sunucu = spawn(npmKomutu, ["run", "preview"], { cwd: KOK, stdio: "ignore" });
  temelUrl = "http://localhost:4173";
  await sunucuBekle(temelUrl);
}

function sunucuKapat() {
  if (sunucu && !sunucu.killed) sunucu.kill("SIGTERM");
}

/* ---------- ana akış ---------- */

async function ana() {
  const halka = proje.parsel.geometri.coordinates[0];
  const merkez = halkaMerkezi(halka);
  const zeminM = Number(proje.model.konum.zeminMedyanM ?? 0);

  // ① Parsele en yakın dış-mekân panoraması (metadata çağrısı ücretsizdir)
  console.log(`• Parsel merkezi: ${merkez[1].toFixed(6)}, ${merkez[0].toFixed(6)} · zemin ${zeminM} m`);
  const metaAdres =
    "https://maps.googleapis.com/maps/api/streetview/metadata" +
    `?location=${merkez[1].toFixed(6)},${merkez[0].toFixed(6)}&radius=100&source=outdoor&key=${googleAnahtar}`;
  const meta = await (await fetch(metaAdres)).json();
  if (meta.status !== "OK") {
    hataylaCik(`Street View panoraması bulunamadı (status: ${meta.status}) — bu sokak çekilmemiş olabilir`);
  }
  const pano = [meta.location.lng, meta.location.lat];
  const panoUzaklikM = mesafeM(pano, merkez);
  const headingDeg = arg.heading !== undefined ? Number(arg.heading) : azimutDeg(pano, merkez);
  console.log(
    `• Pano: ${meta.pano_id} · çekim ${meta.date} · parsele ${panoUzaklikM.toFixed(1)} m · bakış ${headingDeg.toFixed(1)}°`
  );

  // Pano GPS'i birkaç metre şaşabilir; --geri N, 3D kamerayı bakış hattında N metre
  // geri çeker (fotoğraf değişmez). Şablondaki hayalet boşluğa oturana kadar ayarlanır.
  const geriM = Number(arg.geri ?? 0);
  const kameraKonum = geriM !== 0 ? metreOtele(pano, -geriM, headingDeg) : pano;

  const slug = proje.parselSlug ?? "parsel";
  const klasor = path.join(path.resolve(arg.out ?? path.join(KOK, "out")), slug, bugunTarih(), "sokak");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(klasor, { recursive: true });

  // ② Çıplak fotoğraf — Static API arayüz yazısı basmaz; yalnız köşede küçük © kalır
  const fotoAdres =
    "https://maps.googleapis.com/maps/api/streetview" +
    `?size=640x640&pano=${meta.pano_id}&heading=${headingDeg.toFixed(2)}&pitch=${pitchDeg}&fov=${fovDeg}&key=${googleAnahtar}`;
  const fotoYanit = await fetch(fotoAdres);
  if (!fotoYanit.ok) hataylaCik(`Fotoğraf indirilemedi: HTTP ${fotoYanit.status}`);
  const fotoVeri = Buffer.from(await fotoYanit.arrayBuffer());
  const fotoYol = path.join(klasor, "sokak-foto.jpg");
  writeFileSync(fotoYol, fotoVeri);
  console.log(`• Fotoğraf indirildi (${(fotoVeri.length / 1024).toFixed(0)} KB) → ${fotoYol}`);

  // ③ Aynı kameradan modelli 3D kare. Modelin konumu proje dosyasından DEĞİL,
  //    parsel geometrisinden hesaplanır — dosyadaki konum bayat olabilir.
  const simdi = new Date().toISOString();
  const sentetikProje = {
    ...proje,
    olusturma: proje.olusturma ?? simdi,
    guncelleme: simdi,
    model: {
      ...proje.model,
      konum: { lon: merkez[0], lat: merkez[1], zeminMedyanM: zeminM },
    },
    acilar: [
      {
        aciNo: 99,
        ad: "Sokak panosu",
        enBoyOrani: "16:9", // şema bu değeri şart koşuyor; kadraj yine kare pencerede alınır
        onayTarihi: simdi,
        kamera: {
          lon: kameraKonum[0],
          lat: kameraKonum[1],
          yukseklikM: zeminM + kameraYukselikM,
          headingDeg,
          pitchDeg,
          rollDeg: 0,
          fovDeg, // kare pencerede Cesium bunu düşey alır; kare olduğundan yatayla aynıdır
        },
        gunesISO: proje.gunesISO ?? simdi,
      },
    ],
  };

  await sunucuKur();
  console.log("• 3D kare yakalanıyor (1920×1920, aynı pano kamerası)…");
  const tarayici = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--hide-scrollbars"] });
  let sahneYol;
  let modelYalnizYol;
  let atif = "Google";
  try {
    const sayfa = await tarayici.newPage({ viewport: { width: 1920, height: 1920 }, deviceScaleFactor: 1 });
    const glbVeri = readFileSync(glbYolu);
    await sayfa.route("**/sahne-model.glb", (rota) =>
      rota.fulfill({ body: glbVeri, contentType: "model/gltf-binary" })
    );

    // Doku akışını ağdan izle: sokak seviyesinde ince kademe (LOD) geç gelir;
    // "hazır" bayrağından sonra ağ susana kadar beklemek kaba dokuyu önler.
    let sonDokuYaniti = Date.now();
    let dokuHatasi = 0;
    sayfa.on("response", (yanit) => {
      const adres = yanit.url();
      if (!/googleapis\.com|google\.com/.test(adres)) return;
      sonDokuYaniti = Date.now();
      if (yanit.status() >= 400) {
        dokuHatasi++;
        if (dokuHatasi <= 5) console.log(`  ! doku isteği ${yanit.status()}: ${adres.slice(0, 110)}`);
      }
    });
    sayfa.on("console", (mesaj) => {
      if (mesaj.type() === "error") console.log(`  ! sayfa konsolu: ${mesaj.text().slice(0, 200)}`);
    });

    const parametreler = new URLSearchParams({ yakala: "1", aci: "99", isik: "kamera" });
    parametreler.set("proje", `b64:${b64url(JSON.stringify(sentetikProje))}`);
    parametreler.set("glbUrl", "/sahne-model.glb");
    await sayfa.goto(`${temelUrl}/?${parametreler.toString()}`, { waitUntil: "domcontentloaded" });
    try {
      await sayfa.waitForFunction(() => window.__SAHNE_HAZIR || window.__SAHNE_HATA, undefined, {
        timeout: 180_000,
      });
    } catch {
      const kilitli = await sayfa.evaluate(() => Boolean(document.getElementById("kilit-ekrani")));
      throw new Error(
        kilitli
          ? "sayfa kilit ekranında kaldı — anahtar derlemeye girmemiş (npm run build)"
          : "sahne 180 sn içinde hazır olmadı"
      );
    }
    const hata = await sayfa.evaluate(() => window.__SAHNE_HATA ?? null);
    if (hata) throw new Error(`sayfa hatası: ${hata}`);
    atif = await sayfa.evaluate(() => window.__SAHNE_ATIF ?? "Google");

    // Ağ 5 sn susana kadar (en çok --bekle sn) doku akışına süre tanı
    const azamiMs = Number(arg.bekle ?? 45) * 1000;
    const susmaMs = 5000;
    const beklemeBasi = Date.now();
    while (Date.now() - sonDokuYaniti < susmaMs && Date.now() - beklemeBasi < azamiMs) {
      await sayfa.waitForTimeout(500);
    }
    if (dokuHatasi > 0) console.log(`  ! toplam ${dokuHatasi} doku isteği hata verdi`);
    const sayac = await sayfa
      .evaluate(() => (window.__SAHNE_SAYAC ? window.__SAHNE_SAYAC() : null))
      .catch(() => null);
    if (sayac) console.log(`  · doku sayaçları: ${JSON.stringify(sayac)}`);
    await sayfa.waitForTimeout(1000);
    sahneYol = path.join(klasor, "sahne-3d.jpg");
    await sayfa.screenshot({ path: sahneYol, type: "jpeg", quality: 92 });
    console.log(`• 3D kare hazır → ${sahneYol}`);

    // Aynı kadrajda YALNIZ model (mor fon): ölçek şablonunun ham malzemesi
    await sayfa.evaluate(() => window.__SAHNE_MODELYALNIZ?.(true));
    await sayfa.waitForTimeout(800);
    modelYalnizYol = path.join(klasor, "model-yalniz.png");
    await sayfa.screenshot({ path: modelYalnizYol, type: "png" });
  } finally {
    await tarayici.close();
    sunucuKapat();
  }

  metadataBirlestir(klasor, {
    parselSlug: slug,
    sokak: {
      panoId: meta.pano_id,
      panoTarihi: meta.date,
      panoKonum: { lat: pano[1], lon: pano[0] },
      parseleUzaklikM: Number(panoUzaklikM.toFixed(1)),
      headingDeg: Number(headingDeg.toFixed(2)),
      pitchDeg,
      fovDeg,
      kameraYukselikM,
    },
    atif,
  });

  // ④a Ölçek şablonu: mor fonlu kareden modeli ayıkla, fotoğrafın üstüne yarı saydam bindir.
  //    Gemini'ye "binayı TAM hayaletin yerine, TAM o boyutta koy" diyebilmek için —
  //    salt 3D referans verildiğinde model küçültülüp geri itiliyordu (ölçüldü, v1-v2).
  const sharp = (await import("sharp")).default;
  const { data: mp, info: mBilgi } = await sharp(modelYalnizYol)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < mp.length; i += 4) {
    const r = mp[i];
    const g = mp[i + 1];
    const b = mp[i + 2];
    if (r > 170 && b > 170 && g < 110) mp[i + 3] = 0; // mor fon → şeffaf
    else mp[i + 3] = 175; // model → ~%69 örtücü hayalet
  }
  const modelKesik = await sharp(mp, {
    raw: { width: mBilgi.width, height: mBilgi.height, channels: 4 },
  })
    .resize(640, 640)
    .png()
    .toBuffer();
  const sablonYol = path.join(klasor, "sablon.jpg");
  await sharp(fotoVeri).composite([{ input: modelKesik }]).jpeg({ quality: 92 }).toFile(sablonYol);
  console.log(`• Ölçek şablonu hazır → ${sablonYol}`);

  if (arg.kuru) {
    console.log("— Kuru mod: Gemini çağrılmadı. Hizayı üç dosyada gözle karşılaştırın:");
    console.log(`  Fotoğraf : ${fotoYol}`);
    console.log(`  3D kare  : ${sahneYol}`);
    console.log(`  Şablon   : ${sablonYol}`);
    return;
  }

  // ④b Gemini birleştirmesi
  const geminiAnahtar = String(process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY || "").trim();
  if (!geminiAnahtar) hataylaCik("GEMINI_API_KEY boş");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: geminiAnahtar });

  const komut =
    "Image 1 is a real Google Street View photograph of a street with an empty plot between two buildings. " +
    "Image 2 is the SAME photograph with the new building's 3D massing model superimposed as a semi-transparent " +
    "overlay — it marks the building's EXACT position, width, height and roof line in this exact camera frame. " +
    "Image 3 is the full 3D render of that building: read storey count, window layout, facade colours and roof " +
    "shape from it. " +
    "Task: produce ONE photorealistic photograph — Image 1 with the new building constructed on the empty plot. " +
    "The building's silhouette in your output must match the overlay in Image 2 PIXEL-ACCURATELY: same footprint, " +
    "same edges, same roof ridge height, same width. Do not shrink it, do not push it back, do not re-centre it. " +
    "Keep everything else from Image 1 exactly as it is: neighbouring buildings, street, pavement, vehicles, poles, " +
    "bins, vegetation, sky, lighting and framing. Street objects that overlap the ghost (pole, wires, bins, cars) " +
    "stay IN FRONT of the new building. Render realistic facade materials using Image 3's colours, with grounding " +
    "and shadows that match the sun in Image 1. " +
    "Cleanup requirements: the output must contain NO text of any kind — no watermarks, captions, logos, street names " +
    "or UI elements. Replace any blurred patches in the photograph (faces, licence plates, blurred areas at the " +
    "bottom edge) with sharp, plausible photographic detail. The result must look like a single clean real photograph.";

  console.log(`• Gemini birleştiriyor (${modelId}, ~$${birimMaliyetUSD.toFixed(2)})…`);
  const baslangic = Date.now();
  const istek = {
    model: modelId,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: fotoVeri.toString("base64") } },
          { inlineData: { mimeType: "image/jpeg", data: readFileSync(sablonYol).toString("base64") } },
          { inlineData: { mimeType: "image/jpeg", data: readFileSync(sahneYol).toString("base64") } },
          { text: komut },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "1:1", imageSize: taslak ? "2K" : "4K" },
    },
  };

  let sonHata = null;
  let aiGorsel = null;
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      const yanit = await ai.models.generateContent(istek);
      const parcalar = yanit.candidates?.[0]?.content?.parts ?? [];
      const gorsel = parcalar.find((p) => p.inlineData?.data);
      if (!gorsel) {
        const metin = parcalar.filter((p) => p.text).map((p) => p.text).join(" ");
        throw new Error(`model görsel döndürmedi${metin ? ` — yanıt: ${metin.slice(0, 300)}` : ""}`);
      }
      aiGorsel = Buffer.from(gorsel.inlineData.data, "base64");
      break;
    } catch (h) {
      sonHata = h;
      const mesaj = h instanceof Error ? h.message : String(h);
      if (!/429|500|503|RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL/i.test(mesaj) || deneme === 2) break;
      const bekleme = 2000 * 2 ** deneme;
      console.log(`    geçici hata — ${bekleme / 1000} sn sonra tekrar`);
      await new Promise((r) => setTimeout(r, bekleme));
    }
  }
  if (!aiGorsel) throw sonHata ?? new Error("Gemini görsel üretmedi");

  // ⑤ Zorunlu atıf şeridi (Google verisinden türetildi — kullanım şartı; kırpılmaz)
  const aiMeta = await sharp(aiGorsel).metadata();
  const gen = aiMeta.width ?? 2048;
  const yuk = aiMeta.height ?? 2048;
  const bant = Math.max(24, Math.round(yuk * 0.022));
  const atifSvg = Buffer.from(
    `<svg width="${gen}" height="${bant}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="black" fill-opacity="0.55"/>` +
      `<text x="${Math.round(bant * 0.5)}" y="${Math.round(bant * 0.7)}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${Math.round(bant * 0.55)}" fill="white">© Google Street View (${meta.date}) · AI birleştirme: Sahne Studio</text>` +
      `</svg>`
  );
  let surum = 1;
  while (existsSync(path.join(klasor, `sokak-render-v${surum}.jpg`))) surum++;
  const cikisYol = path.join(klasor, `sokak-render-v${surum}.jpg`);
  await sharp(aiGorsel)
    .composite([{ input: atifSvg, left: 0, top: yuk - bant }])
    .jpeg({ quality: 92 })
    .toFile(cikisYol);

  metadataBirlestir(klasor, {
    renderlar: [
      {
        dosya: path.basename(cikisYol),
        model: modelId,
        cozunurluk: `${gen}x${yuk}`,
        tahminiMaliyetUSD: birimMaliyetUSD,
        sureMs: Date.now() - baslangic,
        zaman: new Date().toISOString(),
      },
    ],
  });
  console.log(`✓ Bitti (${Math.round((Date.now() - baslangic) / 1000)} sn) → ${cikisYol}`);
}

ana().catch((h) => {
  sunucuKapat();
  hataylaCik(h instanceof Error ? h.message : String(h));
});

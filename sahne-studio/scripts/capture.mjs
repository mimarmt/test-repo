#!/usr/bin/env node
/**
 * Onaylı açıların 4K karelerini headless tarayıcıyla üretir.
 *
 * Kullanım:
 *   node scripts/capture.mjs --proje ./proje.json --glb ./bina.glb            # tüm açılar
 *   node scripts/capture.mjs --proje ./proje.json --glb ./bina.glb --aci 2    # tek açı
 *   node scripts/capture.mjs --proje ornekler/ornek-proje.json --sahte        # API'siz kuru test
 *
 * Diğer seçenekler: --url http://localhost:4173 (hazır sunucu), --out out (çıkış kökü)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { KOK, aciKlasoru, argumanlar, b64url, bugunTarih, metadataBirlestir, ortamYukle } from "./yardimci.mjs";

const arg = argumanlar(process.argv.slice(2), ["sahte"]);

function hataylaCik(mesaj) {
  console.error(`✗ ${mesaj}`);
  process.exit(1);
}

if (!arg.proje) hataylaCik("--proje ./proje.json zorunlu (uygulamadan 'proje.json indir' ile alınır)");
ortamYukle();

const projeYolu = path.resolve(arg.proje);
if (!existsSync(projeYolu)) hataylaCik(`proje dosyası bulunamadı: ${projeYolu}`);
const projeMetni = readFileSync(projeYolu, "utf8");
let proje;
try {
  proje = JSON.parse(projeMetni);
} catch {
  hataylaCik("proje.json geçerli JSON değil");
}
if (!proje.parselSlug || !Array.isArray(proje.acilar)) hataylaCik("proje.json beklenen alanları içermiyor");

const sahte = Boolean(arg.sahte);
if (!sahte && !String(process.env.VITE_GOOGLE_API_KEY ?? "").trim()) {
  hataylaCik("VITE_GOOGLE_API_KEY boş — .env dosyasını doldurun (gerçek yakalama için gerekli)");
}

let glbYolu = null;
if (arg.glb) {
  glbYolu = path.resolve(arg.glb);
  if (!existsSync(glbYolu)) hataylaCik(`GLB bulunamadı: ${glbYolu}`);
} else if (!sahte && proje.model) {
  hataylaCik(`--glb ./${proje.model.dosyaAdi} verin — projede model yerleşimi var`);
}

const acilar = arg.aci
  ? proje.acilar.filter((a) => a.aciNo === Number(arg.aci))
  : proje.acilar;
if (acilar.length === 0) {
  if (sahte) acilar.push({ aciNo: 1, ad: "sahte", kamera: null, gunesISO: "" });
  else hataylaCik(arg.aci ? `Açı ${arg.aci} projede yok` : "Projede onaylı açı yok");
}

const cikisKoku = path.resolve(arg.out ?? path.join(KOK, "out"));
const tarih = bugunTarih();

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

/**
 * Anahtar derleme anında paketin içine gömülür (VITE_ öneki). `.env` sonradan
 * değiştirilirse eldeki dist eski/boş anahtarla kalır; sayfa kilit ekranında
 * takılır ve beklemek anlamsız bir zaman aşımıyla biter. Onun yerine paketin
 * içinde güncel anahtar var mı diye bakıp gerekirse yeniden derliyoruz.
 */
function derlemeAnahtariGuncelMi() {
  const anahtar = String(process.env.VITE_GOOGLE_API_KEY ?? "").trim();
  if (!anahtar) return true; // sahte mod: anahtar aranmaz
  const varliklar = path.join(KOK, "dist", "assets");
  if (!existsSync(varliklar)) return false;
  return readdirSync(varliklar)
    .filter((ad) => ad.endsWith(".js"))
    .some((ad) => readFileSync(path.join(varliklar, ad), "utf8").includes(anahtar));
}

async function sunucuKur() {
  if (temelUrl) return;
  const distYok = !existsSync(path.join(KOK, "dist", "index.html"));
  if (distYok || !derlemeAnahtariGuncelMi()) {
    console.log(
      distYok
        ? "• dist yok — önce derleniyor (npm run build)…"
        : "• dist'teki anahtar .env ile uyuşmuyor — yeniden derleniyor (npm run build)…"
    );
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

async function ana() {
  await sunucuKur();
  console.log(`• Tarayıcı açılıyor (3840×2160) — ${acilar.length} açı yakalanacak`);
  const tarayici = await chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--hide-scrollbars"],
  });
  try {
    const sayfa = await tarayici.newPage({
      viewport: { width: 3840, height: 2160 },
      deviceScaleFactor: 1,
    });

    if (glbYolu) {
      const glbVeri = readFileSync(glbYolu);
      await sayfa.route("**/sahne-model.glb", (rota) =>
        rota.fulfill({ body: glbVeri, contentType: "model/gltf-binary" })
      );
    }

    for (const aci of acilar) {
      const baslangic = Date.now();
      const klasor = aciKlasoru(cikisKoku, proje.parselSlug, tarih, aci.aciNo);
      const parametreler = new URLSearchParams({ yakala: "1", aci: String(aci.aciNo) });
      parametreler.set("proje", `b64:${b64url(projeMetni)}`);
      if (glbYolu) parametreler.set("glbUrl", "/sahne-model.glb");
      const adres = `${temelUrl}/?${parametreler.toString()}`;

      process.stdout.write(`  → Açı ${String(aci.aciNo).padStart(2, "0")} (${aci.ad ?? ""}) yükleniyor… `);
      await sayfa.goto(adres, { waitUntil: "domcontentloaded" });

      let atif = "Google";
      if (sahte) {
        // API anahtarı yok: kilit ekranı ya da hata mesajı görünene kadar bekle,
        // boru hattının (sunucu → sayfa → ekran görüntüsü → klasör) çalıştığını kanıtla
        await sayfa
          .waitForSelector("#kilit-ekrani, #sahne-mesaj:not([hidden])", { timeout: 30_000 })
          .catch(() => {});
        atif = "Google (sahte test — gerçek doku yok)";
      } else {
        try {
          await sayfa.waitForFunction(() => window.__SAHNE_HAZIR || window.__SAHNE_HATA, undefined, {
            timeout: 180_000,
          });
        } catch (h) {
          // En sık sebep: sayfa anahtarsız açıldığı için kilit ekranında bekliyor.
          // Çıplak "Timeout" mesajı bunu göstermiyor; sebebi ayırt edip söylüyoruz.
          const kilitli = await sayfa.evaluate(() => Boolean(document.getElementById("kilit-ekrani")));
          throw new Error(
            kilitli
              ? "sayfa kilit ekranında kaldı — VITE_GOOGLE_API_KEY .env'de yok ya da derlemeye girmemiş (npm run build)"
              : `sahne 180 sn içinde hazır olmadı (${h instanceof Error ? h.message : String(h)})`
          );
        }
        const hata = await sayfa.evaluate(() => window.__SAHNE_HATA ?? null);
        if (hata) throw new Error(`sayfa hatası: ${hata}`);
        atif = await sayfa.evaluate(() => window.__SAHNE_ATIF ?? "Google");
        await sayfa.waitForTimeout(500);
      }

      const hamYol = path.join(klasor, "raw.jpg");
      await sayfa.screenshot({ path: hamYol, type: "jpeg", quality: 92 });

      metadataBirlestir(klasor, {
        parselSlug: proje.parselSlug,
        tarih,
        aci: `aci-${String(aci.aciNo).padStart(2, "0")}`,
        aciAdi: aci.ad ?? "",
        kamera: aci.kamera ?? null,
        gunesISO: aci.gunesISO ?? null,
        model: proje.model
          ? {
              dosyaAdi: proje.model.dosyaAdi,
              headingDeg: proje.model.headingDeg,
              yukseklikOfsetM: proje.model.yukseklikOfsetM,
              olcek: proje.model.olcek,
            }
          : null,
        yakalama: {
          cozunurluk: "3840x2160",
          sahte,
          sureMs: Date.now() - baslangic,
          zaman: new Date().toISOString(),
        },
        atif,
      });
      console.log(`tamam (${Math.round((Date.now() - baslangic) / 1000)} sn) → ${hamYol}`);
    }
  } finally {
    await tarayici.close();
    sunucuKapat();
  }
  console.log(`✓ Bitti — kareler: ${path.join(cikisKoku, proje.parselSlug, tarih)}`);
  console.log("  Sıradaki adım: npm run render -- --klasor <yukarıdaki klasör>/aci-01 --stil gunduz");
}

ana().catch((h) => {
  sunucuKapat();
  hataylaCik(h instanceof Error ? h.message : String(h));
});

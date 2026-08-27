# SAHNE STUDIO — DEVİR NOTU

> Bu not, projeye başka bir Claude oturumunda kaldığı yerden devam edebilmek için hazırlandı.
> Yeni oturum: önce bu dosyayı, sonra `gercek-cevre-render-yol-haritasi.md` ve
> `sahne-studio/README.md` dosyalarını oku. **Sıfırdan bir şey kurma — her şey hazır, görev
> aşağıdaki "Sıradaki adımlar"dan devam etmek.**

## Proje nedir?

Kullanıcı (Murat, mimar) SketchUp'ta bina modelliyor. Sorun: AI'ya çevre ürettirince "uydurma"
oluyor. Çözüm — **Sahne Studio**: Parsel Pro Studio'daki (kullanıcının TKGM parsel verisi çeken
mevcut uygulaması) gerçek parsel koordinatı alınır → tarayıcıda CesiumJS + **Google
Photorealistic 3D Tiles** ile gerçek 3D şehir dokusu açılır, kamera parsele uçar → parseldeki
mevcut bina **clipping polygon** ile dokudan silinir → SketchUp 2025'ten alınan **GLB** model
gerçek arazi kotuna oturtulur (zemin örnekleme) → kullanıcı güneşi ayarlar, beğendiği açıları
**onaylar** → her onaylı açı headless tarayıcıda (Playwright) **3840×2160** yakalanır → kare
**Gemini** ile hiper-gerçekçi tek fotoğrafa dönüştürülür → `out/<parsel>/<tarih>/aci-NN/`
klasörüne metadata ile dosyalanır.

## Kritik yaklaşım (kullanıcının netleştirdiği, değiştirme!)

1. **Tam-kare dönüşüm:** Arka plan MASKELENMEZ/kilitlenmez. Google karesi bulanık da olsa
   "referans altlıktır"; AI **tüm kareyi** (bina + gerçek çevre birlikte) foto-gerçekçi yapar.
   Geometriyi koruyan şey prompt'taki geometri kilidi (hiçbir yapı ekleme/çıkarma, kadraj aynı)
   ve ileride derinlik/kenar ControlNet. Bina maskesi yalnız opsiyonel malzeme-sadakati aracı.
2. **Zemin uyumu 3D sahnede çözülür:** model, kot örneklemesiyle (merkez+köşeler, medyan)
   gerçek eğime oturur; AI'ya giden karede perspektif/ölçek/zemin teması zaten doğrudur.
3. Aynı mantık kullanıcının alışık olduğu akış: "SketchUp JPG → AI → gerçekçi" — tek fark,
   JPG'nin içinde artık gerçek çevre de var.

## Kilit kararlar (soru-cevapla alındı)

- Önce **bağımsız web uygulaması**; Parsel Pro'ya köprüyle bağlanır (`sahne-studio/docs/parsel-pro-koprusu.md`).
- Ofis içi, tek kullanıcı, **Mac'te localhost**, Türkçe arayüz.
- AI: **Gemini API** — varsayılan `gemini-3-pro-image` (Nano Banana Pro, 4K, ~0,24 $/görsel;
  `--taslak` → `gemini-3.1-flash-image` 2K ~0,10 $). Kullanıcının Google anahtarı VAR;
  anahtarda Map Tiles API + Gemini API etkin olmalı, referrer kısıtı olmamalı.
- SketchUp **2025** (doğal GLB dışa aktarımı). Çalışma bölgesi: büyükşehirler (kapsama riski düşük).

## Yapılanlar (hepsi bu depoda, dal: `claude/architectural-render-real-context-w7f66k`)

1. **`gercek-cevre-render-yol-haritasi.md`** — teknoloji araştırması + F0–F4 yol haritası (özet aşağıda).
2. **`sahne-studio/`** — çalışan MVP (39 dosya): Vite+TS+CesiumJS uygulaması (parsel girişi:
   köprü/URL-b64/dosya/yapıştır; uçuş, sınır çizimi, clipping, GLB yerleştirme + kot/yön/ölçek,
   güneş, kamera presetleri, açı onayı, proje.json, tarayıcıda 4K JPG) + `scripts/capture.mjs`
   (headless 4K, `--sahte` kuru test) + `scripts/render.mjs` (Gemini tam-kare dönüşüm, 6 stil
   preseti `scripts/stiller.json`, atıf şeridini sharp ile geri basma, `--taslak`/`--kuru`).
3. **Doğrulama:** build temiz · 25 birim test · 5 Playwright duman testi · sahte yakalama
   3840×2160 üretti · render kuru modu maliyet planı bastı. (Gerçek anahtar/doku testi HENÜZ
   yapılmadı — sıradaki iş bu.)
4. **Yol haritası artifact sayfası:** https://claude.ai/code/artifact/bd0beefa-d248-4065-a383-f0a45247d57b
5. Önceki oturum: https://claude.ai/code/session_01M4jsPfDFNYT7CxMUSDSBYC

## Yol haritası özeti (tam hali `gercek-cevre-render-yol-haritasi.md`)

- **F0 Kavram kanıtı (elle):** SketchUp→KMZ→Google Earth Pro görüntüsü→Gemini'ye "kadrajı ve
  çevreyi koruyarak foto-gerçekçi yap" — kalite çıtası + kapsama testi.
- **F1 Kodsuz hat:** D5 Render 3.0 Cesium entegrasyonu (Google 3D Tiles tek tık) — manuel en
  yüksek kalite seçeneği.
- **F2 Sahne Studio MVP:** ✅ YAPILDI (yukarıda).
- **F3 Tam otomasyon:** ✅ Betikler yapıldı; kalan: gerçek uçtan uca test, stil ince ayarı,
  onay/karşılaştırma paneli, Gemini **Batch** modu (%50 ucuz), Flux depth-ControlNet yedek
  sağlayıcı (fal.ai/Replicate `flux-depth-dev` ~0,025 $ — geometri sadakati gerekirse).
- **F4 Üst seviye (sonra):** Veo 3.1 image-to-video klip; drone → Gaussian splat (CesiumJS
  1.139+ destekliyor); UE5+Cesium sinematik; müşteri portalı.
- **Riskler:** Google atıfı her karede görünür kalmalı (kod bunu garanti ediyor, kırpma!);
  AI-türev içerik ToS gri alanı → teslimlerde kaynak belirt; doku sokak seviyesinde yumuşak →
  en iyi açılar 30–45° kuş bakışı; dönüşüm şiddeti arttıkça çevre detayı kayabilir.

## Sıradaki adımlar (bu sırayla)

1. **Mac kurulumu + ilk gerçek test** (kullanıcıyla birlikte):
   ```bash
   git clone https://github.com/mimarmt/test-repo && cd test-repo/sahne-studio
   git checkout claude/architectural-render-real-context-w7f66k
   npm install && npx playwright install chromium
   cp .env.example .env   # VITE_GOOGLE_API_KEY=... yapıştırılacak
   npm run dev            # http://localhost:5173 → ornekler/ornek-parsel.json sürükle
   ```
   Beklenen: kamera İzmir örnek parsele uçar, doku gelir, sınır çizilir, mevcut doku silinir,
   kot tablosu dolar. Hata çıkarsa aynen düzelt, dala push et.
2. Kullanıcının **gerçek parseli + GLB'siyle** uçtan uca: açı onayı → `npm run yakala` →
   `npm run render -- --taslak` → sonucu değerlendir, stil promptlarını ince ayarla.
3. **Parsel Pro entegrasyonu:** kullanıcıdan Parsel Pro'nun parsel verisini hangi biçimde
   verebildiğini iste; gerekirse dönüştürücü yaz; "Sahne Studio'da Aç" düğmesi
   (`docs/parsel-pro-koprusu.md` hazır).
4. Sonra: Batch modu, Flux yedek sağlayıcı, onay paneli, F4 kalemleri.

## Çalışma kuralları

- Dil: kullanıcıyla Türkçe. Kod/commit: bu depoya, **aynı dala** push.
- Kullanıcı teknik değil — komutları hazır ver, hataları ondan isteyip kendin çöz.
- "Tam-kare dönüşüm" ve "zemin uyumu 3D'de" ilkelerini koruyarak geliştir.

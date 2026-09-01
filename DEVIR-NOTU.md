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
   3840×2160 üretti · render kuru modu maliyet planı bastı.
4. **✅ 27.08.2026 — Mac'te İLK GERÇEK UÇTAN UCA ÇALIŞTIRMA YAPILDI (ölçüldü):**
   - Depo Mac'e indi: `/Users/muratturna/Projeler/sahne-studio` (GitHub: `mimarmt/test-repo`).
   - Node v24.18 · `npm install` · Playwright Chromium kuruldu · **25/25 test yeşil** · build 4 sn.
   - Google Cloud projesi **`mimari-arama`**: Map Tiles API ve Gemini API **zaten etkindi**.
     Sahne Studio için yeni anahtar: **"Sahne Studio - Map Tiles"** (yalnız Map Tiles'a kısıtlı,
     uygulama kısıtı yok) — canlı test **HTTP 200**. Mevcut "API key 2" ParselPro'nun olabilir,
     ellenmedi.
   - Gemini: AI Studio'da zaten duran **"Gemini API Key mt"** (Tier 1 · Prepay) kullanıldı →
     `GEMINI_API_KEY`. Model listesi doğrulandı: **`gemini-3-pro-image`** ve
     **`gemini-3.1-flash-image`** kararlı sürüm olarak mevcut (koddaki seçim güncel).
   - **Gerçek 4K yakalama: 36 sn** — İzmir Karşıyaka örnek parseli, gerçek Google dokusu,
     parseldeki mevcut bina clipping ile silindi, atıf şeridi karede.
   - **Gerçek AI render: 17 sn** (taslak 2K, ~0,10 $) — tüm kare foto-gerçekçileşti, çevre
     yerinde, atıf korundu.
   - 🔴 **Ders:** modelsiz (boş) parselde AI, clipping boşluğunu **güneş paneli** sandı. Boş
     parsel AI'ya boş gönderilmemeli — ya GLB oturmuş olmalı ya da boşluk ayrıca ele alınmalı.
   - 🔴 **Ders (düzeltildi):** anahtar derleme anında pakete gömülüyor; `dist/` eski anahtarla
     kalırsa sayfa kilit ekranında takılıyor ve yakalama 180 sn sonra anlamsız "Timeout" veriyordu.
     `capture.mjs` artık paketteki anahtarı `.env` ile karşılaştırıp gerekirse yeniden derliyor;
     kilit ekranı durumunda da sebebi yazıyor.
   - **✅ 27.08.2026 ikinci tur — TEK TIK OTOMASYONU (Murat kararı: Yöntem A):**
     Akış: masaüstü "Sahne Studio" kısa yolu → iki sunucu birden açılır (ölçüldü: soğuk
     başlangıç 2,6 sn) → ParselPro açılır → ilçe+ada/parsel sorgula → 3D üret →
     **🌍 Sahne Studio** düğmesi → parsel+GLB köprüye POST edilir → Sahne Studio'da model
     gerçek kota OTOMATİK oturur (ölçüldü: 10 sn) → kaydırıcılarla düzelt → onayla → render.
     - Köprüye `/api/model` uçları eklendi (GLB bellekte; glTF imza denetimi).
     - Model, zemin örneklemesi bittikten sonra `glbUrl`'den kendiliğinden yüklenir.
     - **Yana kaydırma** eklendi: Doğu↔Batı / Kuzey↔Güney kaydırıcıları + sıfırla
       (şemada opsiyonel `kaydirma` alanı; eski proje.json'lar etkilenmez).
     - `scripts/kutle-uret.mjs`: imar zarfından bağımlılıksız GLB kütle üretici.
     - Masaüstü kısa yolu: `/Users/muratturna/Desktop/Sahne Studio.app` (logo dahil;
       ParselPro=:3001 + Sahne=:5173 birlikte başlatır, sonra ParselPro'yu açar).
     - Yenibosna 411/2882 gerçek verisi hazır: `yenibosna-2882-proje.json`
       (zemin kotu Google dokusundan ölçüldü: **87,88 m**, eğim %4) + kütle GLB.
   - 🔴 **Ders (düzeltildi, ikinci gerçek tıklama):** ① `alanM2: null` şemadan dönüyordu —
     `optional` yalnız yokluğu kabul eder, `nullable` da eklendi. ② Uçuş küresi parseli
     **deniz seviyesinde** sanıyordu; Yenibosna 88 m'de olduğundan kamera yerin altında
     kalıp bulanık gri leke gösteriyordu (İzmir 42 m'de şans eseri iyiydi). Küre artık
     gerçek kota kurulur, zemin ölçülünce kamera düzeltme uçuşu yapar. ③ Murat kuralı:
     varsayılan bakış **her zaman sokak tarafından** — uçuş ve insan-gözü/cepheye-dik
     presetleri cephe yönünü (uzun eksen) sokak varsayar; yanılırsa orbit/preset ile düzeltilir.
     Gelecek iyileştirme: ParselPro'nun yol (overpass) verisinden gerçek sokak yönünü pakete koymak.
   - ✅ **ParselPro tarafı COMMIT ATILDI — `7efb28a`** (dal `denetim/c-duzeni`, 27.08.2026,
     YAZAR: Claude, Murat onayı; kapı dış belediye servisleri yüzünden kırmızıydı,
     `--no-verify` gerekçesi commit mesajında). İçerik: ① 🌍 sahneStudioyaGonder köprüsü
     ② `_alanSayiya` Türkçe sayı kuralı ③ saha grafikleri GLB'ye girmez (görüntüleyicide
     durur; 3 m çekme dili doğru — Murat teyidi) ④ çatı sözlüğü motorda: duzdam→teras,
     yeni beşik çatı, MAHYA ölçüsü uygulanır (tepe=14,50+4,50 ölçüldü) ⑤ blueprint kenar
     ikizi kutunun ÇOCUĞU (şevlerde havada kalan çerçeveler bitti — Murat'ın yakaladığı
     "çatıda olmaması gereken çerçeveler"in gerçek kökü buydu) ⑥ kesit: pano "Ön Çıkma"
     artık ön tipi okur (`onCumbaTipi` alanı eklendi), arka şerit zemin katta çizilmez,
     mahya etiketi pano altında kalmaz. Doğrulama: 17/17 davranış testi + headless
     ekran kanıtları. Kesitteki son kat "Açık balkon" etiketi HATA DEĞİL: plan notu
     IV-D-1-1, Murat onayı 09.07.2026.
   - ⚠ **Ortam notu:** Cesium yalnız **görünür** sekmede çizim yapar. Claude'un önizleme paneli
     ve arka plan Chrome sekmeleri sayfayı `hidden` tuttuğu için sahne donuk kalır (0 fps) —
     bu bir uygulama hatası değildir. Tarayıcıdan bakarken sekme **önde** olmalı; otomasyon
     yolu (`npm run yakala`, headless Playwright) bundan etkilenmez.
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

## ✅ BİTTİ (27.08 gece) — Street View render hattı ÇALIŞIYOR

Gerçek sokak fotoğrafının içine model yerleştirme uçtan uca doğrulandı.
Betik: `sahne-studio/scripts/sokak-render.mjs` · npm kısayolu: `npm run sokak`.

**Yenibosna 2882 ile kanıtlanan komut (v3 = en iyi çıktı):**
```bash
cd /Users/muratturna/Projeler/sahne-studio/sahne-studio
node scripts/sokak-render.mjs --proje ./yenibosna-2882-proje.json \
  --glb /tmp/kopru-model2.glb --fov 120 --pitch 18 --geri 5 --yukseklik 2.8 --taslak
```
Çıktılar: `out/istanbul-bahcelievler-411-ada-2882-parsel/2026-08-27/sokak/`
(sokak-foto.jpg · sahne-3d.jpg · model-yalniz.png · sablon.jpg · sokak-render-vN.jpg)

**Nasıl çalışıyor:** ① parsel merkezine en yakın dış-mekân panosu (metadata, ücretsiz)
② o panodan ÇIPLAK fotoğraf (Static API — arayüz yazısı yok) ③ aynı kameradan modelli
3D kare + YALNIZ-model karesi (mor fon, `__SAHNE_MODELYALNIZ`) ④ **ölçek şablonu**:
model hayaleti fotoğrafın üstüne %69 saydam bindirilir ⑤ Gemini'ye 3 görsel:
foto + şablon + 3D → "hayaletin yerine piksel-doğru inşa et" ⑥ atıf şeridi geri basılır.

**Ölçülen dersler (tekrarlama):**
- Şablonsuz (yalnız foto+3D) Gemini modeli KÜÇÜLTÜP geri itiyor — ölçek ancak
  hayalet şablonla tutuyor (v1-v2 şablonsuz, v3-v4 şablonlu; v3 en iyi).
- `--taslak` (flash) temizlik komutlarına pro'dan İYİ uyuyor: pro (v2, v4) kaput
  bulanıklığını ve köşe filigranını bırakıyor. Şimdilik sokak için taslak öner.
- Pano GPS'i birkaç metre şaşıyor → `--geri` (m) kamerayı bakış hattında geri çeker;
  `sablon.jpg`'de hayalet boşluğa oturana kadar kuru modda (`--kuru`, ücretsiz) ayarla.
- Sokak seviyesinde Google dokusu dar aralıklarda ERİMİŞ (uçak fotogrametrisi) —
  çare değil, gerek de yok: çevre fotoğraftan gelir, 3D yalnız yer/kütle söyler.
- Cesium `dynamicScreenSpaceError` sokak kamerasında çevreyi bilerek kaba bırakır →
  yakalamada kapatıldı; `sokakGorunumuAc()` = kamera feneri + gri küre tabanı.
- Shoelace merkez formülü ham koordinatla ÇÖKÜYOR (kayan nokta sadeleşmesi) —
  eski "hatalı merkez 28.840492"nin kökü buydu; yerelleştirilmiş shoelace şart.
- Sahne Studio sağ üstüne "← Parsel Pro" dönüş düğmesi eklendi (opener varsa
  pencereyi kapatır, yoksa localhost:3001'e gider; yakala modunda gizli).

**Murat düzeltmeleri (28.08 canlı) — işlendi:**
- Ölçek: v3 küçük kaldı → --geri 1.5'e kalibre edildi + bitişik nizam talimatı
  prompt'a girdi (yan duvarlar komşuya BİTİŞİK, çekme yalnız önde) → v5 doğru.
- 🚶 Street View artık uygulama İÇİNDE tam ekran katman (Maps Embed API —
  anahtarın 3. API'si; ücretsiz). Sağ üstte "← Sahneye dön" + "↗ Yeni sekmede".
  Google sekmesine düğme konamaz (cross-origin) — katman bu yüzden bizim sayfamız.
- Kanıtlı komut artık: --fov 120 --pitch 18 --geri 1.5 --yukseklik 2.8 --taslak → v5.

**Kalanlar (sokak hattı):** fotoğrafın altındaki Google aracı kaput bulanıklığı
bazı üretimlerde kalıyor (v5'te kaldı, v3'te temizlendi — istikrar için fotoğrafın
alt %12'sini Gemini'den önce kırpmayı dene); köprü GLB'sinde saha plakası hâlâ var
(ParselPro'dan taze gönderimle yenilenmeli); ParselPro arayüzüne tek tuş
"Sokak render" bağlanması; stil/malzeme yönlendirme seçeneği.

## Sıradaki adımlar (bu sırayla)

1. ~~**Mac kurulumu + ilk gerçek test**~~ ✅ **27.08.2026'da yapıldı** (yukarıda, madde 4).
   Kurulu hali: `/Users/muratturna/Projeler/sahne-studio/sahne-studio`, `.env` dolu ve sınandı.
   ```bash
   cd /Users/muratturna/Projeler/sahne-studio/sahne-studio
   npm run dev     # tarayıcıda aç → sekme ÖNDE olmalı (gizli sekmede Cesium çizmez)
   ```
2. **SIRADAKİ İŞ — Murat'ın İLK GERÇEK TIKLAMA TESTİ:** masaüstü kısa yolu → ParselPro'da
   parsel sorgula → 3D üret → 🌍 Sahne Studio → model gerçek çevrede; kaydırıcılarla düzelt →
   açı onayla → `proje.json indir` → yakala + render. Takılırsa hatayı Claude'a söyle.
3. Kendi SketchUp tasarımıyla (zarf kütlesi değil gerçek bina) aynı akış. Murat'tan gereken:
   (a) SketchUp 2025'ten **GLB** dışa aktarımı (*File → Export → 3D Model → .glb*; eksen orijini
   bina tabanında olsun), (b) ParselPro Studio'dan **gerçek ada/parsel** verisi.
   Akış: parsel yükle → GLB bırak → kot/yön ayarla → açı onayla → `proje.json indir` →
   `npm run yakala -- --proje ./proje.json --glb ./bina.glb` →
   `npm run render -- --klasor <klasör> --stil gunduz --taslak` → değerlendir, promptu ince ayarla.
   *(Murat'ın hedefi bu: ParselPro'da hangi ada/parseli seçtiyse onun bilgisiyle model oturacak
   ve hepsi birlikte render edilecek.)*
3. **Parsel Pro entegrasyonu:** kullanıcıdan Parsel Pro'nun parsel verisini hangi biçimde
   verebildiğini iste; gerekirse dönüştürücü yaz; "Sahne Studio'da Aç" düğmesi
   (`docs/parsel-pro-koprusu.md` hazır).
4. Sonra: Batch modu, Flux yedek sağlayıcı, onay paneli, F4 kalemleri.

## Çalışma kuralları

- Dil: kullanıcıyla Türkçe. Kod/commit: bu depoya, **aynı dala** push.
- Kullanıcı teknik değil — komutları hazır ver, hataları ondan isteyip kendin çöz.
- "Tam-kare dönüşüm" ve "zemin uyumu 3D'de" ilkelerini koruyarak geliştir.

# Sahne Studio

SketchUp modelinizi **gerçek Google 3D şehir dokusunun** içine, gerçek parsel koordinatına ve
arazi kotuna oturtur; beğendiğiniz açıları onaylarsınız; her onaylı açı **4K** yakalanır ve
Gemini ile **tüm kare** (bina + gerçek çevre birlikte) hiper-gerçekçi tek bir fotoğrafa
dönüştürülüp proje klasörüne kaydedilir.

Akış: **Parsel Pro Studio → parsel → sahne → açı onayı → `npm run yakala` → `npm run render`**

---

## 1. Kurulum (bir kez)

Gereken: [Node.js 20+](https://nodejs.org) (LTS önerilir).

```bash
cd sahne-studio
npm install
npx playwright install chromium     # headless 4K yakalama için tarayıcı
```

### Google API anahtarı

Tek anahtar yeterli. [Google Cloud Console](https://console.cloud.google.com/) → projeniz →
**APIs & Services**:

1. **Map Tiles API**'yi etkinleştirin (3D şehir dokusu — ayda 1.000 oturum ücretsiz).
2. **Gemini API**'yi etkinleştirin (AI render).
3. Bir API anahtarı oluşturun/mevcut anahtarı kullanın.

```bash
cp .env.example .env      # Windows: copy .env.example .env
# .env içinde: VITE_GOOGLE_API_KEY=AIza...
```

> **Anahtar kısıtı önemli:** Anahtarı **"API restrictions: Map Tiles API + Gemini API"** ile
> kısıtlayın ama **web sitesi (referrer) kısıtı koymayın** — render betiği Node'dan çağrı yapar,
> referrer kısıtı onu engeller. Ayrı ayrı kısıtlamak isterseniz iki anahtar kullanın:
> `VITE_GOOGLE_API_KEY` (Map Tiles, istenirse `http://localhost:*` referrer kısıtlı) ve
> `GEMINI_API_KEY` (Gemini, kısıtsız/IP kısıtlı).

## 2. Çalıştırma

```bash
npm run dev        # http://localhost:5173
```

1. **Parsel yükleyin** — üç yol: Parsel Pro Studio'dan gönderin (panelde "Parsel Pro'dan Al";
   protokol: `docs/parsel-pro-koprusu.md`), `.json` dosyası bırakın veya JSON yapıştırın.
   Deneme için: `ornekler/ornek-parsel.json`.
2. Kamera parsele uçar, parsel sınırı sarı çizilir, **parseldeki mevcut bina dokudan silinir**
   ("Mevcut binayı gizle" kutusuyla açılıp kapanır) ve zemin kotları örneklenip tablo gösterilir.
3. **GLB bırakın** — SketchUp 2025: *File → Export → 3D Model → GLB*. Model parsel merkezine,
   zemin medyan kotuna oturur. **Yön / Kot ofseti / Ölçek** kaydırıcılarıyla ince ayar yapın.
   - SketchUp'ta model ekseninin (origin) bina oturumunda olmasına dikkat edin; kot ofseti
     subasman/eğim düzeltmesi içindir.
4. **Güneş** tarih + saat kaydırıcısı gölgeleri gerçek güneş konumuna göre oynatır.
5. **Kamera** presetleriyle (kuş bakışı 4 yön, insan gözü, cepheye dik) veya serbest dolaşarak
   kadrajı bulun → **"Bu açıyı onayla"**. Açılar projeye kaydedilir (tarayıcı hafızası + dışa aktarma).
6. **proje.json indir** — yakalama betiğinin girdisi budur. ("JPG indir" anlık 4K önizleme verir.)

## 3. Toplu 4K yakalama

```bash
npm run yakala -- --proje ./proje.json --glb ./binaniz.glb
# tek açı: --aci 2   ·   çıkış kökü: --out D:\Renderlar

# GLB'niz hazır değilken hattı gerçek dokuyla sınamak için (model yok, çevre gerçek):
npm run yakala -- --proje ornekler/ornek-proje-modelsiz.json --aci 1
```

Betik uygulamayı headless tarayıcıda açar, her onaylı açıyı birebir kadrajla 3840×2160
yakalar ve şu ağaca yazar:

```
out/izmir-karsiyaka-1234-ada-5-parsel/2026-08-27/
├── aci-01/  raw.jpg · metadata.json
└── aci-02/  raw.jpg · metadata.json
```

## 4. AI render

```bash
npm run render -- --klasor out/<slug>/<tarih>/aci-01 --stil gunduz
# birden çok stil ve varyant:
npm run render -- --klasor ... --stil gunduz,aksam,gece --varyant 2
# ucuz/hızlı deneme (2K, ~4× ucuz):
npm run render -- --klasor ... --stil gunduz --taslak
# API'siz plan + maliyet tahmini:
npm run render -- --klasor ... --stil gunduz --kuru
```

- Varsayılan model **gemini-3-pro-image** (Nano Banana Pro, 4K ~0,24 $/görsel);
  `--taslak` → gemini-3.1-flash-image (2K, ~0,10 $).
- Stiller `scripts/stiller.json` içindedir — kendi stillerinizi ekleyebilirsiniz.
- Prompt, sahnedeki **hiçbir yapıyı ekletmez/çıkartmaz**: gerçek çevre şablon, AI cila.
- Google atıf şeridi her çıktıya otomatik geri basılır (kullanım şartları gereği kırpmayın).

## 5. Testler

```bash
npm test        # geometri/şema/kamera birim testleri (anahtar gerekmez)
npm run smoke   # tarayıcı duman testleri (anahtar gerekmez)
npm run build   # üretim derlemesi
```

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| "Google 3D dokusu yüklenemedi" | Anahtarda Map Tiles API etkin mi? Faturalama açık mı? |
| Sahne siyah / clipping çalışmıyor | Tarayıcı WebGL2 desteklemeli; `/cesium/Workers/` 404 veriyorsa `npm install` yenileyin |
| Zemin kotu "—" | Parsel Google 3D kapsamı dışında olabilir — kot ofsetiyle elle ayarlayın |
| render.mjs 403 | Anahtarda referrer kısıtı var — kaldırın veya ayrı `GEMINI_API_KEY` kullanın |
| Yakalanan kare bulanık | Doku akışı bitmeden çekilmiş olamaz (betik bekler); yine de olduysa tekrar çalıştırın |
| `.env`'i değiştirdim, yakalama eski davranıyor | Anahtar **derleme anında** pakete gömülür. `npm run yakala` bunu kendisi fark edip yeniden derler; elle derlemek isterseniz `npm run build` |
| Model havada/gömülü | Kot ofseti kaydırıcısı; SketchUp'ta eksen orijinini bina tabanına alın |

## Maliyet özeti

| Kalem | Maliyet |
|---|---|
| 3D doku (Map Tiles) | 1.000 oturum/ay ücretsiz, sonrası ~6 $/1.000 |
| Render (4K pro) | ~0,24 $/görsel (taslak 2K ~0,10 $) |
| Yakalama, uygulama | Ücretsiz (açık kaynak bileşenler) |

**Atıf notu:** Karelerdeki "Google" atıf şeridi hem ham hem AI çıktısında korunur; müşteri
teslimlerinde de kırpmayın. Görseller Google verisinden türetildiği için kaynak belirtin.

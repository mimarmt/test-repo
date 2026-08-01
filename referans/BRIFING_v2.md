# BRİFİNG v2 — Öğrenme vanasını aç

**Tarih:** 01.08.2026 · **Yerine geçtiği belge:** `AKSIYON_PLANI.md` (sıralaması değişti)
**Bu belge kendi kendine yeter.** Okuyan ajanın önceki konuşmaları bilmesi gerekmez.

---

## 0. ÖNCE DOĞRULA — hiçbir şeye dokunmadan

Bu belgedeki teşhis, `belgeler/MIMARI_SEMA.md`'nin HTML çıktısındaki **7 SVG
diyagramın kutu metinlerinden** çıkarıldı. **Okların yönü okunamadı** — sadece
kutu içerikleri okundu. Dolayısıyla teşhis bir **çıkarım**, ölçüm değil.

Şu beş komutu koş ve çıktıyı **kaydet**. Hepsi beklendiği gibi çıkarsa devam et;
biri çıkmazsa **dur** ve farkı bildir.

```bash
cd ~/Parametrik-mimari-plan-Geliştirme

# D1 — Eşleme tablosu gerçekten boş mu?
echo "=== D1 mahal_rol_eslemesi ==="
cat veri/ogrenme/mahal_rol_eslemesi.json
wc -c veri/ogrenme/mahal_rol_eslemesi.json

# D2 — Kaç plan var, kaçı role çevrilebiliyor?
echo "=== D2 arsiv ==="
wc -l veri/ogrenme/*/plan_arsivi.jsonl veri/ogrenme/plan_arsivi.jsonl 2>/dev/null

# D3 — N >= 10 esigi nerede tanimli?
echo "=== D3 esik ==="
grep -rn "10" araclar/ogrenme/esikler.json
grep -rln "N *>= *10\|asgari_plan\|min_plan\|esik" araclar/ogrenme/ | head

# D4 — Sirkulasyon tavani nerede, degeri ne?
echo "=== D4 sirkulasyon ==="
grep -rn "sirkulasyon" ortak/kurallar/kural_kitabi.json bilesenler/plan_uretici/oda_programi.json | head -20

# D5 — Sinav son ne zaman kostu, otomatik mi?
echo "=== D5 sinav ==="
git log --oneline -5 -- veri/ogrenme/sinav_notlari.jsonl
grep -rn "sinav" araclar/test/ conftest.py 2>/dev/null | head
```

**Beklenen çıktı:**

| Kontrol | Beklenen | Çıkmazsa ne demek |
|---|---|---|
| D1 | Dosya boş veya `{}` benzeri | Eşleme doluysa teşhis yanlış — dur, bildir |
| D2 | 2+1: 7 · 3+1: 2 · kök: 0 | Sayı farklıysa arşiv büyümüş, iyi haber |
| D3 | Bir yerde 10 eşiği | Bulunamazsa eşik nerede? Şema "N ≥ 10" diyor |
| D4 | `0.08` civarı bir tavan | Yoksa tavan başka yerde |
| D5 | Sınavı koşan **test yok** | Test varsa bekçi zaten kurulmuş |

---

## 1. TEŞHİS — doğrulanırsa

Öğrenme hattı **eksiksiz kurulmuş** ve **çalışır durumda**. Sorun eksik parça
değil, **ortada kapalı bir vana**.

```
ScrapingBee TAKILI (29.07)
      │
      ▼
toplama durdu ──────────► arşiv 9 planda kaldı
      │
      ▼
mahal → rol eşlemesi BOŞ        ◄── ASIL VANA
      │
      ▼
9 planın 0'ı role çevrilebiliyor
      │
      ▼
orana giren plan = 0   ·   eşik: N ≥ 10
      │
      ▼
parametre güncellenmiyor
      │
      ▼
sınav notu 4.48'de sabit
```

Şemanın kendisi bunu üç yerde yazıyor:
- `TIKANIK: mahal→rol eslemesi bos, N=0`
- `TIKANIK: 9 plan var, 0 tanesi orana giriyor`
- `bekliyor: N ≥ 10 (bugun 0)`

### İki ayrı tıkanma — karıştırma

| | Tıkanma | Çözümü |
|---|---|---|
| **A** | Veri parametreye akmıyor (eşleme boş) | İŞ 1 |
| **B** | Sınav notu hiçbir kural değişikliğini denetlemiyor | İŞ 2 |

**B, A çözülse bile kalır.** Kanıt: `sinav_notlari.jsonl`'daki 3 kaydın ikisi
**birebir aynı** — arada `max_m2` kaldırıldı, kural 1.10 eklendi, not kıpırdamadı.

---

## 2. İŞ 1 · VANAYI AÇ — mahal → rol eşlemesi
**Öncelik: BİRİNCİ · Süre: birkaç saat · Kod değil, veri**

### Ne yapılacak

Elinizdeki 9 plandaki oda adlarını sistemin tiplerine eşleyin.

**Adım 1 — envanter çıkar.** Arşivdeki **benzersiz oda adlarını** sıklığa göre dök:

```bash
cat veri/ogrenme/*/plan_arsivi.jsonl \
  | python3 -c "
import sys, json, collections
say = collections.Counter()
for satir in sys.stdin:
    satir = satir.strip()
    if not satir: continue
    try: kayit = json.loads(satir)
    except: continue
    # mahal adlarinin hangi alanda durdugunu BUL, sabit varsayma
    print(json.dumps(kayit, ensure_ascii=False)[:400])
" | head -20
```

> **Not:** Kaydın şemasını bilmiyorum. Önce **bir satırı ekrana bas**, alan
> adlarını gör, sonra dökümü ona göre yaz. Alan adını tahmin etme.

**Adım 2 — eşle.** En sık geçen ~20 adı `veri/ogrenme/mahal_rol_eslemesi.json`'a yaz:

```json
{
  "_aciklama": "Arsivdeki mahal adi -> sistem tipi. Eslesmeyeni UYDURMA.",
  "_kaynak": "veri/ogrenme/*/plan_arsivi.jsonl, 9 plan, 01.08.2026",
  "eslesme": {
    "salon":         "salon",
    "oturma odasi":  "salon",
    "yasam alani":   "salon",
    "yatak odasi":   "yatak",
    "ebeveyn":       "eb_yatak_1",
    "banyo":         "wc_dus",
    "wc":            "kucuk_wc",
    "hol":           "koridor",
    "antre":         "antre",
    "mutfak":        "mutfak",
    "balkon":        "balkon"
  },
  "_eslesmeyenler": ["...bunlari onay kuyruguna dus, uydurma..."]
}
```

### Üç kural — bunlara uy

1. **Eşleşmeyen adı uydurma.** Şemanızın kendi kuralı: `kaynaksiz sayi giremez`.
   Emin olmadığın adı `onay_kuyrugu.jsonl`'a düşür, mimar onaylasın.
2. **Belirsiz adları ayır.** "Oda 1", "Mahal 3" gibi anlamsız etiketler eşlenmez —
   o plan **kısmi** sayılır ve bu raporlanır.
3. **Eşleme tek yönlü değil.** Aynı sistem tipine birden çok ad gelebilir
   (salon ← salon, oturma odası, yaşam alanı). Ters yön birebir olmalı.

### Kabul ölçütü

```
9 planın en az 7'si tam eşleşiyor
Eşleşmeyen ad sayısı raporlanıyor
Eşleşmeyenler onay kuyruğuna düşüyor, sessizce atılmıyor
```

Bu sağlanınca **orana giren plan sayısı 0'dan çıkar** — o an vana açılmıştır.

---

## 3. İŞ 2 · REGRESYON BEKÇİSİ — ikinci tıkanma
**Öncelik: İKİNCİ · Süre: 1 saat · İŞ 1 ile aynı gün**

### Ne yapılacak

`araclar/test/test_sinav_gerilemedi.py` yaz. Test şunu yapsın:

1. Sınavı koş
2. Notu `veri/ogrenme/taban_cizgisi.json` ile karşılaştır
3. **Not düşmüşse testi kır** — mesajda hangi tipte kaç m² bozulduğunu yaz

### Neden

Bu tek dosya, *"ölçüm → kural"* okudur. Bundan sonra hiçbir kural değişikliği
ölçülmeden geçemez. Bugüne kadar olmayan tek şey bu.

### Kabul ölçütü

```
.venv/bin/pytest → yesil
Bilerek bir kural bozulunca → test KIRILIYOR
Geri alinca → tekrar yesil
```

**Üçüncü satır şart.** Bekçinin gerçekten beklediğini doğrulamadan bekçiye
güvenme — `test_koruma_gercek_mi.py` deseninin aynısı.

---

## 4. İŞ 3 · TABAN ÇİZGİSİ VE NOT BİLEŞENLERİ
**Süre: 1 saat**

**3a — Taban çizgisi.** `veri/ogrenme/taban_cizgisi.json`:
```json
{ "sinav_notu": 4.48, "tarih": "...", "git_sha": "...", "kaynak_dxf": "Daire2.dxf" }
```

**3b — Notu üçe ayır.** Tek bir 4.48 hangi yönde bozulduğunu gizliyor:

| Bileşen | Bugün | Ne ölçer |
|---|---|---|
| `eksik_tip_sayisi` | **1** (balkon) | Gerçek planda olup üretimde olmayan oda |
| `alan_mutlak_sapma_m2` | **30.66** | Σ\|fark\| |
| `sirkulasyon_farki_puan` | **−9.73** | gerçek − üretilen |

**3c — Her koşuda `git_sha` yaz.** Notun hangi koddan çıktığı bilinmezse
karşılaştırma yapılamaz.

---

## 5. İŞ 4 · EŞİĞİ AŞ — dönüm noktası
**Süre: yarım gün · Ön koşul: İŞ 1, 2, 3**

Arşiv 9'da, eşik N ≥ 10. **Onuncu planı ekle.**

Kaynak: kendi DXF arşiviniz (`veri/dxf_arsiv/`, bugün 2 dosya) veya
`veri/dis_veri_setleri/toki/toki_kat_planlari.pdf`. Kazımaya gerek yok.

### Beklenen ve ölçülecek

Öğrenme ilk kez tetiklenecek. **İŞ 2'nin bekçisi notun ne yaptığını söyleyecek.**

| Sonuç | Anlamı |
|---|---|
| Not **yükseldi** | Döngü kapandı. Bu projenin dönüm noktası. |
| Not **aynı** | Öğrenme parametreye dokunmuyor — hangi parametreyi yazdığını izle |
| Not **düştü** | Bekçi kırılacak. İyi haber: mekanizma çalışıyor, veri kötü |

Üç sonuç da bilgi. **Bugüne kadar hiçbiri alınamıyordu.**

---

## 6. İŞ 5–7 · YAPISAL DÜZELTMELER
Her birinden sonra bekçiyi koş.

### İŞ 5 · Sirkülasyon tavanı — 5 dakika, en yüksek getirili

| Kaynak | Değer |
|---|---|
| `CLAUDE.md` kuralı | **%8** |
| Mimarın m² tablosu | %8.8 – %12.4 |
| **Gerçek çizim (`Daire2.dxf`)** | **%19.83** |
| Sistemin ürettiği | %10.1 |

Tavan gerçeğin **yarısından az**. Sistem sirkülasyonu ezip alanı salona veriyor.

**Yöntem:** tavanı kaldır (1.0) → sınavı koş → `sirkulasyon_farki_puan`'a bak →
gerçek veriye göre yeni tavanı belirle.

**Not:** %8'in kaynağı belgede yazmıyor. PAİY'de sirkülasyon oranı hükmü
**yok** (arama ile bakıldı, madde bulunamadı). Bu bir tasarım tercihi,
mevzuat değil — değiştirilebilir.

**Kabul:** `|sirkulasyon_farki_puan| < 9.73`

### İŞ 6 · Balkonu üretime sok — yarım gün

Balkon gerçek planda net alanın **%3.8'i**, sistemde **yok**.

Karar (`9cf6a27` — *balkon "orana girmez"*) alınmış ama **balkon bir oda olarak
üretilmiyor**. İkisi ayrı şey.

Cephe kuralı: **uzun kenarı cephede**, derinlik sınırlı. Yalnız "cepheye değsin"
yetmez — o kural balkonun plana içerlek yarık gibi girmesine izin verir.

**Kabul:** `eksik_tip_sayisi` 1 → **0**

### İŞ 7 · Mevzuat altı ölçü — 10 dakika

Şemada `min 1.0 m² / dar kenar 0.8 m` yazıyor. **PAİY m.29: hela asgari
1.20 m², dar kenar 1.00 m.** Bu ölçü ruhsat alamaz.

Ayrıca kontrol et:

| Parametre | Olması gereken |
|---|---|
| `duslu_wc` alan_min | **4.20 m²** (banyo 3.00 + hela 1.20, tek hacimde toplanır) |
| `duslu_wc` dar kenar | **1.50 m** |
| daire giriş kapısı | **1.00 m** (iç kapılar 0.90) |

> **Kaynak uyarısı:** madde numaraları birden çok bağımsız aramada tutarlı
> çıktı ama mevzuat.gov.tr'ye doğrudan erişilemedi. Ruhsat öncesi birincil
> metinden teyit et.

---

## 7. YAPILMAYACAKLAR

| Yapılmayacak | Neden |
|---|---|
| **ScrapingBee'yi düzeltmek** | Kullanılmayan 9 planı 90 yapmanın faydası yok. Önce vanayı aç. |
| **Yeni kural eklemek** | Bekçi kurulmadan eklenen kural, iyi mi kötü mü bilinmeden eklenir. |
| **Sirkülasyonu L/T'ye çevirmek** | Motorun temel varsayımını söker; ölçüm gerektirmiyor. |
| **ML / üretici model** | Kısıt garantisi vermez. Kalite ölçütünüz "savunulabilir" — garanti ister. |
| **Yeni tipoloji** | Tek satırla eklemek 2+1'in bugünkü çıkmazını tekrar üretir. |

---

## 8. ÖLÇÜT PANOSU

| Ölçüt | Bugün | Hedef |
|---|---|---|
| Orana giren plan | **0 / 9** | ≥ 7 / 9 |
| Arşivdeki plan | 9 | **≥ 10** (eşik) |
| Sınav notu | 4.48 (n=1) | yükselen eğilim |
| Eksik tip | 1 (balkon) | **0** |
| Sirkülasyon farkı | −9.73 puan | \|fark\| < 3 |
| Alan mutlak sapma | 30.66 m² | < 15 m² |
| Sınav çizimi | 2 | ≥ 10 |
| Bekleyen karar | 36 / 49 (%73) | azalan |

**Kural:** Ölçülmeyen satıra "ölçülmedi" yazılır, boş bırakılmaz, tahmin edilmez.

---

## 9. GERİ BİLDİRİLECEKLER

Bu işler bitince şunları raporla:

1. **D1–D5 doğrulama çıktıları** — teşhis tuttu mu?
2. **Şu tek soru:** Şemada `ÖLÇÜM / SON SÖZ` kutusundan geriye,
   `KURAL VE PARAMETRE` kutusuna giden **bir ok var mı?**
   Varsa döngü kapalı, sadece vana tıkalıydı. Yoksa iki iş birden gerekiyordu.
3. **İŞ 4'ten sonra notun ne yaptığı** — yükseldi / aynı / düştü
4. **Eşleşmeyen mahal adları listesi** — hangileri onay bekliyor

---

## 10. BU BELGENİN GÜVENİLİRLİĞİ

**Dayanağı:** `mimari_sema.html` içindeki 7 SVG diyagramın kutu metinleri +
daha önce paylaşılan dosya listesi, `sinav_notlari.jsonl`, `tercihler.json`,
git günlüğü.

**Zayıf noktaları:**

1. **Ok yönleri okunamadı.** Akış hakkındaki her hüküm kutu içeriklerine dayanıyor.
2. **Kod yapısı görülmedi.** Dosya/alan adları uyarlanmalı; tahmin edilenler
   `grep` ile doğrulanmalı.
3. **Arşiv kaydının şeması bilinmiyor.** İŞ 1'de önce bir satırı bas, alan
   adlarını gör, sonra dökümü yaz.
4. **%19.83 tek daireden.** Sirkülasyon tavanını buna göre belirlemek n=1'e
   dayanmaktır; sınav 10 çizime çıkınca yeniden bak.
5. **PAİY maddeleri birincil metinden teyit edilmedi.**

Bir çelişki bulursan **dur ve bildir** — planı zorlamak yerine teşhisi düzelt.

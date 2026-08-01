# AKSİYON PLANI — Parametrik Mimari Plan Geliştirme

**Hazırlanma:** 01.08.2026 · **Uygulayan:** Murat Turna + Claude Code (yerel oturum)
**Bu belge kendi kendine yeter** — okuyan ajanın önceki konuşmayı bilmesi gerekmez.

---

## 0. NEDEN BU PLAN — tek cümlelik teşhis

Sistem plan üretiyor, sınav notu alıyor, ama **not hiç oynamıyor.**
Bir öğrenme sistemi dört oktan oluşur; sizde ikisi çalışıyor, biri zayıf, biri yok:

| Ok | Durum | Kanıt |
|---|---|---|
| veri → parametre | **zayıf** | Son kalibrasyon öğrenme hattından değil, mimarın Excel'inden elle geldi |
| parametre → üretim | **çalışıyor** | `oda_programi.json` → `L3_ic_plan/motor.py`, ~60 koşu |
| üretim → ölçüm | **çalışıyor** | `araclar/ogrenme/sinav.py`, gerçek DXF'e karşı |
| **ölçüm → geri besleme** | **YOK** | `sinav_notlari.jsonl`'daki 3 kaydın ikisi **birebir aynı**; arada `max_m2` kaldırıldı, kural 1.10 eklendi — not 4.48'de çakılı |

**Bu planın tek amacı dördüncü oku bağlamak.** O bağlanmadan yapılan her kural değişikliği, iyi mi kötü mü bilinmeden yapılır.

### Ölçülen üç hata ve neden veriyle çözülmezler

`sinav_notlari.jsonl` son kaydı — `Daire2.dxf`, 2+1, gerçek net 73.37 m², **not 4.48**:

| tip | gerçek | üretilen | fark |
|---|---|---|---|
| **salon** | 28.38 | 39.42 | **+11.04** |
| mutfak | 9.75 | 13.14 | +3.39 |
| küçük wc | 3.11 | 4.01 | +0.90 |
| duşlu wc | 6.20 | 5.01 | −1.19 |
| yatak | 28.94 | 28.33 | −0.61 |
| **sirkülasyon** | **19.83** | 10.10 | **−9.73** |
| **balkon** | **3.80** | **yok** | **−3.80** |

Farkların toplamı **tam sıfır**. Bu bir hata değil, saf bir yeniden dağıtım:

```
balkon yok (3.80) + sirkülasyon eziliyor (9.73) = 13.53 m² boşa çıkıyor
                              ↓
      salon +11.04 · mutfak +3.39 · küçük wc +0.90 · (eksi 1.80) = 13.53
```

**Salonun %39 şişmesinin sebebi salon değil.** Balkonun programda olmaması ve
sirkülasyon tavanı 13.53 m²'yi serbest bırakıyor; alan da en geniş banda sahip
odaya akıyor.

Üç hata da **yapısal**, istatistiksel değil:

- balkon → eksik **kavram**. 1000 plan da onu üreticiye eklemez.
- sirkülasyon → **sert kısıt** tavanı. Veri bir kısıtı ezemez.
- salon → yukarıdaki ikisinin **sonucu**.

Sonuç: **veri artışı bu hataları çözmez.** Önce yapı düzelir, sonra veri işe yarar.

---

## FAZ 0 · ÖLÇÜT HATTINI KAPAT
**Süre: yarım gün · Bu faz bitmeden başka hiçbir şeye dokunma**

Amaç: sınav notunu, her değişikliği denetleyen bir kapıya çevirmek.

### A0.1 · Sınavı komutla koşulur ve tarihe yazılır hale getir

**Ne:** `araclar/ogrenme/sinav.py`'yi tek komutla koşan bir sarmalayıcı ekle.
Her koşu `veri/ogrenme/sinav_notlari.jsonl`'a **yeni satır** yazsın; üzerine yazmasın.

Satır şu alanları taşımalı:
```
tarih · git_sha · kaynak_dxf · tipoloji · sinav_notu ·
tip_bazinda_farklar · eksik_tipler · fazla_tipler
```

`git_sha` şart: notun hangi koddan çıktığı bilinmezse karşılaştırma yapılamaz.

**Neden:** Bugün 3 kayıt var, ikisi birebir aynı — aynı ölçüm iki kez elle
etiketlenmiş. Otomatik yazılmadığı için not, kod değişikliklerini takip etmiyor.

**Kabul ölçütü:** `.venv/bin/python -m araclar.ogrenme.sinav` koşulduğunda
`sinav_notlari.jsonl` bir satır uzuyor ve satırda geçerli bir `git_sha` var.

---

### A0.2 · Taban çizgisini dondur

**Ne:** Mevcut durumu **taban çizgisi** olarak kaydet:
`veri/ogrenme/taban_cizgisi.json` → `{"sinav_notu": 4.48, "tarih": ..., "git_sha": ...}`

**Neden:** "İyileşti mi?" sorusunun cevabı için bir sıfır noktası gerekir.
4.48 bugünkü gerçektir; iyi ya da kötü değil, **referanstır.**

**Kabul ölçütü:** Dosya var ve içindeki not, A0.1'in ürettiği son notla aynı.

---

### A0.3 · Regresyon bekçisi — dördüncü ok budur

**Ne:** `araclar/test/test_sinav_gerilemedi.py` yaz. Test şunu yapsın:

1. Sınavı koş
2. Yeni notu `taban_cizgisi.json` ile karşılaştır
3. **Not düşmüşse testi kır**, mesajda hangi tipte kaç m² bozulduğunu yaz

**Neden:** Bu tek dosya, "ölçüm → geri besleme" okudur. Bundan sonra hiçbir kural
değişikliği ölçülmeden geçemez.

**Kabul ölçütü:** `.venv/bin/pytest` koşumunda test yeşil. Bilerek bir kuralı
bozup testin **kırıldığını** gör, sonra geri al. (Bekçinin gerçekten beklediğini
doğrulamadan bekçiye güvenme — `test_koruma_gercek_mi.py` deseninin aynısı.)

---

### A0.4 · Not bileşenlerine ayrılsın

**Ne:** Tek bir 4.48 yerine, sınav şu üç sayıyı ayrı ayrı raporlasın:

| Bileşen | Ne ölçer |
|---|---|
| `eksik_tip_sayisi` | Gerçek planda olup üretimde olmayan oda (bugün: 1 — balkon) |
| `alan_mutlak_sapma_m2` | Σ\|fark\| (bugün: 30.66 m²) |
| `sirkulasyon_farki_puan` | gerçek − üretilen (bugün: −9.73) |

**Neden:** Tek sayı hangi yönde bozulduğunu gizler. Bugünkü 4.48'in içinde
üç ayrı hikâye var; ayrılmadan hangi düzeltmenin işe yaradığı görülemez.

**Kabul ölçütü:** `sinav_notlari.jsonl` satırında üç bileşen de ayrı alan olarak var.

---

## FAZ 1 · ÜÇ YAPISAL HATAYI KAPAT
**Süre: 1–2 gün · Her adımdan sonra FAZ 0'ın bekçisini koş**

Bu fazın kuralı: **tek seferde tek değişiklik, sonra ölç.** İki değişikliği birlikte
yaparsan hangisinin işe yaradığını bilemezsin.

### A1.1 · Sirkülasyon tavanını gerçek veriyle yeniden belirle — İLK İŞ

**Ne:** `oda_programi.json` / `kural_kitabi.json` içindeki
`sirkulasyon_max_oran = 0.08` değerini bul. Şu üç adımı sırayla yap:

1. **Ölç:** Tavanı tamamen kaldır (1.0 yap), sınavı koş, notu kaydet
2. **Karşılaştır:** `sirkulasyon_farki_puan` ne oldu? Salon şişmesi ne oldu?
3. **Karar:** Gerçek veriye göre yeni tavanı belirle

**Neden — ölçüm:**
- `CLAUDE.md` "%8'i geçmemeli" diyor
- Mimarın m² tablosu %8.8 – %12.4 gösteriyor (tablonun kendisi kuralı çiğniyor)
- **Gerçek çizim `Daire2.dxf` → %19.83**

Yani tavan sadece yanlış değil, gerçeğin **yarısından az.** Sistem sirkülasyonu
ezip alanı salona veriyor; ölçülen +11.04 m² salon şişmesinin ana kaynağı bu.

**Dikkat:** `%8` değerinin nereden geldiği belgede yazmıyor. Bir yönetmelik
maddesi değil — PAİY'de sirkülasyon oranı hükmü **yok** (arama ile doğrulandı,
madde bulunamadı). Yani bu bir tasarım tercihi ve değiştirilebilir.

**Kabul ölçütü:** `sirkulasyon_farki_puan` mutlak değeri **−9.73'ten küçük**
olacak. Olmuyorsa sebebi yaz, tavanı geri al, devam etme.

---

### A1.2 · Balkonu üretime sok

**Ne:** Balkon üretilen planda görünmüyor. İki ayrı iş var, karıştırma:

1. **Karar (zaten alınmış):** commit `9cf6a27` — *balkon "orana girmez"*
2. **Eksik olan:** balkon **bir oda olarak üretilmiyor**

Balkonu oda programına ekle. Alan bandı `veri/ogrenme` verisinden veya
mimarın kararından gelsin — **uydurma.** Gerçek örnek: `Daire2.dxf`'te net
alanın %3.8'i.

**Cephe kuralı:** Balkon dış cephede olur, **uzun kenarı cephede**, derinliği
sınırlı. Yalnızca "cepheye değsin" kuralı yetmez — o kural balkonun plana
içerlek bir yarık gibi girmesine izin verir (ölçüldü: 1.4 × 3.6'lık balkon
kısa kenarıyla cepheye değip uzun kenarıyla içeri giriyordu).

Şema önerisi:
```json
"balkon": { ..., "cephe_kurali": { "uzun_kenar_cephede": true, "derinlik_max": 1.50 } }
```

> `derinlik_max` için **1.50 m**: açık/kapalı çıkma derinliği PAİY m.41'e göre
> azami 1.50 m. Balkon cephe hattının **dışına taşıyorsa** bu sınır geçerlidir;
> bina konturu içinde kalıyorsa değildir. Bu ayrımı netleştir.
> *(Kaynak: PAİY m.41. Birincil metne bu oturumda erişilemedi, arama ile
> çapraz doğrulandı — ruhsat öncesi mevzuat.gov.tr'den teyit edilmeli.)*

**Neden:** Eksik kavram. Veri artışıyla gelmez, elle eklenir.

**Kabul ölçütü:** `eksik_tip_sayisi` 1 → **0**.

---

### A1.3 · Salon şişmesini yeniden ölç

**Ne:** A1.1 ve A1.2'den sonra sınavı tekrar koş. Salon farkına bak.

**Neden:** Hipotez şu: salon şişmesi bağımsız bir hata değil, ilk ikisinin
sonucudur. Doğruysa +11.04 kendiliğinden küçülmüş olmalı.

**Kabul ölçütü:**
- Salon farkı belirgin küçüldüyse → hipotez doğrulandı, salon için ayrı iş yok
- Küçülmediyse → salon bandının kendisi yanlış. `oda_programi.json`'daki salon
  `alan_max` değerini gerçek veriyle karşılaştır

---

### A1.4 · Mevzuat ihlallerini kapat

**Ne:** Şu üç değer PAİY m.29'un altında:

| Parametre | Sistemde | Olması gereken | Madde |
|---|---|---|---|
| `duslu_wc.alan_min` | 2.4 m² | **4.20 m²** (banyo 3.00 + hela 1.20) | PAİY m.29 |
| `duslu_wc.min_kenar` | 1.20 m | **1.50 m** | PAİY m.29 |
| `ebeveyn_banyo.min_kenar` | 1.40 m | **1.50 m** | PAİY m.29 |
| daire giriş kapısı | 0.90 m (tek global) | **1.00 m** (iç kapı 0.90 ayrı) | PAİY m.29 |

**Neden:** Bunlar ruhsat alamayacak daire üretir. Tek ıslak hacim hem banyo hem
hela işlevi taşıyorsa, PAİY her ikisinin asgari alanlarının **toplamını** ister.

> *Kaynak uyarısı: madde numaraları ve ölçüler birden çok bağımsız aramada
> tutarlı çıktı, ancak mevzuat.gov.tr'ye doğrudan erişilemedi. Ruhsat
> aşamasından önce birincil metinden teyit edilmeli.*

**Ek olarak — ızgara çelişkisi:** Yasal asgarilerin hiçbiri 0.20 m'nin katı
değil (0.90 · 1.50 · 2.50). Eğer çözüm ızgaranız 0.20 m ise ve eşikleri
**yukarı** yuvarlıyorsanız ihlal oluşmaz ama sistem gereksiz sertleşir —
her ölçüde 10 cm kaybedersiniz. Eşikler **aşağı** yuvarlanıyorsa doğrudan
ihlaldir; kontrol et.

**Kabul ölçütü:** Değerler güncellendi ve mevcut testler yeşil.

---

## FAZ 2 · ÖLÇÜTÜ GÜVENİLİR KIL
**Süre: 2–3 gün**

FAZ 1 bitince not oynamış olmalı. Ama not hâlâ **tek daireden** geliyor — n=1.

### A2.1 · DXF arşivini 2 → 10 çizime çıkar

**Ne:** `veri/dxf_arsiv/` şu an 2 dosya: `2-1-ev-kat-plani.dxf`, `Daire2.dxf`.
En az 10 gerçek çizim ekle. Tipoloji dağılımı:

| Tipoloji | Hedef çizim | Neden |
|---|---|---|
| 3+1 | 4 | Pazarın en büyük dilimi |
| 2+1 | 3 | İkinci büyük, ve elinizde en az veri olan |
| 4+1 | 2 | Model orada zaten güçlü |
| 1+1 | 1 | Kapsama |

**Neden:** Tek daireden alınan not, not değil. n=1'de her sapma hem model
hatası hem tasarım serbestliği olabilir; ikisi ayrışmaz.

**Kabul ölçütü:** `sinav.py` 10 çizim üzerinde koşuyor ve **ortalama + en kötü**
notu ayrı raporluyor.

---

### A2.2 · Yanlış-pozitif testi — en önemli ölçüt

**Ne:** Her gerçek çizimi eleyiciden geçir. Soru şu:
**Kural kümem mimarın gerçekten çizdiği planı eliyor mu?**

**Neden:** Bu, kural yazarken kendini kandırmanı engelleyen tek mekanizmadır.

> **Eleyici gerçek bir planı eliyorsa, kural yanlıştır — plan değil.**

Bu testin bedeli daha önce ödendi: elle uydurulmuş alan bantları, mimarın
**13 gerçek çözümünden 13'ünü birden** reddediyordu (%67 oda bandın dışındaydı).
Test olmadan bu görülmemişti.

**Kabul ölçütü:** Yanlış-pozitif oranı **≤ %10**. Yüksekse elenen her plan için
hangi kural elediğini yaz — o kural gözden geçirilecek.

---

### A2.3 · Net/brüt tanımını karara bağla

**Ne:** Şu üç soruyu yazılı olarak cevapla ve `kural_kitabi.json`'a yaz:

1. Oda dikdörtgenleri **eksen çizgisi** mi, **net iç yüz** mü?
2. İç duvar ve dış duvar kalınlığı kaç?
3. Balkon net alana **dahil mi**?

**Neden:** Sınav gerçek çizimden **net** ölçü okuyor. Üretici duvar kalınlığı
olmadan çalışıyorsa **eksen** ölçüsü üretiyor. İkisi aynı skalada değil ve
aradaki fark %5 mertebesinde — yani sınav notunun bir kısmı gerçek hata değil,
**tanım farkı.**

Bu düzelmeden sınav notunun mutlak değeri güvenilmez (yönü güvenilir kalır).

**Kabul ölçütü:** Karar yazılı. Eksen çizgisi seçilirse, `sinav.py` karşılaştırma
yaparken duvar payını düşsün.

---

## FAZ 3 · VERİ → PARAMETRE OKUNU BAĞLA
**Süre: 3–5 gün · Burada veri ilk kez işe yaramaya başlar**

FAZ 0–2 bitmeden bu faza girme. Yapısal hatalar dururken kalibrasyon,
yanlış modeli daha iyi uydurmaktan ibarettir.

### A3.1 · Kalibrasyon betiği — elle yapılanı otomatikleştir

**Ne:** `araclar/ogrenme/kalibrasyon.py` yaz. Girdi: `veri/ogrenme/*/plan_arsivi.jsonl`
+ `veri/dxf_arsiv/`. Çıktı: tipoloji başına oda alanı katsayıları.

Model: **oransal** — `alan = oran × net_m2`. Servis hacimleri için tavanlı hal:
`alan = clip(oran × net, taban, tavan)`

**Neden — ölçüldü:** 4+1'in dört satırında üç model karşılaştırıldı (LOOCV):

```
sabit     RMSE 4.69
oransal   RMSE 1.15   ← kazanan
doğrusal  RMSE 1.39   (kesişim eklemek aşırı uydurma; F testi anlamsız)
```

Oran, satırdan satıra çok az oynuyor — 4+1'de en fazla 2.22 puan (salon).
Ama **3+1'de tutmuyor**: `wc_dus` yayılımı 4.00 puan (%40). Sebebi gürültü
değil, mimarın bilinçli bandı: 3+1'de duşlu wc **6–12 m² arası**.

**Bu yüzden şema hem oran hem bant taşımalı:**
```json
"wc_dus": { "oran": 0.10, "bant": [6.0, 12.0], "n_satir": 2, "guven": "dusuk" }
```

**Uyarı — belirsizliği gizleme:** 1+1 ve 3+1 katsayıları **2 veri noktasına**
dayanıyor. İki noktadan geçen doğrunun artık serbestlik derecesi sıfırdır;
hata payı **hesaplanamaz**. JSON'a `"guven_araligi": null` yaz, sahte bir
aralık uydurma. Ayrıca kullanım aralığı kilidi koy: 3+1 katsayıları 75–100 m²
dışında **ekstrapolasyondur**.

**Kabul ölçütü:** Betik koşuyor, katsayılar sürümlü dosyaya yazılıyor,
her katsayıda `n_satir` ve `guven` alanı var.

---

### A3.2 · 2+1'i havuzlamayla kurtar

**Ne:** 2+1 için tabloda tek satır var → katsayı çıkarılamıyor. Çözüm:
tipolojileri birlikte modelle. Odaları dört gruba topla (yaşam · sirkülasyon ·
yatak · ıslak), grup payını yatak odası sayısı *k*'nın fonksiyonu yap.

**Neden — ölçüldü:** 2+1 eğitimden **tamamen çıkarılıp** tahmin edildiğinde:

```
grup      R²      tahmin    gerçek    hata
yaşam    0.890    0.4226    0.4400    −3.9%
sirkül   0.739    0.0882    0.0933    −5.5%
yatak    0.873    0.3277    0.3200    +2.4%
ıslak    0.903    0.1604    0.1333   +20.3%
oda düzeyi MAE 1.35 m² (bağıl %11)
```

Parametre sayısı 30 → 12. **Sıfır yeni veriyle bir tipoloji kurtuluyor.**

Uyarı: bu tek tutulan satırla doğrulandı — n=1 doğrulama, doğrulama değil,
tutarlılık kontrolüdür. İkinci bir 2+1 satırı bunu gerçek teste çevirir.

**Kabul ölçütü:** 2+1 için katsayı üretilebiliyor ve sınav notu 2+1 çizimlerinde
kabul edilebilir çıkıyor.

---

### A3.3 · Kazıma hattının verimini ölç

**Ne:** `veri/ogrenme` durumu:

| | |
|---|---|
| Gezilen adres | 89 |
| Arşivlenen plan | **9** (2+1: 7 · 3+1: 2) |
| Kök `plan_arsivi.jsonl` | **0 satır — boş** |
| Verim | **%10** |

Üç iş: (a) kök arşivin neden boş olduğunu bul — iki ayrı yazıcı mı, yarım
kalmış taşıma mı; (b) 89 adresin 80'inin neden plan vermediğini örnekle;
(c) verim %30'un altındaysa arama kelimelerini mi okuyucuyu mu düzeltmek
gerektiğini ölçerek karar ver.

**Neden:** Şu an kazıma hattının çıktısını tüketen bir parametre yolu yok.
A3.1 bittikten sonra tüketici doğar; o zamana kadar hattı **genişletme**,
sadece verimini ölç.

**Kabul ölçütü:** Kök arşivin boş olma sebebi yazılı; verim sayısı raporda.

---

## FAZ 4 · TERCİH ÖĞRENMESİ
**Süre: sonra · Ön koşul: FAZ 0–3 bitmiş olmalı**

**Ne:** İkili karşılaştırma toplama ve ağırlık öğrenme.
`veri/tercihler.json` zaten doğru tasarlanmış — özellikle şu cümle:

> *"Tercih SKORU değiştirir, KURALI değil."*

Bu ayrım doğru ve korunmalı: **kural eleyicidir (ikili, telafi edilemez),
skor sıralayıcıdır (ağırlıklı, öğrenilir).**

**Neden en sonda:** Kendi eşiğiniz `sinyal_esigi: 30`. Elde ~1 daire var.
Dahası: elemeden geçen bol miktarda **canlı** plan olmadan sıralamayı
öğrenmenin anlamı yok — kötü planları iyi sıralamak, iyi plan üretmez.

**Yöntem hazır olduğunda:** Bradley-Terry / lojistik sıralama.
`ozellik(kazanan) − ozellik(kaybeden)` farkları üzerine lojistik regresyon.
Özellikler **yorumlanabilir** ve **z-skorla normalize** olmalı — aynı toplamda
m², oran ve adet karıştırmak ölçek hatasının en sık kaynağıdır.

---

## YAPILMAYACAKLAR — kapsam kilidi

Bunlar bilinçli olarak **dışarıda**. Gerekçesiz açma:

| Yapılmayacak | Neden |
|---|---|
| **ML / üretici model (GAN, difüzyon)** | Kısıt **garantisi** vermez. Kalite ölçütünüz "bir mimarın gözüyle savunulabilir" — savunulabilirlik garanti ister. CP-SAT verir, üretici model veremez |
| **Sirkülasyonu L/T'ye çevirmek** | Motorun temel varsayımını (bir oda = bir dikdörtgen) söker. Ölçüm bunu gerektirmiyor: 3+1 tek dikdörtgen sirkülasyonla 10 odayı çözdü |
| **Kazıma hattını genişletmek** | Çıktısını tüketen parametre yolu açılana kadar veri biriktirmek maliyettir |
| **Aks / kolon kısıtı (sert)** | Topoloji çeşitliliğini düşürür. Önce `dogrula.py`'ye "kolonsuz açıklık > 6 m" **kontrolü** koy, hasarı ölç; kısıt sonra |
| **Aşama C retrieval** | Arşiv şimdilik **ölçüt** için kullanılacak, retrieval için değil |
| **Yeni tipoloji (5+1)** | Tek satırla eklemek 2+1'in bugünkü çıkmazını tekrar üretir. En az iki satır birlikte |

---

## ÖLÇÜT PANOSU — her hafta bak

| Ölçüt | Bugün | Hedef | Nerede |
|---|---|---|---|
| Sınav notu (ortalama) | 4.48 (n=1) | yükselen eğilim | `sinav_notlari.jsonl` |
| Eksik tip sayısı | 1 (balkon) | **0** | sınav bileşeni |
| Sirkülasyon farkı | −9.73 puan | \|fark\| < 3 | sınav bileşeni |
| Alan mutlak sapma | 30.66 m² | < 15 m² | sınav bileşeni |
| Sınav çizim sayısı | 2 | **≥ 10** | `veri/dxf_arsiv/` |
| Yanlış-pozitif oranı | ölçülmedi | ≤ %10 | A2.2 |
| Öğrenilmiş plan | 9 | — (önce yapı) | `plan_arsivi.jsonl` |
| Tercih karşılaştırma | ~1 | ≥ 30 | `tercihler.json` |

**Kural:** Bu panodaki hiçbir sayı, onu ölçen bir koşum olmadan tahmin edilmez.
Ölçülmeyen satıra "ölçülmedi" yazılır, boş bırakılmaz.

---

## İLK GÜN — somut sıra

1. **A0.1** sınav sarmalayıcı + `git_sha` (1–2 saat)
2. **A0.2** taban çizgisi dondur (10 dakika)
3. **A0.3** regresyon bekçisi + bilerek kırıp doğrula (1 saat)
4. **A0.4** notu üç bileşene ayır (1 saat)
5. **A1.1** sirkülasyon tavanını kaldır → sınavı koş → **notu karşılaştır**

Beşinci adımda not oynarsa, **dördüncü ok ilk kez çalışmış olur.**
O an bu projenin dönüm noktasıdır: sistem ilk kez kendi değişikliklerini
denetleyebiliyor demektir.

Not oynamazsa: sirkülasyon tavanı sanıldığı yerde değil. Kısıtı isimlendirmek
için CP-SAT'ın çelişki çekirdeği aracını kullan —

```python
a = model.NewBoolVar("sirkulasyon_tavani")
model.Add(...).OnlyEnforceIf(a)
model.AddAssumptions([a, b, c, ...])
solver.Solve(model)
solver.SufficientAssumptionsForInfeasibility()   # çelişen MİNİMAL alt küme
```

Bu API doğrulandı: üç kısıtlı yapay bir çelişkide çelişen ikiliyi döndürdü,
çelişkiye dahil olmayanı dışarıda bıraktı. Ablasyonla tek tek aramaya gerek yok.

---

## BU PLANDA YANILABİLECEĞİM YERLER

Dürüstlük gereği:

1. **Kod yapınızı görmedim.** `sirkulasyon_max_oran`'ın hangi dosyada, hangi
   isimle durduğunu bilmiyorum. Adım adlarını kendi yapınıza uyarlayın.
2. **Sınav notunun 4.48 nasıl hesaplandığını bilmiyorum** — 10 üzerinden mi,
   başka bir skala mı, yönü hangisi. A0.4'te bileşenlere ayırırken bunu netleştirin.
3. **PAİY madde numaraları birincil metinden teyit edilmedi.** Arama ile çapraz
   doğrulandı, tutarlı çıktı, ama ruhsat öncesi mevzuat.gov.tr'den bakın.
4. **Salon şişmesinin tek sebebinin ilk iki hata olduğu bir hipotez** — toplamların
   tam sıfır çıkması güçlü belirti ama kanıt değil. A1.3 bunu test eder.
5. **%19.83 tek bir daireden.** Sirkülasyon tavanını buna göre belirlemek n=1'e
   dayanmak olur. A2.1'den sonra yeniden bakın.

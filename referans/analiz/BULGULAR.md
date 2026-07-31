# BULGULAR — m² tablosunun parametre denetimi

Kaynak veri: Murat Turna'nın hazırladığı m² tablosu, 31.07.2026. **Gerçek veri.**
Kod: `referans/analiz/` — `python -m referans.analiz.coz`, `python -m referans.analiz.denetim`

---

## 0. Baş bulgu — kendi ölçütüm kendi parametrelerimi çürüttü

Önerdiğim testi hatırlatayım:

> *Eleyici, gerçek bir mimarın çizdiği planı eliyorsa **kural yanlıştır**, plan değil.*

Test uygulandı:

| | |
|---|---|
| Tablodaki gerçek çözüm | **13** |
| Benim uydurduğum bantlarla üretilebilecek olan | **0** |
| Bandımın dışında kalan oda | **52 / 78 (%67)** |

`oda_programi.json`'daki bütün alan bantları elle uydurulmuştu ve **hepsi
yanlıştı.** Bu, verinin en değerli tarafı: bir hafta ağırlık ayarlayarak
bulunamayacak bir şeyi tek tabloyla gösterdi.

En büyük sapmalar:

| Oda | Benim bandım | Gerçek |
|---|---|---|
| `duslu_wc` | 2.4 – 4.5 m² | 6 – 16 m² |
| `yatak` | 9 – 15 m² | 9 – 23 m² |
| `mutfak` | 8 – 15 m² | 9 – 26 m² |
| `antre` | 3 – 7 m² | 9 – 16 m² |
| `salon` | 22 – 38 m² | 20 – 50 m² |

---

## 1. Asıl yapısal keşif: oda alanı **oransaldır**

Tablodaki en güçlü örüntü bu. Bir tipoloji içinde her odanın **net alandaki
payı neredeyse sabit** kalıyor; oda büyüklüğü mutlak bir bant değil, bir yüzde.

4+1, dört veri satırı (140 → 225 m², %61 büyüme):

| Oda | 140 m² | 180 m² | 210 m² | 225 m² | pay |
|---|---|---|---|---|---|
| Salon | %21.4 | %21.1 | %20.0 | %22.2 | **~%21** |
| Mutfak | %11.4 | %11.1 | %11.4 | %11.6 | **~%11.4** |
| Eb. Yatak | %13.6 | %13.3 | %12.4 | %13.3 | **~%13** |
| Koridor | %5.0 | %5.6 | %5.2 | %5.3 | **~%5.3** |
| wc+duş | %6.4 | %6.7 | %7.1 | %7.1 | **~%6.8** |

Saçılım ±%1'in altında. Bu tesadüf değil, bir tasarım kuralının izi.

**Ama bir istisna var ve önemli:** servis hacimleri oransal değil, **sabit**.

- `kucuk_wc` — 3+1'de 75 m²'de de 100 m²'de de **4.0 m²**
- 1+1'de `yatak` — 45 m²'de de 55 m²'de de **14.0 m²**
- 1+0'da `wc_dus` — 35, 45, 52 m²'de hep **8.0 m²**

Yani doğru model bir tek formül değil, **iki cinsli**:

```
oransal oda :  alan = oran × net_m2          (salon, mutfak, yatak, koridor)
sabit oda   :  alan = sabit                   (küçük wc, servis hacimleri)
```

Katsayılar veriden çıkarıldı → `ic_plan/program_semasi.json`.

---

## 2. Parametre parametre denetim

### P1 · Sirkülasyon tavanı %8 — **kendi verinizle çelişiyor**

`CLAUDE.md`: *"Sirkülasyon %8'i geçmemeli."*

| Tanım | %8'i aşan satır |
|---|---|
| Yalnızca koridor | **4 / 9** |
| Koridor + antre | **8 / 9** |

4+1'de koridor+antre payı **%11.4 – %12.4**. 3+1'de koridor tek başına
%8.8 – %9.0.

Üç olasılık var, hangisi doğruysa siz söylersiniz:
1. "Sirkülasyon" yalnızca koridoru kastediyor, antre hariç → yine de 3+1 aşıyor
2. Tavan %8 değil, tipolojiye göre değişiyor (küçük dairede yüksek, büyükte düşük — veri bunun tersini söylüyor)
3. Tavan yanlış yazılmış

**Veriden okunan gerçek değerler:** 1+1 %6.7–9.1 · 2+1 %9.3 · 3+1 %8.8–9.0 · 4+1 %11.4–12.4

### P2 · Antre — model zorunlu tutuyor, tabloda **4+1'e kadar yok**

| Tipoloji | Antre | Koridor |
|---|---|---|
| 1+0 | yok | yok |
| 1+1 | yok | **var** |
| 2+1 | yok | **var** |
| 3+1 | yok | **var** |
| 4+1 | **var** | var |

Antre ayrı bir oda olarak ancak **140 m²'de** beliriyor. Altında giriş holü
ile koridor aynı mekan.

**Modelim giriş kapısını `Antre` odasına bağlıyor — 3+1 için yanlış.**
Düzeltme: giriş, o tipolojide hangi sirkülasyon mekanı varsa ona bağlanmalı.

### P3 · "Salondan mutfağa geçilmez" — **1+1'de anlamsız**

1+1'de tablo `Salon+mutfak` diye **tek hücre** veriyor: mutfak salonun içinde.
Kural 2+1 ve yukarısında geçerli.

**Sonuç: kurallara tipoloji kapsamı alanı gerekiyor.** Bir mimari kural her
tipolojide geçerli değil; "hangi tipolojilerde" bilgisi kuralın parçası olmalı.

### P4 · Balkon — tabloda **hiç yok**

Hiçbir tipolojide balkon sütunu yok ve oda alanları net m²'yi tam dolduruyor.
Yani bu tablo balkonu net alana **katmıyor**.

Modelim balkonu konturun içine döşüyor ve alanını net alandan düşüyor —
120 m²'lik daireden 5–8 m²'yi iç mekandan çalmak demek. **İki model uyuşmuyor.**
Balkon net bütçenin dışında tutulmalı: ya kontura eklenen çıkma, ya ayrı kalem.

### P5 · Islak hacim — aradığınız eşiğin izi burada

3+1'de `wc+duş`:

| net m² | wc+duş | pay |
|---|---|---|
| 75 | 6.0 m² | %8.0 |
| 100 | **12.0 m²** | %12.0 |

**Tam iki katı.** Tek bir banyo 6 m²'den 12 m²'ye büyümez — 12 m²'lik tek
banyo zaten anormal. Bu, ikinci bir ıslak hacmin (ebeveyn banyosu) belirmesi
gibi duruyor.

> **Hipotez: 3+1'de ebeveyn banyosu eşiği ≈ 100 m² net.**
> Sizin "alan biraz daha büyükse ebeveyn wc ticari avantaj" cümlenizin
> sayısal karşılığı bu olabilir.

⚠ **Doğrulanmadı.** Tek soruyla kapanır: *100 m²'lik 3+1'inizde kaç ayrı
ıslak hacim var — bir mi iki mi?*

Karşılaştırma: 4+1'de iki ıslak hacim **ayrı sütun** olarak duruyor
(`wc+duş` ve `wc+çamaşır`). 3+1'de tek sütun var. Bu, 3+1'in 12 m²'sinin
gerçekten tek oda olabileceği ihtimalini de açık bırakıyor.

### P6 · Tipoloji m² aralıkları — örtüşme ve **boşluk**

| Tipoloji | net m² aralığı | veri satırı | güven |
|---|---|---|---|
| 1+0 | 24 – 52 | 4 | yüksek |
| 1+1 | 45 – 55 (65, 70 boş) | 2 | orta |
| 2+1 | 75 (55, 87, 95 boş) | **1** | **düşük** |
| 3+1 | 75 – 100 (120, 125 boş) | 2 | orta |
| 4+1 | 140 – 225 | 4 | yüksek |

- **Örtüşme 45–52 m²:** aynı alan 1+0 veya 1+1 olarak satılabilir — ticari karar
- **Örtüşme 75 m²:** 2+1 veya 3+1 — ticari karar
- **Boşluk 100–140 m²:** hiçbir tipoloji tanımlı değil. 3+1'in 120/125 satırları boş; 4+1 ancak 140'ta başlıyor. **Bu aralık ürün yelpazesinde delik.**

### P7 · Ölçülemeyen parametreler — veri yetersiz

Tabloda **sadece alan** var, boyut yok. Şu parametreler bu veriyle
doğrulanamaz ve hâlâ benim uydurmam:

| Parametre | Durum |
|---|---|
| `min_kenar` (oda kısa kenarı) | **doğrulanamadı** |
| `max_oran` (en/boy ≤ 2.2) | **doğrulanamadı** |
| `kapi_genisligi` 0.90 m | doğrulanamadı |
| `min_cephe` 1.20 m | doğrulanamadı |
| balkon `derinlik_max` 2.00 m | doğrulanamadı |

**En yüksek getirili sonraki veri: aynı tabloya oda en × boy sütunları.**
O gelirse `min_kenar` ve `max_oran` da uydurma olmaktan çıkar.

### P8 · Tablo aritmetiği — üç satır tutmuyor

| Tipoloji | net m² | odalar toplamı | fark |
|---|---|---|---|
| 2+1 | 75 | 74.0 | **−1.0** |
| 3+1 | 100 | 101.0 | **+1.0** |
| 4+1 | 210 | 202.0 | **−8.0** |

İlk ikisi yuvarlama olabilir. **4+1 / 210 m² satırındaki 8 m² dikkat ister** —
Excel'in kendi `total` hücresi de 202 diyor, yani satır eksik kalmış olabilir.

### P9 · Net / brüt — çözülmemiş

Tablo **net** m². Modelim bir kontur üzerinde çalışıyor ve duvar kalınlığı yok
(PLANLAMA.md Ö8). Net ile brüt arasındaki farkı (duvarlar + balkon) tanımlamadan
bu katsayılar modele doğrudan bağlanamaz.

### P10 · "min" başlığı — yorum sorusu

Excel'de her sütun **"min"** diye etiketli. Ama satır toplamları net m²'yi
tam tutuyor. İki okuma mümkün:

- **(a)** Bunlar minimumlar ve o net m², programın sığdığı **en küçük** alan
- **(b)** Bunlar o m² için hedef değerler

Fark önemli: (a) ise bandın alt ucu, (b) ise ortası. Şu an (b) varsaydım.
**Hangisi doğru?**

---

## 3. Tahmin — boş satırlar

Model, Excel'de boş bıraktığınız satırları dolduruyor. **Bunlar sizin veriniz
değil, modelin çıkarımı** — onay bekler.

**1+1**

| net m² | Salon+mutfak | Koridor | Yatak | wc+duş |
|---|---|---|---|---|
| 65 | 32.0 | 7.0 | 14.0 | 12.0 |
| 70 | 35.0 | 8.0 | 14.0 | 13.0 |

**3+1**

| net m² | Salon | Koridor | Mutfak | Yatak 1 | Yatak 2 | Yatak 3 | küçük wc | wc+duş |
|---|---|---|---|---|---|---|---|---|
| 120 | 37.3 | 10.7 | 14.2 | 12.6 | 14.2 | 10.6 | 3.9 | 16.5 |
| 125 | 39.2 | 11.2 | 14.7 | 12.8 | 14.7 | 10.8 | 3.9 | 17.7 |

**2+1 tahmin edilemedi** — tabloda tek satır var, eğim çıkmıyor.
55 / 87 / 95 satırlarından **birini** doldurursanız 2+1 de modellenebilir hale
gelir. Şu an en zayıf halka bu.

---

## 4. Bu veriden çıkan iş listesi

Öncelik sırasıyla:

1. **Alan bantlarını at, oransal modele geç.** Katsayılar hazır (`program_semasi.json`). Bu tek değişiklik, modelin mimarın gerçek çözümlerini üretebilmesinin önkoşulu.
2. **Antre zorunluluğunu kaldır**, girişi tipolojinin sirkülasyon mekanına bağla.
3. **Balkonu net bütçeden çıkar.**
4. **Kurallara tipoloji kapsamı ekle** (salon-mutfak kuralı 1+1'de geçerli değil).
5. **Sirkülasyon tavanını kendi verinizle yeniden tanımlayın** — %8 tutmuyor.
6. **2+1 için bir satır daha, ve tabloya en × boy sütunları.** En yüksek getirili iki veri isteği.

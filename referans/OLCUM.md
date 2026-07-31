# ÖLÇÜM — CP-SAT iç plan üretimi

**ÖLÇÜLDÜ, uydurulmadı.** Hepsi bu depoda tekrar üretilebilir.

Ortam: Linux, 8 çekirdek, Python 3.11.15, `ortools` 9.15.6755, `num_workers=8`.
Model: `referans/ic_plan/motor.py`, girdi `ornek_girdi.json` (12.00 × 10.00 m = 120 m², 10 oda, 9 komşuluk isteği).

> Not: sizin ortamınız Python 3.14 ve macOS. `ortools` 9.15.6755'te
> `cp314 / macosx_11_0_arm64` wheel'i **var** (pypi.org/pypi/ortools/9.15.6755/json,
> 31.07.2026'da bakıldı). Python 3.14 tercihinde bir engel yok.
> Süreler makineye göre değişir; **oranlar** anlamlı, mutlak saniyeler değil.

---

## 1. Çözüm ızgarası taraması

Tüm kısıtlar açık, süre bütçesi 30 sn:

| Çözüm ızgarası | Ham durum | Süre |
|---|---|---|
| 0.50 m | OPTIMAL | 0.8 sn |
| 0.25 m | OPTIMAL | 16.0 sn |
| 0.20 m | OPTIMAL | 13.7 sn |
| **0.10 m** | **FEASIBLE** (optimal kanıtlanamadı) | 30.0 sn (bütçe doldu) |

Aynı 0.10 m yapılandırması, kısıt çıkarma denemelerinde **UNKNOWN** verdi —
yani hiç çözüm bulamadı. Çok çekirdekli CP-SAT deterministik değildir;
0.10 m bu problem boyutunda **kararsız bölgede**.

120 sn verilince 0.25 m yine OPTIMAL (23.4 sn) — yani darboğaz süre değil,
koordinat uzayının büyüklüğü. 12 × 10 m'lik daire 0.10 m'de 120 × 100
koordinat, 0.20 m'de 60 × 50 demek: arama uzayı 4 kat küçülüyor.

**Sonuç:** çözüm ızgarası **0.20 m**. 10 cm'in tam katı olduğu için
çıktı veri sözleşmesini bozmaz. Bu, `CLAUDE.md`'deki "ızgara 10 cm,
CP-SAT içinde tamsayı hücre" satırıyla çelişir; ölçüm gerekçesiyle
itiraz ediyorum, karar sizin.

## 2. Oda sayısının etkisi

| Kurgu | Izgara | Durum | Süre |
|---|---|---|---|
| 6 oda / 10×8 m | 0.10 m | OPTIMAL | 7.5 sn |
| 6 oda / 10×8 m | 0.25 m | OPTIMAL | 1.0 sn |
| 10 oda / 12×10 m | 0.10 m | kanıtlanamadı | 30.0 sn |

Zorluk oda sayısıyla üstel büyüyor. Aşama B'de tüm kat çözülürken
**daire daire çözmek** şart; kat plakasını tek modelde çözmeye kalkışmak
bu ölçümlere göre duvara toslar.

## 3. Kısıt çıkarmak modeli KOLAYLAŞTIRMIYOR

0.10 m ızgarada:

| Deneme | Sonuç |
|---|---|
| tam model | FEASIBLE |
| gün ışığı kısıtı kapalı | UNKNOWN |
| sirkülasyon tavanı kapalı | UNKNOWN |
| komşuluk istekleri yok | UNKNOWN |

Sezgiye aykırı ama doğru: CP-SAT'ta kısıt arama uzayını **budar**.
Kısıt kaldırmak, çözücünün elinden budama aracını almaktır.
"Çözemiyorsa kısıtları gevşetelim" refleksi burada yanlış yönlendirir —
önce ızgarayı kabalaştırın.

## 4. Yakalanan iki hata

**H1 — Eşik sessizce düştü.** `round(0.90 / 0.20) = 4` hücre = **0.80 m**.
Kapı genişliği eşiği 0.90 m iken model 0.80 m'lik geçişi "sağlandı" saydı;
Koridor–Yatak 2 ortak kenarı 0.80 m çıktı. Alt sınırlar **yukarı**
(`_tavan`), üst sınırlar **aşağı** (`_taban`) yuvarlanmalı.
Düzeltince model hem doğru hem **daha hızlı** oldu (25.2 sn → 7.3 sn):
daha sıkı eşik daha çok buduyor.

**H2 — Daireye girilemiyordu.** İlk üretilen plan bütün yazılı kısıtları
OPTIMAL sağladı: boşluksuz döşeme, en/boy ≤ 2.2, sirkülasyon %7.5,
9/9 komşuluk, ıslak hacimler bitişik. Ama **Antre planın ortasındaydı,
hiçbir dış kenara değmiyordu.** Giriş kapısı kısıtı yazılmamıştı.

Bu ikisi aynı dersi veriyor ve bu depodaki en önemli çıktı bu:

> Çözücü yazmadığın kısıtı bilmez. Plan kalitesizse önce üreticiyi değil,
> **kısıt envanterini** sorgula.

## 5. Erişim kuralı — eleme oranının seyri

Kural kaynağı: Murat Turna, 31.07.2026 — *"banyo koridora açılır; yatak
odasından yalnızca ebeveyn banyosu için girilir."*

| Aşama | Eleme oranı | Kalan kusur |
|---|---|---|
| Erişim hiç yazılı değil | **6 / 8 (%75)** | banyoya yatak odasından giriliyor |
| Erişim sert kısıt, salon da geçerli sayılıyor | **2 / 8 (%25)** | banyo yalnızca salona açılıyor |
| `erisim` tablosu + `ebeveyn_banyo` tipi | **0 / 7 (%0)** | — |
| + "salondan mutfağa geçilmez" | **0 / 3 (%0)** | — |
| + balkon dış cephede · duşlu wc mahrem bölgede | **0 / 4 (%0)** | — |

### Kuralın bedeli: çeşitlilik

Eleme oranı %0'da kaldı ama **farklı topoloji sayısı 7'den 3'e düştü**
(aynı 14 çözüm denemesi). Mutfak kapısının sirkülasyondan olması zorunluluğu
arama uzayını daralttı. Sonraki turda balkon ve mahremiyet kuralları eklenince
4'e çıktı — daralma tek yönlü değil; kural bazen bir topolojiyi keserken
başkasını mümkün kılıyor.

Bu bir hata değil, ödünleşim — ve ölçülmesi gereken bir şey:

> Her sert kural, ölü planları keserken **canlı seçenekleri de** keser.
> Eleme oranı düşerken varyant sayısı da düşüyorsa, mimar daha temiz ama
> daha dar bir liste görüyor demektir.

İzlenecek iki sayı birlikte anlamlı: `eleme oranı` **ve** `farklı topoloji
sayısı`. İkincisi 5'in altına inerse deneme sayısını/süreyi artırın; yine
çıkmıyorsa kontur veya oda programı bu daireye fazla gelmiş olabilir.

### Kural 4–5: balkon cephede, duşlu wc mahrem bölgede

**Balkon.** `gun_isigi` kuralı "cepheye ≥1.20 m değsin" diyordu; bu yetmedi.
1.4 × 3.6'lık balkon **kısa kenarıyla** cepheye değip uzun kenarıyla plana
içerlek bir yarık gibi giriyordu. Mimarın kuralı: *balkon hiçbir zaman
odaların içinde olmaz, dış cephede olur.* Modele karşılığı:

```json
"cephe_kurali": { "uzun_kenar_cephede": true, "derinlik_max": 2.00 }
```

Sonuç: balkon 5.6 × 1.4, uzun kenarı cephede.

**Mahremiyet bölgesi.** "Banyo koridora açılır" kuralını ilk turda
`["sirkulasyon"]` diye kodlamıştım — ama sirkülasyon hem antreyi hem koridoru
kapsıyor. Antre giriş bölgesi, koridor mahrem bölge; ikisi aynı şey değil.
**Benim fazla genellemem**di. Tiplere `bolge` alanı (`giris` / `mahrem`)
eklendi, mahrem hacimlerin erişimi doğrudan `["koridor"]`e bağlandı.
Ayrıca `misafir_wc` (antreden) ile `duslu_wc` (koridordan) ayrı tipler oldu.

### Modelleme dersi: komşuluk ≠ kapı

Bu kural, sistemdeki bir kavram eksiğini açığa çıkardı. Model yalnızca
"iki oda kapı genişliğinde duvar paylaşıyor mu" biliyordu; "aralarında
kapı var mı" bilmiyordu. Salon ile mutfak **duvar komşusu olmalı**
(istenen bir şey) ama **kapı olmamalı**.

Şimdilik ayrım şöyle yürüyor: `komsuluklar` girdisi duvar komşuluğunu
(yumuşak, ödüllendirilir), `erisim` tablosu kapıyı (sert, kısıt) ifade
eder. Kapıların gerçekten yerleştirilmesi ayrı bir aşama ve henüz yok —
Aşama A2'de (DXF) şart olacak.

---

Beş kural yazarak eleme oranı %75'ten %0'a indi. **Kod değişmedi** —
kural `oda_programi.json`'daki `erisim` alanında duruyor:

```json
"banyo":         { ..., "erisim": ["sirkulasyon"] },
"ebeveyn_banyo": { ..., "erisim": ["ebeveyn"] }
```

Model ve eleyici artık aynı tabloyu okuyor; aralarındaki felsefe farkı
kapandı. Erişilebilirlik tanımı da özyinelemeli hâle geldi: *R odasına
varılır ⇔ R'nin, erişim tablosunun izin verdiği bir komşusu vardır ve
o komşuya da varılır.* Ayrıca "hangi odadan geçilir" listesi tutmaya
gerek kalmadı.

## 6. Son durum

`giris` kısıtı eklendikten sonra, 0.20 m ızgara, 30 sn bütçe:

- durum: `KABUL_EDILEBILIR` (optimal kanıtlanmadı, süre doldu)
- sağlanmayan komşuluk: `Antre–Salon` (1/9) — raporlandı, gizlenmedi
- sirkülasyon: %8.0 (tavan %8)
- bağımsız doğrulama (`dogrula.py`): **TEMIZ** — 0 ihlal

Giriş kısıtı modeli zorlaştırdı; bu beklenen ve doğru. Tek plan yerine
varyant üretmek (bkz. PLANLAMA.md Ö5) bu gerilimi mimarın önüne koyar.

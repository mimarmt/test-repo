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

## 5. Son durum

`giris` kısıtı eklendikten sonra, 0.20 m ızgara, 30 sn bütçe:

- durum: `KABUL_EDILEBILIR` (optimal kanıtlanmadı, süre doldu)
- sağlanmayan komşuluk: `Antre–Salon` (1/9) — raporlandı, gizlenmedi
- sirkülasyon: %8.0 (tavan %8)
- bağımsız doğrulama (`dogrula.py`): **TEMIZ** — 0 ihlal

Giriş kısıtı modeli zorlaştırdı; bu beklenen ve doğru. Tek plan yerine
varyant üretmek (bkz. PLANLAMA.md Ö5) bu gerilimi mimarın önüne koyar.

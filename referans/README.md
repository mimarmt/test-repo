# referans/ — CP-SAT iç plan üretimi, çalışan referans

Bu klasör `Parametrik-mimari-plan-Geliştirme` projesinin **yerine geçmez**.
Aşama A'daki `L3_ic_plan` modülünün yanına konulacak, karşılaştırılacak bir
referans uygulamadır. Amacı iki şey:

1. "Varyant puanlaması yanlış" sorununu **ölçülebilir** hâle getirmek,
2. Ölçümleri kanıtla vermek — `OLCUM.md`'deki her sayı burada tekrar üretilebilir.

## Okuma sırası

| Dosya | Ne |
|---|---|
| **`PLANLAMA.md`** | **Asıl belge — yöntem, öneriler, başarı tanımı.** Buradan başlayın |
| `OLCUM.md` | Ölçümler: ızgara taraması, yakalanan iki hata |
| `ic_plan/motor.py` | CP-SAT modeli. Baştaki açıklama modelin dört fikrini anlatır |
| `ic_plan/puanlama.py` | İki katmanlı değerlendirme: eleme + öğrenilmiş sıralama |
| `ic_plan/varyant.py` | Ağırlık uzayında örnekleme + topoloji imzasıyla tekilleştirme |
| `ic_plan/dogrula.py` | Bağımsız doğrulayıcı — motorun kendi iddiasına güvenmez |

## Çalıştırma

```bash
pip install ortools                     # 9.15.6755 ile ölçüldü
python -m referans.ic_plan              # tek plan üret + doğrula + SVG
python -m referans.ic_plan.demo_varyant # varyant üret → ele → sırala
```

Sizin projenizde `.venv/bin/python` kullanılır; buradaki `python3`
yalnızca bu kum havuzu içindir.

## Projenizin kurallarına uyum

- Türkçe, ASCII değişken adları ✓
- Metre (float) dışarıda, tamsayı hücre CP-SAT içinde ✓
- Ölçü eşikleri kodda değil `oda_programi.json`'da ✓
- Modüller saf fonksiyon: JSON al / JSON ver; dosya işi `__main__.py`'de ✓

**Bir kuralınıza itiraz var:** çözüm ızgarası 10 cm değil **20 cm**.
Gerekçe ölçülmüş, `OLCUM.md` §1. Karar sizin.

## Bilinen sınırlar

- Kontur dikdörtgen kabul edilir. L kontur için `bosluklar[]` mekanizması
  hazır (eksik parçayı sabit blok koyun) ama sınanmadı.
- Geçiş mekanı bağlılığı 3 düğüme kadar garanti. Aşama B'de akış tabanlı
  kodlama gerekecek.
- Duvar kalınlığı yok; odalar sıfır kalınlıkta duvar paylaşıyor
  (bkz. PLANLAMA.md Ö8).
- `demo_varyant.py` içindeki mimar tercihleri **yapaydır**, makineyi
  göstermek içindir. Gerçek ağırlık gerçek tercihten çıkar.

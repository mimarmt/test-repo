# SENTEZ — dört ajanın ortak hükmü ve bundan sonrası

31.07.2026 · Jüri: mevzuat · ticari · tesisat-yapısal · veri-deney tasarımı

---

## 0. Ajanlar birbirini görmeden aynı yere vardı

Dördü ayrı ayrı, farklı gerekçelerle **ölçü tanımının çözülmemiş olduğunu** söyledi:

| Ajan | Kendi diliyle söylediği |
|---|---|
| **tesisat/yapısal** | *"En çok zarar veren eksik bu. Bugün model her odayı net hedefinden ~%5 büyük üretiyor; rapor 120 m² diyor, gerçek ~105 m². **Ö8'i 8. sıradan 1. sıraya alın.**"* |
| **veri** | *"Sıfır maliyetli iki istek: 'min' başlığı minimum mu hedef mi? Cevap 30 katsayının tamamının yorumunu kaydırır."* |
| **mevzuat** | *"0.20 m ızgara mevzuatın iki temel eşiğini temsil edemiyor: banyo dar kenarı 1.50 m ve kapı 0.90 m, 0.20'nin katı değil."* |
| **ticari** | *"Bütün fiyat, KDV ve kredi hesapları net/brüt = 0.80 varsayımına dayanıyor — kaynaksız. Gerçek katsayı 0.72 çıkarsa ürün konumlandırması değişir."* |

**Bu yakınsama tesadüf değil, teşhisin kendisi.** Referans kümesi ölçütü ("mimarın planı ilk %5'te mi") bu tanım düzelmeden **anlamsız**: mimarın planı net ölçüyle çizilmiş, benimki eksen ölçüsüyle. İkisi aynı skalada karşılaştırılamaz.

---

## 1. Kendi işimde düzeltilen dört şey

**D1 · Izgara tavsiyem yarı yarıya geri alınıyor.**
`OLCUM.md` 0.20 m'yi performans gerekçesiyle önermişti. Mevzuat ajanı gösterdi ki yasal asgariler 0.20'nin katı değil:

| Eşik | 0.20 m ızgara | 0.10 m ızgara |
|---|---|---|
| İç kapı 0.90 m | → 1.00 m (+0.10) | **tam** |
| Banyo kısa kenar 1.50 m | → 1.60 m (+0.10) | **tam** |
| Yatak kısa kenar 2.50 m | → 2.60 m (+0.10) | **tam** |

Daha önce eklediğim `_tavan()` (yukarı yuvarlama) sayesinde bunlar **ihlal üretmiyor** — ama sistemi gereksiz sert yapıyor ve her ölçüde 10 cm yiyor. Karar artık saf performans değil: **0.20 = hızlı ama fazla sert, 0.10 = tam ama yavaş.**

**D2 · Gerçek mevzuat ihlalleri (düzeltildi).**
`duslu_wc` alan_min 2.4 → **4.20 m²** (banyo 3.00 + hela 1.20), kısa kenar 1.20 → **1.50 m**; `ebeveyn_banyo` kısa kenar 1.40 → **1.50 m**; daire giriş kapısı **1.00 m** (iç kapı 0.90'dan ayrıldı). Kaynak: PAİY m.29.

**D3 · "Sabit oda" iddiam fazla iddialıydı.**
Veri ajanı: 3 dayanaktan 2'si n=2 olduğu için **test edilemez**. Test edilebilen tek örnekte (1+0 wc_dus, n=4) sabit model kazanıyor ama tam sabit değil — 24 m²'de 6, üstünde 8. Doğru form tek ve daha az parametreli:
`alan = clip(oran × net, taban, tavan)`

**D4 · Veri isteği önceliğim yanlıştı.**
`BULGULAR` P7 "en × boy tüm tablo" diyordu. Veri ajanı maliyeti hesapladı: 156 hücre, 2+1 satırının **26 katı emek**. Her tipolojiden **birer satır** (60 hücre) aynı 5 parametreyi kurtarıyor.

---

## 2. Yeni ve ağır bulgular

### Y1 · 2+1 sıfır yeni veriyle kurtarılabiliyor
Tipolojiler arası havuzlama (odaları yaşam/sirkülasyon/yatak/ıslak diye grupla, payı yatak sayısı *k*'nın fonksiyonu yap). 2+1 eğitimden tamamen çıkarıldı, sonra tahmin edildi:

```
grup     R²      2+1 tahmin   GERÇEK    hata
yaşam   0.890      0.4226     0.4400    −3.9%
sirkül  0.739      0.0882     0.0933    −5.5%
yatak   0.873      0.3277     0.3200    +2.4%
ıslak   0.903      0.1604     0.1333   +20.3%
oda düzeyi: MAE 1.35 m² (bağıl %11)
```
Parametre sayısı 30 → 12. **Mevcut model 2+1 için hiçbir şey üretemiyor; havuz %11 hatayla üretiyor.**

### Y2 · Salon paradoksu — ticari olarak ciddi
3+1 / 100 m²'de salon **30 m²**. 4+1 / 140 m²'de salon yine **30 m²**. Alıcı %40 fazla m² parası ödüyor, salonu bir metrekare büyümüyor. Modelin tahmin ettiği 3+1 / 125'in salonu 39.2 m² — 180 m²'lik 4+1'in salonundan büyük.
4+1'de fazladan gelen 40 m²'nin neredeyse tamamı özel + servis hacimlerine gidiyor; antre+koridor payı %11.4–12.4.

### Y3 · 7.6 m'lik salon açıklığı inşa edilemez
Ürettiğim planda Salon 4.8 × 7.6 m. Betonarme kiriş açıklığının pratik sınırı 6–7 m. Ya ortadan kiriş geçecek ya içine kolon düşecek. **Modelde kolon/aks kavramı hiç yok.**
Yarım saatlik iş: `dogrula.py`'ye "kolonsuz açıklık > 6 m" kontrolü — kısıt yazmadan önce mevcut varyantların kaçının bu duvara tosladığını ölçer.

### Y4 · Islak hacim kuralı yanlış geometriyi ödüllendiriyor
"Tek şaft" ölçütü ne elemede ne modelde sert; yalnızca yumuşak. Üstelik **komşuluk ≠ şaft**: şaft bir *nokta*, komşuluk bir *kenar*. İki ıslak hacim yalnızca köşede buluşuyorsa model "dağılmış" der — oysa tek şaftın oturduğu yer tam orasıdır.
Doğru kısıt ucuz (2 değişken, 4n lineer kısıt): tüm ıslak hacimler **ortak bir düğüm noktası** içersin.
```python
model.Add(x1[i] <= sx); model.Add(sx <= x2[i])
model.Add(y1[i] <= sy); model.Add(sy <= y2[i])
```
Bir noktayı en fazla 4 oda paylaşabilir — 4'ten fazla ıslak hacim varsa **ikinci şaft gerekiyordur.** Aynı nesne düşey sürekliliği (kat indeksi taşımayan değişken) ve havalandırma bacasını da çözüyor.

### Y5 · Penceresiz banyo bacasız — bu yönetmelik ihlali
PAİY: banyo/tuvalet havalandırma bacası **veya** mekanik havalandırma **zorunlu**. Modelde baca kavramı yok; `gun_isigi: false` iki ayrı şeyi aynı kutuya koyuyor — "ışık istemez" ve "havalandırma istemez". İkincisi yanlış.

### Y6 · Mimarın 13 çözümünden yalnız biri mevzuata takılıyor
**1+0 / 24 m².** PAİY m.29 asgarileri toplamı 12+9+3.30+3.00+1.20 = **28.50 m²**. Ayrıca 1+0 ailesinin tamamında **mutfak kalemi yok** — m.29'a göre mutfak veya yemek pişirme yeri zorunlu.

### Y7 · Sistem mimarın kendi 3+1'ini hâlâ üretemiyor
Alan bantları artık tablodan geliyor (uydurma değil). Yine de 3+1 / 75 ve 100 için hiçbir toleransta çözüm çıkmadı. Ablasyon suçluyu buldu: **erişim kısıtı** — kapatınca OPTIMAL.
Sebep: bu tipolojide antre yok, tek koridor var ve model *yedi odanın da o tek dikdörtgene* açılmasını istiyor. Gerçek holler L şeklindedir. Holu 2–3 dikdörtgene bölmeyi denedim, o da çözmedi.
### Y7b · Tıkanma kesin olarak yerinden edildi (31.07.2026, iki cevaptan sonra)

Mimar iki soruyu cevapladı ve model buna göre yeniden kuruldu:
- Tablodaki değerler **asgari** (hedef değil) → bant tek yönlü: `alan_min = tablo`, üst uç serbest
- 3+1'de ebeveyn banyosu **yok** → çekirdek program 8 oda

Bu, ilk tıkanmanın bir parçasını açıkladı: satır toplamı net m²'yi tam
tuttuğu için, o m²'de **hiç serbestlik yok** — her oda tam asgarisinde
olmak zorunda. Kontur asgariler toplamının %135'ine çıkarılınca
**OPTIMAL** geldi (134.3 m², 8 oda). İki kusur kaldı, ikisi de aynı
kökten: `kucuk_wc`'nin erişimi `["antre"]` yazıyordu ama bu tipolojide
antre yok. Düzeltilince — **tekrar çözümsüz.**

**Kesin teşhis:** tek dikdörtgen koridor 8 odaya birden hizmet edemiyor.
Kapı eşiği 0.20 m ızgarada 1.00 m'ye yuvarlanıyor; 8 oda × 1.00 m = 8 m
temas, üstelik koridor girişe de değecek ve en/boy ≤ 6.0 kalacak.

> **"Bir oda = bir dikdörtgen" varsayımı sirkülasyon için geçersiz.**
> Motorun 1. omurga fikri (dikdörtgen varsayımı bağlantılılığı bedavaya
> getirir) tam da sirkülasyonda kırılıyor. Gerçek holler L veya T
> şeklindedir. Bu artık 7. sırada bir iş değil, **net/brüt ile birlikte
> ilk sırada.**

---

## 3. Bundan sonrası — sıra

| # | İş | Neden bu sırada | Maliyet |
|---|---|---|---|
| **1** | **İki soruyu cevaplayın** (aşağıda) | Bedava, ve 30 katsayının yorumunu belirliyor | 2 dakika |
| **2** | **Net/brüt kararı** — duvar kalınlığı, balkonun net alana dahil olup olmadığı | Dört ajanın da ortak hükmü. Referans kümesi ölçütü bu düzelmeden anlamsız | karar 1 saat |
| **3** | **Şaft düğümü kısıtı** (Y4) | En ucuz–en getirili. Tek nesne, üç sorunu çözüyor | 6 satır |
| **4** | **`dogrula.py`'ye açıklık kontrolü** (Y3) | Kısıt yazmadan önce hasarı ölç | yarım saat |
| **5** | **Havalandırma bacası** (Y5) | Yönetmelik — eleyici kural | md.3'ün nesnesine biner |
| **6** | **2+1 havuz katmanı** (Y1) | Sıfır yeni veriyle bir tipoloji kurtarıyor | yarım gün |
| **7** | **Erişim/hol modeli** (Y7) | Sistem gerçek 3+1 üretene kadar hiçbir ölçüt çalışmaz | araştırma |
| **8** | Aks/kolon (Y3 sert hali) | md.2'ye bağımlı; topoloji çeşitliliğini düşürür, **önce ölçün** | 1 gün |

---

## 4. Mimardan istenecek veri — birleşik öncelik

Veri ajanının bilgi/hücre hesabıyla:

| # | İstek | Hücre | Ne kazandırır |
|---|---|---|---|
| **0** | **"3+1 / 100 m²'de bir mi iki mi ıslak hacim var?"** ve **"'min' başlığı minimum mu hedef mi?"** | **0** | 3+1'in model **yapısını** belirler; 30 katsayının yorumunu sabitler |
| **1** | **2+1 için ikinci satır — 95 (veya 55). 87 İSTEMEYİN** | 6 | 6 katsayı tanımsız → tanımlı. Bilgi/hücre = 1.00, listedeki en yüksek, ikincinin 5 katı |
| **2** | 4+1 / 210 satırının 8 m² açığı | ~1 | Oran toplamı 0.9886 → 1.0000. Satırı **atmayın** (df 2→1, güven aralığı %195 genişler), net'i 202 kabul edin |
| **3** | **3+1 için 120 VE 125 — ikisi birden** | 16 | df 0 → 2, t 12.7 → 4.30 (%66 daralma). Tek satır işe yaramaz |
| **4** | en × boy — **her tipolojiden birer satır** | 60 | `min_kenar`, `max_oran`, `min_cephe`, `derinlik_max` sıfır veriden çıkar |
| **5** | Aynı m²'de **ikinci bir alternatif çözüm** | 10 | Modelin hatası ile tasarım serbestliğini ilk kez ayırır. Kimsenin listesinde yoktu |

**Vaktiniz çok kısıtlıysa: #0 + #1 + #2 = 7 hücre.** Bu üçü modelin hesaplanamayan tipolojisini, aritmetik tutarsızlığını ve en büyük yapısal belirsizliğini birden kapatıyor.

---

## 5. Ticari kararlar — sizin alanınız, veriyi koyuyorum

- **45 ve 52 m² 1+0 satırları ticari olarak gereksiz** (1+1 talebin iki katı, %12 vs %6). Stüdyo kotası sınırlı; onu 24–35 m² bandında kullanın.
- **75 m²'yi 2+1 olarak satın.** 3+1'e sıkıştırınca iki oda 9 m²'ye iniyor — mevzuat asgarisiyle aynı, yani "oda" değil "niş büyüklüğünde oda".
- **100–140 m² boşluğu delik**, tercih değil. Talebin %35'ini oluşturan tipolojinin prim segmenti orada.
- **150 m² net KDV eşiği:** 140 satırının eşiğin 10 m² altında durması iyi karar — bilinçliyse. 180/210/225 aşan kısımda %20 KDV ödüyor (+%1.7 / +%2.9 / +%3.3).
- **Ebeveyn banyosu eşiği ticari olarak ~90–95 m² net** (3+1). Altında zarar: kazanılan 4–5 m² doğrudan ikincil yatak odalarından çıkar ve onları 9 m²'nin altına iter.

> Bu kalemlerin fiyat/kredi hesapları **net/brüt = 0.80 varsayımına** dayanıyor — kaynaksız. Sıra #2 çözülmeden kesinleşmez.

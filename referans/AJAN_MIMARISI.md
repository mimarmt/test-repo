# AJAN MİMARİSİ — projenin çıkış yolu

31.07.2026

---

## 0. Önce doğru teşhis: darboğaz nerede

Bugün bu projeye **altı mimari kural** girdi:

1. Banyo koridora açılır
2. Yatak odasından yalnızca ebeveyn banyosuna girilir
3. Salondan mutfağa geçilmez
4. Duşlu wc mahremiyet alanında, koridor hattında
5. Balkon dış cephede, uzun kenarı cephede
6. 3+1'de tek duşlu wc; ebeveyn banyosu alan yeterse

Her biri aynı döngüden geçti:

```
plan üret → mimar bakar → kuralı söyler → tabloya yazılır → ölç
```

Döngü **çalışıyor** — eleme oranı %75'ten %0'a indi. Ama tek bir kanaldan
akıyor: **Murat'ın gözünden.** Her tur birkaç dakika. Bir plan üreticisinin
savunulabilir plan çıkarması için 6 kural yetmez; 60, belki 200 kural gerekir.
Bu hızla o noktaya varılmaz.

> **Darboğaz plan üretmek değil. Mimari bilginin sisteme giriş hızı.**

Ajanların işi budur: o kanalı çoğaltmak. Mimarın yerine geçmek değil —
mimarın önüne **gerekçeli, denetlenebilir öneriler** koyup onay hızını artırmak.

---

## 1. Mimari — "Jüri"

```
KATMAN 0 · PROGRAM ÜRETİCİ            veri: Murat'ın m² tablosu
    daire m² + tipoloji → oda listesi + alan payları
    ajan YOK — bu bir tablo araması
        ↓
KATMAN 1 · ÜRETİCİ (CP-SAT)
    kontur + program + kurallar → N adet farklı topolojide plan
    ajan YOK — ve bu pazarlık konusu değil (§2)
        ↓
KATMAN 2 · UZMAN JÜRİSİ               ← ajanlar burada, PARALEL
    mevzuat · kullanım · tesisat · maliyet · ticari
    her biri: hüküm + GEREKÇE + kaynak
        ↓
KATMAN 3 · HAKEM
    vetoları uygular → kalanları sıralar → gerekçeleri mimara gösterir
        ↓
KATMAN 4 · KURAL ÇIKARICI             ← ajan
    mimarın düzeltmelerini okur → kural tablosuna öneri üretir
        ↓
    (mimar onaylar) → oda_programi.json → KATMAN 1'e geri besleme
```

---

## 2. Üç tasarım kuralı — bunlar tartışmaya kapalı

### K1 · Ajan plan ÜRETMEZ, plan DEĞERLENDİRİR

Üretim CP-SAT'ta kalır. Sebep: CP-SAT kısıtı **garanti** eder. Bir dil modeli
"bu planda odalar çakışmıyor" diyebilir ve yanılabilir; CP-SAT'ta çakışma
matematiksel olarak imkansızdır.

Sizin kalite ölçütünüz *"üretilen plan bir mimarın gözüyle savunulabilir
olmalı"*. Savunulabilirlik garanti gerektirir. Garanti veren katmanı
olasılıklı bir modele bırakmak, bugün kurduğumuz her şeyi geri alır.

### K2 · Her hüküm gerekçeli ve denetlenebilir olmalı

Yasak: *"Bu plan kötü, 6/10."*
Zorunlu: *"Yatak 2 kısa kenarı 2.40 m; PAİY md.X asgari 2.50 m — ihlal."*

Sebep: mimar **gerekçeye itiraz edebilmeli.** Bugün bunu beş kez yaptınız —
"bu kesinlikle yanlış, banyo koridora açılır". O itiraz ancak gerekçe
görünürse mümkün. Puan görünürse imkansız.

### K3 · Ajanın hükmü doğrudan sisteme yazılmaz

Ajan **öneri** üretir → mimar onaylar → kural tabloya girer.
Bugünkü döngünün aynısı; tek fark besleme kanalının 1 değil 5 olması.

Onaysız yazılan kural, uydurulmuş parametreyle aynı şeydir — ve bugün
uydurulmuş parametrelerin mimarın 13 gerçek çözümünün **13'ünü birden**
reddettiğini ölçtük.

---

## 3. Katman 2 — jüri üyeleri

| Ajan | Neye bakar | Vetosu var mı |
|---|---|---|
| **mevzuat** | Asgari piyes ölçüleri, ışıklandırma, kaçış, kapı genişliği | **Evet** — mevzuat ihlali telafi edilemez |
| **kullanım** | Mobilya sığıyor mu, sirkülasyon akışı, mahremiyet gradyanı, kapı çarpışması | **Evet** — kullanılamaz oda |
| **tesisat** | Şaft birliği, düşey süreklilik, penceresiz hacmin bacası | **Evet** — tesisat kurulamıyorsa plan yok |
| **maliyet** | Duvar uzunluğu, cephe/alan oranı, kalıp tekrarı, şaft sayısı | Hayır — sıralamaya girer |
| **ticari** | Satılabilirlik, tipoloji uyumu, m² verimliliği, oda payları | Hayır — sıralamaya girer |

**Veto ile sıralama ayrımı kritik.** Bugün kurduğumuz iki katmanlı yapının
(`ele()` + `puanla()`) devamı bu. Mevzuat ihlali "biraz kötü" değil, **elenmiş**.
Maliyet ise ödünleşim — sıralamaya girer.

---

## 4. Neden beş ajan, tek "akıllı ajan"dan iyi

1. **Kör noktalar örtüşmez.** Beş ajan birbirinin çıktısını görmez; aynı kusuru beşinin birden kaçırma olasılığı, tekinin kaçırma olasılığından düşüktür.
2. **Hüküm izlenebilir kalır.** Birleşik tek puanda "neden 6/10?" sorusunun cevabı yoktur. Beş ayrı hükümde vardır.
3. **Yanlış açı tek başına düzeltilir.** Ticari ajan yanılıyorsa yalnız o değişir; mevzuat ajanı bozulmaz.
4. **Ajan eklemek/çıkarmak ucuzdur.** Yeni bir açı (akustik, erişilebilirlik, enerji) yeni bir ajandır — mevcut hiçbir şeye dokunmaz.

---

## 5. Ajanlar da ölçülür — bu maddeyi atlamayın

Ajan yanılır. Jüriye girmek serbest değil, **ölçülmüş katkı şartı** var.
Her ajan referans kümesiyle sınanır:

| Ölçüt | Anlamı | Hedef |
|---|---|---|
| **Yanlış-pozitif** | Mimarın gerçek çizdiği planı eliyor mu | **~0** — eliyorsa kural yanlış, plan değil |
| **Yanlış-negatif** | Mimarın "bu olmaz" dediği planı geçiriyor mu | düşük |
| **Katkı** | Bu ajan olmadan sıralama ne kadar bozulur | ölçülür, sıfırsa ajan çıkar |

Bu, bugün kendi parametrelerimi çürüten testin aynısı. Kendime uyguladım,
ajanlara da uygulanır.

---

## 6. Geliştirme zamanı ajan kullanımı — şimdi yapılacaklar

Ürün içindeki jüriden ayrı olarak, ajanlar **geliştirme hızı** için de kullanılır:

### G1 · Referans kümesi üzerinde fan-out ← en yüksek getirili
Her gerçek plan için bir ajan: *"sistem bu planı üretebilir mi? Üretemiyorsa
hangi kısıt engelliyor?"*

Bugün bunu **tek bir tablo** için elle yaptım ve 13/13 reddedildiğini buldum.
30 gerçek plan için ajanla yapılırsa, eksik kısıtların **tamamı bir turda**
çıkar. Kural kural ilerlemeye gerek kalmaz.

### G2 · Çelişki avcısı
Kural tablosundaki kuralları ikişer ikişer karşılaştırıp çelişenleri bulur.
Bugün canlı bir örneği yaşandı: model salonu geçerli erişim sayarken eleyici
saymıyordu. Kural sayısı arttıkça bu elle bulunamaz.

### G3 · Karşıt savunma
Bir ajan planı **savunur**, bir ajan **çürütmeye çalışır**, üçüncüsü hakem.
Tek ajanın "plan iyi" deme eğilimini kırar. Adversarial doğrulama, tek yönlü
değerlendirmenin en bilinen zayıflığını kapatır.

### G4 · Kural çıkarıcı (Katman 4)
Mimarın serbest cümlelerini (*"salondan mutfağa geçilmez"*) tablo satırına
çevirir. Bugün bu çeviriyi ben yaptım, altı kez. Ajan bunu ölçekler —
ama **onay yine mimarda** (K3).

---

## 7. Uygulama sırası

| # | İş | Ön koşul |
|---|---|---|
| 1 | **Referans kümesi** — 20–30 gerçek plan, kontur + program + geometri | m² tablosu geldi, geometri eksik |
| 2 | **G1 fan-out** — hangi kısıtlar eksik, toplu teşhis | 1 |
| 3 | **Katman 0** — program üreticiyi oransal modele bağla | katsayılar hazır |
| 4 | **Katman 2 jürisi** — beş ajan, gerekçeli hüküm | 1 (ölçüt için) |
| 5 | **Ajan ölçümü** — yanlış-pozitif oranları | 1, 4 |
| 6 | **Katman 4** — kural çıkarıcı | 4 |

**1. sıradaki iş hâlâ referans kümesi.** m² tablosu onun yarısıydı — program
tarafını verdi. Eksik olan **geometri**: hangi oda nerede. Ajanlar o veri
olmadan ölçülemez, ölçülemeyen ajan jüriye giremez.

---

## 8. Şu an çalışan dört ajan

Bu belge yazılırken dört uzman aynı veriye farklı açılardan bakıyor:

- **mevzuat** — PAİY asgari ölçüleri; şu an uydurma olan `min_kenar`, `max_oran`, `kapi_genisligi` parametrelerinin mevzuat karşılığı
- **ticari** — tipoloji merdiveni, 100–140 m² boşluğu, ebeveyn banyosu eşiğinin ticari mantığı
- **tesisat/yapısal** — şaft birliği, düşey süreklilik, kolon aksı, duvar kalınlığı
- **veri/deney tasarımı** — 13 satırdan çıkarımın güvenilirliği, hangi ek verinin en çok bilgi getireceği

Bu, Katman 2'nin canlı bir denemesi. Sonuçları geldiğinde her biri
K3 gereği **öneri** olarak sunulacak — onay sizde.

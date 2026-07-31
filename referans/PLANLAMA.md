# PLANLAMA — "bu işin başarılı olması için ne yapmalı"

Murat Turna · 31.07.2026
Kaynak: `CLAUDE.md`, `CALISMA_KURALI.md` (Drive) + bu depodaki ölçümler (`OLCUM.md`).

---

## 0. Kısa cevap

Varyant puanlamasını düzeltmeye çalışıyorsunuz. **Ölçüm, sorunun puanlamada
olmadığını söylüyor.**

Bu depoda sizin kurallarınızla bir CP-SAT üreteci kurdum, 8 varyant ürettim
ve mimari olarak eledim:

| | Elenen | Sebep |
|---|---|---|
| Erişim kısıtı **yokken** | **6 / 8 (%75)** | banyoya yatak odasından giriliyor |
| Erişim **sert** kısıt (salon da geçerli) | **2 / 8 (%25)** | banyo yalnızca salona açılıyor |
| `erisim` tablosu + `ebeveyn_banyo` tipi | **0 / 7 (%0)** | — |

Elenen 6 planın hepsi CP-SAT'a göre **OPTIMAL**'di. Bütün ölçü kurallarınızı
sağlıyorlardı. Puanlama onları doğru sıralayamıyordu çünkü **o planların
sıralanacak hâli yoktu — listeye hiç girmemeleri gerekiyordu.**

Yani: daha fazla kural yazmak veya ağırlık oynatmak bu sorunu çözmez.
Katman yanlış.

---

## 1. Teşhis — tek sorun sanılan üç ayrı sorun

**S1 · Üretim ölü plan üretiyor.**
Yazılmamış kısıt yok sayılır. Erişilebilirlik hiçbir yerde yazmıyordu; çözücü
de dairenin içinde dolaşılabildiğini varsaymak zorunda değil. İlk ürettiğim
plan girilemeyen bir daireydi: Antre planın ortasındaydı, hiçbir dış kenara
değmiyordu — ve OPTIMAL'di.

**S2 · Puanlama tek katmanlı.**
Ağırlıklı toplamda bir eksendeki yüksek puan, başka eksendeki **ölümcül**
kusuru telafi eder. "Alan hedefleri mükemmel, en/boy ideal, ama banyoya
yatak odasından giriliyor" planı toplamda öne çıkar. Mimari kalite toplamsal
değil: önce **eleyici**, sonra sıralı.

**S3 · Ağırlıklar elle ayarlanıyor.**
12 özellik = 12 düğme, geri besleme yok. Birini düzeltince öteki bozulur,
ne zaman duracağınız belli değil. "Bu işin başarılı olması için ne
yapacağımı bilmiyorum" cümlesinin kaynağı bu: **bitiş ölçütü tanımlı değil.**

> Ek gözlem: Drive'da iki proje iç içe duruyor. `PARAMETRE_SEMASI.md` sürüm 1.0
> ParselPro Studio'ya ait (imar zinciri, `export const modul` — JavaScript).
> `CLAUDE.md` ise bu projeyi Python 3.14 olarak tanımlıyor ve imarı kapsam
> dışı ilan ediyor, `ROADMAP.md`'yi geçersiz sayıyor. Aynı kökte üç farklı
> kapsam yaşıyor. Bağlamı her oturumda yeniden kurmak zorunda kalmanız
> zorlanmanın küçümsenmeyecek bir parçası. İkisini ayrı köke almanızı öneririm.

---

## 2. Yöntem — dört adımlı döngü

### Adım 1 · Değerlendirmeyi ikiye ayır

```
KATMAN 1 · ELEME (ikili, ağırlıksız, telafi edilemez)
    girilemez daire · erişilemez oda · kullanılamaz ölçü ·
    ıslak hacmin kapı yeri yok
    →  plan listeye HİÇ girmez

KATMAN 2 · SIRALAMA (öğrenilmiş ağırlık)
    yalnızca elemeden geçenler
```

Kod: `referans/ic_plan/puanlama.py` — `ele()` ve `puanla()`.

Erişilebilirlik kontrolü özyinelemeli: *R odasına varılır ⇔ R'nin, `erisim`
tablosunun izin verdiği bir komşusu vardır ve o komşuya da varılır.*
Girişten başlar. Ulaşılamayan oda varsa plan ölüdür. Bu tek kontrol,
ilk turda 8 varyantın 6'sını yakaladı.

Tablo `oda_programi.json`'da durur, kodda değil — mimari kuralı mimar yazar:

```json
"banyo":         { ..., "erisim": ["sirkulasyon"] },   // koridora açılır
"ebeveyn_banyo": { ..., "erisim": ["ebeveyn"] },       // en-suite istisnası
"balkon":        { ..., "erisim": ["salon", "ebeveyn", "yatak", "mutfak"] }
```

### Adım 2 · Kuralı eleyiciden modele **terfi ettir** ← döngünün motoru

Eleyici bir kusuru yakaladığında iki iş yapılır:

1. kural eleyicide kalır (güvenlik ağı),
2. **aynı kural CP-SAT modeline sert kısıt olarak eklenir.**

Erişimi modele taşıdım — her oda en az bir geçiş mekanına kapı genişliğinde
açılmak zorunda:

```
eleme oranı   %75  →  %25  →  %0
```

Bu döngünün güzelliği: **her tur eleme oranı düşer ve nerede olduğunuzu
bir sayı söyler.** Projenin bittiği an bellidir.

> Bu döngü bir kez canlı olarak işledi: eleyici "banyo yalnızca salona
> açılıyor" dedi, model salonu geçerli erişim sayıyordu. Kararı siz verdiniz
> — *banyo koridora açılır; yatak odasından yalnızca ebeveyn banyosu için
> girilir.* Karar `oda_programi.json`'daki `erisim` tablosuna yazıldı,
> `ebeveyn_banyo` tipi eklendi, eleme oranı **%25 → %0**. Kod değişmedi.
>
> Kuralın kodda değil tabloda durması önemli: sonraki mimari kuralı da
> siz yazarsınız, benim veya bir yazılımcının araya girmesi gerekmez.

### Adım 3 · Ağırlığı elle değil, **ikili tercihten** öğren

Ağırlık ayarlamayı bırakın. Bunun yerine mimara iki plan gösterip
**"bu mu, şu mu?"** sorun. Her karşılaştırma ~5 saniye; 200 karşılaştırma
~20 dakika eder ve ağırlıkları **belirler**.

Yöntem: Bradley-Terry / lojistik sıralama. `ozellik(kazanan) − ozellik(kaybeden)`
farkları üzerine lojistik regresyon. Harici bağımlılık yok, 30 satır
(`puanlama.ogren()`).

Şartlar:
- Özellikler **yorumlanabilir** kalmalı — mimar puana itiraz edebilmeli.
- Özellikler **z-skorla normalize** edilmeli. Aynı toplamda m², oran ve adet
  karıştırmak ölçek hatasının en sık kaynağıdır; muhtemelen mevcut
  puanlamanızdaki hatalardan biri de budur.
- Öğrenilen ağırlığın işareti sezginize ters çıkarsa bu **bilgidir**, hata değil.

Ölçüm uyarısı: bu depodaki gösterimde 6 plan → 15 karşılaştırma çıktı ve
ağırlıklar oynak. **En az ~200 gerçek karşılaştırma** gerekiyor.

### Adım 4 · **Referans kümesi** — asıl eksik parça

Şu an "puanlama doğru mu" sorusunun cevabı bir his. Ölçüye çevrilir:

1. Kendi arşivinizden **20–30 gerçek plan** alın (mimarın çizdiği).
2. Her biri için kontur + oda programını çıkarın.
3. Sistem aynı girdiyle **50 varyant** üretsin.
4. Gerçek planı havuza katın, hepsini puanlayın.
5. **Ölçüt: gerçek planın yüzdelik sırası. Hedef ilk %5.**

Gerçek plan 30. sırada çıkıyorsa puanlama yanlıştır — tartışmasız, ölçülmüş.

Ve ters yönde, en az bunun kadar önemlisi:

> **Eleyici, gerçek bir mimarın çizdiği planı eliyorsa kural yanlıştır, plan değil.**
> Eleyicinin yanlış-pozitif oranı ~0 olmalı.

Bu, kural yazarken kendinizi kandırmanızı engelleyen tek mekanizma.

**Yol haritası değişikliği önerisi:** `CLAUDE.md`'de DWG arşivi Aşama C'de
(retrieval için). **Arşivi şimdi öne alın — retrieval için değil, ölçüt için.**
Aşama A'nın doğruluğunu ölçmenin başka yolu yok. Retrieval yine C'de kalsın.

### Ayrıca · Çeşitlilik — "5 en iyi" değil, "5 farklı"

"Doğru planlar önüme gelmiyor" şikayetinin ikinci sebebi: ilk 5 varyant
genelde aynı topolojinin 20 cm kaymış hâlidir. Mimar 5 plan gördüğünü sanır,
1 plan görmüştür; iyi plan 40 klonun altında kalır.

Çözüm: **topoloji imzası** (kapı genişliğini geçen komşulukların kümesi) ile
tekilleştir. İki plan aynı odaları birbirine değdiriyorsa aynı plandır.
Varyantlar ağırlık uzayında örnekleyerek üretilir — her varyant *bir
ağırlıklandırmaya göre optimal*dir, dolayısıyla mimara savunulabilir.
Kod: `referans/ic_plan/varyant.py`.

---

## 3. Başarı tanımı — bitiş çizgisi

Tanımlı bitiş ölçütü olmadan bu proje bitmez. Dört sayı öneriyorum:

| Ölçüt | Hedef | Şu an (bu depo, 12×10 m, 10 oda) |
|---|---|---|
| Eleme oranı | < %10 | **%0** (7 varyant, tek girdi) |
| Referans planın yüzdelik sırası | ilk %5 | **ölçülmedi** — referans kümesi yok |
| Kabul oranı (ilk 5'ten en az biri "üzerinde çalışırım") | ≥ %70 | ölçülmedi |
| Süre / daire | < 60 sn | 10–30 sn |

İkinci satır boş olduğu sürece "başarılı mı" sorusunun cevabı yoktur.
**Önceliğiniz o satırı doldurmak.**

---

## 4. Öneriler — öncelik sırasıyla

### Ö1 · Referans kümesi kur (20–30 gerçek plan)
- **Ne:** Arşivden plan seç, kontur + program + istenen komşulukları JSON'a çevir. Yüzdelik sıra ölçen koşum yaz.
- **Neden:** Puanlamanın doğruluğunu ölçmenin başka yolu yok. Bugün elinizde ölçüt yok, bu yüzden ne zaman bitireceğinizi bilmiyorsunuz.
- **Kaynak:** Bu belge §2 Adım 4. Yöntem *learning-to-rank* değerlendirmesinin standart kurgusudur.
- **Maliyet:** 3–5 gün (çoğu veri girişi). **Risk:** düşük. **En yüksek getirili iş bu.**

### Ö2 · Değerlendirmeyi iki katmana ayır
- **Ne:** `ele()` + `puanla()`. Ölümcül kusur telafi edilemesin.
- **Neden:** Ölçüldü — 8 varyantın 6'sı ölüydü ve sıralamaya giriyordu.
- **Kaynak:** `referans/ic_plan/puanlama.py` (yazıldı, çalışıyor).
- **Maliyet:** 1 gün (devralınabilir).

### Ö3 · Erişimi `erisim` tablosuyla sert kısıt yap ✔ *(yapıldı)*
- **Ne:** Her odanın kapısı, tipinin `erisim` listesindeki bir mekana açılsın. Tablo `oda_programi.json`'da, kodda değil.
- **Neden:** Eleme oranı %75 → %25 → **%0** (ölçüldü).
- **Kaynak:** `motor.py`, "ERISIM (SERT)" bölümü.
- **Maliyet:** yarım gün. **Not:** 3'ten fazla geçiş mekanında gerçek bağlılık kodlaması (akış / `AddCircuit`) gerekir — Aşama B'de şart olacak.

### Ö4 · Çözüm ızgarasını 0.20 m yap
- **Ne:** CP-SAT koordinatları 20 cm hücre; veri yine 10 cm'in katı, sözleşme bozulmaz.
- **Neden:** Ölçüldü — 0.10 m'de 10 odalı model 30 sn'de kanıtlanamıyor, bazen hiç çözüm bulamıyor. 0.20 m'de OPTIMAL.
- **Kaynak:** `OLCUM.md` §1.
- **Maliyet:** yarım gün. `CLAUDE.md`'deki "ızgara 10 cm" satırı güncellenmeli. **Bu, mevcut kuralınıza itirazdır; karar sizin.**

### Ö5 · Alt sınır eşiklerini yukarı yuvarla
- **Ne:** min kenar / kapı / min cephe → `ceil`; alan üst sınırı → `floor`.
- **Neden:** `round(0.90/0.20) = 4` hücre = **0.80 m**. Kapı eşiği sessizce düştü, motor "sağlandı" dedi. Düzeltince model hem doğru hem hızlandı (25.2 → 7.3 sn).
- **Kaynak:** `OLCUM.md` §4/H1.
- **Maliyet:** 1 saat. En ucuz düzeltme.

### Ö6 · İkili tercih toplama arayüzü
- **Ne:** İki plan yan yana, tek tık. 200 karşılaştırma topla, `ogren()` ile ağırlık çıkar.
- **Neden:** Elle ağırlık ayarının geri beslemesi yok; ikili karşılaştırmanın var.
- **Kaynak:** `puanlama.ogren()` (yazıldı).
- **Maliyet:** 2 gün arayüz + mimarın 20 dakikası. Aşama D'nin "varyant karşılaştır" işini öne çeker — orası zaten planda.

### Ö7 · Varyantları topoloji imzasıyla tekilleştir
- **Ne:** Aynı komşuluk grafına sahip planları tek say.
- **Neden:** İyi plan klonların altında kalıyor olabilir.
- **Kaynak:** `varyant.py` (yazıldı).
- **Maliyet:** yarım gün.

### Ö8 · Duvar kalınlığı kararını A'da ver, A2'ye bırakma
- **Ne:** Oda dikdörtgenleri eksen çizgisi mi, net iç yüz mü? Şu an odalar sıfır kalınlıkta duvar paylaşıyor.
- **Neden:** DXF'e giderken net/brüt farkı ortaya çıkar; A2'de fark edilirse bütün alan bantları yeniden ölçeklenir.
- **Kaynak:** kaynaksız — bu bir tasarım kararı, ölçüm değil.
- **Maliyet:** karar 1 saat, uygulama 2–3 gün. **Karar sizin; ben eksen çizgisi öneririm** (duvar payını `shapely.buffer` ile sonradan düşmek, alan bantlarını bozmadan çalışır).

---

## 5. Şimdi yapmayın

- **Daha fazla kural yazmak.** Asıl uyarı bu. Ölçüt kurulmadan yazılan her kural, doğruluğu bilinmeyen bir düğme daha ekler.
- **ML / Graph2Plan / House-GAN.** *(RPLAN veri setinin Çin konut stoğuna dayandığı ve TR tipolojisine — balkon zorunluluğu, ıslak şaft, kapalı mutfak — oturmadığı bilgisi **hafızadandır, doğrulanmadı.** Bu yolu ciddi olarak değerlendirecekseniz önce veri setine bakın.)* Doğrulanmış gerekçe şu: üretici model kısıt **garantisi** vermez — sizin kalite ölçütünüz "bir mimarın gözüyle savunulabilir olmalı"; CP-SAT bunu garanti eder, üretici model edemez. Referans kümeniz 500+ plana çıkarsa yeniden konuşulur.
- **Aşama C retrieval.** Arşivi ölçüt olarak kullanın (Ö1), retrieval'i C'de bırakın.
- **Ters çözüm / hedefleme.** `PARAMETRE_SEMASI.md` md.10c zaten "iskelet kurulmadan başlanmaz" diyor. Katılıyorum.

---

## 6. İki haftalık sıra

**Hafta 1** — Ö5 (1 saat) → Ö4 (yarım gün) → Ö3 (yarım gün) → Ö2 (1 gün) → **Ö1 başla** (referans kümesi, 3 gün)
**Hafta 2** — Ö1 bitir + ilk yüzdelik sıra ölçümü → Ö7 → Ö6 arayüz → 200 karşılaştırma → ağırlıkları yeniden öğren → yüzdelik sırayı tekrar ölç

İki hafta sonunda elinizde **"referans plan ilk %X'te"** diyen bir sayı olur.
O sayı varsa proje yönetilebilir; yoksa yönetilemez.

---

## 7. Açık kalemler — karar sizin

- Alan bantları **net mi brüt mü**? (Ö8 ile bağlantılı)
- Balkon alanı oda programına dahil mi, ayrı mı sayılıyor?
- Çekirdek ve daire giriş kapısı Aşama A'da girdi mi, Aşama B'de mi belirlenir? Şu an elle veriliyor (`girdi.giris`).
- ParselPro Studio ile bu proje ayrı köke alınacak mı?

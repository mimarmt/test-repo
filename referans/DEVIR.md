# DEVİR — bu depoya yeni gelen oturum için

**Son güncelleme:** 01.08.2026 · 24 commit
**Amaç:** Temiz bir oturumun 5 dakikada yetişmesi. Bu belge özet değil, **indeks + canlı durum**.

---

## Bir cümlede

Murat Turna'nın **Parametrik Mimari Plan Geliştirme** projesi (Mac'inde,
`~/Parametrik-mimari-plan-Geliştirme`) CP-SAT ile kat planı üretiyor.
Bu depo o projenin **değil**; bu depo bir **analiz ve referans alanı**.
Buradaki `referans/ic_plan/` bağımsız bir referans motorudur — üretim kodu değil.

---

## Canlı sayılar

| Ölçüt | Değer | Kaynak |
|---|---|---|
| Sınav notu | **4.48** (n=1, `Daire2.dxf`, 2+1, net 73.37 m²) | mimarın sistemi |
| Orana giren plan | **0 / 9** | şemadaki `TIKANIK` |
| Arşivdeki plan | 9 (2+1: 7 · 3+1: 2) · eşik **N ≥ 10** | `plan_arsivi.jsonl` |
| Eksik oda tipi | **1** — balkon | sınav |
| Sirkülasyon | gerçek **%19.83** · üretilen %10.1 · kural **%8** | sınav |
| Alan mutlak sapma | 30.66 m² | sınav |
| Kendi DXF arşivi | 2 dosya | `veri/dxf_arsiv/` |
| Bekleyen mimari karar | **36 / 49** (%73) | şema kartları |
| Tercih karşılaştırma | ~1 · eşik 30 | `tercihler.json` |

---

## Karara bağlanmış — tekrar tartışılmaz

**Mimari kurallar (Murat Turna, 31.07.2026):**
1. Banyo koridora açılır
2. Yatak odasından yalnız ebeveyn banyosuna girilir
3. Salondan mutfağa geçilmez (2+1 ve üstü; 1+1'de birleşik hücre)
4. Duşlu WC mahremiyet alanında, koridor hattında
5. Balkon dış cephede — uzun kenarı cephede, derinlik sınırlı
6. 3+1'de **bir tane** duşlu wc; ebeveyn banyosu tabloda **hiç yok**
7. m² tablosundaki değerler **asgari**, üst sınır da var (3+1 wc+duş: **6–12 m²**)
8. 3+1 hol **L veya T şeklinde tek mekân**

**Yöntem kararları:**
- Değerlendirme iki katmanlı: **eleme** (ikili, telafi edilemez) + **sıralama** (öğrenilir)
- Mimari kural **koda değil tabloya** yazılır
- Alan modeli **oransal**: `alan = clip(oran × net, taban, tavan)` — LOOCV ile doğrulandı
- Ajan plan **üretmez**, değerlendirir. Üretim CP-SAT'ta kalır (kısıt garantisi)

---

## Açık sorular — canlı

| # | Soru | Kime | Neden önemli |
|---|---|---|---|
| **A1** | Şemada `ÖLÇÜM/SON SÖZ` → `KURAL VE PARAMETRE` **geri oku var mı**? | Murat | Varsa tek iş (vana), yoksa iki iş |
| **A2** | `BRIFING_v2.md` D1–D5 doğrulama çıktıları | Mac oturumu | Teşhis çıkarım, ölçüm değil |
| **A3** | Net/brüt: oda dikdörtgeni **eksen mi net iç yüz mü**? Duvar kalınlığı? | Murat | Sınav notunun mutlak değeri buna bağlı |
| **A4** | 2+1 için ikinci satır (**95 veya 55** — 87 değil) | Murat | 6 katsayı tanımsız → tanımlı |
| **A5** | 4+1 / 210 m² satırındaki **8 m² açık** | Murat | Oran toplamı 0.9886, 1.0 olmalı |

---

## Ne nerede — okuma indeksi

| Belge | Ne için okunur |
|---|---|
| **`BRIFING_v2.md`** | **Güncel iş emri.** Mac oturumuna yapıştırılan. Sıra burada. |
| `sema_notlari.html` | Mimarın akış şemasına yazılan notlar. Teşhisin kaynağı. |
| `analiz/SENTEZ.md` | Dört uzman ajanın ortak hükmü + kendi düzelttiğim 4 şey |
| `analiz/BULGULAR.md` | m² tablosunun parametre denetimi — P1–P10 |
| `analiz/veri.py` | **Mimarın m² tablosu**, gerçek veri olarak kodlanmış |
| `OLCUM.md` | Izgara taraması, yakalanan hatalar, eleme oranının seyri |
| `AJAN_MIMARISI.md` | Jüri mimarisi — çok ajanlı değerlendirme tasarımı |
| `PLANLAMA.md` | İlk yöntem belgesi. **Sıralaması eskidi**, teşhisi geçerli |
| `AKSIYON_PLANI.md` | İlk iş planı. **BRIFING_v2 yerine geçti** |
| `ic_plan/` | Bağımsız referans motoru. Üretim değil, deney alanı |

---

## Düzeltilmiş hatalarım — tekrarlanmasın

Bu oturumda kendi hükümlerimden dördü çürüdü. Kayda geçiyor:

1. **"Uydurulan alan bantları"** — mimarın 13 gerçek çözümünden **13'ünü** reddediyordu. Kaynaksız sayı yazılmaz.
2. **"Tek dikdörtgen koridor 8 kapı taşıyamaz"** — fazla genel bir hükümdü; mimarın motoru 10 odayı tek dikdörtgenle çözdü. Kendi yapılandırmamdaki gözlemi genel kural sandım.
3. **"Ebeveyn banyosu eşiği ~100 m²"** — 12 m² tek odaymış. Hipotez çürüdü.
4. **"Öğrenme altyapısı kurulmamış"** — kurulmuş, hem de eksiksiz. Dosyayı görmeden hüküm verdim.

**Ders:** ölçmeden hüküm verme; verdiysen kapsamını yaz ("benim yapılandırmamda,
şu konturda") — genel kural gibi yazma.

---

## Bu oturumun işi ne, Mac oturumunun işi ne

| | Bu depo (analiz) | Mac projesi (üretim) |
|---|---|---|
| Rol | Teşhis, ölçüm tasarımı, brifing | Kod, kural, üretim |
| Çıktı | Belge ve deney | Çalışan sistem |
| Sonraki girdi | A1 + A2 cevapları | `BRIFING_v2.md` İŞ 1–7 |

**Uyarı:** İki motoru paralel yürütmek maliyet. Bu depodaki referans motor
görevini yaptı (kalibrasyon, iki katmanlı değerlendirme, mevzuat ihlalleri,
çelişki çekirdeği aracı). Bundan sonra ağırlık Mac tarafında olmalı.

---

## Yeni oturum nasıl başlar

Tek satır yeter:

```
referans/DEVIR.md oku, sonra referans/BRIFING_v2.md. Beklediğim cevap: A1 ve A2.
```

Daha derine inmek gerekirse indeksten ilgili belgeyi aç — **hepsini okuma.**

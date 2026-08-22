# Madde 17 — Panel yalnız bende açılıyor: sayfa hâlâ Netlify'da (madde 12'nin eksik yarısı)

**Öncelik:** YÜKSEK — panel paylaşılamıyor
**Tarih:** 22.08.2026 · **Durum:** TAMAMLANDI — kapı worker'ı 22.08.2026 15:15'te canlıya alındı ve doğrulandı: **https://panel.gs-fikstur.workers.dev** (ana sayfa Netlify ile bayt bayt aynı, 7/7 dosya aynı, fonksiyon vekili çalışıyor). Kurulum, kullanıcının tek seferlik API anahtarıyla wrangler üzerinden yapıldı; anahtarın silinmesi kullanıcıya hatırlatıldı. Saha doğrulaması 16:10'da geldi: yeni adres Türkiye'den telefonda açıldı — "canlı kaynak", sürüm v0822-070801, taze veri, hata kutusu yok (eski adresteki donmuş v73 kopyasının tarih hatası güncel sürümde zaten düzeltilmişti; yeni adres güncel sürümü veriyor). Kalan işler: arkadaş cihazında son teyit, kilit ekran bildirimi isteyenlerin yeni adreste yeniden açması, cihaz kısayollarının yeni adrese geçirilmesi, kurulumda kullanılan API anahtarının silinmesi, (tavsiye) özel alan adı.
**İlişki:** Madde 12 vekili (API trafiğini) Cloudflare'a taşıdı; bu madde sayfanın kendisini ve fonksiyon çağrılarını kapsıyor.

---

## 1. Bulgu ve kök neden (ölçüm sonucu)

**Belirti:** Panel linki arkadaşta açılmıyor; bende açılıyor çünkü service worker sayfayı
önbellekten sunuyor. İlk kez açan herkes (arkadaş, babamın yeni cihazı) sayfaya ulaşamıyor.

**Kök neden — resmî kayıtla doğrulandı:** `netlify.app` alan adı, BTK'nın
**21 Şubat 2025** tarihli ve **490.05.01.2025.-118058** sayılı kararıyla, "yasa dışı bahis"
gerekçesiyle **Türkiye'de erişime engelli**
([EngelliWeb kaydı](https://ifade.org.tr/engelliweb/netlify-erisime-engellendi/)).
Yani sorun arkadaşın cihazında değil; Türkiye'deki hiçbir ISS'den `*.netlify.app`
açılmıyor. Netlify destek forumlarında Türkiye'den aynı belirtiler kayıtlı
([ERR_SSL_PROTOCOL_ERROR başlığı](https://answers.netlify.com/t/turkey-err-ssl-protocol-error/114059)).

**Bunun iki sinsi sonucu var:**
- Service worker önbelleği olan cihazlar (benimki) çalışmaya devam ediyor → sorun benden
  saklanıyor. Üstelik SW güncelleme denetimi de aynı engele takıldığı için cihazımdaki
  kopya **donmuş**: Netlify'a yeni sürüm yüklesem bile bana ulaşamaz.
- Vekil Cloudflare'a taşınmış olsa da sayfa ve fonksiyon uçları `netlify.app`'te kaldıkça
  panel Türkiye'de **yeni hiçbir cihaza kurulamaz**.

---

## 2. Soru 1 — Sayfa Cloudflare'a taşınabilir mi? → EVET

Panel statik dosyalardan oluşuyor (HTML + JS + service worker); doğrudan yüklenerek taşınır.
İki önemli düzeltmeyle:

- **`pages.dev` tuzağı:** Cloudflare Pages'in ortak alan adı `pages.dev` Türkiye'de
  **iki kez engellendi** — 29.05.2023'te BTK (sonra kaldırıldı) ve **25.11.2025'te TFF**
  (karar 067-01, "kaçak maç yayını";
  [EngelliWeb kaydı](https://ifade.org.tr/engelliweb/cloudflare-pages-erisime-engellendi-2/),
  [Technopat haberi](https://www.technopat.net/2025/11/30/cloudflare-pages-kapatildi/)).
  AYM, TFF'nin engelleme yetkisini iptal etti (yürürlük: 14.07.2026), ancak ortak platform
  alan adlarına toplu engel riski yapısal olarak sürüyor. Sayfayı `pages.dev`'e taşımak
  aynı sorunu geri getirebilir.
- **Güncel doğru hedef:** Cloudflare'ın 2026'daki resmî önerisi yeni projeler için Pages
  değil, **Workers + static assets**
  ([Cloudflare dokümanı](https://developers.cloudflare.com/workers/static-assets/)).
  Madde 12'de kurulan vekil Worker'ına statik dosyalar da eklenir → **sayfa ve vekil tek
  adreste, tek origin'de** birleşir. `workers.dev` için EngelliWeb'de engel kaydı yok;
  bugünkü vekilin benim cihazımda çalışması da fiilî kanıt (yine de aşağıdaki canary
  ölçümüyle doğrulanacak).

**Şerh:** Panel dosyaları bu depoda değil (test-repo'da yalnız `deneme.txt` var;
`mimarmt/muratturna` deposu boş). Netlify'a elle yüklenmiş görünüyor; güncel kopya
Netlify panelinden (son deploy'un indirme bağlantısı) alınıp Worker'a `wrangler deploy`
ya da dashboard üzerinden yüklenir.

---

## 3. Soru 2 — Netlify fonksiyonları (abone.js, rapor.js, gol-kontrol.js) kalabilir mi? → EVET, tek şartla

Fonksiyonlar da **aynı engelli alan adında** yaşıyor
(`<site>.netlify.app/.netlify/functions/...`). Sayfayı taşıyıp fonksiyonları tarayıcıdan
doğrudan çağırmaya devam etmek paneli Türkiye'de yine kırar (aynı engel + üstüne CORS).

**Şart:** Tarayıcı → fonksiyon trafiği de Cloudflare'dan geçmeli. Worker'a küçük bir kural
eklenir: `/.netlify/functions/*` (veya `/api/*`) istekleri **sunucudan sunucuya** Netlify'a
iletilir. Cloudflare veri merkezi → Netlify trafiği Türkiye'deki ISS engellerinden
etkilenmez. Yollar aynen korunursa panel kodunda değişiklik sıfıra yakın olur ve tek
origin sayesinde CORS derdi hiç doğmaz.

Yerinde kalabilecekler (kod görmeden varsayım — kod paylaşılırsa birebir doğrularım):
- **gol-kontrol.js** zamanlanmış çalışıyorsa Netlify sunucularında koşar; Türkiye
  engelinden hiç etkilenmez.
- **Push bildirimleri** FCM/Apple servisleri üzerinden gider, Netlify'dan değil;
  etkilenmez. (Abonelik-origin ilişkisi için risk tablosuna bak.)

Sonuç: **Bugün fonksiyon taşımaya gerek yok.** İstenirse ileride ayrı bir madde olarak
Cloudflare'a alınabilir; bu geçişin ön şartı değil.

---

## 4. Soru 3 — Alan adı ne olur, mevcut link kırılır mı?

Dürüst durum: mevcut `…netlify.app` linki Türkiye'den **zaten kırık** — kaybedilecek bir
link yok. Taşıma sonrası:

- Yeni adres `<isim>.workers.dev` olur; yeni link herkese bir kez paylaşılır.
- Eski link silinmez: yurt dışından/VPN'den çalışmaya devam eder (Netlify aynen kalıyor).
- Eski cihazlardaki SW kopyaları kendiliğinden yeni adrese **geçemez** (güncelleme de
  engele takılıyor). Bendeki ve babamdaki cihazlarda yeni adres bir kez elle açılıp yer
  imi değiştirilecek; eski kopya kaldırılacak.
- **Kalıcı sigorta (tavsiye):** Yıllık ~10–15 $'a kendi alan adını al (ör. Cloudflare
  Registrar) ve Worker'a bağla. `netlify.app` ve `pages.dev` örnekleri, binlerce sitenin
  paylaştığı ortak alan adlarının tek kararla topluca engellenebildiğini gösterdi; kendi
  alan adın bu risk sınıfından çıkarır ve bundan sonra altyapı değişse bile link bir daha
  hiç değişmez.

---

## 5. Soru 4 — Risk ve geri dönüş yolu

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| `workers.dev`'in de bir gün engellenmesi (`pages.dev` emsali) | düşük–orta | yüksek | Kendi alan adı (kalıcı çözüm); canary ölçümü |
| Push abonelikleri origin'e bağlı → herkes yeni adreste bir kez daha "abone ol" demeli | kesin | düşük | Geçiş sonrası tek seferlik yeniden abonelik; VAPID anahtarlarını değiştirme |
| Çift bildirim (aynı cihazda eski + yeni origin'den iki abonelik) | orta | düşük | Eski cihazlarda eski SW/site verisini kaldır; abone listesinden eski kaydı sil |
| Vekil aktarım ayrıntıları (başlık, yöntem, gövde) | orta | orta | Canary + üç fonksiyon ucunu tek tek test |
| Ücretsiz katman limiti (Worker ~100k istek/gün; statik varlık istekleri ücretsiz) | çok düşük | düşük | Panel ölçeği için fazlasıyla yeterli |

**Geri dönüş yolu:** Bu geçişte hiçbir şey silinmiyor ve Netlify'a dokunulmuyor; tek
yönlü, yıkıcı bir adım yok. Worker tarafında sorun çıkarsa geri dönüş = eski
`netlify.app` linkini kullanmaya devam etmek (VPN'li/yurt dışı erişim ve SW önbellekli
mevcut cihazlar için aynen çalışır). İki sürüm istenildiği kadar yan yana yaşayabilir.

---

## 6. Ölçüm planı — taşımadan ÖNCE (~10 dakika)

Buradan (yurt dışı veri merkezi) Türkiye ISS davranışı doğrudan ölçülemiyor; resmî engel
kayıtları yukarıda. Gerçek ölçüm şu üç adımla yapılacak:

1. **Teşhisi kesinleştir:** Kendi cihazında **gizli pencerede** (SW devre dışı kalır)
   netlify.app linkini aç. Açılmıyorsa kök neden kendi bağlantında da doğrulanmış olur.
2. **workers.dev erişimi:** Bugünkü vekil Worker'ın adresini tarayıcıda düz aç ve
   arkadaşına gönderip açtır. Açılıyorsa taşıma yolu geçerli.
3. **Canary:** Worker'a tek satırlık bir test sayfası koy ("merhaba"), linki arkadaşına
   ve babana gönder. İkisinde de açılırsa uçtan uca kanıt tamam — panel dosyaları ancak
   bundan sonra taşınır.

İsteğe bağlı resmî sorgu: e-Devlet
[Web Sitesi Erişim Engeli Sorgulama](https://www.turkiye.gov.tr/esb-web-sitesi-erisim-engeli-sorgulama)
ile `netlify.app`, `pages.dev`, `workers.dev` güncel durumu görülebilir.

---

## 7. Önerilen uygulama sırası (~1 saat)

1. Bölüm 6'daki üç ölçüm.
2. Panel dosyalarının güncel kopyasını Netlify panelinden indir.
3. Statik dosyaları vekil Worker'ına ekle (Workers static assets).
4. Worker'a `/.netlify/functions/*` → Netlify sunucu-sunucu iletim kuralını ekle.
5. Kendi cihazında test: sayfa + abone + rapor + gol-kontrol uçları.
6. Arkadaş ve baba cihazında test; yeni adreste yeniden abonelik.
7. Yeni linki paylaş; eski cihazlarda eski SW/site verisini temizle.
8. (Tavsiye) Alan adı alıp Worker'a bağla — linki kalıcılaştır.
9. Netlify'ı yedek olarak aynen bırak.

## GÜNCELLEME — 22.08.2026: Paket hazırlandı ve doğrulandı

Panel adresi öğrenildi: **https://gs-fikstur.netlify.app** (GS Fikstür — Galatasaray
2026/27 fikstür, skorlar, puan durumu; PWA + gol bildirimleri). İncelemede plan
sadeleşti: dosyaları kopyalamak yerine **tam geçirgen "kapı" worker'ı** seçildi
(`cloudflare-kapi-worker.js`, bu depoda).

**Neden kopyalama değil kapı:** Sayfadaki tüm yollar göreli
(`/.netlify/functions/abone|rapor`, `sw.js`, ikonlar, `gol.mp3`); madde 12 vekili
(`gs-afb.gs-fikstur.workers.dev`) koda mutlak adresle gömülü ve ayrı çalışıyor. Kapı
worker'ı her isteği Cloudflare üzerinden Netlify'a geçirir → tek kaynak Netlify kalır,
paneldeki her güncelleme yeni adrese kendiliğinden yansır, worker'a bir daha dokunmak
gerekmez; kurulum tek kopyala-yapıştır.

**Yerel doğrulama sonuçları (wrangler dev):**
- 7 dosyanın 7'si (index, sw.js, manifest, gol.mp3, 3 ikon) kapıdan **bayt bayt aynı**
  geçti (md5 karşılaştırmalı), content-type'lar doğru.
- Gövdeli POST istekleri `/.netlify/functions/*` yoluna doğru iletiliyor.
- Bulunan ve düzeltilen hata: kaynak yanıtın `content-encoding/content-length`
  başlıkları aynen kopyalanınca çözülmüş gövde "brotli'li" diye sunuluyordu; başlıklar
  temizlendi, doğrulandı.

**Kurulum (kullanıcı yapacak — Cloudflare hesabına yalnız o girebiliyor):**
dash.cloudflare.com → Workers & Pages → Create → Hello World şablonu → isim: `panel` →
Deploy → Edit code → kodu sil, `cloudflare-kapi-worker.js` içeriğini yapıştır → Deploy.
Yeni adres: **https://panel.gs-fikstur.workers.dev**

**Kurulum sonrası kontrol listesi:**
1. Yeni adresi arkadaşın telefonunda aç (önbelleksiz temiz cihaz) — açılıyorsa madde
   kapanır.
2. Skorların geldiğini, "abone ol"un çalıştığını gör; bildirim isteyen herkes yeni
   adreste bir kez daha abone olmalı (abonelik adrese bağlı).
3. Kendi cihazlarında ve babandakinde yeni adrese geç (eski kopya donuk kalıyor);
   ana ekran kısayolunu yeni adresle yeniden ekle, eskisini sil.
4. Eski Netlify adresi yedek olarak aynen kalıyor; hiçbir şey silinmedi.
5. (Tavsiye, ayrı iş) Özel alan adı alıp worker'a bağla — workers.dev'in de günün
   birinde engellenmesine karşı kalıcı sigorta.

## Kaynaklar

- [EngelliWeb — Netlify erişime engellendi](https://ifade.org.tr/engelliweb/netlify-erisime-engellendi/) (BTK, 21.02.2025, 490.05.01.2025.-118058)
- [EngelliWeb — Cloudflare Pages erişime engellendi](https://ifade.org.tr/engelliweb/cloudflare-pages-erisime-engellendi-2/) (TFF, 25.11.2025, 067-01)
- [Technopat — Cloudflare Pages erişime kapatıldı](https://www.technopat.net/2025/11/30/cloudflare-pages-kapatildi/)
- [Netlify Forum — Turkey ERR_SSL_PROTOCOL_ERROR](https://answers.netlify.com/t/turkey-err-ssl-protocol-error/114059)
- [Cloudflare — Workers static assets](https://developers.cloudflare.com/workers/static-assets/) · [Pages'ten Workers'a geçiş rehberi](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [e-Devlet — Web Sitesi Erişim Engeli Sorgulama](https://www.turkiye.gov.tr/esb-web-sitesi-erisim-engeli-sorgulama)

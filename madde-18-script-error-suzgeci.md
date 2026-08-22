# Madde 18 — "Hata: Script error." uyarısını sustur (kozmetik)

**Öncelik:** Düşük — panele zararı yok, sadece çirkin görünüyordu
**Tarih:** 22.08.2026 · **Durum:** ÇÖZÜLDÜ — süzgeç 22.08 ~17:00'de kapı worker'ına
eklendi ve canlıya alındı (sürüm 4911b695). Kapı, HTML geçerken `<head>` içine tek
satırlık koruma enjekte ediyor; davranış testi geçti: maskeli "Script error." kutu
çıkarmıyor, gerçek hata (dosya adlı) aynen görünüyor. Sayfanın kalanı bire bir
korunuyor (diff: tek satır), sw.js ve diğer dosyalar dokunulmamış. Aşağıdaki
panel-içi yama artık zorunlu değil; panelin bir sonraki sürümünde eklenirse
kapıdaki enjeksiyon kaldırılabilir (ya da ikisi birden zararsızca durabilir).

## Bulgu

Madde 17 kapandıktan sonra iPhone'da panel her açılışta pembe **"Hata: Script
error."** kutusu gösterdi (16:42 ve 16:49 ekran görüntüleri). Teşhis:

- Panelin iz kaydı tertemiz: tüm veri çağrıları başarılı, açılışta hata yok.
- Panelin birebir kopyası kontrollü tarayıcıda (Chromium) çalıştırıldı: **sıfır
  hata, kutu çıkmıyor.** Panel kodunda dışarıdan yüklenen script de yok.
- "Script error." tarayıcının, **sayfanın kendi kodundan gelmeyen** (eklenti /
  tarayıcı içi) hataları ayrıntısını gizleyerek bildirme biçimidir. Panelin
  737. satırdaki "her hatayı ekrana yaz" emniyet kemeri bu dış gürültüyü de
  ekrana taşıyor.

Sonuç: Panel sağlıklı; kutu zararsız ama kullanıcıyı korkutuyor.

## Yama (panel index.html, ~737. satırdaki hata yakalayıcı)

Şimdiki hali:

```js
window.addEventListener("error",e=>{try{
  document.getElementById("bildirim").innerHTML=
    '<div class="uyari hata">Hata: '+String(e.message).slice(0,120)+'</div>';}catch(x){}});
```

Yeni hali (tek satır eklendi):

```js
window.addEventListener("error",e=>{try{
  if(!e.filename)return; /* dış kaynaklı, ayrıntısı gizlenen hata (Script error.) — gösterme */
  document.getElementById("bildirim").innerHTML=
    '<div class="uyari hata">Hata: '+String(e.message).slice(0,120)+'</div>';}catch(x){}});
```

Mantığı: dış kaynaklı maskelenmiş hatalarda `e.filename` boştur; panelin kendi
hatalarında dosya adı dolu gelir. Yani gerçek hatalar (ör. eski v73'teki tarih
hatası gibi) ekranda görünmeye devam eder, yalnızca anlamsız "Script error."
gürültüsü susar.

## Uygulama notu

Panel güncellemeleri hangi sohbette/dosyada yapılıyorsa bu maddeyi oraya taşı;
sürüm damgası (SURUM ve sw.js'teki SURUM_DAMGASI) her zamanki gibi yükseltilsin.
Netlify'a yüklenen yeni sürüm, kapı sayesinde yeni adreste kendiliğinden görünür
(madde 17) — kapı worker'ına dokunmak gerekmez.

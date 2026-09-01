# Parsel Pro Studio → Sahne Studio Köprüsü

Sahne Studio, parsel verisini Parsel Pro Studio'dan hazır alır — kullanıcı hiçbir koordinatı elle
girmez. Aktarım için üç yol vardır; üçü de aynı **ParselPaketi** JSON biçimini kullanır.

## ParselPaketi biçimi (sürüm 1)

```json
{
  "surum": 1,
  "kimlik": {
    "il": "İzmir",
    "ilce": "Karşıyaka",
    "mahalle": "Bostanlı",
    "ada": "1234",
    "parsel": "5",
    "tkgmId": "opsiyonel"
  },
  "geometri": {
    "type": "Polygon",
    "coordinates": [[[27.0919, 38.4613], [27.09236, 38.4613], [27.09236, 38.46152], [27.0919, 38.46152], [27.0919, 38.4613]]]
  },
  "alanM2": 981.4,
  "kaynak": { "uygulama": "Parsel Pro Studio", "surum": "1.0", "alinmaTarihi": "2026-08-27T10:00:00+03:00" }
}
```

Kurallar:

- Koordinatlar **EPSG:4326**, `[boylam, enlem]` sırasında (TKGM parsel sorgu servisi zaten bu biçimde döner).
- Yalnız **dış halka** desteklenir (delikli parsel şimdilik yok); 3–200 köşe.
- Kapanış tekrarı (ilk köşenin sonda yinelenmesi) olsa da olmasa da kabul edilir.
- `ada`/`parsel` sayı da gelse metne çevrilir. `alanM2`, `mahalle`, `tkgmId`, `kaynak` opsiyoneldir.

## Yol 1 — Yerel köprü (önerilen: "Sahne Studio'da Aç" düğmesi)

Sahne Studio çalışırken (`npm run dev` → `http://localhost:5173`) iki uç açıktır:

| Uç | Yöntem | İş |
|---|---|---|
| `/api/parsel` | POST (JSON gövde) | Paketi köprüye bırakır → `{"tamam":true}` |
| `/api/parsel/son` | GET | Son bırakılan paketi döner (yoksa 204) |

CORS açıktır — Parsel Pro tarayıcıda başka portta çalışsa da POST edebilir.

Parsel Pro tarafına eklenecek düğmenin tamamı:

```js
async function sahneStudiodaAc(parselPaketi) {
  await fetch("http://localhost:5173/api/parsel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parselPaketi),
  });
  window.open("http://localhost:5173/?parselUrl=/api/parsel/son", "_blank");
}
```

Kullanıcı Sahne Studio zaten açıksa POST sonrası paneldeki **"Parsel Pro'dan Al"** düğmesine basar.

## Yol 2 — URL parametresi

Paket base64url ile URL'ye gömülür (küçük paketlerde pratik):

```
http://localhost:5173/?parsel=b64:<base64url(JSON)>
```

## Yol 3 — Dosya

ParselPaketi'ni `.json` olarak dışa aktarın; kullanıcı panele sürükleyip bırakır
(veya "Parsel JSON yapıştır" alanına yapıştırır).

## Notlar

- Köprü paketi yalnız bellekte tutar; sunucu yeniden başlayınca silinir — kalıcılık Sahne Studio
  projesinde (`localStorage` + `proje.json`) sağlanır.
- Aynı parsel yeniden gönderilirse Sahne Studio o parselin kayıtlı çalışmasını (model yerleşimi,
  onaylı açılar) otomatik geri yükler.

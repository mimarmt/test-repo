/*
 * GS Fikstür — Cloudflare kapı worker'ı (Madde 17)
 *
 * Görevi: Türkiye'de engelli olan gs-fikstur.netlify.app'i engelsiz bir
 * adres üzerinden olduğu gibi geçirmek. Sayfa, sw.js, manifest, ikonlar,
 * gol.mp3 ve /.netlify/functions/* çağrılarının hepsi bu kapıdan geçer.
 *
 * Netlify'da yapılan her güncelleme burada kendiliğinden görünür;
 * bu worker'ı bir daha güncellemek gerekmez. gs-afb worker'ına dokunulmaz.
 */

const KAYNAK = "https://gs-fikstur.netlify.app";

export default {
  async fetch(istek) {
    const gelen = new URL(istek.url);
    const hedef = KAYNAK + gelen.pathname + gelen.search;
    const govdeliMi = istek.method !== "GET" && istek.method !== "HEAD";

    let cevap;
    try {
      cevap = await fetch(hedef, {
        method: istek.method,
        headers: istek.headers,
        body: govdeliMi ? istek.body : undefined,
        redirect: "follow",
      });
    } catch (hata) {
      return new Response(
        "Panel kaynağına şu an ulaşılamıyor, birazdan yeniden deneyin.",
        { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    /* Kaynağın gövdesi çözülmüş akar; sıkıştırma başlıkları kopyalanırsa
       tarayıcıya "sıkıştırılmış" diye çözülmüş veri gider. İkisini temizle,
       sıkıştırmayı Cloudflare kendisi yeniden yapsın. */
    const basliklar = new Headers(cevap.headers);
    basliklar.delete("content-encoding");
    basliklar.delete("content-length");

    return new Response(cevap.body, {
      status: cevap.status,
      statusText: cevap.statusText,
      headers: basliklar,
    });
  },
};

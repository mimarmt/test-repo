import { Cesium3DTileset, Viewer } from "cesium";

/** Doku akışı durulana kadar bekler: tilesLoaded üst üste N kare doğru kalmalı. */
export function stabilBekle(
  viewer: Viewer,
  tileset: Cesium3DTileset,
  ayarlar: { kareSayisi?: number; enAzMs?: number; zamanAsimiMs?: number } = {}
): Promise<void> {
  const { kareSayisi = 30, enAzMs = 3000, zamanAsimiMs = 120000 } = ayarlar;
  return new Promise((coz, reddet) => {
    const baslangic = performance.now();
    let ustUste = 0;
    const kaldir = viewer.scene.postRender.addEventListener(() => {
      const gecen = performance.now() - baslangic;
      if (gecen > zamanAsimiMs) {
        kaldir();
        reddet(new Error(`Sahne ${Math.round(zamanAsimiMs / 1000)} sn içinde durulmadı`));
        return;
      }
      ustUste = tileset.tilesLoaded ? ustUste + 1 : 0;
      if (ustUste >= kareSayisi && gecen >= enAzMs) {
        kaldir();
        coz();
      }
    });
  });
}

export function atifMetni(viewer: Viewer): string {
  try {
    const kap = viewer.creditDisplay.container as HTMLElement | undefined;
    const metin = (kap?.textContent ?? "").replace(/\s+/g, " ").trim();
    return metin.length > 0 ? metin : "Google";
  } catch {
    return "Google";
  }
}

function atifBandiCiz(baglam: CanvasRenderingContext2D, genislik: number, yukseklik: number, metin: string): void {
  const bantY = Math.max(28, Math.round(yukseklik * 0.024));
  baglam.fillStyle = "rgba(0,0,0,0.55)";
  baglam.fillRect(0, yukseklik - bantY, genislik, bantY);
  baglam.fillStyle = "#ffffff";
  baglam.font = `${Math.round(bantY * 0.55)}px system-ui, sans-serif`;
  baglam.textBaseline = "middle";
  const tam = metin.startsWith("Google") ? `© ${metin}` : `© Google · ${metin}`;
  baglam.fillText(tam.slice(0, 220), Math.round(bantY * 0.4), yukseklik - bantY / 2);
}

/**
 * Sahneyi ~4K çözünürlükte JPG'ye çevirir; Google atıf bandı görüntüye işlenir.
 * (Ekrandaki atıf çubuğu DOM olduğu için canvas'a kendimiz basıyoruz — ToS gereği.)
 */
export async function kareYakala(
  viewer: Viewer,
  tileset: Cesium3DTileset,
  hedefGenislik = 3840
): Promise<Blob> {
  const onceki = viewer.resolutionScale;
  const cssGenislik = viewer.canvas.clientWidth || 1;
  viewer.resolutionScale = Math.max(0.5, Math.min(hedefGenislik / cssGenislik, 4));
  try {
    await stabilBekle(viewer, tileset, { kareSayisi: 15, enAzMs: 1200, zamanAsimiMs: 60000 });
    viewer.scene.render();
    const kaynak = viewer.canvas;
    const tuval = document.createElement("canvas");
    tuval.width = kaynak.width;
    tuval.height = kaynak.height;
    const baglam = tuval.getContext("2d");
    if (!baglam) throw new Error("2D tuval oluşturulamadı");
    baglam.drawImage(kaynak, 0, 0);
    atifBandiCiz(baglam, tuval.width, tuval.height, atifMetni(viewer));
    return await new Promise<Blob>((coz, reddet) =>
      tuval.toBlob((b) => (b ? coz(b) : reddet(new Error("JPG üretilemedi"))), "image/jpeg", 0.92)
    );
  } finally {
    viewer.resolutionScale = onceki;
  }
}

export function blobIndir(blob: Blob, dosyaAdi: string): void {
  const adres = URL.createObjectURL(blob);
  const baglanti = document.createElement("a");
  baglanti.href = adres;
  baglanti.download = dosyaAdi;
  baglanti.click();
  setTimeout(() => URL.revokeObjectURL(adres), 10000);
}

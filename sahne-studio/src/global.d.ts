export {};

declare global {
  interface Window {
    /** Yakalama modunda sahne tamamen yüklendiğinde set edilir; capture.mjs bunu bekler. */
    __SAHNE_HAZIR?: { aci: number | null; zaman: string };
    /** Cesium atıf çubuğunun metni (metadata.json'a yazılır). */
    __SAHNE_ATIF?: string;
    /** Yakalama modunda ölümcül hata olursa mesajı buraya yazılır. */
    __SAHNE_HATA?: string;
  }
}

import { describe, expect, it } from "vitest";
import { parselDogrula, projeDogrula } from "../src/semalar";

const gecerliParsel = {
  surum: 1,
  kimlik: { il: "İzmir", ilce: "Karşıyaka", mahalle: "Bostanlı", ada: 1234, parsel: "5" },
  geometri: {
    type: "Polygon",
    coordinates: [
      [
        // saat yönünde + kapanış tekrarı: doğrulama normalleştirmeli
        [27.0919, 38.4613],
        [27.0919, 38.46152],
        [27.09236, 38.46152],
        [27.09236, 38.4613],
        [27.0919, 38.4613],
      ],
    ],
  },
  alanM2: 512.3,
  kaynak: { uygulama: "Parsel Pro Studio", surum: "1.0" },
};

describe("parselDogrula", () => {
  it("geçerli paketi kabul eder ve normalleştirir", () => {
    const sonuc = parselDogrula(gecerliParsel);
    expect(sonuc.tamam).toBe(true);
    if (!sonuc.tamam) return;
    expect(sonuc.deger.kimlik.ada).toBe("1234"); // sayı → metin
    const halka = sonuc.deger.geometri.coordinates[0];
    expect(halka).toHaveLength(4); // kapanış tekrarı atıldı
  });

  it("eksik il için yol içeren Türkçe hata verir", () => {
    const bozuk = structuredClone(gecerliParsel) as Record<string, unknown>;
    delete (bozuk.kimlik as Record<string, unknown>).il;
    const sonuc = parselDogrula(bozuk);
    expect(sonuc.tamam).toBe(false);
    if (sonuc.tamam) return;
    expect(sonuc.hatalar.join(" ")).toContain("kimlik.il");
  });

  it("delikli poligonu reddeder", () => {
    const bozuk = structuredClone(gecerliParsel);
    (bozuk.geometri.coordinates as number[][][]).push(bozuk.geometri.coordinates[0]);
    const sonuc = parselDogrula(bozuk);
    expect(sonuc.tamam).toBe(false);
    if (sonuc.tamam) return;
    expect(sonuc.hatalar.join(" ")).toContain("dış halka");
  });

  it("kendini kesen halkayı geometri hatasıyla reddeder", () => {
    const bozuk = structuredClone(gecerliParsel);
    bozuk.geometri.coordinates[0] = [
      [27.09, 38.46],
      [27.092, 38.462],
      [27.092, 38.46],
      [27.09, 38.463],
    ];
    const sonuc = parselDogrula(bozuk);
    expect(sonuc.tamam).toBe(false);
    if (sonuc.tamam) return;
    expect(sonuc.hatalar.join(" ")).toContain("kendini kesiyor");
  });

  it("aralık dışı koordinatı reddeder", () => {
    const bozuk = structuredClone(gecerliParsel);
    bozuk.geometri.coordinates[0][0] = [227.09, 38.46];
    const sonuc = parselDogrula(bozuk);
    expect(sonuc.tamam).toBe(false);
  });
});

describe("projeDogrula", () => {
  it("geçerli asgari projeyi kabul eder", () => {
    const proje = {
      surum: 1,
      parselSlug: "izmir-karsiyaka-1234-ada-5-parsel",
      parsel: gecerliParsel,
      model: null,
      gunesISO: "2026-08-27T14:00:00+03:00",
      acilar: [
        {
          aciNo: 1,
          ad: "Kuş bakışı GB",
          kamera: {
            lon: 27.0921,
            lat: 38.4612,
            yukseklikM: 180,
            headingDeg: 315,
            pitchDeg: -40,
            rollDeg: 0,
            fovDeg: 60,
          },
          gunesISO: "2026-08-27T14:00:00+03:00",
          enBoyOrani: "16:9",
          onayTarihi: "2026-08-27T16:00:00.000Z",
        },
      ],
      olusturma: "2026-08-27T15:00:00.000Z",
      guncelleme: "2026-08-27T16:00:00.000Z",
    };
    const sonuc = projeDogrula(proje);
    expect(sonuc.tamam).toBe(true);
  });

  it("bozuk açı kaydını yol ile bildirir", () => {
    const proje = {
      surum: 1,
      parselSlug: "x",
      parsel: gecerliParsel,
      model: null,
      gunesISO: "2026-08-27T14:00:00+03:00",
      acilar: [{ aciNo: 1, ad: "eksik kamera" }],
      olusturma: "t",
      guncelleme: "t",
    };
    const sonuc = projeDogrula(proje);
    expect(sonuc.tamam).toBe(false);
    if (sonuc.tamam) return;
    expect(sonuc.hatalar.join(" ")).toContain("acilar.0");
  });
});

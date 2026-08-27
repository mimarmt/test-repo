import { describe, expect, it } from "vitest";
import {
  GeometriHatasi,
  enUzunKenarAcisi,
  halkaNormallestir,
  merkezHesapla,
  metreOtele,
  parselSlug,
  yaklasikCapM,
} from "../src/parsel/geometri";

// İzmir/Karşıyaka civarında ~200×56 m saat yönünün tersine (CCW) dikdörtgen
const CCW_DIKDORTGEN: number[][] = [
  [27.0919, 38.4613],
  [27.0942, 38.4613],
  [27.0942, 38.46181],
  [27.0919, 38.46181],
];

describe("halkaNormallestir", () => {
  it("kapanış tekrarını atar", () => {
    const kapali = [...CCW_DIKDORTGEN, CCW_DIKDORTGEN[0]];
    expect(halkaNormallestir(kapali)).toHaveLength(4);
  });

  it("saat yönündeki halkayı CCW'ye çevirir", () => {
    const cw = [...CCW_DIKDORTGEN].reverse();
    const sonuc = halkaNormallestir(cw);
    expect(sonuc).toEqual([...cw].reverse());
  });

  it("z bileşenini atar", () => {
    const uclu = CCW_DIKDORTGEN.map(([lon, lat]) => [lon, lat, 42]);
    const sonuc = halkaNormallestir(uclu);
    expect(sonuc[0]).toHaveLength(2);
  });

  it("dejenere (çizgisel) halkayı reddeder", () => {
    const cizgi = [
      [27.09, 38.46],
      [27.091, 38.46],
      [27.092, 38.46],
    ];
    expect(() => halkaNormallestir(cizgi)).toThrow(GeometriHatasi);
  });

  it("kendini kesen (papyon) halkayı reddeder", () => {
    // asimetrik papyon: alanı sıfır olmadığından dejenere değil, kesişme dalına düşer
    const papyon = [
      [27.09, 38.46],
      [27.092, 38.462],
      [27.092, 38.46],
      [27.09, 38.463],
    ];
    expect(() => halkaNormallestir(papyon)).toThrow(/kendini kesiyor/);
  });

  it("3'ten az köşeyi reddeder", () => {
    expect(() =>
      halkaNormallestir([
        [27.09, 38.46],
        [27.091, 38.461],
        [27.09, 38.46],
      ])
    ).toThrow(/en az 3/);
  });
});

describe("merkezHesapla", () => {
  it("dikdörtgenin merkezini bulur", () => {
    const [lon, lat] = merkezHesapla(CCW_DIKDORTGEN as [number, number][]);
    expect(lon).toBeCloseTo((27.0919 + 27.0942) / 2, 6);
    expect(lat).toBeCloseTo((38.4613 + 38.46181) / 2, 6);
  });

  it("L biçimli parselde köşe ortalamasından farklı, alan ağırlıklı sonuç verir", () => {
    // L şekli: büyük kol sağda — merkez sağa kaymalı
    const elSekli: [number, number][] = [
      [0, 0],
      [0.003, 0],
      [0.003, 0.003],
      [0.002, 0.003],
      [0.002, 0.001],
      [0, 0.001],
    ];
    const [lon] = merkezHesapla(elSekli);
    const koseOrtalamasi = elSekli.reduce((t, k) => t + k[0], 0) / elSekli.length;
    expect(lon).toBeGreaterThan(koseOrtalamasi);
  });
});

describe("enUzunKenarAcisi", () => {
  it("doğu yönündeki en uzun kenar için 90° döner", () => {
    const halka: [number, number][] = [
      [0, 0],
      [0.002, 0],
      [0.002, 0.0005],
      [0, 0.0005],
    ];
    expect(enUzunKenarAcisi(halka)).toBeCloseTo(90, 5);
  });

  it("kuzey yönündeki en uzun kenar için 0° döner", () => {
    const halka: [number, number][] = [
      [0, 0],
      [0.0005, 0],
      [0.0005, 0.002],
      [0, 0.002],
    ];
    // CCW halkada uzun kenarlardan ilki kuzeye gider (köşe 2→3)... yön 0 ya da 180 olabilir
    const aci = enUzunKenarAcisi(halka);
    expect([0, 180]).toContainEqual(Math.round(aci));
  });
});

describe("yaklasikCapM", () => {
  it("ekvatorda 0.002 derece ≈ 222 m", () => {
    const halka: [number, number][] = [
      [0, 0],
      [0.002, 0],
      [0.002, 0.0005],
      [0, 0.0005],
    ];
    expect(yaklasikCapM(halka)).toBeGreaterThan(210);
    expect(yaklasikCapM(halka)).toBeLessThan(235);
  });
});

describe("metreOtele", () => {
  it("kuzeye 100 m ötelemede yalnız enlem artar", () => {
    const [lon, lat] = metreOtele([27, 38], 100, 0);
    expect(lon).toBeCloseTo(27, 9);
    expect(lat).toBeGreaterThan(38);
    expect((lat - 38) * 111_195).toBeCloseTo(100, 0);
  });

  it("doğuya ötelemede yalnız boylam artar", () => {
    const [lon, lat] = metreOtele([27, 38], 100, 90);
    expect(lat).toBeCloseTo(38, 9);
    expect(lon).toBeGreaterThan(27);
  });
});

describe("parselSlug", () => {
  it("Türkçe karakterleri ASCII'ye çevirir", () => {
    expect(parselSlug({ il: "İzmir", ilce: "Karşıyaka", ada: "1234", parsel: "5" })).toBe(
      "izmir-karsiyaka-1234-ada-5-parsel"
    );
  });

  it("büyük İĞÜŞÖÇ harflerini doğru dönüştürür", () => {
    expect(parselSlug({ il: "IĞDIR", ilce: "ÇÜŞÖİ", ada: "1", parsel: "2" })).toBe(
      "igdir-cusoi-1-ada-2-parsel"
    );
  });

  it("boşluk ve noktalama yerine tire koyar", () => {
    expect(parselSlug({ il: "Afyon Karahisar", ilce: "Merkez / Batı", ada: "10", parsel: "3" })).toBe(
      "afyon-karahisar-merkez-bati-10-ada-3-parsel"
    );
  });
});

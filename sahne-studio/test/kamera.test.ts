import { describe, expect, it } from "vitest";
import { Math as CMath } from "cesium";
import { aciUygulaParametreleri, kartesyendenKoordinat } from "../src/sahne/kamera";
import type { AciKamerasi } from "../src/semalar";

describe("açı serileştirme gidiş-dönüşü", () => {
  const aci: AciKamerasi = {
    lon: 27.09215,
    lat: 38.46141,
    yukseklikM: 152.75,
    headingDeg: 312.4,
    pitchDeg: -33.25,
    rollDeg: 0,
    fovDeg: 60,
  };

  it("konum kartesyene çevrilip geri geldiğinde korunur", () => {
    const { destination } = aciUygulaParametreleri(aci);
    const geri = kartesyendenKoordinat(destination);
    expect(geri.lon).toBeCloseTo(aci.lon, 8);
    expect(geri.lat).toBeCloseTo(aci.lat, 8);
    expect(geri.yukseklikM).toBeCloseTo(aci.yukseklikM, 4);
  });

  it("yönelim dereceleri radyana doğru çevrilir", () => {
    const { orientation } = aciUygulaParametreleri(aci);
    expect(orientation.heading).toBeCloseTo(CMath.toRadians(312.4), 12);
    expect(orientation.pitch).toBeCloseTo(CMath.toRadians(-33.25), 12);
    expect(orientation.roll).toBe(0);
  });
});

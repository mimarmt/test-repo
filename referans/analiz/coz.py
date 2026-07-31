"""m2 tablosunun analizi.

    python -m referans.analiz.coz

Uc soruya cevap arar:
  1. Tablo kendi icinde tutarli mi? (toplamlar tutuyor mu)
  2. Oda alani net m2 ile nasil degisiyor? (sabit mi, oransal mi)
  3. Benim uydurdugum alan bantlari bu gercek cozumleri kabul ediyor mu?
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .veri import BOS_SATIRLAR, TABLO

KOK = Path(__file__).resolve().parents[1] / "ic_plan"

# Excel adi -> benim tip adim (bant karsilastirmasi icin)
ESLESME = {
    "salon": "salon", "salon_mutfak": "salon", "koridor": "koridor",
    "mutfak": "mutfak", "antre": "antre",
    "yatak": "yatak", "yatak_1": "yatak", "yatak_2": "yatak",
    "yatak_3": "yatak", "yatak_4": "yatak", "eb_yatak_1": "ebeveyn",
    "wc_dus": "duslu_wc", "kucuk_wc": "misafir_wc", "wc_camasir": "duslu_wc",
}


def baslik(s: str) -> None:
    print(f"\n{'═' * 74}\n{s}\n{'═' * 74}")


def tutarlilik() -> None:
    baslik("1 · TABLO TUTARLILIGI — oda toplamlari net m2'yi tutuyor mu")
    for tip, (adlar, satirlar) in TABLO.items():
        for net, alanlar in satirlar:
            top = sum(alanlar)
            fark = top - net
            im = "✓" if abs(fark) < 0.5 else "✗"
            ek = "" if abs(fark) < 0.5 else f"   ← {fark:+.1f} m2 FARK"
            print(f"  {im} {tip:4s} {net:6.0f} m2   odalar toplami {top:6.1f}{ek}")


def olcek() -> dict:
    baslik("2 · ODA ALANI NET m2 ILE NASIL DEGISIYOR")
    print("  egim = marjinal m2'nin kaci bu odaya gidiyor")
    print("  pay  = odanin net alandaki yuzdesi (ilk → son satir)\n")

    cikti: dict[str, dict] = {}
    for tip, (adlar, satirlar) in TABLO.items():
        if len(satirlar) < 2:
            print(f"  {tip}  — tek satir, egim hesaplanamaz (Excel'de eksik)\n")
            continue
        netler = np.array([s[0] for s in satirlar], dtype=float)
        print(f"  ── {tip}  ({len(satirlar)} satir, {netler.min():.0f}–{netler.max():.0f} m2)")
        cikti[tip] = {}
        for k, ad in enumerate(adlar):
            y = np.array([s[1][k] for s in satirlar], dtype=float)
            egim, sabit = np.polyfit(netler, y, 1)
            paylar = y / netler
            # Sabit mi, oransal mi?
            if abs(egim) < 0.02:
                cins = "SABIT"
            elif abs(sabit) < 0.15 * y.mean():
                cins = "ORANSAL"
            else:
                cins = "TABANLI"
            print(
                f"     {ad:14s} egim {egim:+5.3f}  sabit {sabit:+6.1f}  "
                f"pay %{paylar[0]*100:4.1f}→%{paylar[-1]*100:4.1f}   {cins}"
            )
            cikti[tip][ad] = {
                "egim": round(float(egim), 4),
                "sabit": round(float(sabit), 2),
                "pay_ort": round(float(paylar.mean()), 4),
                "cins": cins,
            }
        print()
    return cikti


def bantlarim() -> None:
    baslik("3 · BENIM UYDURDUGUM BANTLAR GERCEK COZUMLERI KABUL EDIYOR MU")
    program = json.loads((KOK / "oda_programi.json").read_text(encoding="utf-8"))
    tipler = program["tipler"]

    toplam = ihlal = 0
    ayrinti: list[str] = []
    for tip, (adlar, satirlar) in TABLO.items():
        for net, alanlar in satirlar:
            for ad, alan in zip(adlar, alanlar):
                benim = ESLESME.get(ad)
                if benim not in tipler:
                    continue
                toplam += 1
                b = tipler[benim]
                if alan < b["alan_min"] - 1e-9:
                    ihlal += 1
                    ayrinti.append(
                        f"     {tip:4s} {net:5.0f} m2  {ad:14s} {alan:5.1f} m2  "
                        f"< min {b['alan_min']:.1f}  ({benim})"
                    )
                elif alan > b["alan_max"] + 1e-9:
                    ihlal += 1
                    ayrinti.append(
                        f"     {tip:4s} {net:5.0f} m2  {ad:14s} {alan:5.1f} m2  "
                        f"> max {b['alan_max']:.1f}  ({benim})"
                    )
    print(f"  {ihlal}/{toplam} oda, benim bandımın DISINDA  (%{ihlal/toplam*100:.0f})")
    print("\n  Reddedilenler:")
    for a in ayrinti:
        print(a)

    # Satir bazinda: kac cozum tamamen kabul edilirdi
    kabul = 0
    tum = 0
    for tip, (adlar, satirlar) in TABLO.items():
        for net, alanlar in satirlar:
            tum += 1
            if all(
                ESLESME.get(ad) not in tipler
                or tipler[ESLESME[ad]]["alan_min"] - 1e-9 <= alan
                <= tipler[ESLESME[ad]]["alan_max"] + 1e-9
                for ad, alan in zip(adlar, alanlar)
            ):
                kabul += 1
    print(f"\n  Mimarin {tum} gercek cozumunden {kabul} tanesi benim programimla")
    print(f"  uretilebilirdi. {tum - kabul} tanesi COZUM YOK verirdi.")


def tahmin(katsayi: dict) -> None:
    baslik("4 · EXCEL'DE BOS BIRAKILAN SATIRLAR — modelin tahmini")
    print("  ⚠ Bunlar MIMARIN VERISI DEGIL, modelin cikarimi. Onay bekler.\n")
    for tip, netler in BOS_SATIRLAR.items():
        if tip not in katsayi:
            print(f"  {tip}: katsayi yok (tabloda tek satir var), tahmin edilemez\n")
            continue
        adlar = TABLO[tip][0]
        print(f"  ── {tip}")
        print("     net m2  " + " ".join(f"{a[:11]:>11s}" for a in adlar) + "        top")
        for net in netler:
            degerler = [
                max(0.0, katsayi[tip][ad]["egim"] * net + katsayi[tip][ad]["sabit"])
                for ad in adlar
            ]
            olcekli = [d * net / sum(degerler) for d in degerler]
            print(
                f"     {net:6.0f}  "
                + " ".join(f"{d:11.1f}" for d in olcekli)
                + f"  {sum(olcekli):9.1f}"
            )
        print()


def main() -> int:
    tutarlilik()
    katsayi = olcek()
    bantlarim()
    tahmin(katsayi)

    (Path(__file__).parent / "katsayilar.json").write_text(
        json.dumps(katsayi, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

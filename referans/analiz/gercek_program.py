"""Mimarin kendi programini sistem uretebiliyor mu?

    python -m referans.analiz.gercek_program

Alan bantlari artik UYDURULMUYOR: program_semasi.json'daki oransal
katsayilardan, yani Murat Turna'nin m2 tablosundan uretiliyor.

Olculen soru: mimarin gercek oda dagilimini tutturmak icin alan bandina
ne kadar TOLERANS gerekiyor? Tolerans ne kadar darsa model o kadar
sadik; ama cok dar olursa geometri (en/boy orani, min kenar, komsuluk)
tutmaz ve cozum cikmaz. Aradaki en kucuk deger olculur.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

from ..ic_plan import puanlama
from ..ic_plan.motor import uret

KOK = Path(__file__).resolve().parents[1] / "ic_plan"

# Excel oda adi -> geometrik tip (min_kenar / max_oran / erisim buradan)
GEOMETRI = {
    "salon": "salon", "salon_mutfak": "salon", "koridor": "koridor",
    "mutfak": "mutfak", "antre": "antre",
    "yatak": "yatak", "yatak_1": "yatak", "yatak_2": "yatak",
    "yatak_3": "yatak", "yatak_4": "yatak", "eb_yatak_1": "ebeveyn",
    "wc_dus": "duslu_wc", "kucuk_wc": "misafir_wc", "wc_camasir": "duslu_wc",
}


def program_kur(tipoloji: str, net_m2: float, tolerans: float,
                sema: dict, taban: dict) -> tuple[dict, list[str]]:
    """Oransal katsayilardan CP-SAT programi kurar."""
    kat = sema["alan_dagilimi"]["tipler"][tipoloji]
    odalar = sema["tipolojiler"][tipoloji]["cekirdek_odalar"]

    program = copy.deepcopy(taban)
    program["tipler"] = {}

    for ad in odalar:
        g = taban["tipler"][GEOMETRI[ad]]
        k = kat[ad]
        hedef = k["deger_m2"] if k["cins"] == "sabit" else k["oran"] * net_m2
        program["tipler"][ad] = {
            **g,
            "alan_hedef": round(hedef, 2),
            "alan_min": round(hedef * (1 - tolerans), 2),
            "alan_max": round(hedef * (1 + tolerans), 2),
        }
        # Bu tipolojide antre yoksa, giris bolgesi odalari da koridora acilir
        if "sirkulasyon" in program["tipler"][ad].get("erisim", []):
            program["tipler"][ad]["erisim"] = ["sirkulasyon"]
        elif program["tipler"][ad].get("erisim") == ["antre"]:
            program["tipler"][ad]["erisim"] = ["koridor"]

    return program, odalar


def girdi_kur(odalar: list[str], en: float, boy: float) -> dict:
    sirk = [a for a in odalar if a in ("koridor", "antre")]
    giris = "antre" if "antre" in odalar else "koridor"
    komsuluk = [[giris, a] for a in odalar if a not in sirk]
    return {
        "kontur": {"en": en, "boy": boy},
        "cepheler": ["sol", "sag", "alt", "ust"],
        "bosluklar": [],
        "giris": {"oda": giris, "kenar": "alt", "konum": en / 2 - 0.55,
                  "genislik": 1.10},
        "odalar": [{"ad": a, "tip": a} for a in odalar],
        "komsuluklar": komsuluk,
    }


def dene(tipoloji: str, net_m2: float, en: float, boy: float,
         sema: dict, taban: dict) -> None:
    print(f"\n{'─' * 72}")
    print(f"{tipoloji} · {net_m2:.0f} m² net · kontur {en:.1f} × {boy:.1f} m")
    print(f"{'─' * 72}")

    kat = sema["alan_dagilimi"]["tipler"][tipoloji]
    odalar = sema["tipolojiler"][tipoloji]["cekirdek_odalar"]
    print("  Mimarın tablosundan gelen hedefler:")
    for ad in odalar:
        k = kat[ad]
        h = k["deger_m2"] if k["cins"] == "sabit" else k["oran"] * net_m2
        cins = "sabit" if k["cins"] == "sabit" else f"%{k['oran']*100:.1f}"
        print(f"     {ad:14s} {h:6.2f} m²   ({cins})")

    for tol in (0.05, 0.10, 0.15, 0.25):
        program, odalar = program_kur(tipoloji, net_m2, tol, sema, taban)
        girdi = girdi_kur(odalar, en, boy)
        plan = uret(girdi, program)
        durum = plan["durum"]
        if plan.get("odalar"):
            kusur = puanlama.ele(plan, girdi, program)
            sapma = plan["rapor"]["toplam_alan_sapmasi_m2"]
            im = "✓" if not kusur else f"✗ {len(kusur)} kusur"
            print(f"  tolerans ±%{tol*100:3.0f}  →  {durum:18s} "
                  f"sapma {sapma:5.2f} m²  {im}")
            if not kusur:
                for o in sorted(plan["odalar"], key=lambda z: -z["alan"]):
                    print(f"        {o['ad']:14s} {o['alan']:6.2f} m²  "
                          f"{o['en']:4.1f}×{o['boy']:4.1f}")
                return
        else:
            print(f"  tolerans ±%{tol*100:3.0f}  →  {durum}")
    print("  ⚠ Hiçbir toleransta temiz plan çıkmadı.")


def main() -> int:
    sema = json.loads((KOK / "program_semasi.json").read_text(encoding="utf-8"))
    taban = json.loads((KOK / "oda_programi.json").read_text(encoding="utf-8"))
    taban["esikler"]["cozum_suresi_sn"] = 20.0

    print("═" * 72)
    print("MIMARIN KENDI PROGRAMINI SISTEM URETEBILIYOR MU")
    print("Alan bantlari uydurma degil — m² tablosundan.")
    print("═" * 72)

    dene("3+1", 100, 12.5, 8.0, sema, taban)
    dene("3+1", 75, 10.0, 7.5, sema, taban)
    dene("4+1", 140, 14.0, 10.0, sema, taban)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

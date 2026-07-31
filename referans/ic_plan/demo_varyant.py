"""Uctan uca gosterim: varyant uret -> ele -> ozellik cikar -> sirala.

    python -m referans.ic_plan.demo_varyant

DIKKAT — bu betikteki mimar tercihleri YAPAYDIR. Makinenin calistigini
gostermek icindir. Gercek agirliklar ancak GERCEK ikili tercihlerden
cikar; sentetik tercihle uretilen agirlik hicbir sey kanitlamaz.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import numpy as np

from . import ciz, puanlama
from .varyant import uret_varyantlar

KOK = Path(__file__).parent


def main() -> int:
    girdi = json.loads((KOK / "ornek_girdi.json").read_text(encoding="utf-8"))
    program = json.loads((KOK / "oda_programi.json").read_text(encoding="utf-8"))

    hizli = copy.deepcopy(program)
    hizli["esikler"]["cozum_suresi_sn"] = 10.0

    print("1) Varyant uretimi (agirlik uzayinda ornekleme)...")
    planlar = uret_varyantlar(girdi, hizli, sayi=8, deneme=14, tohum=7)
    print(f"   farkli topolojide {len(planlar)} plan\n")

    print("2) KATMAN 1 — eleme")
    gecen, elenen = [], []
    for i, p in enumerate(planlar):
        kusur = puanlama.ele(p, girdi, program)
        if kusur:
            elenen.append((i, kusur))
            print(f"   V{i} ELENDI: {'; '.join(kusur)}")
        else:
            gecen.append(p)
    print(f"   {len(gecen)}/{len(planlar)} plan siralamaya girdi\n")

    if len(gecen) < 2:
        print("   Siralama icin en az 2 plan gerekli.")
        return 1

    print("3) KATMAN 2 — ozellikler")
    ozs = [puanlama.ozellikler(p, girdi, program) for p in gecen]
    X = np.array([puanlama.vektor(o) for o in ozs])
    Xn, _, _ = puanlama.olcekle(X)

    basliklar = [ad for ad, _ in puanlama.OZELLIKLER]
    print("        " + " ".join(f"{a[:9]:>9s}" for a in basliklar[:6]))
    for i, o in enumerate(ozs):
        print(f"   V{i}   " + " ".join(f"{o[a]:9.3f}" for a in basliklar[:6]))
    print()

    # ── YAPAY mimar tercihi ────────────────────────────────────
    # Gercekte burada mimarin "bu mu su mu" cevaplari olur.
    gizli = np.array([y for _, y in puanlama.OZELLIKLER], dtype=float)
    gizli_puan = Xn @ gizli

    ciftler = [(i, j) for i in range(len(gecen)) for j in range(len(gecen)) if i < j]
    fark = np.array([
        (Xn[i] - Xn[j]) if gizli_puan[i] > gizli_puan[j] else (Xn[j] - Xn[i])
        for i, j in ciftler
    ])
    print(f"4) Ogrenme — {len(fark)} ikili tercih (YAPAY)")
    w = puanlama.ogren(fark)
    print(f"   tercih dogrulugu: %{puanlama.dogruluk(fark, w) * 100:.0f}")
    print("   ogrenilen agirliklar (buyukten kucuge |w|):")
    for k in np.argsort(-np.abs(w)):
        print(f"     {basliklar[k]:22s} {w[k]:+7.3f}")
    print()

    print("5) Siralama")
    puanlar = puanlama.puanla(Xn, w)
    cikti = KOK / "cikti" / "varyantlar"
    cikti.mkdir(parents=True, exist_ok=True)
    for sira, k in enumerate(np.argsort(-puanlar), start=1):
        p = gecen[k]
        o = ozs[k]
        print(
            f"   {sira}. V{k}  puan {puanlar[k]:+6.2f}  "
            f"komsuluk %{o['komsuluk_karsilanma']*100:3.0f}  "
            f"sirk %{o['sirkulasyon_orani']*100:4.1f}  "
            f"en kotu oran {o['en_kotu_oran']:.2f}"
        )
        (cikti / f"{sira:02d}_V{k}.svg").write_text(ciz.svg(p), encoding="utf-8")

    print(f"\ncikti: {cikti}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

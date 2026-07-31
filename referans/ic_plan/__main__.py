"""Dosya isi burada; motor.py dosya yolu bilmez.

Kullanim:
    python -m referans.ic_plan [girdi.json] [cikti_kok]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from . import ciz
from .dogrula import dogrula
from .motor import uret

KOK = Path(__file__).parent


def main(argv: list[str]) -> int:
    girdi_yolu = Path(argv[1]) if len(argv) > 1 else KOK / "ornek_girdi.json"
    cikti_kok = Path(argv[2]) if len(argv) > 2 else KOK / "cikti"
    cikti_kok.mkdir(parents=True, exist_ok=True)

    girdi = json.loads(girdi_yolu.read_text(encoding="utf-8"))
    program = json.loads((KOK / "oda_programi.json").read_text(encoding="utf-8"))

    plan = uret(girdi, program)

    ad = girdi_yolu.stem
    (cikti_kok / f"{ad}.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"durum: {plan['durum']}")
    for k, v in plan["rapor"].items():
        print(f"  {k}: {v}")

    if not plan["odalar"]:
        return 1

    # Motorun iddiasini bagimsizca olc
    ihlaller = dogrula(plan, girdi, program)
    print("\ndogrulama:", "TEMIZ" if not ihlaller else f"{len(ihlaller)} ihlal")
    for i in ihlaller:
        print(f"  ! {i}")

    (cikti_kok / f"{ad}.svg").write_text(ciz.svg(plan), encoding="utf-8")
    print(f"\ncikti: {cikti_kok}/{ad}.svg")
    return 0 if not ihlaller else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

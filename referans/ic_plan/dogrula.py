"""Bagimsiz dogrulayici — cozucunun kendi iddiasina GUVENMEZ.

Motor "komsuluk saglandi" diyebilir; bu modul plani metre cinsinden,
sifirdan olcer. Izgara yuvarlamasi, birim hatasi ve model kurma hatasi
ancak boyle yakalanir. Bu ayrimin bedeli bir kez yazildi: kapi esigi
0.90 m iken 0.20 m'lik izgarada 0.80 m'ye dusmustu ve model bunu
"saglandi" olarak raporlamisti.
"""

from __future__ import annotations

TOLERANS = 1e-6


def _ortak_kenar(a: dict, b: dict) -> float:
    """Iki odanin paylastigi kenarin uzunlugu (metre, yoksa 0)."""
    ax2, ay2 = a["x"] + a["en"], a["y"] + a["boy"]
    bx2, by2 = b["x"] + b["en"], b["y"] + b["boy"]
    if abs(ax2 - b["x"]) < TOLERANS or abs(bx2 - a["x"]) < TOLERANS:
        return max(0.0, min(ay2, by2) - max(a["y"], b["y"]))
    if abs(ay2 - b["y"]) < TOLERANS or abs(by2 - a["y"]) < TOLERANS:
        return max(0.0, min(ax2, bx2) - max(a["x"], b["x"]))
    return 0.0


def _dis_cephe(o: dict, K: dict, cepheler: set[str]) -> float:
    u = 0.0
    if "sol" in cepheler and abs(o["x"]) < TOLERANS:
        u = max(u, o["boy"])
    if "sag" in cepheler and abs(o["x"] + o["en"] - K["en"]) < TOLERANS:
        u = max(u, o["boy"])
    if "alt" in cepheler and abs(o["y"]) < TOLERANS:
        u = max(u, o["en"])
    if "ust" in cepheler and abs(o["y"] + o["boy"] - K["boy"]) < TOLERANS:
        u = max(u, o["en"])
    return u


def dogrula(plan: dict, girdi: dict, program: dict) -> list[str]:
    """Ihlal listesi dondurur. Bos liste = plan temiz."""
    if not plan.get("odalar"):
        return ["plan bos"]

    esik, tipler = program["esikler"], program["tipler"]
    K = plan["kontur"]
    cepheler = set(girdi.get("cepheler", ("sol", "sag", "alt", "ust")))
    odalar = plan["odalar"]
    parcalar = odalar + plan.get("bosluklar", [])
    ihlal: list[str] = []

    # 1) Kontur icinde mi
    for o in parcalar:
        if (o["x"] < -TOLERANS or o["y"] < -TOLERANS
                or o["x"] + o["en"] > K["en"] + TOLERANS
                or o["y"] + o["boy"] > K["boy"] + TOLERANS):
            ihlal.append(f"KONTUR DISI: {o.get('ad', '?')}")

    # 2) Cakisma yok mu
    for i in range(len(parcalar)):
        for j in range(i + 1, len(parcalar)):
            a, b = parcalar[i], parcalar[j]
            ox = min(a["x"] + a["en"], b["x"] + b["en"]) - max(a["x"], b["x"])
            oy = min(a["y"] + a["boy"], b["y"] + b["boy"]) - max(a["y"], b["y"])
            if ox > TOLERANS and oy > TOLERANS:
                ihlal.append(
                    f"CAKISMA: {a.get('ad','?')} ile {b.get('ad','?')} "
                    f"({ox:.2f}x{oy:.2f} m)"
                )

    # 3) Bosluk kalmis mi (alan denkligi + cakismasizlik => tam doseme)
    toplam = sum(o["en"] * o["boy"] for o in parcalar)
    if abs(toplam - K["en"] * K["boy"]) > 1e-4:
        ihlal.append(
            f"BOSLUK: doseme {toplam:.3f} m2, kontur {K['en'] * K['boy']:.3f} m2"
        )

    # 4) Olcu esikleri
    for o in odalar:
        t = tipler[o["tip"]]
        kisa = min(o["en"], o["boy"])
        if kisa < t["min_kenar"] - TOLERANS:
            ihlal.append(f"DAR: {o['ad']} kisa kenar {kisa:.2f} < {t['min_kenar']} m")
        oran = max(o["en"], o["boy"]) / kisa
        if oran > t["max_oran"] + 1e-9:
            ihlal.append(f"ORAN: {o['ad']} {oran:.2f} > {t['max_oran']}")
        alan = o["en"] * o["boy"]
        if not (t["alan_min"] - 1e-6 <= alan <= t["alan_max"] + 1e-6):
            ihlal.append(
                f"ALAN: {o['ad']} {alan:.2f} m2, bant [{t['alan_min']}, {t['alan_max']}]"
            )

    # 5) Gun isigi
    for o in odalar:
        if tipler[o["tip"]].get("gun_isigi"):
            c = _dis_cephe(o, K, cepheler)
            if c < esik["min_cephe"] - TOLERANS:
                ihlal.append(
                    f"ISIK: {o['ad']} dis cephe {c:.2f} < {esik['min_cephe']} m"
                )

    # 6) Istenen komsuluklar — gercek kapi genisligiyle
    ad_map = {o["ad"]: o for o in odalar}
    kapi = esik["kapi_genisligi"]
    for a, b in girdi.get("komsuluklar", []):
        if a not in ad_map or b not in ad_map:
            continue
        u = _ortak_kenar(ad_map[a], ad_map[b])
        saglanmayan = [tuple(x) for x in plan["rapor"].get("saglanmayan_komsuluklar", [])]
        if u < kapi - TOLERANS and (a, b) not in saglanmayan:
            ihlal.append(
                f"KOMSULUK: {a}-{b} ortak kenar {u:.2f} < {kapi} m "
                f"(motor 'saglandi' dedi)"
            )

    # 7) Sirkulasyon tavani
    sirk = sum(
        o["en"] * o["boy"] for o in odalar if tipler[o["tip"]].get("sirkulasyon")
    )
    oran = sirk / (K["en"] * K["boy"])
    if oran > esik["sirkulasyon_max_oran"] + 1e-9:
        ihlal.append(
            f"SIRKULASYON: %{oran * 100:.1f} > %{esik['sirkulasyon_max_oran'] * 100:.0f}"
        )

    return ihlal

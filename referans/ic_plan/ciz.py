"""Uretilen plani SVG'ye cevirir. Hesap yapmaz, yalnizca cizer."""

from __future__ import annotations

RENK = {
    "salon": "#e8f0fb", "ebeveyn": "#eef7ec", "yatak": "#f3f7ec",
    "mutfak": "#fdf2e3", "banyo": "#e6f4f6", "wc": "#e6f4f6",
    "antre": "#f4f0f8", "koridor": "#f4f0f8", "balkon": "#f7f7f7",
}


def svg(plan: dict, olcek: float = 40.0, kenar: float = 30.0) -> str:
    """olcek: metre basina piksel."""
    K = plan["kontur"]
    w, h = K["en"] * olcek, K["boy"] * olcek
    G, Y = w + 2 * kenar, h + 2 * kenar

    def px(x: float, y: float, boy: float = 0.0) -> tuple[float, float]:
        # SVG'de y asagi buyur; mimari cizimde yukari. Ceviriyoruz.
        return kenar + x * olcek, kenar + (K["boy"] - y - boy) * olcek

    p = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{G:.0f}" height="{Y:.0f}" '
        f'viewBox="0 0 {G:.0f} {Y:.0f}">',
        f'<rect width="{G:.0f}" height="{Y:.0f}" fill="#ffffff"/>',
    ]

    for o in plan["odalar"]:
        x, y = px(o["x"], o["y"], o["boy"])
        ow, oh = o["en"] * olcek, o["boy"] * olcek
        p.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{ow:.1f}" height="{oh:.1f}" '
            f'fill="{RENK.get(o["tip"], "#f0f0f0")}" stroke="#333" stroke-width="2"/>'
        )
        cx, cy = x + ow / 2, y + oh / 2
        p.append(
            f'<text x="{cx:.1f}" y="{cy - 4:.1f}" text-anchor="middle" '
            f'font-family="Helvetica" font-size="12" fill="#111">{o["ad"]}</text>'
        )
        p.append(
            f'<text x="{cx:.1f}" y="{cy + 11:.1f}" text-anchor="middle" '
            f'font-family="Helvetica" font-size="10" fill="#666">'
            f'{o["alan"]:.1f} m² · {o["en"]:.1f}×{o["boy"]:.1f}</text>'
        )

    for b in plan.get("bosluklar", []):
        x, y = px(b["x"], b["y"], b["boy"])
        p.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{b["en"] * olcek:.1f}" '
            f'height="{b["boy"] * olcek:.1f}" fill="#d8d8d8" stroke="#333" stroke-width="2"/>'
        )

    # Kontur (dis duvar) en uste
    x0, y0 = px(0, 0, K["boy"])
    p.append(
        f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'fill="none" stroke="#000" stroke-width="4"/>'
    )
    p.append("</svg>")
    return "\n".join(p)

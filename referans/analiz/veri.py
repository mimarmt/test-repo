"""Murat Turna'nin m2 tablosu — tipolojiye gore oda alani cozumleri.

Kaynak: Murat Turna'nin hazirladigi Excel, 31.07.2026. GERCEK VERI.
Butun degerler NET m2. Balkon tabloda YOKTUR (net alana dahil degil).

Bos birakilan satirlar (Excel'de doldurulmamis) burada da yoktur;
tahmin edilip doldurulmamistir.
"""

# tipoloji -> (oda adlari, [(net_m2, [oda alanlari...]), ...])
TABLO: dict[str, tuple[list[str], list[tuple[float, list[float]]]]] = {
    "1+0": (
        ["yatak", "wc_dus"],
        [
            (24, [18, 6]),
            (35, [27, 8]),
            (45, [37, 8]),
            (52, [44, 8]),
        ],
    ),
    "1+1": (
        ["salon_mutfak", "koridor", "yatak", "wc_dus"],
        [
            (45, [20, 3, 14, 8]),
            (55, [26, 5, 14, 10]),
            # 65 ve 70 m2 satirlari Excel'de bos
        ],
    ),
    "2+1": (
        ["salon", "koridor", "mutfak", "yatak_1", "yatak_2", "wc_dus"],
        [
            (75, [22, 7, 11, 13, 11, 10]),
            # 55, 87, 95 m2 satirlari Excel'de bos
        ],
    ),
    "3+1": (
        ["salon", "koridor", "mutfak", "yatak_1", "yatak_2", "yatak_3",
         "kucuk_wc", "wc_dus"],
        [
            (75, [20, 6.6, 9, 11, 9, 9, 4, 6]),
            (100, [30, 9, 12, 12, 12, 10, 4, 12]),
            # 120 ve 125 m2 satirlari Excel'de bos
        ],
    ),
    "4+1": (
        ["salon", "antre", "koridor", "mutfak", "eb_yatak_1", "yatak_2",
         "yatak_3", "yatak_4", "wc_dus", "wc_camasir"],
        [
            (140, [30, 9, 7, 16, 19, 16, 14, 14, 9, 6]),
            (180, [38, 12, 10, 20, 24, 20, 18, 18, 12, 8]),
            (210, [42, 14, 11, 24, 26, 22, 20, 18, 15, 10]),
            (225, [50, 16, 12, 26, 30, 23, 22, 20, 16, 10]),
        ],
    ),
}

# Excel'de belirtilen ama doldurulmamis net m2 degerleri —
# modelin tahmin edecegi satirlar
BOS_SATIRLAR: dict[str, list[float]] = {
    "1+1": [65, 70],
    "2+1": [55, 87, 95],
    "3+1": [120, 125],
}

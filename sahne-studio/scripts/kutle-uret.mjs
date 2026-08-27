#!/usr/bin/env node
/**
 * Yapılaşma zarfından (cephe × derinlik × kat) basit bina KÜTLESİ üretir → .glb
 *
 * Amaç: SketchUp modeli hazır olmadan, onaylı imar zarfıyla gerçek çevrede
 * kütle denemesi yapabilmek. Çıktı gerçek tasarım değil, ZARFTIR.
 *
 * Kullanım:
 *   node scripts/kutle-uret.mjs --cephe 7.25 --derinlik 12 --kat 5 --katYuksekligi 3 \
 *   --catiCekme 1.5 --catiYuksekligi 2.2 --cikti ./kutle.glb
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { argumanlar } from "./yardimci.mjs";

const a = argumanlar(process.argv.slice(2), []);
const sayi = (ad, varsayilan) => (a[ad] === undefined ? varsayilan : Number(a[ad]));

const cephe = sayi("cephe", 7.25);
const derinlik = sayi("derinlik", 12);
const kat = sayi("kat", 5);
const katH = sayi("katYuksekligi", 3);
const catiCekme = sayi("catiCekme", 1.5);
const catiH = sayi("catiYuksekligi", 2.2);
const bantKalinlik = sayi("bantKalinlik", 0.18);
const bantCikinti = sayi("bantCikinti", 0.12);
const cikti = path.resolve(a.cikti ?? "kutle.glb");

const govdeH = kat * katH;

/** Kutuları üçgen ağa çevirir; taban Y=0'da, XZ merkezde. */
function kutu(gx, gy, gz, mx, my, mz) {
  const x0 = mx - gx / 2, x1 = mx + gx / 2;
  const y0 = my,          y1 = my + gy;
  const z0 = mz - gz / 2, z1 = mz + gz / 2;
  const yuzler = [
    { n: [0, 0, 1],  k: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]] },
    { n: [0, 0, -1], k: [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]] },
    { n: [1, 0, 0],  k: [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]] },
    { n: [-1, 0, 0], k: [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]] },
    { n: [0, 1, 0],  k: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]] },
    { n: [0, -1, 0], k: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]] },
  ];
  const konum = [], normal = [], indis = [];
  for (const y of yuzler) {
    const t = konum.length / 3;
    for (const nokta of y.k) { konum.push(...nokta); normal.push(...y.n); }
    indis.push(t, t + 1, t + 2, t, t + 2, t + 3);
  }
  return { konum, normal, indis };
}

function birlestir(parcalar) {
  const konum = [], normal = [], indis = [];
  for (const p of parcalar) {
    const kaydir = konum.length / 3;
    konum.push(...p.konum); normal.push(...p.normal);
    for (const i of p.indis) indis.push(i + kaydir);
  }
  return { konum, normal, indis };
}

// --- kütle: gövde + kat bantları + çekme yapılmış çatı katı ---
const govde = [kutu(cephe, govdeH, derinlik, 0, 0, 0)];
for (let k = 1; k < kat; k++) {
  govde.push(kutu(cephe + bantCikinti * 2, bantKalinlik, derinlik + bantCikinti * 2, 0, k * katH - bantKalinlik / 2, 0));
}
const catiCephe = Math.max(cephe - catiCekme * 2, 1);
const catiDerinlik = Math.max(derinlik - catiCekme * 2, 1);
const cati = [kutu(catiCephe, catiH, catiDerinlik, 0, govdeH, 0)];

const agParcalari = [birlestir(govde), birlestir(cati)];

// --- glTF 2.0 / GLB yazımı (bağımlılıksız) ---
const tamponlar = [];
let uzaklik = 0;
const gorunumler = [], erisimler = [];

function ekle(veri, tur, hedef) {
  const tampon = tur === "u16" ? new Uint16Array(veri) : new Float32Array(veri);
  const bayt = Buffer.from(tampon.buffer, tampon.byteOffset, tampon.byteLength);
  const hiza = (4 - (uzaklik % 4)) % 4;
  if (hiza) { tamponlar.push(Buffer.alloc(hiza)); uzaklik += hiza; }
  tamponlar.push(bayt);
  gorunumler.push({ buffer: 0, byteOffset: uzaklik, byteLength: bayt.length, target: hedef });
  uzaklik += bayt.length;
  return gorunumler.length - 1;
}

const ilkelIkiliListe = [];
for (const [sira, ag] of agParcalari.entries()) {
  const kGorunum = ekle(ag.konum, "f32", 34962);
  const nGorunum = ekle(ag.normal, "f32", 34962);
  const iGorunum = ekle(ag.indis, "u16", 34963);
  const enKucuk = [Infinity, Infinity, Infinity], enBuyuk = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < ag.konum.length; i += 3)
    for (let e = 0; e < 3; e++) {
      enKucuk[e] = Math.min(enKucuk[e], ag.konum[i + e]);
      enBuyuk[e] = Math.max(enBuyuk[e], ag.konum[i + e]);
    }
  erisimler.push({ bufferView: kGorunum, componentType: 5126, count: ag.konum.length / 3, type: "VEC3", min: enKucuk, max: enBuyuk });
  erisimler.push({ bufferView: nGorunum, componentType: 5126, count: ag.normal.length / 3, type: "VEC3" });
  erisimler.push({ bufferView: iGorunum, componentType: 5123, count: ag.indis.length, type: "SCALAR" });
  const t = erisimler.length - 3;
  ilkelIkiliListe.push({ attributes: { POSITION: t, NORMAL: t + 1 }, indices: t + 2, material: sira });
}

const ikili = Buffer.concat(tamponlar);
const gltf = {
  asset: { version: "2.0", generator: "Sahne Studio kutle-uret" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "BinaZarfi" }],
  meshes: [{ name: "kutle", primitives: ilkelIkiliListe }],
  materials: [
    { name: "duvar", pbrMetallicRoughness: { baseColorFactor: [0.86, 0.84, 0.79, 1], metallicFactor: 0, roughnessFactor: 0.85 } },
    { name: "cati", pbrMetallicRoughness: { baseColorFactor: [0.45, 0.42, 0.40, 1], metallicFactor: 0, roughnessFactor: 0.9 } },
  ],
  bufferViews: gorunumler,
  accessors: erisimler,
  buffers: [{ byteLength: ikili.length }],
};

const jsonBayt = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonDolgu = Buffer.alloc((4 - (jsonBayt.length % 4)) % 4, 0x20);
const ikiliDolgu = Buffer.alloc((4 - (ikili.length % 4)) % 4, 0);
const jsonParca = Buffer.concat([jsonBayt, jsonDolgu]);
const ikiliParca = Buffer.concat([ikili, ikiliDolgu]);

const baslik = Buffer.alloc(12);
baslik.write("glTF", 0); baslik.writeUInt32LE(2, 4);
baslik.writeUInt32LE(12 + 8 + jsonParca.length + 8 + ikiliParca.length, 8);
const jsonBaslik = Buffer.alloc(8);
jsonBaslik.writeUInt32LE(jsonParca.length, 0); jsonBaslik.write("JSON", 4);
const ikiliBaslik = Buffer.alloc(8);
ikiliBaslik.writeUInt32LE(ikiliParca.length, 0); ikiliBaslik.write("BIN\0", 4);

writeFileSync(cikti, Buffer.concat([baslik, jsonBaslik, jsonParca, ikiliBaslik, ikiliParca]));
console.log(`✓ Kütle üretildi: ${cikti}`);
console.log(`  zarf ${cephe} × ${derinlik} m · ${kat} kat × ${katH} m = ${govdeH} m`);
console.log(`  çatı katı ${catiCephe.toFixed(2)} × ${catiDerinlik.toFixed(2)} m · ${catiH} m (toplam ${(govdeH + catiH).toFixed(2)} m)`);
console.log(`  taban alanı ${(cephe * derinlik).toFixed(2)} m²`);

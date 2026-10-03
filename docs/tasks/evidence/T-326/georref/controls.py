"""Puntos de control: intersecciones de calles con nombre en el plano (rótulos) y en OpenStreetMap."""
import json
import math
import sys

import pymupdf
from PIL import Image, ImageDraw

BASE = sys.argv[1]
doc = pymupdf.open(f'{BASE}/plano/plano.pdf')
page = doc[0]

labels = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        t = ' '.join(''.join(s['text'] for s in l['spans']).split())
        if not t:
            continue
        x0, y0, x1, y1 = l['bbox']
        labels.append({'t': t, 'c': ((x0 + x1) / 2, (y0 + y1) / 2), 'd': l['dir']})

osm = json.load(open(f'{BASE}/geo/ways.json', encoding='utf-8'))['elements']

# Nombre en el plano -> nombres en OSM
PAIRS = [
    ('CONGRESO', ['Congreso de Tucumán'], 'SAN MARTIN', ['San Martín']),
    ('D. RETONDO', ['D. Retondo'], 'C. PELLEGRINI', ['Pellegrini']),
    ('ALSINA', ['Adolfo Alsina'], 'V. SARFIELD', ['Vélez Sarsfield']),
    ('AV. SARMIENTO', ['Avenida Sarmiento'], 'SAN MARTIN', ['San Martín']),
    ('J.B. ALBERDI', ['Juan Bautista Alberdi'], 'SAN MARTIN', ['San Martín']),
    ('B. RIVADAVIA', ['Bernardino Rivadavia', 'Rivadavia'], 'A. DEL VALLE', ['Aristobulo del Valle']),
    ('M. MORENO', ['Mariano Moreno'], 'AV. MITRE', ['Avenida Mitre']),
    ('J. MARMOL', ['José Mármol'], 'C. PELLEGRINI', ['Pellegrini']),
    ('AV. GRAL. SAVIO', ['Avenida General Savio', 'Avenida Savio'], 'A. AGUADO', ['Alejandro Aguado']),
    ('AV. GRAL. SAVIO', ['Avenida General Savio', 'Avenida Savio'], 'I. GORRITI', ['Ignacio Gorriti']),
    ('COSTA RICA', ['Costa Rica'], 'ECUADOR', ['Ecuador']),
    ('PARAGUAY', ['Paraguay'], 'COLOMBIA', ['Colombia']),
    ('COSTA RICA', ['Costa Rica'], 'MEXICO', ['México']),
    ('CATAMARCA', ['Catamarca'], 'TIERRA DEL FUEGO', ['Tierra del Fuego']),
    ('MISIONES', ['Misiones'], 'ANTARTIDA ARGENTINA', ['Antártida Argentina']),
    ('LA RIOJA', ['La Rioja'], 'ANTARTIDA ARGENTINA', ['Antártida Argentina']),
    ('AV. NEUQUEN', ['Avenida Neuquen'], 'TIERRA DEL FUEGO', ['Tierra del Fuego']),
    ('N. LAPRIDA', ['Narciso Laprida'], 'C. PELLEGRINI', ['Pellegrini']),
    ('D. RETONDO', ['D. Retondo'], 'V. SARFIELD', ['Vélez Sarsfield']),
    ('LAMADRID', ['Lamadrid'], 'J.A. ROCA', ['Julio Argentino Roca']),
    ('AV. SARMIENTO', ['Avenida Sarmiento'], 'AV. BELGRANO', ['Avenida Belgrano']),
    ('J.B. TERAN', ['Juan B. Teran'], 'BOLIVIA', ['Bolivia']),
    ('M. REYNAGA', ['Monseñor Reynaga'], 'SAN LORENZO', ['San Lorenzo']),
    ('PARIS', [], 'MADRID', ['Madrid']),
]


def line_intersection(p, d, q, e):
    # p + t d = q + s e
    det = d[0] * (-e[1]) - d[1] * (-e[0])
    if abs(det) < 1e-6:
        return None
    rx, ry = q[0] - p[0], q[1] - p[1]
    t = (rx * (-e[1]) - ry * (-e[0])) / det
    return (p[0] + t * d[0], p[1] + t * d[1])


def plan_point(a, b):
    la = [l for l in labels if l['t'] == a]
    lb = [l for l in labels if l['t'] == b]
    best = None
    for x in la:
        for y in lb:
            ip = line_intersection(x['c'], x['d'], y['c'], y['d'])
            if not ip:
                continue
            reach = max(math.dist(ip, x['c']), math.dist(ip, y['c']))
            if best is None or reach < best[0]:
                best = (reach, ip)
    return best


def seg_inter(p1, p2, p3, p4):
    d1 = (p2[0] - p1[0], p2[1] - p1[1])
    d2 = (p4[0] - p3[0], p4[1] - p3[1])
    det = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(det) < 1e-14:
        return None
    t = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / det
    u = ((p3[0] - p1[0]) * d1[1] - (p3[1] - p1[1]) * d1[0]) / det
    if -1e-9 <= t <= 1 + 1e-9 and -1e-9 <= u <= 1 + 1e-9:
        return (p1[0] + t * d1[0], p1[1] + t * d1[1])
    return None


def osm_points(names_a, names_b):
    wa = [w for w in osm if w['tags'].get('name') in names_a]
    wb = [w for w in osm if w['tags'].get('name') in names_b]
    pts = []
    for x in wa:
        ga = [(n['lon'], n['lat']) for n in x['geometry']]
        for y in wb:
            gb = [(n['lon'], n['lat']) for n in y['geometry']]
            for i in range(len(ga) - 1):
                for j in range(len(gb) - 1):
                    ip = seg_inter(ga[i], ga[i + 1], gb[j], gb[j + 1])
                    if ip:
                        pts.append(ip)
    uniq = []
    for p in pts:
        if all(math.dist(p, u) > 1e-5 for u in uniq):
            uniq.append(p)
    return uniq


out = []
for a, oa, b, ob in PAIRS:
    pp = plan_point(a, b)
    op = osm_points(oa, ob) if oa and ob else []
    print(f"{a} x {b}: plan={None if not pp else (round(pp[1][0], 1), round(pp[1][1], 1), 'reach', round(pp[0], 1))} osm={[(round(p[1], 6), round(p[0], 6)) for p in op]}")
    # Avenidas de doble mano: OSM trae una intersección por calzada; si están a < 30 m se promedian.
    if op and max(math.dist(op[0], q) for q in op) * 111000 < 30:
        op = [(sum(q[0] for q in op) / len(op), sum(q[1] for q in op) / len(op))]
    if pp and pp[0] < 75 and len(op) == 1:
        out.append({'id': f'{a} x {b}', 'x': pp[1][0], 'y': pp[1][1], 'lat': op[0][1], 'lng': op[0][0]})
json.dump(out, open(f'{BASE}/geo/controls.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('usable', len(out))

Image.MAX_IMAGE_PIXELS = None
im = Image.open(f'{BASE}/plano/plano-1.png').convert('RGB')
sc = im.size[0] / 612
tiles = []
R = int(14 * sc)
for c in out:
    cx, cy = int(c['x'] * sc), int(c['y'] * sc)
    t = im.crop((cx - R, cy - R, cx + R, cy + R)).resize((160, 160))
    dr = ImageDraw.Draw(t)
    dr.line((70, 80, 90, 80), fill='red', width=2)
    dr.line((80, 70, 80, 90), fill='red', width=2)
    cv = Image.new('RGB', (160, 176), 'white')
    cv.paste(t, (0, 16))
    ImageDraw.Draw(cv).text((2, 2), c['id'][:30], fill='black')
    tiles.append(cv)
cols = 6
sheet = Image.new('RGB', (cols * 162, ((len(tiles) + cols - 1) // cols) * 178), 'white')
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * 162, (i // cols) * 178))
sheet.save(f'{BASE}/geo/controls_sheet.png')

"""Punto representativo por barrio (centro del rótulo circular) -> WGS84, y superposición de OSM sobre el plano."""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw

BASE = sys.argv[1]
T = json.load(open(f'{BASE}/geo/transform.json', encoding='utf-8'))
coef = np.array(T['coef'])
M_LAT, M_LNG, LAT0 = T['m_lat'], T['m_lng'], T['lat0']
inv = np.linalg.inv(np.vstack([coef.T, [0, 0, 1]]))  # metros -> plano


def plan_to_wgs(x, y):
    mx, my = np.array([x, y, 1.0]) @ coef
    return LAT0 + my / M_LAT, -65.62 + mx / M_LNG


def wgs_to_plan(lat, lng):
    m = np.array([(lng + 65.62) * M_LNG, (lat - LAT0) * M_LAT, 1.0])
    p = inv @ m
    return p[0], p[1]


cands = json.load(open(f'{BASE}/plano/cands.json'))
# Rótulos circulares verificados visualmente (contact sheet). Se excluyen los rótulos de calle "20 DE JUNIO"/"24 DE SETIEMBRE".
EXCLUDE = {(20, 466), (20, 234), (24, 461), (24, 63), (24, 225)}
labels = {}
for c in cands:
    key = (c['n'], round(c['x']))
    if key in EXCLUDE:
        continue
    labels.setdefault(c['n'], []).append(c)

res = {}
for n, ls in sorted(labels.items()):
    for c in ls:
        lat, lng = plan_to_wgs(c['x'], c['y'])
        res.setdefault(n, []).append({'x': round(c['x'], 1), 'y': round(c['y'], 1), 'lat': round(float(lat), 6), 'lng': round(float(lng), 6),
                                      'in_bounds': bool(-27.4550 <= lat <= -27.4100 and -65.6400 <= lng <= -65.5950)})
json.dump(res, open(f'{BASE}/geo/points.json', 'w', encoding='utf-8'), indent=1)
for n, v in res.items():
    print(n, v)

# Superposición: calles de OSM transformadas al plano, sobre el render del plano.
Image.MAX_IMAGE_PIXELS = None
im = Image.open(f'{BASE}/plano/plano-1.png').convert('RGB')
sc = im.size[0] / 612
dr = ImageDraw.Draw(im)
osm = json.load(open(f'{BASE}/geo/ways.json', encoding='utf-8'))['elements']
for w in osm:
    pts = [wgs_to_plan(n['lat'], n['lon']) for n in w['geometry']]
    dr.line([(x * sc, y * sc) for x, y in pts], fill=(0, 0, 255), width=5)
for n, v in res.items():
    for p in v:
        x, y = p['x'] * sc, p['y'] * sc
        dr.ellipse((x - 14, y - 14, x + 14, y + 14), outline=(255, 0, 0), width=6)
im.save(f'{BASE}/geo/overlay_full.png')
small = im.resize((im.size[0] // 4, im.size[1] // 4))
small.save(f'{BASE}/geo/overlay_small.png')
for name, box in {'ov_centro': (180, 220, 470, 480), 'ov_norte': (300, 20, 480, 240), 'ov_sur': (180, 470, 560, 800)}.items():
    c = im.crop(tuple(int(v * sc) for v in box))
    c.resize((1100, int(1100 * (box[3] - box[1]) / (box[2] - box[0])))).save(f'{BASE}/geo/{name}.png')

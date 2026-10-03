"""Barrio 17 San Lorenzo: centro del área pintada de rosa del plano (decisión de Lautaro073, 2026-10-03).

El plano tiene dos rótulos (17A y 17). El área del barrio es el relleno rosa: la franja bajo 17A y las cuatro
manzanas alrededor de (17). Se toman los rellenos vectoriales de ese color en la zona, se rasteriza la región sobre el
render del plano y se calcula el centroide de los píxeles rosas; luego se lleva a WGS84 con transform.json.

Uso: python georref/area17.py BASE   (BASE con plano/plano.pdf, plano/plano-1.png y geo/transform.json)
Salida: BASE/geo/area-17.json y BASE/geo/area-17-mascara.png
"""
import json
import sys

import numpy as np
import pymupdf
from PIL import Image

BASE = sys.argv[1]
PINK = (0.937, 0.706, 0.812)
WINDOW = pymupdf.Rect(330, 690, 400, 800)  # zona de los rótulos 17A/17, en puntos del plano

pg = pymupdf.open(f'{BASE}/plano/plano.pdf')[0]
rects = [d['rect'] for d in pg.get_drawings()
         if d.get('fill') and tuple(round(c, 3) for c in d['fill']) == PINK and WINDOW.contains(d['rect'])]
x0, y0 = min(r.x0 for r in rects), min(r.y0 for r in rects)
x1, y1 = max(r.x1 for r in rects), max(r.y1 for r in rects)

Image.MAX_IMAGE_PIXELS = None
im = np.asarray(Image.open(f'{BASE}/plano/plano-1.png').convert('RGB')).astype(int)
sc = im.shape[1] / pg.rect.width
X0, Y0, X1, Y1 = int(x0 * sc) - 2, int(y0 * sc) - 2, int(x1 * sc) + 2, int(y1 * sc) + 2
sub = im[Y0:Y1, X0:X1]
mask = np.abs(sub - np.array([round(c * 255) for c in PINK])).max(axis=2) <= 12
ys, xs = np.nonzero(mask)
cx, cy = (xs.mean() + X0) / sc, (ys.mean() + Y0) / sc

T = json.load(open(f'{BASE}/geo/transform.json', encoding='utf-8'))
mx, my = np.array([cx, cy, 1.0]) @ np.array(T['coef'])
lat, lng = T['lat0'] + my / T['m_lat'], -65.62 + mx / T['m_lng']

Image.fromarray(np.where(mask[..., None], [255, 0, 0], sub).astype('uint8')).save(f'{BASE}/geo/area-17-mascara.png')
out = {'x': round(float(cx), 1), 'y': round(float(cy), 1), 'lat': round(float(lat), 6), 'lng': round(float(lng), 6),
       'rellenos_vectoriales': len(rects), 'pixeles_rosa': int(mask.sum()),
       'bbox_pt': [round(float(v), 1) for v in (x0, y0, x1, y1)]}
json.dump(out, open(f'{BASE}/geo/area-17.json', 'w', encoding='utf-8'), indent=1)
print(out)

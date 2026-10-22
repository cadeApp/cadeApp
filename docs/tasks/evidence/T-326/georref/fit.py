"""Ajuste afín plano(x, y) -> WGS84 por mínimos cuadrados, con descarte iterativo y validación leave-one-out."""
import json
import math
import sys

import numpy as np

BASE = sys.argv[1]
MAX_RESIDUAL_M = float(sys.argv[2]) if len(sys.argv) > 2 else 40.0
pts = json.load(open(f'{BASE}/geo/controls.json', encoding='utf-8'))

LAT0 = -27.43
M_LAT = 111_132.0
M_LNG = 111_320.0 * math.cos(math.radians(LAT0))


def to_m(lat, lng):
    return np.array([(lng + 65.62) * M_LNG, (lat - LAT0) * M_LAT])


def fit(sel):
    A = np.array([[p['x'], p['y'], 1.0] for p in sel])
    B = np.array([to_m(p['lat'], p['lng']) for p in sel])
    coef, *_ = np.linalg.lstsq(A, B, rcond=None)
    return coef


def resid(coef, p):
    return float(np.linalg.norm(np.array([p['x'], p['y'], 1.0]) @ coef - to_m(p['lat'], p['lng'])))


use = list(pts)
dropped = []
while True:
    coef = fit(use)
    r = [(resid(coef, p), p) for p in use]
    worst = max(r, key=lambda t: t[0])
    if worst[0] <= MAX_RESIDUAL_M or len(use) <= 6:
        break
    use.remove(worst[1])
    dropped.append((worst[1]['id'], round(worst[0], 1)))

print('descartados (residual > %.0f m):' % MAX_RESIDUAL_M)
for d in dropped:
    print('  ', d)
print('usados', len(use))
coef = fit(use)
rs = []
for p in use:
    others = [q for q in use if q is not p]
    loo = resid(fit(others), p)
    rs.append(loo)
    print(f"  {p['id']:<40} ajuste={resid(coef, p):6.1f} m  leave-one-out={loo:6.1f} m")
print(f'RMS ajuste={math.sqrt(np.mean([resid(coef, p) ** 2 for p in use])):.1f} m  '
      f'RMS LOO={math.sqrt(np.mean(np.square(rs))):.1f} m  max LOO={max(rs):.1f} m')
# escala: metros por punto del plano
sx = np.linalg.norm(coef[0]); sy = np.linalg.norm(coef[1])
print(f'escala x={sx:.2f} m/pt  y={sy:.2f} m/pt  ángulo entre ejes={math.degrees(math.acos(np.dot(coef[0], coef[1]) / sx / sy)):.1f}°')
json.dump({'coef': coef.tolist(), 'lat0': LAT0, 'm_lat': M_LAT, 'm_lng': M_LNG, 'used': [p['id'] for p in use],
           'dropped': dropped}, open(f'{BASE}/geo/transform.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

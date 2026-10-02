"""Resultado por barrio aprobado: derivado (lat/lng) o null con motivo. Fuente de nombres: barrios-fuente.md."""
import io
import json
import re
import sys

BASE, REPO = sys.argv[1], sys.argv[2]
pts = json.load(open(f'{BASE}/geo/points.json', encoding='utf-8'))
src = io.open(f'{REPO}/docs/tasks/evidence/T-326/barrios-fuente.md', encoding='utf-8').read()
rows = [(m.group(1), m.group(3).strip()) for m in
        re.finditer(r'^\| (\d{2}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$', src, re.M)]
assert len(rows) == 62

NULL_REASON = {
    24: 'rótulos 24-25-26 agrupados en el borde norte, sin área propia distinguible',
    25: 'rótulos 24-25-26 agrupados en el borde norte, sin área propia distinguible',
    26: 'rótulos 24-25-26 agrupados en el borde norte, sin área propia distinguible',
    55: 'sin rótulo circular en el plano (el 55 violeta es un equipamiento)',
    56: 'sin rótulo circular en el plano (el 56 violeta es un equipamiento)',
    57: 'sin rótulo circular en el plano (el 57 violeta es un equipamiento)',
    65: 'sin rótulo circular en el plano (el 65 violeta es un equipamiento)',
    17: 'dos rótulos (17A y 17) en sectores distintos; el 17 cae fuera del recuadro de Aguilares',
}
out = []
for num, name in rows:
    n = int(num)
    ls = pts.get(str(n), [])
    if n in NULL_REASON:
        out.append({'num': num, 'name': name, 'estado': 'null', 'motivo': NULL_REASON[n], 'x': None, 'y': None})
        continue
    if len(ls) != 1:
        out.append({'num': num, 'name': name, 'estado': 'null', 'motivo': f'{len(ls)} rótulos', 'x': None, 'y': None})
        continue
    p = ls[0]
    if not p['in_bounds']:
        out.append({'num': num, 'name': name, 'estado': 'null', 'x': p['x'], 'y': p['y'],
                    'motivo': f"punto derivado ({p['lat']}, {p['lng']}) fuera del recuadro de Aguilares del producto"})
        continue
    out.append({'num': num, 'name': name, 'estado': 'derivado', 'x': p['x'], 'y': p['y'], 'lat': p['lat'], 'lng': p['lng']})

json.dump(out, open(f'{BASE}/geo/final.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
d = [o for o in out if o['estado'] == 'derivado']
print('derivados', len(d), '· null', len(out) - len(d))
for o in out:
    print(o['num'], o['name'], o['estado'], o.get('lat'), o.get('lng'), o.get('motivo', ''))

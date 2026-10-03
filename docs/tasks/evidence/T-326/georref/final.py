"""Resultado por barrio aprobado. Fuente de nombres: barrios-fuente.md.

Estados:
  - derivado: punto del plano municipal llevado a WGS84 (centro del rótulo circular o, para 17, centro del área rosa).
  - referencia_local: punto que Lautaro073 señaló para el barrio (georref/referencias-locales.json).
  - null: sin punto confiable (hoy ninguno).

Uso: python georref/final.py BASE <repo>   (BASE con geo/points.json y geo/area-17.json)
"""
import io
import json
import re
import sys

BASE, REPO = sys.argv[1], sys.argv[2]
EVID = f'{REPO}/docs/tasks/evidence/T-326'
pts = json.load(open(f'{BASE}/geo/points.json', encoding='utf-8'))
area17 = json.load(open(f'{BASE}/geo/area-17.json', encoding='utf-8'))
local = {b['num']: b for b in json.load(open(f'{EVID}/georref/referencias-locales.json', encoding='utf-8'))['barrios']}
src = io.open(f'{EVID}/barrios-fuente.md', encoding='utf-8').read()
rows = [(m.group(1), m.group(3).strip()) for m in
        re.finditer(r'^\| (\d{2}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$', src, re.M)]
assert len(rows) == 63
names = dict(rows)
for num, b in local.items():
    assert names[num] == b['name'], (num, b['name'])

out = []
for num, name in rows:
    n = int(num)
    if num in local:
        continue  # se resuelven después: 24 depende del punto final de 23
    if n == 17:
        # Dos rótulos (17A y 17): el barrio es el área rosa completa (decisión de Lautaro073).
        out.append({'num': num, 'name': name, 'estado': 'derivado', 'metodo': 'centro del área rosa del plano',
                    'x': area17['x'], 'y': area17['y'], 'lat': area17['lat'], 'lng': area17['lng']})
        continue
    ls = pts.get(str(n), [])
    if len(ls) != 1:
        out.append({'num': num, 'name': name, 'estado': 'null', 'motivo': f'{len(ls)} rótulos', 'x': None, 'y': None})
        continue
    p = ls[0]
    if not p['in_bounds']:
        out.append({'num': num, 'name': name, 'estado': 'null', 'x': p['x'], 'y': p['y'],
                    'motivo': f"punto derivado ({p['lat']}, {p['lng']}) fuera del recuadro de Aguilares (CC-019)"})
        continue
    out.append({'num': num, 'name': name, 'estado': 'derivado', 'metodo': 'centro del rótulo circular',
                'x': p['x'], 'y': p['y'], 'lat': p['lat'], 'lng': p['lng']})

by_num = {o['num']: o for o in out}
for num, b in local.items():
    if 'mismo_punto_que' in b:
        ref = by_num[b['mismo_punto_que']]
        assert ref['estado'] != 'null', b
        entry = {'num': num, 'name': b['name'], 'estado': 'referencia_local', 'mismo_punto_que': b['mismo_punto_que'],
                 'fuente': b['fuente'], 'lat': ref['lat'], 'lng': ref['lng']}
    else:
        entry = {'num': num, 'name': b['name'], 'estado': 'referencia_local', 'fuente': b['fuente'],
                 'url': b['url'], 'lat': b['lat'], 'lng': b['lng']}
    by_num[num] = entry

final = [by_num[num] for num, _ in rows]
json.dump(final, open(f'{BASE}/geo/final.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
count = {e: sum(o['estado'] == e for o in final) for e in ('derivado', 'referencia_local', 'null')}
print(' · '.join(f'{k} {v}' for k, v in count.items()))
for o in final:
    print(o['num'], o['name'], o['estado'], o.get('lat'), o.get('lng'), o.get('motivo', ''))

#!/usr/bin/env python3
"""Gera global.json para a página Monitor Global (voos + conflitos).

Roda no GitHub Actions a cada 30 min: as APIs de voos (OpenSky, adsb.lol) não
liberam CORS para o navegador e a API geo do GDELT foi desativada, então os dados
são buscados aqui e publicados no branch `data`, lido pela página via
raw.githubusercontent.com.
"""
import csv, io, json, sys, time, urllib.request, zipfile
from datetime import datetime, timedelta, timezone

UA = {'User-Agent': 'monitor-preppers-br (github.com/preppersbr1-glitch/monitor-preppers-br)'}
MAX_CIVIL = 2500        # voos civis enviados ao mapa (amostra)
GDELT_FILES = 24        # 24 x 15 min = últimas 6 horas
MAX_CONFLICTS = 500


def get(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def log(*a):
    print(*a, file=sys.stderr)


# ── VOOS ──
def fetch_flights():
    mil = {}
    try:
        for a in json.loads(get('https://api.adsb.lol/v2/mil')).get('ac', []):
            if a.get('lat') is not None and a.get('lon') is not None:
                mil[a['hex'].lower()] = a
    except Exception as e:
        log('adsb.lol mil falhou:', e)

    items, seen = [], set()
    states = []
    try:
        states = json.loads(get('https://opensky-network.org/api/states/all', 90)).get('states') or []
    except Exception as e:
        log('OpenSky falhou:', e)

    civil = [s for s in states if s[6] is not None and s[5] is not None and not s[8] and s[0] not in mil]
    step = max(1, len(civil) // MAX_CIVIL)
    for s in civil[::step]:
        # [lat, lon, callsign, país/tipo, altitude m, velocidade km/h, rumo, militar]
        items.append([round(s[6], 3), round(s[5], 3), (s[1] or '').strip(), s[2] or '',
                      round(s[7]) if s[7] else None, round(s[9] * 3.6) if s[9] else None, round(s[10] or 0), 0])
    for hx, a in mil.items():
        alt = a.get('alt_baro')
        items.append([round(a['lat'], 3), round(a['lon'], 3), (a.get('flight') or a.get('r') or '').strip(),
                      a.get('t') or '', round(alt * 0.3048) if isinstance(alt, (int, float)) else None,
                      round(a['gs'] * 1.852) if a.get('gs') else None, round(a.get('track') or 0), 1])
    src = [n for n, ok in (('OpenSky', states), ('adsb.lol', mil)) if ok]
    return {'source': ' + '.join(src), 'total': len(states) + len(mil), 'military': len(mil), 'items': items}


# ── CONFLITOS (GDELT 2.0 events) ──
# EventRootCode: 14 protesto, 15 postura militar, 18 agressão, 19 combate, 20 violência em massa; 183x = atentados/explosões
SEVERITY = {'terrorism': 6, 'war': 5, 'explosion': 4, 'attack': 3, 'military': 2, 'protest': 1}


def category(root, code):
    if code.startswith('183'):
        return 'explosion'
    return {'20': 'terrorism', '19': 'war', '18': 'attack', '15': 'military', '14': 'protest'}.get(root)


def fetch_conflicts():
    last = get('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', 30).decode().split()[2]
    ts = datetime.strptime(last.rsplit('/', 1)[1][:14], '%Y%m%d%H%M%S').replace(tzinfo=timezone.utc)
    spots = {}
    ok = 0
    for i in range(GDELT_FILES):
        stamp = (ts - timedelta(minutes=15 * i)).strftime('%Y%m%d%H%M%S')
        try:
            z = zipfile.ZipFile(io.BytesIO(get(f'http://data.gdeltproject.org/gdeltv2/{stamp}.export.CSV.zip', 60)))
            raw = z.read(z.namelist()[0]).decode('utf-8', 'ignore')
            ok += 1
        except Exception as e:
            log('GDELT', stamp, 'falhou:', e)
            continue
        for r in csv.reader(io.StringIO(raw), delimiter='\t'):
            if len(r) < 61:
                continue
            cat = category(r[28], r[26])
            if not cat or not r[56] or not r[57]:
                continue
            try:
                lat, lon, mentions = float(r[56]), float(r[57]), int(r[31] or 1)
            except ValueError:
                continue
            key = (round(lat, 1), round(lon, 1))
            s = spots.setdefault(key, {'lat': key[0], 'lon': key[1], 'name': r[52], 'cat': cat,
                                       'events': 0, 'mentions': 0, 'url': r[60], 'top': 0})
            s['events'] += 1
            s['mentions'] += mentions
            if SEVERITY[cat] > SEVERITY[s['cat']]:
                s['cat'] = cat
            if mentions > s['top']:
                s['top'], s['url'], s['name'] = mentions, r[60], r[52] or s['name']
    top = sorted(spots.values(), key=lambda s: s['mentions'], reverse=True)[:MAX_CONFLICTS]
    for s in top:
        del s['top']
    return {'hours': ok * 15 / 60, 'items': top}


def main(out):
    data = {'updated': int(time.time() * 1000)}
    try:
        data['flights'] = fetch_flights()
    except Exception as e:
        log('voos falharam:', e)
    try:
        data['conflicts'] = fetch_conflicts()
    except Exception as e:
        log('conflitos falharam:', e)
    with open(out, 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    fl, cf = data.get('flights', {}), data.get('conflicts', {})
    log(f"voos: {len(fl.get('items', []))} ({fl.get('military', 0)} militares) | conflitos: {len(cf.get('items', []))} locais em {cf.get('hours', 0)}h")
    if not fl.get('items') and not cf.get('items'):
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'global.json')

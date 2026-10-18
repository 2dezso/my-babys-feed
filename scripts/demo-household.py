#!/usr/bin/env python3
"""Example diary for App Review and for screenshots.

  python scripts/demo-household.py --dump demo.json            write the example data to a file (nothing is sent)
  python scripts/demo-household.py --push CODE                 (re)write it into the real database under CODE
  python scripts/demo-household.py --push CODE --revive        the same, if a reviewer deleted the demo from the app
  python scripts/demo-household.py --new-code                  print a fresh random household code

The times are worked out from the moment the script runs, so run --push again just before submitting for review, or
the "last feed" will look days old. It refuses to touch a household that is not one of its own demo households
(they carry demo: true in the profile), so a wrong code can never overwrite a real diary. The illustrated "photos"
are drawn here, so no real baby photos are involved. Needs Pillow for the pictures: pip install pillow
"""
import argparse, base64, datetime as dt, io, json, random, re, secrets, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = 'my-baby-feed'
FS = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def draw_photo(kind):
    """A soft illustrated picture, as a small JPEG data URL."""
    from PIL import Image, ImageDraw
    w = h = 700
    img = Image.new('RGB', (w, h), (253, 243, 238))
    d = ImageDraw.Draw(img)
    for y in range(h):  # sky
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(255 - 40 * t), int(236 - 20 * t), int(222 - 10 * t)))
    if kind == 'hills':
        d.ellipse((470, 90, 610, 230), fill=(255, 214, 140))
        d.ellipse((-150, 430, 520, 1000), fill=(150, 205, 160))
        d.ellipse((250, 500, 950, 1100), fill=(104, 178, 128))
    elif kind == 'trees':
        d.rectangle((0, 520, w, h), fill=(150, 205, 160))
        d.polygon([(250, h), (450, h), (360, 520)], fill=(240, 220, 190))
        for x, s in ((110, 1.0), (560, 1.2), (400, 0.7)):
            d.rectangle((x - 12 * s, 420, x + 12 * s, 540), fill=(150, 110, 90))
            d.ellipse((x - 85 * s, 420 - 190 * s, x + 85 * s, 440), fill=(86, 160, 112))
    else:  # balloons
        for x, y, col in ((230, 260, (240, 140, 150)), (380, 200, (255, 205, 120)), (520, 290, (140, 190, 235))):
            d.ellipse((x - 70, y - 90, x + 70, y + 90), fill=col)
            d.line([(x, y + 90), (360, 640)], fill=(150, 130, 120), width=3)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=72)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def build(now):
    """The example diary, as plain dicts. `now` is a datetime; everything is placed relative to it."""
    rnd = random.Random(20261018)  # the same shape of week every time
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    ms = lambda t: int(t.timestamp() * 1000)

    feeds = []
    slots = [(2, 50, 110), (6, 20, 130), (9, 40, 135), (13, 0, 140), (16, 20, 130), (19, 40, 140), (22, 50, 120)]
    for back in range(13, -1, -1):
        day = today - dt.timedelta(days=back)
        for hour, minute, base in slots:
            t = day + dt.timedelta(hours=hour, minutes=minute + rnd.randint(-15, 15))
            if t > now - dt.timedelta(minutes=25):
                continue
            amount = int(round((base + rnd.randint(-10, 15)) / 5) * 5)
            feeds.append({'type': 'bottle', 'timestamp': ms(t), 'amountMl': amount, 'intervalHours': 3})

    poos = []
    sizes = ['Small', 'Medium', 'Medium', 'Big']
    notes = {5: 'After the bath', 11: 'At Grandad’s'}
    for back in range(13, -1, -1):
        day = today - dt.timedelta(days=back)
        for hour in (7, 12, 17, 21):
            if rnd.random() < 0.2:
                continue
            t = day + dt.timedelta(hours=hour, minutes=rnd.randint(0, 50))
            if t > now - dt.timedelta(minutes=25):
                continue
            p = {'timestamp': ms(t), 'size': rnd.choice(sizes)}
            if back in notes and hour == 12:
                p['note'] = notes[back]
            poos.append(p)

    moments = {}
    for back, caption, kind in ((16, 'First proper smile', 'hills'), (9, 'Our first walk in the park', 'trees'), (3, 'Meeting Grandad', 'balloons')):
        key = (today - dt.timedelta(days=back)).strftime('%Y-%m-%d')
        moments[key] = {'caption': caption, 'updatedAt': ms(now), 'photoDataUrl': draw_photo(kind)}

    return {
        'profile': {'firstName': 'Sam', 'lastName': '', 'dob': (today - dt.timedelta(days=74)).strftime('%Y-%m-%d'),
                    'gender': 'male', 'bottleBrand': 'mam', 'demo': True},
        'bottle': {'madeAt': None, 'feedStartedAt': None},
        'feeds': feeds, 'poos': poos, 'milestones': moments,
    }


# ---------------------------------------------------------------- sending it
def api_key():
    m = re.search(r'apiKey:\s*"([^"]+)"', (ROOT / 'firebase-config.js').read_text(encoding='utf-8'))
    if not m:
        sys.exit('could not read the API key from firebase-config.js')
    return m.group(1)


def call(url, body=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        sys.exit(f'{method or "POST"} {url.split("?")[0]} failed: {e.code} {e.read().decode()[:300]}')


def typed(v):
    if v is None: return {'nullValue': None}
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, float): return {'doubleValue': v}
    return {'stringValue': v}


def fields(d):
    return {k: typed(v) for k, v in d.items()}


def list_docs(token, path):
    names, page = [], ''
    while True:
        r = call(f'{FS}/{path}?pageSize=300{page}', token=token, method='GET')
        names += [d['name'] for d in r.get('documents', [])]
        if 'nextPageToken' not in r:
            return names
        page = '&pageToken=' + r['nextPageToken']


def push(code, data, revive=False):
    if not (6 <= len(code) <= 12) or any(c not in CODE_ALPHABET for c in code):
        sys.exit('that does not look like a household code')
    key = api_key()
    auth = call(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={key}', {'returnSecureToken': True})
    token, uid = auth['idToken'], auth['localId']
    base = f'households/{code}'
    # Register this script's own sign-in as a member first, so it also works once the security rules are on.
    call(f'{FS}/{base}/members/{uid}', {'fields': fields({'lastSeen': int(dt.datetime.now().timestamp() * 1000)})}, token, 'PATCH')

    old = {c: list_docs(token, f'{base}/{c}') for c in ('feeds', 'poos', 'milestones', 'profile', 'bottle', 'tombstone')}
    if any(old.values()):
        prof = call(f'{FS}/{base}/profile/info', token=token, method='GET') if old['profile'] else {}
        is_demo = prof.get('fields', {}).get('demo', {}).get('booleanValue')
        # A household someone deleted from the app leaves only its marker. Bringing it back needs --revive.
        deleted_only = not old['profile'] and bool(old['tombstone']) and not any(old[c] for c in ('feeds', 'poos', 'milestones', 'bottle'))
        if not is_demo and not (deleted_only and revive):
            hint = ' It was deleted from the app; add --revive to bring this demo back.' if deleted_only else ''
            sys.exit(f'{code} is not a demo household that can be rewritten. Nothing was changed.{hint}')
    writes = [{'delete': n} for names in old.values() for n in names]
    full = lambda p: f'projects/{PROJECT}/databases/(default)/documents/{base}/{p}'
    writes.append({'update': {'name': full('profile/info'), 'fields': fields(data['profile'])}})
    writes.append({'update': {'name': full('bottle/info'), 'fields': fields(data['bottle'])}})
    for i, f in enumerate(data['feeds']):
        writes.append({'update': {'name': full(f'feeds/demo-feed-{i:03d}'), 'fields': fields(f)}})
    for i, p in enumerate(data['poos']):
        writes.append({'update': {'name': full(f'poos/demo-poo-{i:03d}'), 'fields': fields(p)}})
    for day, m in data['milestones'].items():
        writes.append({'update': {'name': full(f'milestones/{day}'), 'fields': fields(m)}})
    # one batch of at most 500 writes
    for start in range(0, len(writes), 400):
        call(f'{FS}:commit', {'writes': writes[start:start + 400]}, token)
    print(f'wrote {len(data["feeds"])} feeds, {len(data["poos"])} poos, {len(data["milestones"])} moments to {code}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--dump', help='write the example data to this file')
    ap.add_argument('--push', metavar='CODE', help='write it to the real database under this household code')
    ap.add_argument('--new-code', action='store_true', help='print a fresh random code and stop')
    ap.add_argument('--revive', action='store_true', help='with --push: bring back a demo household that was deleted from the app')
    ap.add_argument('--now', help='pretend it is this time, e.g. 2026-10-18T11:40 (for screenshots)')
    ap.add_argument('--last-feed-ago', type=int, metavar='MINUTES', help='slide the whole diary so the latest feed was this many minutes ago (for screenshots)')
    a = ap.parse_args()
    if a.new_code:
        print(''.join(secrets.choice(CODE_ALPHABET) for _ in range(8)))
        sys.exit()
    now = dt.datetime.fromisoformat(a.now) if a.now else dt.datetime.now()
    data = build(now)
    if a.last_feed_ago is not None:
        latest = max(f['timestamp'] for f in data['feeds'])
        shift = int(now.timestamp() * 1000) - a.last_feed_ago * 60000 - latest
        for item in data['feeds'] + data['poos']:
            item['timestamp'] += shift
    if a.dump:
        Path(a.dump).write_text(json.dumps(data), encoding='utf-8')
        print('wrote', a.dump)
    if a.push:
        push(a.push.strip().upper(), data, a.revive)
    if not a.dump and not a.push:
        ap.print_help()

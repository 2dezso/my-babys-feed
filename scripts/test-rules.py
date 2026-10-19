#!/usr/bin/env python3
"""Checks that firestore.rules do what they should, against a THROWAWAY Firebase project (never the live one).

Set it up once:
  1. Firebase console: make a new project, add a Firestore database, turn on Authentication > Anonymous.
  2. Firestore > Rules: paste in firestore.rules and Publish.
  3. Project settings > Your apps > add a Web app, and note its apiKey and projectId.
Then run:
  python scripts/test-rules.py --project YOUR-TEST-PROJECT-ID --key YOUR-TEST-API-KEY

Each check says whether the request was allowed or refused and whether that is what the rules should do. It refuses
to run against the project named in firebase-config.js (the live one). It writes only under made-up household codes.
"""
import argparse, json, random, re, string, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def http(method, url, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'{}')
        except Exception:
            return e.code, {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', required=True)
    ap.add_argument('--key', required=True)
    a = ap.parse_args()

    live = re.search(r'projectId:\s*"([^"]+)"', (ROOT / 'firebase-config.js').read_text(encoding='utf-8'))
    if live and live.group(1) == a.project:
        sys.exit('That is the live project. This script only runs against a throwaway project.')

    FS = f'https://firestore.googleapis.com/v1/projects/{a.project}/databases/(default)/documents'

    def signup():
        status, body = http('POST', f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={a.key}', body={'returnSecureToken': True})
        if status != 200:
            sys.exit(f'Could not sign in anonymously ({status}). Is Anonymous switched on in the test project? {body}')
        return body['idToken'], body['localId']

    def code():
        return ''.join(random.choice(LETTERS) for _ in range(8))

    def fields(d):
        return {k: ({'integerValue': str(v)} if isinstance(v, int) else {'stringValue': str(v)}) for k, v in d.items()}

    results = []

    def expect(label, allowed, status):
        got_allowed = status in (200, 404)  # a missing document is still an allowed read
        ok = got_allowed == allowed
        results.append(ok)
        print(f"  {'PASS' if ok else 'FAIL'}  {label}  (wanted {'allowed' if allowed else 'refused'}, got HTTP {status})")

    def put(path, token, data):
        return http('PATCH', f'{FS}/{path}', token, {'fields': fields(data)})[0]

    def get(path, token=None):
        return http('GET', f'{FS}/{path}', token)[0]

    tokA, uidA = signup()   # a member of household one
    tokB, uidB = signup()   # a stranger
    tokC, uidC = signup()   # a member of household two
    h1, h2 = code(), code()
    print(f'Testing project {a.project} with made-up households {h1} and {h2}\n')

    print('Joining')
    expect('a signed-in phone can register itself in a household', True, put(f'households/{h1}/members/{uidA}', tokA, {'lastSeen': 1}))
    expect('another phone registers in a second household', True, put(f'households/{h2}/members/{uidC}', tokC, {'lastSeen': 1}))
    expect('a phone cannot register someone else', False, put(f'households/{h1}/members/{uidC}', tokB, {'lastSeen': 1}))
    expect('a code that is too short (5) is refused', False, put(f'households/{code()[:5]}/members/{uidB}', tokB, {'lastSeen': 1}))
    expect('a code that is too long (13) is refused', False, put(f'households/{code()}ABCDE/members/{uidB}', tokB, {'lastSeen': 1}))
    expect('a code of 6 is allowed (older households)', True, put(f'households/{code()[:6]}/members/{uidB}', tokB, {'lastSeen': 1}))

    print('\nMembers can use the household')
    expect('a member can add a feed', True, put(f'households/{h1}/feeds/f1', tokA, {'type': 'bottle', 'amountMl': 120}))
    expect('a member can read the feed', True, get(f'households/{h1}/feeds/f1', tokA))
    expect('a member can list feeds', True, get(f'households/{h1}/feeds', tokA))
    expect('a member can write the profile', True, put(f'households/{h1}/profile/info', tokA, {'firstName': 'Sam'}))
    expect('a member can add a Moment', True, put(f'households/{h1}/milestones/2026-10-02', tokA, {'caption': 'First smile'}))
    expect('a member can list who has joined', True, get(f'households/{h1}/members', tokA))

    print('\nStrangers are kept out')
    expect('an unregistered phone cannot read feeds', False, get(f'households/{h1}/feeds/f1', tokB))
    expect('an unregistered phone cannot list feeds', False, get(f'households/{h1}/feeds', tokB))
    expect('an unregistered phone cannot write feeds', False, put(f'households/{h1}/feeds/f2', tokB, {'amountMl': 1}))
    expect('an unregistered phone cannot read the profile', False, get(f'households/{h1}/profile/info', tokB))
    expect('an unregistered phone cannot list who has joined', False, get(f'households/{h1}/members', tokB))
    expect('a member of another household cannot read these feeds', False, get(f'households/{h1}/feeds/f1', tokC))
    expect('a member of another household cannot write here', False, put(f'households/{h1}/feeds/f3', tokC, {'amountMl': 1}))
    expect('a phone with no sign-in cannot read', False, get(f'households/{h1}/feeds/f1'))
    expect('a phone with no sign-in cannot register', False, http('PATCH', f'{FS}/households/{h1}/members/x', None, {'fields': fields({'lastSeen': 1})})[0])
    expect('the list of all households cannot be read', False, get('households', tokA))
    expect('a collection outside households cannot be read', False, get('somewhere/else', tokA))
    expect('a collection outside households cannot be written', False, put('somewhere/else', tokA, {'a': 1}))

    print('\nWhat sharing a code means (these are meant to work)')
    expect('a stranger who has the code can register, as designed', True, put(f'households/{h1}/members/{uidB}', tokB, {'lastSeen': 1}))
    expect('and then can read the diary', True, get(f'households/{h1}/feeds/f1', tokB))

    print('\nDeleted households')
    expect('a member can leave a deletion marker', True, put(f'households/{h1}/tombstone/info', tokA, {'deletedAt': 1}))
    expect('any signed-in phone can read the marker', True, get(f'households/{h1}/tombstone/info', tokC))
    expect('a phone with no sign-in cannot read the marker', False, get(f'households/{h1}/tombstone/info'))
    expect('a stranger cannot write a marker in a household they are not in', False, put(f'households/{h2}/tombstone/info', tokB, {'deletedAt': 1}))

    print('\nDeleting, in the order the app does it')
    expect('a member can delete the diary data', True, http('DELETE', f'{FS}/households/{h1}/feeds/f1', tokA)[0])
    expect('a member can delete the other phones\' registrations', True, http('DELETE', f'{FS}/households/{h1}/members/{uidB}', tokA)[0])
    expect('the phone can delete its own registration last', True, http('DELETE', f'{FS}/households/{h1}/members/{uidA}', tokA)[0])
    expect('and then it can no longer read the household', False, get(f'households/{h1}/feeds/f1', tokA))
    expect('the marker is still readable afterwards', True, get(f'households/{h1}/tombstone/info', tokA))

    failed = results.count(False)
    print(f"\n{len(results) - failed} of {len(results)} checks as expected." + ('' if not failed else f' {failed} did not match: read the FAIL lines above.'))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()

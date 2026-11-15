#!/usr/bin/env python3
"""Release only committed, pushed EECS570 sources; audit or roll back this site."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CORE = {'index.html', 'style.css', 'app.js', 'map-data.js', 'map-footprints.js', 'positioning.mjs', 'registration.mjs', 'gestures.mjs'}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=str(ROOT), text=True).strip()


def manifest(revision):
    files = git('ls-tree', '-r', '--name-only', revision).splitlines()
    return {p: hashlib.sha256(subprocess.check_output(['git', 'show', revision + ':' + p], cwd=str(ROOT))).hexdigest() for p in files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'deploy', 'rollback'])
    parser.add_argument('--host', default='solvaneon', help='SSH host for this map server')
    parser.add_argument('--release', help='Required for rollback: exact release-<SHA> directory name')
    args = parser.parse_args()
    if args.action == 'rollback':
        if not args.release or not re.fullmatch(r'release-([0-9a-f]{7,40})(?:-r[0-9]+)?', args.release):
            parser.error('rollback requires --release release-<SHA> (optional -rN suffix)')
        prefix = re.fullmatch(r'release-([0-9a-f]{7,40})(?:-r[0-9]+)?', args.release).group(1)
        revision = git('rev-parse', '--verify', prefix + '^{commit}')
    else:
        if git('status', '--porcelain'):
            raise RuntimeError('Working tree is not clean. Commit or resolve all changes first.')
        if git('branch', '--show-current') != 'main':
            raise RuntimeError('Use main for deployment and synchronization checks.')
        revision = git('rev-parse', 'HEAD')
        remote = git('ls-remote', '--heads', 'origin', 'refs/heads/main').split()
        if not remote or remote[0] != revision:
            raise RuntimeError('Local HEAD differs from GitHub main. Push/synchronize first; never force-push to release.')
    files = manifest(revision)
    assets = {p: h for p, h in files.items() if p in CORE or p.startswith(('public/', 'Mapsv1.0/'))}
    if args.action == 'deploy':
        subprocess.run(['node', '--check', 'app.js'], cwd=str(ROOT), check=True)
        subprocess.run(['node', '--test', 'tests/positioning.test.mjs', 'tests/gestures.test.mjs'], cwd=str(ROOT), check=True)
    payload = {'action': args.action, 'revision': revision, 'files': files, 'assets': assets, 'release': args.release}
    worker = (ROOT / 'deploy/release_remote.py').read_text()
    result = subprocess.run(['ssh', args.host, 'python3 -c ' + shlex.quote(worker)], input=json.dumps(payload), text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.stderr:
        print(result.stderr, file=sys.stderr, end='')
    if result.stdout:
        print(result.stdout, end='')
    if result.returncode:
        raise RuntimeError('Release operation failed. Inspect the result above; deploy/rollback restore the previous active release on probe failure.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print('ERROR: ' + str(error), file=sys.stderr)
        sys.exit(1)

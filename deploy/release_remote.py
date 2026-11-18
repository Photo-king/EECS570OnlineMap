"""Server worker for scripts/release.py. Only manages /var/www/school-map."""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

BASE = Path('/var/www/school-map')
CURRENT = BASE / 'current'
RELEASES = BASE / 'releases'
payload = json.load(sys.stdin)
revision = payload['revision']
if not re.fullmatch(r'[0-9a-f]{40}', revision):
    raise RuntimeError('Invalid revision')
for name in payload['files']:
    if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts:
        raise RuntimeError('Invalid source path')


def metadata(root):
    path = root / 'version.json'
    return json.loads(path.read_text()) if path.is_file() else None


def verify(root, files, strict=False):
    mismatches = []
    for name, expected in files.items():
        path = root / name
        if not path.is_file() or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            mismatches.append(name)
    if mismatches:
        raise RuntimeError('Content mismatch: ' + ', '.join(mismatches))
    if strict:
        extras = [str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and str(p.relative_to(root)) not in files and p.name != 'version.json']
        if extras:
            raise RuntimeError('Unexpected runtime files: ' + ', '.join(extras))


def probe(root):
    # Loopback HTTPS uses the production virtual host and certificate.
    args = ['curl', '-fsS', '--max-time', '20', '--resolve', 'map.solvaneon.com:443:127.0.0.1']
    body = subprocess.check_output(args + ['https://map.solvaneon.com/app.js'])
    if hashlib.sha256(body).hexdigest() != payload['assets']['app.js']:
        raise RuntimeError('HTTPS app.js does not match the selected commit')
    headers = subprocess.check_output(args + ['-I', 'https://map.solvaneon.com/registration.mjs']).decode().lower()
    if 'application/javascript' not in headers:
        raise RuntimeError('Incorrect module MIME type')
    info = metadata(root)
    if info:
        served = json.loads(subprocess.check_output(args + ['https://map.solvaneon.com/version.json']).decode())
        if served['revision'] != revision:
            raise RuntimeError('HTTPS version.json does not match the selected commit')


def switch(target):
    link = BASE / ('current-next-' + revision[:12])
    if link.is_symlink():
        link.unlink()
    os.symlink(str(target), str(link))
    os.replace(str(link), str(CURRENT))


action = payload['action']
previous = CURRENT.resolve()
if action == 'check':
    verify(previous, payload['assets'], strict=True)
    info = metadata(previous)
    if info and (info['revision'] != revision or info.get('assets') != payload['assets']):
        raise RuntimeError('Deployed revision differs from main, even if runtime files happen to match')
    if not info and not previous.name.startswith('release-' + revision[:7]):
        raise RuntimeError('Legacy release name does not match main')
    probe(previous)
    print(json.dumps({'synchronized': True, 'revision': revision, 'runtime_files_verified': len(payload['assets']), 'version_endpoint': bool(info), 'release': previous.name}))
    sys.exit(0)
if action == 'deploy':
    expected_conf = payload['files']['deploy/school-map.conf']
    actual_conf = hashlib.sha256(Path('/etc/nginx/conf.d/school-map.conf').read_bytes()).hexdigest()
    if actual_conf != expected_conf:
        raise RuntimeError('nginx configuration differs. Back up, apply and validate this site configuration separately before deploying.')
    target = RELEASES / ('release-' + revision[:12])
    if not target.exists():
        with tempfile.TemporaryDirectory(prefix='entr550-release-') as temp:
            archive = Path(temp) / 'source.tar.gz'
            subprocess.run(['curl', '-fsSL', '--connect-timeout', '10', '--max-time', '120', 'https://codeload.github.com/Photo-king/ENTR550OnlineMap/tar.gz/' + revision, '-o', str(archive)], check=True)
            extracted = Path(temp) / 'source'
            extracted.mkdir()
            with tarfile.open(str(archive)) as tar:
                for member in tar.getmembers():
                    if member.name.startswith('/') or '..' in PurePosixPath(member.name).parts or not (member.isfile() or member.isdir()):
                        raise RuntimeError('Unsafe archive member')
                tar.extractall(str(extracted))
            source = next(extracted.iterdir())
            verify(source, payload['files'])
            stage = Path(tempfile.mkdtemp(prefix='.stage-', dir=str(RELEASES)))
            try:
                for name in payload['assets']:
                    destination = stage / name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(str(source / name), str(destination))
                info = {'revision': revision, 'short_revision': revision[:12], 'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'source': 'https://github.com/Photo-king/ENTR550OnlineMap/commit/' + revision, 'assets': payload['assets']}
                (stage / 'version.json').write_text(json.dumps(info, indent=2) + '\n')
                for root, dirs, files in os.walk(str(stage)):
                    os.chmod(root, 0o755)
                    for name in files:
                        os.chmod(os.path.join(root, name), 0o644)
                verify(stage, payload['assets'], strict=True)
                os.replace(str(stage), str(target))
            except Exception:
                shutil.rmtree(str(stage))
                raise
elif action == 'rollback':
    name = payload['release']
    if not re.fullmatch(r'release-[0-9a-f]{7,40}(?:-r[0-9]+)?', name):
        raise RuntimeError('Invalid rollback release')
    target = RELEASES / name
    if not target.is_dir() or target.is_symlink():
        raise RuntimeError('Rollback release unavailable')
else:
    raise RuntimeError('Unknown release action')
verify(target, payload['assets'], strict=True)
info = metadata(target)
if info and (info['revision'] != revision or info.get('assets') != payload['assets']):
    raise RuntimeError('Existing release metadata differs from requested revision')
try:
    switch(target)
    probe(target)
except Exception:
    switch(previous)
    raise
record = {'action': action, 'revision': revision, 'release': target.name, 'previous': previous.name, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
with (BASE / 'release-history.jsonl').open('a') as log:
    log.write(json.dumps(record) + '\n')
print(json.dumps(dict(record, runtime_files_verified=len(payload['assets']))))

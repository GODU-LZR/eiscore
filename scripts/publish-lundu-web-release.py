#!/usr/bin/env python3
"""Validate and publish a complete Lundu web release; never changes business data.

Run on the deployment host. --validate-only is offline; --check-only also checks
the locked live baseline and Docker without switching. Receipts are consistency
evidence, not cryptographic attestation or protection from a root user.
"""

import argparse
import contextlib
import ctypes
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import quote, unquote, urljoin, urlsplit
import urllib.request
import uuid


ROOT = Path('/opt/lundu-eiscore')
RECEIPT = 'release-provenance.json'
CACHEABLE = {'.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico',
             '.svg', '.webp', '.avif', '.woff', '.woff2', '.ttf', '.eot'}
HOST_FILES = {'index.html', 'sw.js', 'asset-manifest.json', RECEIPT}
WRONG_BRAND = re.compile(r'君乐缘|junleyuan', re.I)


class InvalidRelease(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidRelease(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def json_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate JSON key: ' + key)
        result[key] = value
    return result


def read_json(path):
    with Path(path).open(encoding='utf-8') as source:
        value = json.load(source, object_pairs_hook=json_object)
    require(isinstance(value, dict), 'JSON object required: ' + Path(path).name)
    return value


def relative_path(value):
    require(isinstance(value, str) and value, 'empty or non-string path')
    require(not any(ord(char) < 32 for char in value), 'control character in path')
    require('\\' not in value and ':' not in value and '%' not in value,
            'non-canonical path: ' + value)
    require(not value.startswith('/') and all(part not in ('', '.', '..')
            for part in value.split('/')), 'unsafe path: ' + value)
    require(value == RECEIPT or not any(re.search(r'(^backups?$|release[.-]|carousel-(?:incoming|prev)|^node_modules$)', part, re.I)
                    for part in value.split('/')), 'polluted release path: ' + value)
    return value


def local_url(value, origin, entry='index.html'):
    require(isinstance(value, str), 'URL must be a string')
    raw_path = unquote(urlsplit(value).path)
    relative_path(raw_path[1:] if raw_path.startswith('/') else raw_path)
    parsed = urlsplit(urljoin(origin + '/' + entry, value))
    require(parsed.scheme == 'https' and parsed.netloc == urlsplit(origin).netloc,
            'external release URL: ' + value)
    require(not parsed.query and not parsed.fragment, 'non-canonical asset URL: ' + value)
    return relative_path(unquote(parsed.path)[1:])


def inventory(root, include_receipt=False):
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(), 'release must be a real directory')
    result = {}
    for item in sorted(root.rglob('*')):
        require(not item.is_symlink(), 'symlink in release: ' + str(item))
        if item.is_dir():
            continue
        require(item.is_file(), 'special file in release: ' + str(item))
        name = relative_path(item.relative_to(root).as_posix())
        if include_receipt or name != RECEIPT:
            result[name] = file_sha(item)
    return result


def tree_sha(files):
    return sha256(''.join(f'{name}\0{files[name]}\n' for name in sorted(files)).encode())


def hash_map(value, label):
    require(isinstance(value, dict) and value, label + ' must be a nonempty map')
    for name, checksum in value.items():
        relative_path(name)
        require(isinstance(checksum, str) and re.fullmatch(r'[0-9a-f]{64}', checksum),
                label + ' invalid SHA-256: ' + name)
    return value


def safe_extract(archive, destination):
    """Inspect every member first; do not follow links or trust tar permissions."""
    destination = Path(destination)
    with tarfile.open(archive, 'r:*') as bundle:
        members = []
        names = set()
        total = 0
        for member in bundle.getmembers():
            name = member.name
            while name.startswith('./'):
                name = name[2:]
            if name in ('', '.') and member.isdir():
                continue
            name = relative_path(name.rstrip('/') if member.isdir() else name)
            require(name not in names, 'duplicate tar path: ' + name)
            require(member.isdir() or member.type in (tarfile.REGTYPE, tarfile.AREGTYPE),
                    'tar links/special files are forbidden: ' + name)
            require(not member.sparse, 'sparse tar file: ' + name)
            names.add(name)
            total += member.size
            require(len(names) <= 20000 and member.size <= 256 * 1024 * 1024
                    and total <= 1024 * 1024 * 1024, 'archive exceeds release limits')
            members.append((member, name))
        files = {name for member, name in members if member.isfile()}
        for _, name in members:
            require(not any(parent.as_posix() in files for parent in PurePosixPath(name).parents
                            if parent.as_posix() != '.'), 'tar file is also a parent: ' + name)
        for member, name in members:
            target = destination / name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                target.chmod(0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as source, target.open('xb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o644)
    destination.chmod(0o755)
    for item in destination.rglob('*'):
        if item.is_dir():
            item.chmod(0o755)


class EntryTags(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.assets = []
        self.icons = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('src'):
            self.assets.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            rel = attrs.get('rel', '').lower()
            if rel in ('icon', 'shortcut icon', 'apple-touch-icon'):
                self.icons.append((rel, attrs['href']))
            if rel in ('stylesheet', 'modulepreload', 'preload', 'icon',
                       'shortcut icon', 'apple-touch-icon'):
                self.assets.append(attrs['href'])


def validate_policy(policy):
    require(policy.get('schemaVersion') == 1, 'unsupported policy schema')
    require(policy.get('enterpriseId') == 'lundu', 'policy is not for Lundu')
    require(re.fullmatch(r'[0-9a-f]{40}', policy.get('requiredSourceCommit', '')),
            'invalid required source commit')
    require(policy.get('origin') == 'https://lundu.eiscore.top', 'unexpected deployment origin')
    require(policy.get('mounts') == ['', 'apps', 'company-site', 'decision', 'equipment',
            'hr', 'materials', 'mobile', 'production', 'purchase', 'quality', 'sales'],
            'policy must cover all 12 entries')
    require(policy.get('carouselCount') == 6 and policy.get('bomParts') == 13
            and policy.get('productCount') == 12, 'unexpected visual acceptance policy')
    local_url(policy['favicon'], policy['origin'])


def protected(files):
    return {name: checksum for name, checksum in files.items()
            if name not in HOST_FILES and not name.startswith('assets/')}


def validate_candidate(root, policy):
    validate_policy(policy)
    root = Path(root)
    receipt = read_json(root / RECEIPT)
    require(receipt.get('schemaVersion') == 1, 'unsupported provenance schema')
    source = receipt.get('sourceCommit', '')
    require(isinstance(source, str) and re.fullmatch(r'[0-9a-f]{40}', source), 'invalid source commit')
    required = policy['requiredSourceCommit']
    history = receipt.get('sourceHistory')
    require(receipt.get('requiredSourceCommit') == required and isinstance(history, list)
            and required in history and source in history and all(isinstance(commit, str)
            and re.fullmatch(r'[0-9a-f]{40}', commit) for commit in history),
            'required independent-site source is absent')
    files = inventory(root)
    require(hash_map(receipt.get('files'), 'provenance files') == files,
            'release bytes do not match provenance (missing, extra or changed file)')
    require(receipt.get('treeSha256') == tree_sha(files), 'release tree SHA-256 mismatch')
    baseline = receipt.get('baseline', {})
    require(isinstance(baseline, dict) and re.fullmatch(r'[0-9a-f]{16}', baseline.get('version', ''))
            and re.fullmatch(r'[0-9a-f]{64}', baseline.get('indexSha256', '')),
            'invalid baseline descriptor')
    require(hash_map(baseline.get('files'), 'baseline files') == protected(files),
            'candidate changed or omitted protected baseline files')
    manifest = read_json(root / 'asset-manifest.json')
    version = receipt.get('manifestVersion', '')
    require(isinstance(version, str) and re.fullmatch(r'[0-9a-f]{16}', version)
            and manifest.get('version') == version, 'manifest version mismatch')
    urls = manifest.get('urls')
    require(isinstance(urls, list) and all(isinstance(url, str) and url.startswith('/')
            and not url.startswith('//') for url in urls), 'invalid manifest URLs')
    url_files = [local_url(url, policy['origin']) for url in urls]
    expected = {name for name in files if Path(name).suffix.lower() in CACHEABLE and name != 'sw.js'}
    require(len(url_files) == len(set(url_files)) and set(url_files) == expected,
            'manifest has duplicate, missing, extra or polluted URLs')
    require(type(manifest.get('count')) is int and manifest['count'] == len(urls)
            and type(manifest.get('totalBytes')) is int
            and manifest['totalBytes'] == sum((root / name).stat().st_size for name in url_files),
            'manifest count/bytes mismatch')
    config = read_json(root / 'config/eiscore-enterprise.json')
    require(config.get('enterprise', {}).get('id') == policy['enterpriseId'], 'wrong enterprise configuration')
    branding = config.get('branding', {}).get('login', {})
    slides = branding.get('carouselImages', [])
    require(isinstance(slides, list) and len(slides) == policy['carouselCount'], 'missing static carousel')
    slide_paths = [local_url(slide['url'], policy['origin']) for slide in slides]
    require(len(set(slide_paths)) == policy['carouselCount'] and set(slide_paths) <= files.keys(),
            'carousel art missing or repeated')
    logo = local_url(config.get('branding', {}).get('logoUrl', ''), policy['origin'])
    require(logo in files, 'logo asset missing')
    for mount in policy['mounts']:
        entry = f'{mount}/index.html' if mount else 'index.html'
        require(entry in files, 'missing frontend entry: ' + entry)
        html = (root / entry).read_text(encoding='utf-8')
        require(not WRONG_BRAND.search(html), 'wrong brand in entry: ' + entry)
        tags = EntryTags(html)
        require(tags.assets, 'entry has no assets: ' + entry)
        for asset in tags.assets:
            if urlsplit(asset).scheme in ('http', 'https') and urlsplit(asset).netloc != urlsplit(policy['origin']).netloc:
                continue
            require(local_url(asset, policy['origin'], entry) in files, 'entry asset missing: ' + asset)
        if not mount:
            require(len(tags.icons) == 3 and sorted(rel for rel, _ in tags.icons) in
                    [['apple-touch-icon', 'icon', 'icon'], ['apple-touch-icon', 'icon', 'shortcut icon']]
                    and all(local_url(url, policy['origin']) == local_url(policy['favicon'], policy['origin'])
                            for _, url in tags.icons), 'three Lundu favicon references required')
            for asset in tags.assets:
                if asset.startswith('/assets/'):
                    text = (root / local_url(asset, policy['origin'])).read_text(encoding='utf-8')
                    require(not WRONG_BRAND.search(text), 'wrong brand in root entry asset')
    require(not WRONG_BRAND.search(json.dumps(config, ensure_ascii=False)), 'wrong brand in public configuration')
    stamp = receipt.get('build', {}).get('stamp', '')
    require(isinstance(stamp, str) and re.fullmatch(r'[A-Za-z0-9._-]{1,128}', stamp), 'missing release stamp')
    for name in ('index.html', 'sw.js'):
        require(name in files, 'missing cache entry: ' + name)
        text = (root / name).read_text(encoding='utf-8')
        versions = re.findall(r'\b(?:var|const|let)\s+RELEASE_VERSION\s*=\s*[\'"]([^\'"]+)[\'"]', text)
        require(versions == [stamp], 'release stamp missing or inconsistent in ' + name)
    return receipt


def validate_evidence(evidence, receipt, policy, now=None):
    require(evidence.get('pass') is True and evidence.get('realProfile') is True,
            'real published-profile browser acceptance is required')
    for field, expected in [('version', receipt['manifestVersion']), ('treeSha256', receipt['treeSha256']),
                            ('sourceCommit', receipt['sourceCommit']), ('releaseStamp', receipt['build']['stamp'])]:
        require(evidence.get(field) == expected, 'browser evidence mismatch: ' + field)
    require(evidence.get('errors') == [], 'browser errors or missing error evidence')
    require('origin' not in evidence or evidence['origin'] == policy['origin'], 'browser evidence origin mismatch')
    try:
        completed = dt.datetime.fromisoformat(evidence.get('completedAt', '').replace('Z', '+00:00'))
        require(completed.tzinfo is not None, 'browser evidence time must include timezone')
        age = ((now or dt.datetime.now(dt.timezone.utc)) - completed).total_seconds()
        require(-60 <= age <= 3600, 'browser evidence is stale or in the future')
    except (TypeError, ValueError) as error:
        raise InvalidRelease('invalid browser evidence timestamp') from error
    views = evidence.get('views')
    require(isinstance(views, list) and len(views) == 4 and all(isinstance(view, dict) for view in views),
            'four browser viewports required')
    require({view.get('viewportWidth') for view in views} == {1440, 390, 414, 768}, 'wrong browser viewports')
    for view in views:
        width = view['viewportWidth']
        require(type(view.get('scrollWidth')) in (int, float) and 0 < view['scrollWidth'] <= width,
                'horizontal overflow in browser evidence')
        slides = view.get('slides')
        require(isinstance(slides, list) and len(slides) == policy['carouselCount'], 'browser carousel incomplete')
        slide_urls = []
        for slide in slides:
            if isinstance(slide, dict):
                require(slide.get('loaded') is True, 'browser carousel image failed')
                slide = slide.get('url')
            slide_urls.append(local_url(slide, policy['origin']))
        require(len(set(slide_urls)) == policy['carouselCount'], 'browser carousel repeats images')
        require(view.get('bomParts') == policy['bomParts'] and view.get('explodedAndAssembled') is True,
                'real pump decomposition/assembly evidence missing')
        require(view.get('cards') == policy['productCount'] and view.get('loaded') == policy['productCount'],
                'product pictures incomplete')
        details = view.get('detailImages')
        require(isinstance(details, list) and len(details) == policy['productCount']
                and all(isinstance(image, dict) and image.get('loaded') is True for image in details),
                'product detail picture evidence incomplete')
        images = view.get('quoteImages')
        require(isinstance(images, list) and len(images) == policy['productCount'] and all(isinstance(image, dict)
                and image.get('loaded') is True and image.get('fit') == 'contain' for image in images),
                'purchase-order picture evidence missing')
        require(view.get('wrongBrand') is False and view.get('logo') is True
                and view.get('faviconStatus') == 200, 'browser brand/logo/favicon failure')


def validate_baseline(live, receipt):
    actual = inventory(live)
    baseline = receipt['baseline']
    require(read_json(Path(live) / 'asset-manifest.json').get('version') == baseline['version'],
            'live baseline version changed; do not overwrite another release')
    require(actual.get('index.html') == baseline['indexSha256'], 'live baseline index changed')
    require(protected(actual) == baseline['files'], 'live protected baseline bytes changed')
    require(actual.get('sw.js') != receipt['files'].get('sw.js'), 'Service Worker did not change for the new release')
    return actual


def run(command):
    result = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
    require(result.returncode == 0, 'command failed: ' + ' '.join(command))
    return result.stdout


def compose(root, *args):
    return ['docker', 'compose', '--env-file', str(root / '.env'), '-f', str(root / 'compose.yml'), *args]


def container_state(runner=run):
    ids = runner(['docker', 'ps', '-aq', '--no-trunc']).split()
    require(ids, 'no Docker containers found')
    template = ('{"id":{{json .Id}},"startedAt":{{json .State.StartedAt}},'
                '"running":{{json .State.Running}},"labels":{{json .Config.Labels}},'
                '"mounts":{{json .Mounts}},"ports":{{json .NetworkSettings.Ports}}}')
    return [json.loads(line) for line in runner(['docker', 'inspect', '--format', template, *ids]).splitlines()]


def web_and_others(state, root):
    own = [item for item in state if (item.get('labels') or {}).get('com.docker.compose.project') == root.name
           and (item.get('labels') or {}).get('com.docker.compose.service') == 'web']
    require(len(own) == 1 and own[0]['running'], 'exactly one running Lundu web container required')
    web = own[0]
    mounts = [mount for mount in web['mounts'] if mount['Destination'] == '/usr/share/nginx/html']
    require(len(mounts) == 1 and mounts[0]['Source'] == str(root / 'release') and not mounts[0]['RW'],
            'web has unexpected release mount')
    others = {item['id']: item['startedAt'] for item in state if item['id'] != web['id']}
    return web, others


def verify_http(root, files, policy, web, runner=run):
    """Probe the actual web port with the domain Host header, bypassing proxies/DNS."""
    bindings = (web.get('ports') or {}).get('80/tcp') or []
    require(bindings, 'web has no published HTTP port')
    port = int(bindings[0]['HostPort'])
    require(0 < port < 65536, 'invalid web HTTP port')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for name, checksum in files.items():
        request = urllib.request.Request(f'http://127.0.0.1:{port}/' + quote(name, safe='/'),
                                         headers={'Host': urlsplit(policy['origin']).netloc,
                                                  'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity'})
        with opener.open(request, timeout=30) as response:
            require(response.status == 200 and sha256(response.read()) == checksum,
                    'HTTP byte mismatch: ' + name)
            mime = response.headers.get_content_type()
            if name.endswith('.json'):
                require(mime == 'application/json', 'JSON returned as SPA fallback: ' + name)
            if name.endswith('.html'):
                require(mime == 'text/html', 'wrong HTML content type: ' + name)


def atomic_exchange(left, right):
    """Linux renameat2 exchange: there is no missing-release directory window."""
    libc = ctypes.CDLL(None, use_errno=True)
    require(hasattr(libc, 'renameat2'), 'atomic directory exchange is unavailable')
    function = libc.renameat2
    function.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    function.restype = ctypes.c_int
    if function(-100, os.fsencode(left), -100, os.fsencode(right), 2) != 0:
        raise OSError(ctypes.get_errno(), 'atomic release exchange failed')


@contextlib.contextmanager
def publication_lock(root):
    import fcntl  # Only live operations need Linux; offline validation works on Windows.
    require(root == ROOT and root.is_dir() and root.resolve() == root, 'unexpected deployment root')
    lock = root / '.lundu-web-publish.lock'
    fd = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(fd)


def publish_release(stage, root, receipt, policy, check_only=False, runner=run,
                    exchange=atomic_exchange, http_check=verify_http):
    """Caller holds the publication lock. Dependencies are injectable for offline tests."""
    live = root / 'release'
    before = container_state(runner)
    old_web, old_others = web_and_others(before, root)
    old_files = validate_baseline(live, receipt)
    runner(compose(root, 'exec', '-T', 'web', 'nginx', '-t'))
    http_check(root, old_files, policy, old_web, runner)
    require(validate_baseline(live, receipt) == old_files, 'live changed during baseline checks')
    require(inventory(stage) == receipt['files'], 'candidate changed after validation')
    if check_only:
        after_web, after_others = web_and_others(container_state(runner), root)
        require(old_others == after_others and old_web['id'] == after_web['id'],
                'container identities changed during check')
        return {'mode': 'check-only', 'liveChecks': True, 'version': receipt['manifestVersion'],
                'baselineVersion': receipt['baseline']['version']}
    backup_parent = root / 'backups'
    require(not backup_parent.is_symlink(), 'backup directory cannot be a symlink')
    backup_parent.mkdir(exist_ok=True)
    suffix = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    backup = backup_parent / ('web-before-' + receipt['baseline']['version'] + '-' + suffix)
    old_location = stage
    exchange(stage, live)
    try:
        stage.rename(backup)
        old_location = backup
        runner(compose(root, 'up', '-d', '--no-deps', '--force-recreate', 'web'))
        runner(compose(root, 'exec', '-T', 'web', 'nginx', '-t'))
        web, others = web_and_others(container_state(runner), root)
        require(others == old_others, 'non-web container identity/start time changed')
        require(web['id'] != old_web['id'], 'web was not recreated')
        require(inventory(live) == receipt['files'], 'published disk bytes changed')
        http_check(root, receipt['files'], policy, web, runner)
        _, others = web_and_others(container_state(runner), root)
        require(others == old_others, 'non-web containers changed during HTTP verification')
    except BaseException as failure:
        try:
            exchange(live, old_location)
            failed = backup_parent / ('web-failed-' + receipt['manifestVersion'] + '-' + suffix)
            old_location.rename(failed)
            runner(compose(root, 'up', '-d', '--no-deps', '--force-recreate', 'web'))
            runner(compose(root, 'exec', '-T', 'web', 'nginx', '-t'))
            web, others = web_and_others(container_state(runner), root)
            require(others == old_others, 'non-web containers changed; web-only rollback cannot repair them')
            require(inventory(live) == old_files, 'rollback disk verification failed')
            http_check(root, old_files, policy, web, runner)
        except BaseException as rollback_failure:
            raise InvalidRelease(f'publish failed ({failure}); ROLLBACK FAILED ({rollback_failure})') from rollback_failure
        raise InvalidRelease(f'publish failed; previous web release restored: {failure}') from failure
    return {'mode': 'published', 'version': receipt['manifestVersion'], 'treeSha256': receipt['treeSha256'],
            'sourceCommit': receipt['sourceCommit'], 'indexSha256': receipt['files']['index.html'],
            'backup': str(backup), 'rebuiltServices': ['web'], 'webContainer': web['id'],
            'manifestCount': len(read_json(live / 'asset-manifest.json')['urls']), 'otherContainersUnchanged': True}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--archive-sha256', required=True)
    parser.add_argument('--evidence', required=True, type=Path)
    parser.add_argument('--evidence-sha256')
    parser.add_argument('--policy', type=Path, default=Path(__file__).resolve().parents[1] / 'deploy/lundu/web-release-policy.json')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--validate-only', action='store_true', help='offline candidate/evidence validation; does not check live')
    mode.add_argument('--check-only', action='store_true', help='also lock and check deployment baseline/Docker, without switching')
    args = parser.parse_args(argv)
    require(re.fullmatch(r'[0-9a-fA-F]{64}', args.archive_sha256)
            and file_sha(args.archive) == args.archive_sha256.lower(), 'archive SHA-256 mismatch')
    if args.evidence_sha256:
        require(file_sha(args.evidence) == args.evidence_sha256.lower(), 'evidence SHA-256 mismatch')
    policy, evidence = read_json(args.policy), read_json(args.evidence)
    if args.validate_only:
        with tempfile.TemporaryDirectory(prefix='lundu-release-validate-') as directory:
            stage = Path(directory)
            safe_extract(args.archive, stage)
            receipt = validate_candidate(stage, policy)
            validate_evidence(evidence, receipt, policy)
            print(json.dumps({'mode': 'validate-only', 'liveChecks': False,
                              'version': receipt['manifestVersion'], 'treeSha256': receipt['treeSha256']}))
        return
    require(os.name == 'posix' and os.geteuid() == 0, 'live checks/publication require root on the deployment host')
    with publication_lock(ROOT):
        stage = Path(tempfile.mkdtemp(prefix='.lundu-web-stage-', dir=ROOT))
        retain_stage = False
        try:
            safe_extract(args.archive, stage)
            receipt = validate_candidate(stage, policy)
            validate_evidence(evidence, receipt, policy)
            # Guard against an input being replaced while it was read.
            require(file_sha(args.archive) == args.archive_sha256.lower(), 'archive changed during validation')
            # A failed switch can leave the only old directory at stage: keep it
            # for recovery instead of deleting it from a generic finally block.
            retain_stage = not args.check_only
            result = publish_release(stage, ROOT, receipt, policy, args.check_only)
            print(json.dumps(result))
        finally:
            if stage.exists() and not retain_stage:
                shutil.rmtree(stage)


if __name__ == '__main__':
    try:
        main()
    except (InvalidRelease, OSError, ValueError, KeyError, TypeError, tarfile.TarError, subprocess.TimeoutExpired) as error:
        print('REFUSED: ' + str(error), file=sys.stderr)
        sys.exit(1)

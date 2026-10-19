#!/usr/bin/env python3
"""Replace only the Lundu business Harness, preserving its image, data and IPs."""

import argparse
import contextlib
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

ROOT = Path('/opt/lundu-eiscore')
TARGET = 'lundu-eiscore-deepseek-web-1'
SERVICE = 'deepseek-web'
PROJECT = 'lundu-eiscore'
HARNESS = '/opt/eiscore-harness'
MANIFEST = 'harness-package.json'


class Rejected(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise Rejected(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def inventory(root, allow_modules=False):
    require(root.is_dir() and not root.is_symlink(), 'directory unavailable or linked')
    result = {}
    for folder, directories, files in os.walk(root, followlinks=False):
        for name in directories[:] + files:
            item = Path(folder) / name
            relative = item.relative_to(root).as_posix()
            if item.is_symlink():
                require(allow_modules and relative == 'node_modules'
                        and os.readlink(item) == '/opt/bridge/node_modules', 'unapproved symlink')
                if name in directories:
                    directories.remove(name)
                continue
            require(item.is_dir() or item.is_file(), 'special file is forbidden')
            if item.is_file():
                result[relative] = {'sha256': sha(item), 'size': item.stat().st_size}
    return result


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def validate_package(root, source):
    require(re.fullmatch(r'[0-9a-f]{40}', source or ''), 'source commit must be 40 lowercase hex characters')
    require(root.is_absolute() and root.resolve() == root, 'package path must be canonical and absolute')
    require(root != ROOT and not root.is_relative_to(ROOT / 'release'), 'package must not overlap the web release')
    files = inventory(root, allow_modules=True)
    require(MANIFEST in files, 'harness package manifest missing')
    try:
        manifest = json.loads((root / MANIFEST).read_text(encoding='utf-8'), object_pairs_hook=unique_object)
    except (OSError, json.JSONDecodeError):
        raise Rejected('invalid harness package manifest') from None
    require(isinstance(manifest, dict), 'harness package manifest must be an object')
    require(manifest.get('schemaVersion') == 1 and manifest.get('sourceCommit') == source,
            'harness package source mismatch')
    expected = {}
    require(isinstance(manifest.get('files'), list), 'package files must be an array')
    for entry in manifest['files']:
        require(isinstance(entry, dict), 'invalid package file entry')
        path = entry.get('path', '')
        require(isinstance(path, str) and path and not path.startswith('/') and '\\' not in path
                and all(part not in ('', '.', '..') for part in path.split('/')),
                'unsafe package file path')
        require(path != MANIFEST and path not in expected, 'duplicate or self-referencing package file')
        require(not any(part.startswith('.env') for part in path.split('/')), 'package must not contain environment files')
        require(re.fullmatch(r'[0-9a-f]{64}', entry.get('sha256', ''))
                and type(entry.get('size')) is int and entry['size'] >= 0, 'invalid package checksum')
        expected[path] = {'sha256': entry['sha256'], 'size': entry['size']}
    actual = {name: value for name, value in files.items() if name != MANIFEST}
    require(actual == expected, 'package file inventory or checksum mismatch')
    require({'dsh-web-runner.mjs', 'dsh-web.patch.yml', 'dsh-web-defaults.mjs',
             'business-web-ui.mjs', 'visual-response-policy.mjs', 'web-ui/business-ui.js',
             'web-ui/business-ui.css', 'web-ui/visual-runtime.js', 'web-ui/visual-runtime.css',
             'web-ui/vendor/echarts.min.js', 'web-ui/vendor/viz-standalone.js',
             'web-ui/vendor/echarts.min.js.LICENSE.txt', 'web-ui/vendor/viz-standalone.js.LICENSE.txt',
             'client-plugins/eiscore-auth/lib/index.js', 'client-plugins/digital-twin/lib/index.js',
             'client-plugins/enterprise-bi/lib/index.js'} <= actual.keys(),
            'business Harness runtime files missing')
    for line in (root / 'dsh-web.patch.yml').read_text(encoding='utf-8').splitlines():
        entry = re.match(r'^\s*(?:-\s*)?name:\s*(.*?)\s*$', line)
        if not entry:
            continue
        scalar = re.fullmatch(r'''(?:'([^']*)'|"([^"]*)"|([^\s#'"]+))\s*(?:#.*)?''', entry[1])
        require(scalar is not None, 'unsupported patch module reference')
        module = next(value for value in scalar.groups() if value is not None)
        require(module not in ('|', '>') and not module.startswith(('&', '*', '!')),
                'unsupported patch module reference')
        if not module.startswith(HARNESS):
            continue
        require(module.startswith(HARNESS + '/'), 'unsafe patch module path')
        relative = module[len(HARNESS) + 1:]
        require(re.fullmatch(r'[A-Za-z0-9_@./-]+', relative)
                and all(part not in ('', '.', '..') for part in relative.split('/')),
                'unsafe patch module path')
        require(relative in actual, 'patch module missing from package: ' + relative)
    return files


def command(args, text_input=None, timeout=90):
    try:
        result = subprocess.run(args, input=text_input, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise Rejected('Docker command unavailable or timed out') from None
    # Docker/Compose errors can contain environment values. Never echo them.
    require(result.returncode == 0, 'Docker command failed')
    return result.stdout


def inspect():
    values = json.loads(command(['docker', 'inspect', TARGET]))
    require(len(values) == 1 and values[0].get('State', {}).get('Running'), 'business Harness is not running')
    return values[0]


def running_others():
    lines = command(['docker', 'ps', '--no-trunc', '--format', '{{.Names}}\t{{.ID}}']).splitlines()
    return dict(line.split('\t', 1) for line in lines if line.split('\t', 1)[0] != TARGET)


def provider_values():
    """Read only these provider assignments from the Lundu deployment file."""
    result = {}
    path = ROOT / '.env'
    if path.is_file():
        require(not path.is_symlink(), 'Lundu provider configuration must not be a symlink')
        for line in path.read_text(encoding='utf-8').splitlines():
            match = re.fullmatch(r'\s*(DEEPSEEK_API_KEY|DSH_PROVIDER|DSH_MODEL)\s*=\s*(.*?)\s*', line)
            if match:
                value = match[2]
                if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
                    value = value[1:-1]
                if value and not value.startswith('#'):
                    result[match[1]] = value
    return result


def compose_definition(current, package=None):
    config, host = current['Config'], current['HostConfig']
    service = {'container_name': TARGET, 'image': current['Image'], 'pull_policy': 'never',
               'entrypoint': config.get('Entrypoint'), 'command': config.get('Cmd'),
               'user': config.get('User', ''), 'read_only': bool(host.get('ReadonlyRootfs')),
               'cap_drop': host.get('CapDrop') or [], 'cap_add': host.get('CapAdd') or [],
               'security_opt': host.get('SecurityOpt') or []}
    environment = dict(item.split('=', 1) for item in config.get('Env', []) if '=' in item)
    if package:
        for name, value in provider_values().items():
            if not environment.get(name):
                environment[name] = value
        environment.update(EISCORE_HARNESS_CAPABILITY_PROFILE='business',
                           DSH_DEFAULT_WORKSPACE='/var/lib/dsh/workspaces/business',
                           DSH_DEFAULT_WORKSPACE_TITLE='业务助手工作区',
                           DSH_PATCH_PATH=HARNESS + '/dsh-web.patch.yml')
    service['environment'] = environment
    if host.get('Init') is not None:
        service['init'] = host['Init']
    if config.get('WorkingDir'):
        service['working_dir'] = config['WorkingDir']
    if config.get('Healthcheck'):
        health = config['Healthcheck']
        service['healthcheck'] = {'test': health['Test']}
        for original, key in [('Interval', 'interval'), ('Timeout', 'timeout'), ('StartPeriod', 'start_period')]:
            if health.get(original):
                service['healthcheck'][key] = str(health[original]) + 'ns'
        if health.get('Retries'):
            service['healthcheck']['retries'] = health['Retries']
    policy = host.get('RestartPolicy', {})
    if policy.get('Name'):
        service['restart'] = policy['Name'] + (':' + str(policy['MaximumRetryCount'])
            if policy['Name'] == 'on-failure' and policy.get('MaximumRetryCount') else '')
    if host.get('Tmpfs'):
        service['tmpfs'] = [target + ':' + options for target, options in host['Tmpfs'].items()]
    service['labels'] = {key: value for key, value in config.get('Labels', {}).items()
                         if not key.startswith('com.docker.compose.')}
    volumes, mounts = {}, []
    for mount in current.get('Mounts', []):
        target = mount['Destination']
        if package and (target == HARNESS or target.startswith(HARNESS + '/')):
            require(mount['Type'] == 'bind', 'unexpected data mount under Harness runtime')
            continue
        require(mount['Type'] in ('bind', 'volume', 'tmpfs'), 'unsupported mount type')
        if mount['Type'] == 'tmpfs':
            continue  # HostConfig.Tmpfs already preserves options.
        item = {'type': mount['Type'], 'target': target, 'read_only': not mount.get('RW', True)}
        if mount['Type'] == 'volume':
            name = 'volume_' + str(len(volumes))
            volumes[name] = {'external': True, 'name': mount['Name']}
            item['source'] = name
        else:
            item['source'] = mount['Source']
            item['bind'] = {'create_host_path': False, 'propagation': mount.get('Propagation') or 'rprivate'}
        mounts.append(item)
    if package:
        mounts.append({'type': 'bind', 'source': str(package), 'target': HARNESS, 'read_only': True,
                       'bind': {'create_host_path': False}})
    service['volumes'] = mounts
    networks = {}
    service['networks'] = {}
    for original_name, attachment in current['NetworkSettings']['Networks'].items():
        name = 'network_' + str(len(networks))
        networks[name] = {'external': True, 'name': original_name}
        values = {'aliases': attachment.get('Aliases') or []}
        for field, key in [('IPAddress', 'ipv4_address'), ('GlobalIPv6Address', 'ipv6_address')]:
            if attachment.get(field):
                values[key] = attachment[field]
        service['networks'][name] = values
    require(networks, 'business Harness network missing')
    require(not host.get('PortBindings'), 'unexpected published ports require explicit review')
    return {'name': PROJECT, 'services': {SERVICE: service}, 'networks': networks, 'volumes': volumes}


def private_json(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as destination:
        json.dump(value, destination, ensure_ascii=False)


def compose_literals(value):
    # Compose interpolates JSON strings too. Preserve literal dollars in the
    # inspected environment/commands instead of reading deployment-shell vars.
    if isinstance(value, str):
        return value.replace('$', '$$')
    if isinstance(value, dict):
        return {key: compose_literals(item) for key, item in value.items()}
    if isinstance(value, list):
        return [compose_literals(item) for item in value]
    return value


def switch(path):
    command(['docker', 'compose', '--project-name', PROJECT, '-f', str(path),
             'up', '-d', '--no-deps', '--force-recreate', SERVICE])


READINESS_PROGRAM = (
    "const http=require('node:http');const r=http.get('http://127.0.0.1:3081/api/eiscore/auth/status',"
    "{headers:{host:'lundu.eiscore.top'}},s=>{let b='';s.on('data',c=>b+=c);s.on('end',()=>{"
    "try{const a=JSON.parse(b).authenticated;process.exit((s.statusCode===200&&typeof a==='boolean')"
    "||(s.statusCode===401&&a===false)?0:1)}catch{process.exit(1)}})});"
    "r.setTimeout(2000,()=>{r.destroy();process.exit(1)});r.on('error',()=>process.exit(1));")


def ready():
    # Auth status is public, read-only and requires both the native DSH server
    # and its EISCore authentication plugin to have completed startup.
    deadline = time.monotonic() + 120
    while True:
        try:
            command(['docker', 'exec', TARGET, 'node', '-e', READINESS_PROGRAM], timeout=3)
            return
        except Rejected:
            require(time.monotonic() < deadline, 'business Harness readiness failed')
            time.sleep(1)


@contextlib.contextmanager
def publication_lock():
    import fcntl
    with (ROOT / '.lundu-web-publish.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Rejected('another Lundu publication holds the shared lock') from None
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def publish(package, expected_id, source, check_only=False):
    package = Path(package)
    package_files = validate_package(package, source)
    with publication_lock():
        current = inspect()
        require(current['Id'] == expected_id, 'current business Harness container changed')
        require(current['Name'] == '/' + TARGET, 'unexpected container identity')
        require(all(package != Path(mount['Source']).resolve() for mount in current.get('Mounts', [])
                    if mount['Type'] == 'bind' and mount['Destination'] == HARNESS),
                'candidate must not reuse the currently mounted Harness directory')
        release = inventory(ROOT / 'release')
        others = running_others()
        before = compose_definition(current)
        after = compose_definition(current, package)
        command(['docker', 'compose', '--project-name', PROJECT, '-f', '-', 'config', '--quiet'], json.dumps(compose_literals(after)))
        result = {'pass': True, 'checkOnly': check_only, 'target': TARGET, 'sourceCommit': source,
                  'packageFiles': len(package_files), 'protectedReleaseFiles': len(release), 'imageId': current['Image']}
        if check_only:
            return result
        backup = ROOT / 'backups' / ('business-harness-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8])
        backup.mkdir(parents=True, mode=0o700)
        original_path, candidate_path = backup / 'before-compose.json', backup / 'candidate-compose.json'
        private_json(original_path, compose_literals(before))
        private_json(candidate_path, compose_literals(after))
        private_json(backup / 'protected-baseline.json', {'release': release, 'otherContainers': others})
        attempted = False
        try:
            require(inspect()['Id'] == expected_id, 'business Harness changed before switch')
            require(inventory(ROOT / 'release') == release and running_others() == others, 'protected state changed before switch')
            require(validate_package(package, source) == package_files, 'package changed before switch')
            attempted = True
            switch(candidate_path)
            ready()
            deployed = inspect()
            require(deployed['Image'] == current['Image'], 'business Harness image changed')
            data_volumes = lambda container: {mount['Destination']: mount['Name']
                for mount in container.get('Mounts', []) if mount['Type'] == 'volume'}
            require(data_volumes(deployed) == data_volumes(current), 'business Harness data volumes changed')
            old_networks = current['NetworkSettings']['Networks']
            new_networks = deployed['NetworkSettings']['Networks']
            require(old_networks.keys() == new_networks.keys() and all(
                all(new_networks[name].get(key) == facts.get(key) for key in ['IPAddress', 'GlobalIPv6Address'])
                and set(facts.get('Aliases') or []) <= set(new_networks[name].get('Aliases') or [])
                for name, facts in old_networks.items()), 'business Harness network addresses or aliases changed')
            require(inventory(ROOT / 'release') == release, 'protected web release changed')
            require(running_others() == others, 'another running container changed')
            require(validate_package(package, source) == package_files, 'package changed during switch')
        except Exception as error:
            if not attempted:
                raise
            reason = str(error) if isinstance(error, Rejected) else 'unclassified deployment failure'
            try:
                switch(original_path)
                ready()
            except Exception:
                raise Rejected('deployment failed; target-only rollback failed; private backup: ' + str(backup)) from None
            raise Rejected('deployment failed; only business Harness rolled back; reason: ' + reason
                           + '; private backup: ' + str(backup)) from None
        result.update(containerId=deployed['Id'], backup=str(backup), rebuiltServices=[SERVICE])
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package-root', required=True)
    parser.add_argument('--expected-container-id', required=True)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    try:
        require(re.fullmatch(r'[0-9a-f]{64}', args.expected_container_id), 'expected container ID must be full length')
        result = publish(args.package_root, args.expected_container_id, args.source_commit, args.check_only)
    except (Rejected, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        result = {'pass': False, 'target': TARGET, 'error': str(error) if isinstance(error, Rejected) else 'publication state unavailable'}
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())

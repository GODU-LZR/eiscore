#!/usr/bin/env python3
"""Offline negative tests: temporary files and fake Docker/HTTP only."""

import datetime as dt
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/publish-lundu-web-release.py'
SPEC = importlib.util.spec_from_file_location('lundu_web_publish', SCRIPT)
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
POLICY = {
    'schemaVersion': 1, 'requiredSourceCommit': '9' * 40, 'enterpriseId': 'lundu',
    'origin': 'https://lundu.eiscore.top',
    'mounts': ['', 'apps', 'company-site', 'decision', 'equipment', 'hr',
               'materials', 'mobile', 'production', 'purchase', 'quality', 'sales'],
    'carouselCount': 6, 'bomParts': 13, 'productCount': 12,
    'favicon': '/enterprise-assets/site/lundu-favicon.png'
}


def write(root, name, value):
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(value if isinstance(value, bytes) else value.encode())


def save_json(root, name, value):
    write(root, name, json.dumps(value, ensure_ascii=False, indent=2))


def manifest(root, version):
    paths = sorted(name for name in release.inventory(root)
                   if Path(name).suffix in release.CACHEABLE and name != 'sw.js')
    save_json(root, 'asset-manifest.json', {
        'version': version, 'count': len(paths),
        'totalBytes': sum((root / name).stat().st_size for name in paths),
        'urls': ['/' + name for name in paths]
    })


def refresh_receipt(root, receipt):
    receipt['files'] = release.inventory(root)
    receipt['treeSha256'] = release.tree_sha(receipt['files'])
    save_json(root, release.RECEIPT, receipt)


def fixture(root, stamp, version):
    for mount in POLICY['mounts']:
        entry = mount + '/index.html' if mount else 'index.html'
        asset = mount + '/assets/main.js' if mount else 'assets/main.js'
        icons = ''.join(f'<link rel="{rel}" href="{POLICY["favicon"]}">'
                        for rel in ('icon', 'shortcut icon', 'apple-touch-icon')) if not mount else ''
        inline = f'<script>var RELEASE_VERSION = "{stamp}"</script>' if not mount else ''
        write(root, entry, f'<html><head>{icons}{inline}</head><body><script src="/{asset}"></script></body></html>')
        write(root, asset, 'window.testFrontend = true')
    write(root, 'sw.js', f'const RELEASE_VERSION = "{stamp}";')
    for index in range(6):
        write(root, f'enterprise-assets/site/slide-{index}.jpg', b'fixture image bytes')
    write(root, 'enterprise-assets/site/lundu-logo.png', b'fixture logo bytes')
    write(root, 'enterprise-assets/site/lundu-favicon.png', b'fixture icon bytes')
    save_json(root, 'config/eiscore-enterprise.json', {
        'enterprise': {'id': 'lundu'}, 'branding': {
            'logoUrl': '/enterprise-assets/site/lundu-logo.png', 'login': {
                'carouselImages': [{'url': f'/enterprise-assets/site/slide-{index}.jpg'} for index in range(6)]
            }
        }
    })
    manifest(root, version)


def evidence(receipt):
    return {
        'pass': True, 'version': receipt['manifestVersion'], 'treeSha256': receipt['treeSha256'],
        'sourceCommit': receipt['sourceCommit'], 'releaseStamp': receipt['build']['stamp'],
        'realProfile': True, 'errors': [], 'completedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'views': [{
            'viewportWidth': width, 'scrollWidth': width,
            'slides': [f'/enterprise-assets/site/slide-{index}.jpg' for index in range(6)],
            'bomParts': 13, 'explodedAndAssembled': True, 'cards': 12, 'loaded': 12,
            'detailImages': [{'loaded': True} for _ in range(12)],
            'quoteImages': [{'loaded': True, 'fit': 'contain'} for _ in range(12)],
            'wrongBrand': False, 'logo': True, 'faviconStatus': 200
        } for width in (1440, 390, 414, 768)]
    }


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lundu-publish-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'lundu-eiscore'
        self.live = self.root / 'release'
        self.stage = self.root / 'stage'
        fixture(self.live, 'old-stamp', '1' * 16)
        fixture(self.stage, 'new-stamp', '2' * 16)
        self.receipt = {
            'schemaVersion': 1, 'sourceCommit': 'a' * 40,
            'requiredSourceCommit': POLICY['requiredSourceCommit'],
            'sourceHistory': ['a' * 40, POLICY['requiredSourceCommit']],
            'manifestVersion': '2' * 16, 'build': {'stamp': 'new-stamp'},
            'baseline': {'version': '1' * 16, 'indexSha256': release.file_sha(self.live / 'index.html'),
                         'files': release.protected(release.inventory(self.live))}
        }
        refresh_receipt(self.stage, self.receipt)

    def valid(self):
        return release.validate_candidate(self.stage, POLICY)

    def test_valid_complete_candidate_and_real_profile_evidence(self):
        receipt = self.valid()
        release.validate_evidence(evidence(receipt), receipt, POLICY)
        release.validate_baseline(self.live, receipt)

    def test_old_source_is_rejected_even_when_bytes_match(self):
        self.receipt['sourceHistory'] = ['b' * 40]
        refresh_receipt(self.stage, self.receipt)
        with self.assertRaisesRegex(release.InvalidRelease, 'source is absent'):
            self.valid()

    def test_real_generated_duplicate_icon_structure_preserves_all_png_targets(self):
        html = (self.stage / 'index.html').read_text()
        write(self.stage, 'index.html', html.replace('rel="shortcut icon"', 'rel="icon"'))
        manifest(self.stage, self.receipt['manifestVersion'])
        refresh_receipt(self.stage, self.receipt)
        self.valid()
        write(self.stage, 'index.html', html.replace('rel="shortcut icon"', 'rel="icon"').replace(
            POLICY['favicon'], '/enterprise-assets/site/lundu-logo.png', 1))
        manifest(self.stage, self.receipt['manifestVersion'])
        refresh_receipt(self.stage, self.receipt)
        with self.assertRaisesRegex(release.InvalidRelease, 'favicon'):
            self.valid()

    def test_same_size_tampering_is_rejected(self):
        target = self.stage / 'assets/main.js'
        original = target.read_bytes()
        target.write_bytes(b'x' * len(original))
        with self.assertRaisesRegex(release.InvalidRelease, 'bytes do not match'):
            self.valid()

    def test_missing_art_is_rejected_even_with_recomputed_receipt(self):
        (self.stage / 'enterprise-assets/site/slide-0.jpg').unlink()
        manifest(self.stage, '2' * 16)
        refresh_receipt(self.stage, self.receipt)
        with self.assertRaisesRegex(release.InvalidRelease, 'protected baseline'):
            self.valid()

    def test_missing_entry_is_rejected_even_with_forged_baseline(self):
        (self.stage / 'sales/index.html').unlink()
        manifest(self.stage, '2' * 16)
        self.receipt['baseline']['files'] = release.protected(release.inventory(self.stage))
        refresh_receipt(self.stage, self.receipt)
        with self.assertRaisesRegex(release.InvalidRelease, 'missing frontend entry'):
            self.valid()

    def test_missing_cache_manifest_member_is_rejected(self):
        value = release.read_json(self.stage / 'asset-manifest.json')
        value['urls'].pop()
        value['count'] -= 1
        save_json(self.stage, 'asset-manifest.json', value)
        refresh_receipt(self.stage, self.receipt)
        with self.assertRaisesRegex(release.InvalidRelease, 'manifest has'):
            self.valid()

    def test_old_version_or_index_or_protected_bytes_refuse_live_overwrite(self):
        for mutation in ('version', 'index', 'art'):
            with self.subTest(mutation=mutation):
                fixture(self.live, 'old-stamp', '1' * 16)
                if mutation == 'version':
                    manifest(self.live, '3' * 16)
                else:
                    write(self.live, 'index.html' if mutation == 'index' else
                          'enterprise-assets/site/slide-0.jpg', 'changed')
                with self.assertRaises(release.InvalidRelease):
                    release.validate_baseline(self.live, self.receipt)

    def test_stale_or_unbound_or_mock_browser_evidence_is_rejected(self):
        for field, value in [('treeSha256', 'f' * 64), ('sourceCommit', 'f' * 40),
                             ('releaseStamp', 'old'), ('realProfile', False),
                             ('completedAt', '2020-01-01T00:00:00Z'), ('errors', ['error'])]:
            with self.subTest(field=field):
                result = evidence(self.receipt)
                result[field] = value
                with self.assertRaises(release.InvalidRelease):
                    release.validate_evidence(result, self.receipt, POLICY)
        result = evidence(self.receipt)
        result['views'][0]['explodedAndAssembled'] = False
        with self.assertRaisesRegex(release.InvalidRelease, 'decomposition'):
            release.validate_evidence(result, self.receipt, POLICY)
        for field in ('detailImages', 'quoteImages'):
            result = evidence(self.receipt)
            result['views'][0][field].pop()
            with self.subTest(field=field), self.assertRaises(release.InvalidRelease):
                release.validate_evidence(result, self.receipt, POLICY)

    def test_missing_worker_stamp_is_rejected(self):
        write(self.stage, 'sw.js', 'const RELEASE_VERSION = "old-stamp";')
        refresh_receipt(self.stage, self.receipt)
        with self.assertRaisesRegex(release.InvalidRelease, 'stamp missing'):
            self.valid()

    def test_safe_archive_and_rejection_before_extracting_any_member(self):
        variants = [('traversal', ['ok.txt', '../escape']), ('absolute', ['/escape']),
                    ('duplicate', ['same', './same']), ('link', ['link']),
                    ('nested_backup', ['backups/old/index.html']), ('encoded', ['%2e%2e/escape'])]
        for label, names in variants:
            archive = self.root / (label + '.tar')
            with tarfile.open(archive, 'w') as bundle:
                for name in names:
                    member = tarfile.TarInfo(name)
                    if label == 'link':
                        member.type, member.linkname = tarfile.SYMTYPE, '/etc/passwd'
                    else:
                        member.size = 1
                    bundle.addfile(member, None if label == 'link' else io.BytesIO(b'x'))
            target = self.root / ('extract-' + label)
            target.mkdir()
            with self.subTest(label=label), self.assertRaises(release.InvalidRelease):
                release.safe_extract(archive, target)
            self.assertEqual(list(target.iterdir()), [])

    def fake_runner(self):
        self.commands = []
        self.rebuilt = 0

        def runner(command):
            self.commands.append(command)
            if command[:3] == ['docker', 'ps', '-aq']:
                return 'web\ndb\n'
            if command[:2] == ['docker', 'inspect']:
                return '\n'.join(json.dumps(item) for item in [
                    {'id': 'web-' + str(self.rebuilt), 'startedAt': str(self.rebuilt), 'running': True,
                     'labels': {'com.docker.compose.project': 'lundu-eiscore', 'com.docker.compose.service': 'web'},
                     'mounts': [{'Source': str(self.live), 'Destination': '/usr/share/nginx/html', 'RW': False}],
                     'ports': {'80/tcp': [{'HostPort': '18393'}]}},
                    {'id': 'db', 'startedAt': 'unchanged', 'running': True, 'labels': {}, 'mounts': [], 'ports': {}}
                ])
            if 'up' in command:
                self.assertEqual(command[-5:], ['up', '-d', '--no-deps', '--force-recreate', 'web'])
                self.rebuilt += 1
            return ''
        return runner

    @staticmethod
    def fake_exchange(left, right):
        # Emulate the atomic primitive only inside this private temporary fixture.
        middle = left.parent / 'exchange-middle'
        left.rename(middle)
        right.rename(left)
        middle.rename(right)

    def test_check_only_checks_everything_but_never_rebuilds_or_switches(self):
        runner = self.fake_runner()
        calls = []
        result = release.publish_release(self.stage, self.root, self.receipt, POLICY, True, runner,
                                         exchange=lambda *_: self.fail('check-only exchanged directories'),
                                         http_check=lambda *args: calls.append(args[1]))
        self.assertEqual(result['mode'], 'check-only')
        self.assertEqual(self.rebuilt, 0)
        self.assertEqual(len(calls), 1)
        self.assertEqual(release.file_sha(self.live / 'index.html'), self.receipt['baseline']['indexSha256'])

    def test_publish_rebuilds_only_web_and_keeps_complete_backup(self):
        runner = self.fake_runner()
        result = release.publish_release(self.stage, self.root, self.receipt, POLICY, runner=runner,
                                         exchange=self.fake_exchange, http_check=lambda *_: None)
        self.assertEqual(self.rebuilt, 1)
        self.assertEqual(release.inventory(self.live), self.receipt['files'])
        self.assertTrue(Path(result['backup']).is_dir())
        self.assertTrue(result['otherContainersUnchanged'])

    def test_failed_http_verification_restores_old_bytes_and_rebuilds_only_web(self):
        runner = self.fake_runner()
        old = release.inventory(self.live)
        calls = []

        def http_check(_root, files, *_):
            calls.append(files)
            if files == self.receipt['files']:
                raise release.InvalidRelease('injected HTTP failure')

        with self.assertRaisesRegex(release.InvalidRelease, 'previous web release restored'):
            release.publish_release(self.stage, self.root, self.receipt, POLICY, runner=runner,
                                    exchange=self.fake_exchange, http_check=http_check)
        self.assertEqual(self.rebuilt, 2)
        self.assertEqual(release.inventory(self.live), old)
        self.assertEqual(len(calls), 3)

    def test_archive_digest_fails_before_docker_or_network(self):
        archive = self.root / 'candidate.tar'
        archive.write_bytes(b'not a tar')
        with patch.object(release.subprocess, 'run', side_effect=AssertionError('Docker executed')):
            with self.assertRaisesRegex(release.InvalidRelease, 'archive SHA-256 mismatch'):
                release.main(['--archive', str(archive), '--archive-sha256', '0' * 64,
                              '--evidence', 'unused', '--validate-only'])

    def test_validate_only_extracts_real_tar_without_docker_or_network(self):
        archive = self.root / 'candidate.tar'
        with tarfile.open(archive, 'w') as bundle:
            bundle.add(self.stage, arcname='.')
        save_json(self.root, 'policy.json', POLICY)
        save_json(self.root, 'evidence.json', evidence(self.receipt))
        output = io.StringIO()
        with patch.object(release.subprocess, 'run', side_effect=AssertionError('Docker executed')), \
                patch.object(release.urllib.request, 'build_opener', side_effect=AssertionError('network accessed')), \
                contextlib.redirect_stdout(output):
            release.main(['--archive', str(archive), '--archive-sha256', release.file_sha(archive),
                          '--evidence', str(self.root / 'evidence.json'), '--policy', str(self.root / 'policy.json'),
                          '--validate-only'])
        self.assertEqual(json.loads(output.getvalue())['liveChecks'], False)

    def test_non_web_restart_blocks_check_only_without_mutation(self):
        base_runner = self.fake_runner()
        inspections = 0

        def runner(command):
            nonlocal inspections
            output = base_runner(command)
            if command[:2] == ['docker', 'inspect']:
                inspections += 1
                if inspections > 1:
                    output = output.replace('unchanged', 'restarted')
            return output

        with self.assertRaisesRegex(release.InvalidRelease, 'container identities'):
            release.publish_release(self.stage, self.root, self.receipt, POLICY, True, runner,
                                    exchange=lambda *_: self.fail('check-only changed release'),
                                    http_check=lambda *_: None)
        self.assertEqual(self.rebuilt, 0)

    def test_compose_failure_rolls_back_and_reports_rollback_failure_distinctly(self):
        base_runner = self.fake_runner()

        def runner(command):
            if 'up' in command:
                raise release.InvalidRelease('injected compose failure')
            return base_runner(command)

        old = release.inventory(self.live)
        with self.assertRaisesRegex(release.InvalidRelease, 'ROLLBACK FAILED'):
            release.publish_release(self.stage, self.root, self.receipt, POLICY, runner=runner,
                                    exchange=self.fake_exchange, http_check=lambda *_: None)
        # Restoring the disk must happen even when Docker cannot restart web.
        self.assertEqual(release.inventory(self.live), old)
        self.assertTrue(list((self.root / 'backups').glob('web-failed-*')))


if __name__ == '__main__':
    unittest.main(verbosity=2)

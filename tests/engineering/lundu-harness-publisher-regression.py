"""Offline, fake-Docker checks; never connects to a deployment."""
import contextlib
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('publisher', Path(__file__).resolve().parents[2] / 'deploy/lundu/publish-business-harness.py')
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)
COMMIT = 'a' * 40
ORIGINAL_ID = '1' * 64


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / 'release').mkdir()
        (self.root / 'release/index.html').write_text('protected art and 3D', encoding='utf-8')
        (self.root / '.env').write_text('DEEPSEEK_API_KEY=provider-secret\nUNRELATED=do-not-copy\n', encoding='utf-8')
        self.package = self.root / 'candidate'
        self.package.mkdir()
        names = ['dsh-web-runner.mjs', 'dsh-web.patch.yml', 'dsh-web-defaults.mjs',
                 'business-web-ui.mjs', 'visual-response-policy.mjs', 'web-ui/business-ui.js',
                 'web-ui/business-ui.css', 'web-ui/visual-runtime.js', 'web-ui/visual-runtime.css',
                 'web-ui/vendor/echarts.min.js', 'web-ui/vendor/viz-standalone.js',
                 'web-ui/vendor/echarts.min.js.LICENSE.txt', 'web-ui/vendor/viz-standalone.js.LICENSE.txt',
                 'client-plugins/eiscore-auth/lib/index.js', 'client-plugins/digital-twin/lib/index.js',
                 'client-plugins/enterprise-bi/lib/index.js']
        files = []
        for name in names:
            path = self.package / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'reviewed')
            files.append({'path': name, 'sha256': hashlib.sha256(b'reviewed').hexdigest(), 'size': 8})
        (self.package / publisher.MANIFEST).write_text(json.dumps({'schemaVersion': 1, 'sourceCommit': COMMIT, 'files': files}), encoding='utf-8')
        self.original = {'Id': ORIGINAL_ID, 'Name': '/' + publisher.TARGET, 'Image': 'sha256:' + '2' * 64,
            'State': {'Running': True},
            'Config': {'Env': ['EXISTING=keep-secret'], 'Entrypoint': ['node'], 'Cmd': ['/opt/eiscore-harness/dsh-web-runner.mjs'], 'User': '10001:10001'},
            'HostConfig': {'ReadonlyRootfs': True, 'CapDrop': ['ALL'], 'SecurityOpt': ['no-new-privileges'], 'Tmpfs': {'/tmp': 'rw,noexec,nosuid,size=256m'}, 'Init': True},
            'Mounts': [{'Type': 'volume', 'Destination': '/var/lib/dsh', 'Name': 'original-dsh-home', 'RW': True},
                       {'Type': 'bind', 'Destination': '/opt/eiscore-harness', 'Source': '/old-package', 'RW': False},
                       {'Type': 'bind', 'Destination': '/opt/eiscore-harness/dsh-web.patch.yml', 'Source': '/old-patch', 'RW': False}],
            'NetworkSettings': {'Networks': {'original-business': {'IPAddress': '172.24.0.7', 'GlobalIPv6Address': '', 'Aliases': ['deepseek-web', publisher.TARGET]}}}}
        self.current = copy.deepcopy(self.original)
        self.switches = []
        self.commands = []
        self.failure = None
        self.others = 'protected-web\t' + '4' * 64
        self.addCleanup(patch.stopall)
        patch.object(publisher, 'ROOT', self.root).start()
        patch.object(publisher, 'publication_lock', contextlib.nullcontext).start()
        patch.object(publisher, 'command', self.docker).start()

    def docker(self, args, text_input=None, timeout=90):
        self.commands.append(args)
        if args[:2] == ['docker', 'inspect']:
            return json.dumps([self.current])
        if args[:2] == ['docker', 'ps']:
            return self.others + '\n' + publisher.TARGET + '\t' + self.current['Id']
        if args[:2] == ['docker', 'exec']:
            return ''
        if 'config' in args:
            value = json.loads(text_input)
            self.assertEqual(set(value['services']), {'deepseek-web'})
            return ''
        self.assertEqual(args[-5:], ['up', '-d', '--no-deps', '--force-recreate', 'deepseek-web'])
        filename = Path(args[args.index('-f') + 1])
        self.switches.append(filename)
        if os.name != 'nt':
            self.assertEqual(os.stat(filename).st_mode & 0o777, 0o600)
        self.current = copy.deepcopy(self.original)
        self.current['Id'] = ('3' if 'candidate' in filename.name else '5') * 64
        if self.failure and len(self.switches) == 1:
            self.failure()
        return ''

    def publish(self, **kwargs):
        return publisher.publish(self.package, ORIGINAL_ID, COMMIT, **kwargs)

    def refresh_manifest(self):
        files = []
        for path in sorted(self.package.rglob('*')):
            if path.is_file() and path.name != publisher.MANIFEST:
                content = path.read_bytes()
                files.append({'path': path.relative_to(self.package).as_posix(),
                              'sha256': hashlib.sha256(content).hexdigest(), 'size': len(content)})
        (self.package / publisher.MANIFEST).write_text(json.dumps({
            'schemaVersion': 1, 'sourceCommit': COMMIT, 'files': files}), encoding='utf-8')

    def write_patch(self, source):
        (self.package / 'dsh-web.patch.yml').write_text(source, encoding='utf-8')
        self.refresh_manifest()

    def test_check_only_and_clone_configuration(self):
        result = self.publish(check_only=True)
        self.assertTrue(result['pass'])
        self.assertFalse(self.switches)
        config = publisher.compose_definition(self.original, self.package)
        service = config['services']['deepseek-web']
        self.assertEqual(service['image'], self.original['Image'])
        self.assertEqual(service['cap_drop'], ['ALL'])
        self.assertEqual(service['tmpfs'], ['/tmp:rw,noexec,nosuid,size=256m'])
        self.assertEqual(service['networks']['network_0']['ipv4_address'], '172.24.0.7')
        self.assertTrue(all(value['external'] for value in config['networks'].values()))
        self.assertEqual(config['volumes']['volume_0']['name'], 'original-dsh-home')
        self.assertEqual(len(service['volumes']), 2)
        self.assertEqual(service['environment']['EXISTING'], 'keep-secret')
        self.assertEqual(service['environment']['DEEPSEEK_API_KEY'], 'provider-secret')
        self.assertNotIn('UNRELATED', service['environment'])
        self.assertNotIn('provider-secret', json.dumps(result))

    def test_success_rebuilds_only_target(self):
        result = self.publish()
        self.assertTrue(result['pass'])
        self.assertEqual(result['rebuiltServices'], ['deepseek-web'])
        self.assertEqual(len(self.switches), 1)
        self.assertEqual((self.root / 'release/index.html').read_text(), 'protected art and 3D')

    def test_compose_preserves_literal_dollars(self):
        self.assertEqual(publisher.compose_literals({'environment': {'KEY': '$one${TWO}$$'}}),
                         {'environment': {'KEY': '$$one$${TWO}$$$$'}})

    @unittest.skipUnless(shutil.which('node'), 'native readiness probe needs Node')
    def test_real_readiness_program_accepts_native_401_and_rejects_html(self):
        for status, body, expected in [(401, '{"authenticated":false}', 0),
                (200, '{"authenticated":false}', 0), (200, '{"authenticated":true}', 0),
                (200, '<html>fallback</html>', 1), (401, '{"authenticated":true}', 1),
                (502, '{"authenticated":false}', 1)]:
            script = ("const vm=require('node:vm'),{EventEmitter}=require('node:events');"
                      "const req=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>{};"
                      "const http={get(_url,_options,callback){setImmediate(()=>{const incoming=new EventEmitter();"
                      f"incoming.statusCode={status};callback(incoming);incoming.emit('data',{json.dumps(body)});"
                      "incoming.emit('end');});return req;}};"
                      f"vm.runInNewContext({json.dumps(publisher.READINESS_PROGRAM)},{{require:()=>http,process}});")
            self.assertEqual(subprocess.run(['node', '-e', script], capture_output=True, timeout=5).returncode, expected)

    def test_changed_expected_id_rejects_without_rebuilding(self):
        self.current['Id'] = '9' * 64
        with self.assertRaisesRegex(publisher.Rejected, 'container changed'):
            self.publish()
        self.assertFalse(self.switches)

    def test_release_drift_rolls_back_only_target(self):
        self.failure = lambda: (self.root / 'release/index.html').write_text('external drift')
        with self.assertRaisesRegex(publisher.Rejected, 'only business Harness rolled back'):
            self.publish()
        self.assertEqual([path.name for path in self.switches], ['candidate-compose.json', 'before-compose.json'])
        self.assertEqual((self.root / 'release/index.html').read_text(), 'external drift')

    def test_other_container_change_rolls_back(self):
        def alter():
            self.others = 'protected-web\t' + '8' * 64
        self.failure = alter
        with self.assertRaisesRegex(publisher.Rejected, 'only business Harness rolled back'):
            self.publish()
        self.assertEqual(len(self.switches), 2)

    def test_manifest_drift_rejects(self):
        (self.package / 'dsh-web-runner.mjs').write_bytes(b'tampered')
        with self.assertRaisesRegex(publisher.Rejected, 'checksum mismatch'):
            self.publish(check_only=True)
        self.assertFalse(self.commands)

    def test_accurate_but_incomplete_manifest_rejects(self):
        filename = 'web-ui/vendor/viz-standalone.js'
        (self.package / filename).unlink()
        path = self.package / publisher.MANIFEST
        manifest = json.loads(path.read_text())
        manifest['files'] = [entry for entry in manifest['files'] if entry['path'] != filename]
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(publisher.Rejected, 'runtime files missing'):
            self.publish(check_only=True)
        self.assertFalse(self.commands)

    def test_patch_references_existing_package_modules(self):
        self.write_patch("- insert:\n"
                         "    - name: '/opt/eiscore-harness/visual-response-policy.mjs'\n"
                         '    - name: "/opt/eiscore-harness/business-web-ui.mjs" # reviewed\n'
                         '    - name: /opt/eiscore-harness/dsh-web-defaults.mjs\n')
        self.assertTrue(self.publish(check_only=True)['pass'])

    def test_accurate_manifest_with_missing_patch_module_rejects(self):
        self.write_patch("- insert:\n    - name: '/opt/eiscore-harness/missing-plugin.mjs'\n")
        with self.assertRaisesRegex(publisher.Rejected, 'patch module missing from package'):
            self.publish(check_only=True)
        self.assertFalse(self.commands)

    def test_noncanonical_patch_module_paths_reject(self):
        for module in ['/opt/eiscore-harness', '/opt/eiscore-harness-other/plugin.mjs',
                       '/opt/eiscore-harness/../visual-response-policy.mjs',
                       '/opt/eiscore-harness/./visual-response-policy.mjs',
                       '/opt/eiscore-harness//visual-response-policy.mjs',
                       '/opt/eiscore-harness/web-ui\\visual-runtime.js',
                       '/opt/eiscore-harness/%2e%2e/visual-response-policy.mjs',
                       '/opt/eiscore-harness/visual-response-policy.mjs?ignored',
                       '/opt/eiscore-harness/visual-response-policy.mjs#ignored']:
            with self.subTest(module=module):
                self.write_patch(f"- insert:\n    - name: '{module}'\n")
                with self.assertRaisesRegex(publisher.Rejected, 'unsafe patch module path'):
                    self.publish(check_only=True)
                self.assertFalse(self.commands)

    def test_missing_vendor_licenses_reject_with_accurate_manifest(self):
        for filename in ['web-ui/vendor/echarts.min.js.LICENSE.txt',
                         'web-ui/vendor/viz-standalone.js.LICENSE.txt']:
            with self.subTest(filename=filename):
                path = self.package / filename
                original = path.read_bytes()
                path.unlink()
                self.refresh_manifest()
                with self.assertRaisesRegex(publisher.Rejected, 'runtime files missing'):
                    self.publish(check_only=True)
                self.assertFalse(self.commands)
                path.write_bytes(original)
                self.refresh_manifest()

    @unittest.skipIf(os.name == 'nt', 'Windows symlink privileges vary; Linux deployment enforces links')
    def test_only_immutable_node_modules_link_allowed(self):
        (self.package / 'node_modules').symlink_to('/opt/bridge/node_modules')
        self.assertTrue(self.publish(check_only=True)['pass'])
        (self.package / 'escape').symlink_to('/etc')
        with self.assertRaisesRegex(publisher.Rejected, 'unapproved symlink'):
            self.publish(check_only=True)


if __name__ == '__main__':
    unittest.main()

# -*- coding: utf-8 -*-
"""Offline contracts. Run: python -m unittest discover -s tools/tests -p test_nai*.py"""
import datetime
import json
import os
import socket
import stat
import subprocess
import sys
import tempfile
import time
import types
import unittest
import zipfile
import requests
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import nai_gen
import nai_guard
from nai_guard import GuardError, RequestGuard

EPOCH = 1_790_928_000


class FakeClock:
    def __init__(self, now=EPOCH):
        self.now = now
        self.waits = []

    def time(self):
        return self.now

    def sleep(self, seconds):
        self.waits.append(seconds)
        self.now += seconds


def make_guard(directory, clock, **options):
    return RequestGuard(directory, clock=clock.time, sleep=clock.sleep, **options)


def guard_worker(directory, result_file, scenario):
    # Independent interpreters, file barrier/results: no Windows named pipes,
    # transport subprocess/socket or token reader required by these contracts.
    clock = FakeClock()
    with patch.object(socket, 'socket', side_effect=AssertionError('network forbidden')):
        deadline = time.monotonic() + 10
        while not (Path(directory) / 'ready').exists():
            if time.monotonic() > deadline:
                raise RuntimeError('offline worker barrier timed out')
            time.sleep(0.01)
        try:
            dimensions = (2048, 1152) if scenario == 'quota' else (832, 1216)
            request = (lambda: os._exit(23)) if scenario == 'crash' else (lambda: '200')
            make_guard(directory, clock).perform(*dimensions, request)
            result = {'status': 'sent', 'at': clock.time()}
        except GuardError:
            result = {'status': 'blocked', 'at': clock.time()}
        Path(result_file).write_text(json.dumps(result), encoding='utf-8')


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='nai-offline-')
        self.directory = Path(self.temporary.name)
        self.clock = FakeClock()
        self.guard = make_guard(self.directory, self.clock)
        self.network = patch.object(socket, 'socket', side_effect=AssertionError('network forbidden'))
        self.network.start()
        self.credentials = patch.object(nai_gen, 'load_token', side_effect=AssertionError('token reader forbidden'))
        self.credentials.start()
        self.process = patch.object(nai_gen.subprocess, 'run', side_effect=AssertionError('real transport forbidden'))
        self.process.start()
        # The production PIL verification is unchanged. Mock its contract so
        # these guard/transport tests require only Python's standard library.
        self.image = MagicMock()
        self.image.size = (832, 1216)
        self.image.__enter__.return_value = self.image
        self.pillow = patch.dict(sys.modules, {'PIL': types.SimpleNamespace(
            Image=types.SimpleNamespace(open=MagicMock(return_value=self.image)))})
        self.pillow.start()

    def tearDown(self):
        self.pillow.stop()
        self.process.stop()
        self.credentials.stop()
        self.network.stop()
        self.temporary.cleanup()

    def test_rate_survives_new_process_instance_and_fractional_clock(self):
        self.clock.now += 0.25
        starts = []
        self.guard.perform(832, 1216, lambda: starts.append(self.clock.time()) or '200')
        make_guard(self.directory, self.clock).perform(
            832, 1216, lambda: starts.append(self.clock.time()) or '201')
        self.assertGreaterEqual(starts[1] - starts[0], 45)
        self.assertEqual(len(self.clock.waits), 2)
        self.assertFalse(self.guard.usage_file.exists())

    def test_delayed_reservation_save_cannot_shorten_dispatch_interval(self):
        starts = []
        save = nai_guard._save

        def delayed_save(path, value):
            save(path, value)
            if path == self.guard.rate_file and value['request_pending'] and not starts:
                self.clock.now += 10

        def request():
            starts.append(self.clock.time())
            self.clock.now += 2
            return '200'

        with patch('nai_guard._save', side_effect=delayed_save):
            self.guard.perform(832, 1216, request)
            make_guard(self.directory, self.clock).perform(832, 1216, request)
        self.assertEqual(starts, [EPOCH + 10, EPOCH + 57])
        self.assertGreaterEqual(starts[1] - starts[0], 45)

    def test_completion_clock_failure_leaves_fail_closed_pending_state(self):
        self.guard.clock = MagicMock(side_effect=[EPOCH, RuntimeError('offline clock failure')])
        request = MagicMock(return_value='200')
        with self.assertRaisesRegex(RuntimeError, 'clock failure'):
            self.guard.perform(832, 1216, request)
        request.assert_called_once_with()
        self.assertTrue(json.loads(self.guard.rate_file.read_text(encoding='utf-8'))['request_pending'])
        with self.assertRaisesRegex(GuardError, 'interrupted'):
            make_guard(self.directory, self.clock).perform(
                832, 1216, lambda: self.fail('failed completion clock sent another request'))

    @unittest.skipIf(os.name == 'nt', 'POSIX directory fsync contract')
    def test_posix_file_and_directory_fsync_precede_dispatch_and_finalize_response(self):
        synced = []
        fsync = os.fsync

        def observe_fsync(descriptor):
            mode = os.fstat(descriptor).st_mode
            synced.append('directory' if stat.S_ISDIR(mode) else 'file')
            self.assertTrue(stat.S_ISDIR(mode) or stat.S_ISREG(mode))
            return fsync(descriptor)

        def request():
            self.assertEqual(synced, ['file', 'directory'] * 2)
            return '200'

        with patch('nai_guard.os.fsync', side_effect=observe_fsync):
            self.guard.perform(2048, 1152, request)
        self.assertEqual(synced, ['file', 'directory'] * 3)

    def test_shared_429_blocks_new_instance_without_sending_or_charging(self):
        self.assertEqual(self.guard.perform(2048, 1152, lambda: '429'), '429')
        before = self.guard.usage_file.read_bytes()
        for clock in (self.clock, FakeClock(EPOCH + 899)):
            with self.assertRaisesRegex(GuardError, 'cooldown'):
                make_guard(self.directory, clock).perform(
                    2048, 1152, lambda: self.fail('cooldown sent request'))
        self.assertEqual(before, self.guard.usage_file.read_bytes())
        self.clock.now += 900
        self.assertEqual(make_guard(self.directory, self.clock).perform(832, 1216, lambda: '200'), '200')

    def test_invalid_quota_blocks_even_small_image(self):
        day = datetime.datetime.fromtimestamp(EPOCH).date().isoformat()
        values = ['{broken', 'null', '[]', json.dumps({'bad-day': 0})]
        values += [json.dumps({day: count}) for count in (-1, 1.2, '1', True, None)]
        for value in values:
            with self.subTest(value=value):
                self.guard.usage_file.write_text(value, encoding='utf-8')
                with self.assertRaises(GuardError):
                    self.guard.perform(832, 1216, lambda: self.fail('invalid quota sent request'))
                self.assertEqual(self.guard.usage_file.read_text(encoding='utf-8'), value)

    def test_invalid_rate_blocks_request_and_does_not_charge(self):
        values = ['{broken', 'null', '{}', '[]']
        values += [json.dumps({'next_request_at': bad, 'cooldown_until': 0, 'request_pending': False})
                   for bad in (-1, 1.2, '1', True, None)]
        values += [json.dumps({'next_request_at': 0, 'cooldown_until': bad, 'request_pending': False})
                   for bad in (-1, 1.2, '1', True, None)]
        for value in values:
            with self.subTest(value=value):
                self.guard.rate_file.write_text(value, encoding='utf-8')
                with self.assertRaises(GuardError):
                    self.guard.perform(2048, 1152, lambda: self.fail('invalid rate sent request'))
                self.assertFalse(self.guard.usage_file.exists())

    def test_multiprocess_remaining_quota_only_allows_two(self):
        day = datetime.datetime.fromtimestamp(EPOCH).date().isoformat()
        self.guard.usage_file.write_text(json.dumps({day: 18}), encoding='utf-8')
        results = self.run_workers('quota', 6)
        self.assertEqual([r['status'] for r in results].count('sent'), 2)
        self.assertEqual([r['status'] for r in results].count('blocked'), 4)
        starts = sorted(r['at'] for r in results if r['status'] == 'sent')
        self.assertGreaterEqual(starts[1] - starts[0], 45)
        self.assertEqual(json.loads(self.guard.usage_file.read_text(encoding='utf-8'))[day], 20)

    def run_workers(self, scenario, count):
        files = [self.directory / ('worker-{}.json'.format(index)) for index in range(count)]
        workers = [subprocess.Popen([sys.executable, '-B', str(Path(__file__).resolve()),
                    '--offline-worker', str(self.directory), str(result), scenario],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE) for result in files]
        (self.directory / 'ready').write_text('ready', encoding='utf-8')
        for worker in workers:
            stdout, stderr = worker.communicate(timeout=30)
            self.assertEqual(worker.returncode, 0, (stdout, stderr))
        return [json.loads(result.read_text(encoding='utf-8')) for result in files]

    def test_rate_and_429_are_enforced_in_independent_interpreters(self):
        self.guard.perform(832, 1216, lambda: '200')
        results = self.run_workers('small', 2)
        self.assertEqual(sorted(r['at'] for r in results), [EPOCH + 45, EPOCH + 90])
        # Fresh interpreters begin with the old simulated epoch. A persisted
        # response cooldown must stop them before transport, even after restart.
        self.clock.now += 135
        self.guard.perform(832, 1216, lambda: '429')
        results = self.run_workers('small', 2)
        self.assertEqual([r['status'] for r in results], ['blocked', 'blocked'])

    def test_failed_transport_keeps_reservations(self):
        with self.assertRaisesRegex(RuntimeError, 'offline failure'):
            self.guard.perform(2048, 1152, lambda: (_ for _ in ()).throw(RuntimeError('offline failure')))
        day = datetime.datetime.fromtimestamp(EPOCH).date().isoformat()
        self.assertEqual(json.loads(self.guard.usage_file.read_text(encoding='utf-8'))[day], 1)
        with self.assertRaisesRegex(GuardError, 'interrupted'):
            make_guard(self.directory, self.clock).perform(
                832, 1216, lambda: self.fail('unknown transport result sent request'))

    def test_response_save_failure_including_429_leaves_fail_closed_pending_state(self):
        replace = os.replace
        calls = []

        def fail_response_save(source, destination):
            calls.append(destination)
            if len(calls) == 2:
                raise OSError('offline response save failure')
            return replace(source, destination)

        with patch('nai_guard.os.replace', side_effect=fail_response_save):
            with self.assertRaisesRegex(OSError, 'response save failure'):
                self.guard.perform(832, 1216, lambda: '429')
        with self.assertRaisesRegex(GuardError, 'interrupted'):
            make_guard(self.directory, FakeClock(EPOCH + 1000)).perform(
                832, 1216, lambda: self.fail('unsaved 429 sent request'))

    def test_process_exit_releases_lock_but_keeps_fail_closed_pending_state(self):
        (self.directory / 'ready').write_text('ready', encoding='utf-8')
        worker = subprocess.Popen([sys.executable, '-B', str(Path(__file__).resolve()),
            '--offline-worker', str(self.directory), str(self.directory / 'unused.json'), 'crash'])
        self.assertEqual(worker.wait(timeout=30), 23)
        with self.assertRaisesRegex(GuardError, 'interrupted'):
            make_guard(self.directory, self.clock).perform(
                832, 1216, lambda: self.fail('crashed request sent another request'))

    def test_atomic_replace_failure_does_not_send_or_reset_existing_quota(self):
        day = datetime.datetime.fromtimestamp(EPOCH).date().isoformat()
        before = json.dumps({day: 3})
        self.guard.usage_file.write_text(before, encoding='utf-8')
        with patch('nai_guard.os.replace', side_effect=OSError('save failed')):
            with self.assertRaises(OSError):
                self.guard.perform(2048, 1152, lambda: self.fail('unsaved reservation sent request'))
        self.assertEqual(self.guard.usage_file.read_text(encoding='utf-8'), before)

    def test_dimensions_reject_bool_negative_and_fraction(self):
        for width in (True, -1, 0, 1.5):
            with self.subTest(width=width), self.assertRaises(GuardError):
                self.guard.perform(width, 1216, lambda: self.fail('invalid dimensions sent request'))

    def test_real_transport_uses_literal_argv_without_shell(self):
        token = 'offline-fake-" & echo should-never-run'
        payload = self.directory / 'payload with spaces & chars.json'
        output = self.directory / 'zip with spaces.zip'
        with patch.object(nai_gen.subprocess, 'run') as run:
            run.return_value.stdout = '200'
            self.assertEqual(nai_gen._curl_request(payload, output, token, ['--noproxy', '*']), '200')
        arguments = run.call_args[0][0]
        self.assertIsInstance(arguments, list)
        self.assertFalse(run.call_args[1]['shell'])
        self.assertIn('Authorization: Bearer ' + token, arguments)
        self.assertIn('@' + str(payload), arguments)

    def test_python_transport_uses_direct_and_explicit_proxy_without_environment(self):
        payload = self.directory / 'payload.json'
        output = self.directory / 'response.zip'
        payload.write_bytes(b'{"test":true}')
        with patch('requests.Session') as make_session:
            session = make_session.return_value.__enter__.return_value
            session.post.return_value.status_code = 200
            session.post.return_value.content = b'archive bytes'
            status = nai_gen._requests_request(payload, output, 'offline-token', ['--noproxy', '*'])
            self.assertEqual(status, '200')
            self.assertFalse(session.trust_env)
            self.assertEqual(output.read_bytes(), b'archive bytes')
            self.assertNotIn('proxies', session.post.call_args.kwargs)
            self.assertEqual(session.post.call_args.kwargs['data'], b'{"test":true}')
            self.assertEqual(session.post.call_args.kwargs['headers']['Authorization'],
                             'Bearer offline-token')

        with patch('requests.Session') as make_session:
            session = make_session.return_value.__enter__.return_value
            session.post.return_value.status_code = 201
            session.post.return_value.content = b'proxy archive'
            status = nai_gen._requests_request(
                payload, output, 'offline-token', ['-x', 'http://127.0.0.1:12450'])
            self.assertEqual(status, '201')
            self.assertEqual(session.post.call_args.kwargs['proxies'],
                             {'https': 'http://127.0.0.1:12450'})

    def test_generate_offline_retry_paces_and_charges_each_attempt(self):
        image_bytes = b'offline fake image bytes'
        self.image.size = (2048, 1152)
        calls = []

        def fake_transport(payload, archive, token, channel):
            self.assertEqual(token, 'offline-fake-token')
            calls.append((self.clock.time(), channel))
            if len(calls) == 1:
                return '000'
            with zipfile.ZipFile(archive, 'w') as zipped:
                zipped.writestr('image.png', image_bytes)
            return '200'

        with patch.dict(os.environ, {'HTTPS_PROXY': 'http://127.0.0.1:12450'}):
            output, seed = nai_gen.generate_image('test', width=2048, height=1152, seed=42,
                out=self.directory / 'offline & output.png', guard=self.guard,
                transport=fake_transport, token='offline-fake-token')
        self.assertTrue(Path(output).is_file())
        self.assertEqual(Path(output).read_bytes(), image_bytes)
        self.image.verify.assert_called_once()
        self.assertEqual(seed, 42)
        self.assertEqual(calls, [(EPOCH, ['--noproxy', '*']),
                                 (EPOCH + 45, ['-x', 'http://127.0.0.1:12450'])])
        day = datetime.datetime.fromtimestamp(EPOCH).date().isoformat()
        self.assertEqual(json.loads(self.guard.usage_file.read_text(encoding='utf-8'))[day], 2)
        self.assertEqual(nai_gen.MODEL, 'nai-diffusion-5-full')

    def test_generate_429_saves_cooldown_and_restart_never_calls_transport(self):
        out = self.directory / 'offline.png'
        with self.assertRaisesRegex(SystemExit, '429'):
            nai_gen.generate_image('test', out=out, seed=42, guard=self.guard,
                transport=lambda *args: '429', token='offline-fake-token')
        with self.assertRaisesRegex(SystemExit, 'cooldown'):
            nai_gen.generate_image('test', out=out, seed=42, guard=make_guard(self.directory, self.clock),
                transport=lambda *args: self.fail('429 retry sent request'), token='offline-fake-token')

    def test_concurrent_same_output_keeps_mixed_dimensions_and_archives_private(self):
        output = self.directory / 'same-output.png'
        old_payload = output.with_suffix('.payload.json')
        old_archive = output.with_suffix('.zip')
        old_payload.write_bytes(b'existing payload')
        old_archive.write_bytes(b'existing archive')
        barrier = Barrier(2)
        paths = []
        images = []

        def image_open(path):
            dimensions = json.loads(Path(path).read_text(encoding='utf-8'))['dimensions']
            image = MagicMock()
            image.size = tuple(dimensions)
            image.__enter__.return_value = image
            images.append(image)
            return image

        def generate(dimensions, seed):
            guard = make_guard(self.directory, FakeClock())

            class SynchronizedGuard:
                def perform(self, width, height, request):
                    # Both payloads exist before either dispatches. Shared paths
                    # deterministically replace one caller's dimensions here.
                    barrier.wait(timeout=10)
                    return guard.perform(width, height, request)

            def transport(payload, archive, token, channel):
                body = json.loads(payload.read_text(encoding='utf-8'))
                self.assertEqual((body['parameters']['width'], body['parameters']['height']), dimensions)
                self.assertEqual(body['parameters']['seed'], seed)
                paths.append((payload, archive))
                image = json.dumps({'dimensions': dimensions, 'seed': seed}).encode('utf-8')
                with zipfile.ZipFile(archive, 'w') as zipped:
                    zipped.writestr('image.png', image)
                return '200'

            return nai_gen.generate_image('test', width=dimensions[0], height=dimensions[1], seed=seed,
                out=output, guard=SynchronizedGuard(), transport=transport, token='offline-fake-token')

        with patch.object(sys.modules['PIL'].Image, 'open', side_effect=image_open):
            with ThreadPoolExecutor(max_workers=2) as workers:
                futures = [workers.submit(generate, dimensions, seed) for dimensions, seed in
                           (((832, 1216), 42), ((2048, 1152), 43))]
                results = [future.result(timeout=20) for future in futures]
        self.assertEqual(results, [(str(output), 42), (str(output), 43)])
        self.assertEqual(len(paths), 2)
        self.assertNotEqual(paths[0][0], paths[1][0])
        self.assertNotEqual(paths[0][1], paths[1][1])
        self.assertTrue(all(not path.exists() for pair in paths for path in pair))
        self.assertEqual(list(self.directory.glob('same-output.nai-*')), [])
        self.assertEqual(old_payload.read_bytes(), b'existing payload')
        self.assertEqual(old_archive.read_bytes(), b'existing archive')
        day = datetime.datetime.fromtimestamp(EPOCH).date().isoformat()
        self.assertEqual(json.loads(self.guard.usage_file.read_text(encoding='utf-8'))[day], 1)
        self.assertIn(json.loads(output.read_text(encoding='utf-8'))['seed'], (42, 43))
        for image in images:
            image.verify.assert_called_once_with()


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--offline-worker':
        guard_worker(*sys.argv[2:])
    else:
        unittest.main()

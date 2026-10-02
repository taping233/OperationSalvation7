# -*- coding: utf-8 -*-
"""Persistent, fail-closed request reservations; no credentials or network code."""
import datetime
import json
import math
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path


class GuardError(RuntimeError):
    """A request must not be sent until the guard condition is resolved."""


@contextmanager
def _process_lock(path):
    # Kernel locks are released on process exit. Keep the file: unlinking a lock
    # file would let another process lock a different inode for the same state.
    if path.is_symlink():
        raise GuardError('NAI guard lock must not be a symbolic link')
    with path.open('a+b') as handle:
        if handle.tell() == 0:
            handle.write(b'\0')
            handle.flush()
        if os.name == 'nt':
            import msvcrt
            while True:
                handle.seek(0)
                try:
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError as error:
                    if error.errno not in (13, 11, 36):
                        raise
                    time.sleep(0.05)
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)


def _load(path, default):
    if path.is_symlink():
        raise GuardError('NAI guard state must not be a symbolic link: ' + path.name)
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return default
    except (OSError, ValueError) as error:
        raise GuardError('NAI guard state unreadable/corrupt: ' + path.name) from error


def _save(path, value):
    # Same-directory replace is atomic on Windows and POSIX. A crash before
    # replace leaves the previous valid state and an unused temporary file.
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                     prefix=path.name + '.', suffix='.tmp',
                                     dir=str(path.parent), delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.flush()
        os.fsync(handle.fileno())
        temporary = handle.name
    os.replace(temporary, str(path))
    if os.name != 'nt':
        directory = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)


def _validate_usage(usage):
    if not isinstance(usage, dict):
        raise GuardError('NAI quota state must be a date/count object')
    for day, count in usage.items():
        try:
            if datetime.date.fromisoformat(day).isoformat() != day:
                raise ValueError('noncanonical day')
        except (TypeError, ValueError) as error:
            raise GuardError('NAI quota state has an invalid day') from error
        if type(count) is not int or count < 0:
            raise GuardError('NAI quota count must be a nonnegative integer')


def _validate_rate(rate):
    if not isinstance(rate, dict) or set(rate) != {'next_request_at', 'cooldown_until', 'request_pending'}:
        raise GuardError('NAI rate state has an invalid schema')
    if type(rate['request_pending']) is not bool:
        raise GuardError('NAI pending request state must be boolean')
    for value in (rate['next_request_at'], rate['cooldown_until']):
        if type(value) is not int or value < 0:
            raise GuardError('NAI rate timestamps must be nonnegative integer seconds')


class RequestGuard:
    def __init__(self, state_dir, free_px_cap=1_080_000, quota=20,
                 interval=45, cooldown=900, clock=time.time, sleep=time.sleep):
        self.state_dir = Path(state_dir)
        self.usage_file = self.state_dir / 'large-usage.json'
        self.rate_file = self.state_dir / 'request-rate.json'
        self.free_px_cap = free_px_cap
        self.quota = quota
        self.interval = interval
        self.cooldown = cooldown
        self.clock = clock
        self.sleep = sleep

    def perform(self, width, height, request):
        """Reserve before sending, including failed requests and channel retries.

        Hold the lock through the transport so a 429 is persisted before any
        waiting process can send. Cooldown fails promptly; ordinary pacing waits.
        Pace from completion, conservatively covering pre-dispatch save delays.
        Reservations survive interruption and are never refunded speculatively.
        """
        if type(width) is not int or type(height) is not int or min(width, height) <= 0:
            raise GuardError('NAI dimensions must be positive integers')
        self.state_dir.mkdir(parents=True, exist_ok=True)
        with _process_lock(self.state_dir / 'request.lock'):
            usage = _load(self.usage_file, {})
            rate = _load(self.rate_file, {'next_request_at': 0, 'cooldown_until': 0,
                                          'request_pending': False})
            _validate_usage(usage)
            _validate_rate(rate)
            if rate['request_pending']:
                raise GuardError('NAI previous request interrupted/response not saved; '
                                 'stop and reconcile request-rate.json before retrying')
            now = self.clock()
            if rate['cooldown_until'] > now:
                raise GuardError('NAI HTTP 429 shared cooldown: retry in {} seconds'.format(
                    math.ceil(rate['cooldown_until'] - now)))
            while rate['next_request_at'] > now:
                self.sleep(min(rate['next_request_at'] - now, 45))
                now = self.clock()
            today = datetime.datetime.fromtimestamp(now).date().isoformat()
            if width * height > self.free_px_cap:
                used = usage.get(today, 0)
                if used >= self.quota:
                    raise GuardError('NAI 大图日限额：今日 {} 张已用完（{}）'.format(self.quota, used))
                usage[today] = used + 1
                _save(self.usage_file, usage)
            rate['next_request_at'] = math.ceil(now + self.interval)
            # Persist uncertainty before dispatch. If a process dies or response
            # state cannot be saved (including 429), future requests fail closed.
            rate['request_pending'] = True
            _save(self.rate_file, rate)
            status = request()
            # The earlier reservation timestamp precedes fsync and dispatch.
            # Completion is a provable later boundary, so even a slow save or
            # descheduled process cannot shorten the actual request interval.
            # Leave the durable pending marker intact if the clock fails.
            completed_at = self.clock()
            rate['next_request_at'] = max(rate['next_request_at'],
                                          math.ceil(completed_at + self.interval))
            if str(status) == '429':
                rate['cooldown_until'] = math.ceil(completed_at + self.cooldown)
            rate['request_pending'] = False
            _save(self.rate_file, rate)
            return status

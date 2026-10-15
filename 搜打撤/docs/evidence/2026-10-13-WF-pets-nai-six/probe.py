"""Probe NAI authentication with an invalid, non-generation body; never print credentials."""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).absolute().parents[3] / 'tools'))
from nai_gen import ENDPOINT, load_token

token = load_token()
result = subprocess.run(['curl', '-sS', '--ssl-no-revoke', '--max-time', '20',
    '-H', 'Authorization: Bearer ' + token, '-H', 'Content-Type: application/json',
    '-o', 'NUL', '-w', 'http=%{http_code} connect=%{http_connect}',
    '--data-binary', '{}', ENDPOINT], shell=False, capture_output=True, text=True)
print(json.dumps({'curlExitCode': result.returncode, 'status': result.stdout.strip(),
                  'error': result.stderr.replace(token, '[REDACTED]').strip()[-500:]}))

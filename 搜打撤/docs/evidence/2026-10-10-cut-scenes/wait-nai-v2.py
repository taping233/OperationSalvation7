import json
import os
import runpy
import time
from pathlib import Path

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
rate_path = root.parent / '.tmp/nai/request-rate.json'
print('WAIT_PID ' + str(os.getpid()), flush=True)
while True:
    rate = json.loads(rate_path.read_text(encoding='utf-8'))
    remaining = rate['cooldown_until'] - time.time()
    if remaining <= 0:
        break
    print('COOLDOWN_SECONDS ' + str(int(remaining)), flush=True)
    time.sleep(min(60, remaining + 1))
runpy.run_path(str(evidence / 'generate-nai-v2.py'), run_name='__main__')

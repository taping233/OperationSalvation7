"""Record this iteration's observed cost without exposing transcript content."""
import datetime
import json
import os
from pathlib import Path

source = next((Path(os.environ['USERPROFILE']) / '.codex/sessions/2026/10/05').glob(
    '*01a109e9-983c-7183-9a4d-9ccefb9df5a3*'))
start = None
events = []
for line in source.open(encoding='utf-8'):
    event = json.loads(line)
    payload = event.get('payload', {})
    item = payload.get('item', {})
    if event['type'] == 'event_msg' and payload.get('type') == 'item_completed' and item.get('type') == 'UserMessage':
        message = ' '.join(part.get('text', '') for part in item.get('content', []) if part.get('type') == 'text')
        if message.strip() == '继续测试，把整套开发流程和记忆都慢慢迭代，提高效率':
            start = event['timestamp']
            events = []
    if start:
        events.append(event)
if not start:
    raise RuntimeError('request marker missing')
usage = [event['payload']['usage'] for event in events if event['type'] == 'token_usage_record']
calls = [event for event in events if event['type'] == 'response_item' and event['payload'].get('type') in
         ['function_call', 'custom_tool_call']]
now = datetime.datetime.now(datetime.timezone.utc)
trace = {'requestReceived': start, 'observedAt': now.isoformat(),
         'elapsedSoFarSeconds': round((now - datetime.datetime.fromisoformat(start.replace('Z', '+00:00'))).total_seconds(), 2),
         'recordedModelResponses': len(usage), 'recordedTopLevelToolCalls': len(calls),
         'inputTokenRange': [min(item['input_tokens'] for item in usage), max(item['input_tokens'] for item in usage)],
         'reasoningOutputTokens': sum(item.get('reasoning_output_tokens', 0) for item in usage),
         'limits': 'Snapshot before final reply; no equivalent old-development baseline; not a whole-task speed claim.'}
destination = Path(__file__).parent
(destination / 'development-trace.json').write_text(json.dumps(trace, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
report_path = destination / 'measurements.json'
report = json.loads(report_path.read_text(encoding='utf-8-sig'))
report['development']['finalTraceSnapshot'] = trace
report['development']['rework'].append({'kind': 'native stdin encoding',
    'detail': 'One Chinese inline Python pipe failed decoding; saved UTF-8 capture script replaces the pipe.'})
report['finalStatus'] = 'complete-uncommitted'
report['rulesBudget'] = {'rootBytes': 4556, 'docsFourBytes': 25473}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(trace))

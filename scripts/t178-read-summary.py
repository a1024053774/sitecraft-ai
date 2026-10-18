import bisect
import collections
import json
from pathlib import Path
import sys

profile_root, node_profile, destination = map(Path, sys.argv[1:4])
result = json.loads((profile_root / 'result.json').read_text(encoding='utf-8'))


def overlaps(start, end, windows):
    total = 0
    index = max(0, bisect.bisect_right([value[0] for value in windows], start) - 1)
    while index < len(windows) and windows[index][0] < end:
        left, right = windows[index]
        total += max(0, min(end, right) - max(start, left))
        index += 1
    return total


def summarize_cpu(filename, windows):
    data = json.loads(filename.read_text(encoding='utf-8'))
    nodes = {node['id']: node for node in data['nodes']}
    samples = collections.Counter()
    cursor = data['startTime']
    timestamps = []
    for node, delta in zip(data['samples'], data['timeDeltas']):
        cursor += delta
        timestamps.append((cursor, node))
    # V8 can deliver samples out of timestamp order. DevTools likewise restores
    # absolute timestamps and sorts the paired samples; raw profiles stay intact.
    timestamps.sort(key=lambda value: value[0])
    average = (timestamps[-1][0] - timestamps[0][0]) / (len(timestamps) - 1)
    for index, (timestamp, node) in enumerate(timestamps):
        end = timestamps[index + 1][0] if index + 1 < len(timestamps) else timestamp + average
        samples[node] += overlaps(timestamp, end, windows)
    functions = collections.Counter()
    for node, duration in samples.items():
        frame = nodes[node]['callFrame']
        name = frame['functionName'] or '匿名函数'
        url = frame['url'] if not frame['url'].startswith('data:') else '诊断挂钩'
        functions[name, url, frame['lineNumber'] + 1, frame['columnNumber'] + 1] += duration
    total = sum(functions.values())
    idle = sum(value for key, value in functions.items() if key[0] == '(idle)')
    active = total - idle
    top = [dict(function=key[0], url=key[1], line=key[2], column=key[3], sampledMs=value / 1000,
                windowPercent=value / total * 100, activePercent=None if key[0] == '(idle)' else value / active * 100)
           for key, value in functions.most_common(16)]
    return dict(sampledWindowMs=total / 1000, activeMs=active / 1000, idleMs=idle / 1000,
                negativeTimeDeltas=sum(value < 0 for value in data['timeDeltas']), top=top)


summary = {'sourceRevision': '7cfd723', 'note': 'CPU 百分比是采样时间；Trace 事件为包含子事件的时长，不能跨名称相加。', 'chrome': []}
for record in sorted(result['records'], key=lambda value: value['id']):
    index = record['id']
    trace = json.loads((profile_root / f'chrome-{index}.trace.json').read_text(encoding='utf-8'))
    assert not trace['completion']['dataLossOccurred']
    sync = next(event for event in trace['traceEvents'] if event.get('name') == 'clock_sync'
                and event.get('args', {}).get('sync_id') == record['clock']['syncId'])
    offset = sync['ts'] - (record['clock']['startUs'] + record['clock']['endUs']) / 2
    captures = [call for call in record['calls'] if 'readMs' in call]
    assert len(captures) == 123
    windows = [(call['startUs'] + offset, call['endUs'] + offset) for call in captures]
    windows.sort()
    names = ['UpdateLayoutTree', 'Document::recalcStyle', 'Layout', 'Document::UpdateStyleAndLayout',
             'CompressionStream Deflate', 'V8.DeoptimizeCode']
    events = {name: {'count': 0, 'durationMs': 0.0} for name in names}
    for event in trace['traceEvents']:
        if event.get('name') not in events or event.get('ph') != 'X':
            continue
        duration = overlaps(event['ts'], event['ts'] + event.get('dur', 0), windows)
        if duration:
            events[event['name']]['count'] += 1
            events[event['name']]['durationMs'] += duration / 1000
    before = {value['name']: value['value'] for value in record['metricsBefore']['metrics']}
    after = {value['name']: value['value'] for value in record['metricsAfter']['metrics']}
    summary['chrome'].append(dict(browser=index, clockOffsetUs=offset, captures=len(captures),
        captureRoundTripMs=sum(value['durationMs'] for value in captures),
        inPageReadMs=sum(value['readMs'] for value in captures),
        serializeMs=sum(value['serializeMs'] for value in captures),
        compressMs=sum(value['compressMs'] for value in captures),
        allCdpMethodCount=len(record['calls']),
        cpu=summarize_cpu(profile_root / f'chrome-{index}.cpuprofile', windows), trace=events,
        performanceDelta={name: after[name] - before[name] for name in [
            'RecalcStyleCount', 'RecalcStyleDuration', 'LayoutCount', 'LayoutDuration', 'TaskDuration']}))
    del trace

summary['node'] = summarize_cpu(node_profile, [(result['productionStartUs'], result['productionEndUs'])])
summary['dynamicViewports'] = [dict(width=value['width'], **value['dynamicState'])
                              for value in result['checks']['viewports'] if value.get('dynamicState')]
destination.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for browser in summary['chrome']:
    print('Chrome', browser['browser'], '读取', round(browser['inPageReadMs'], 1), 'ms', browser['trace'])
    print('CPU', browser['cpu'])
print('Node', summary['node'])

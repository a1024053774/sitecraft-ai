"""Reproduce T-130 privacy/accounting counterexamples; restore each edit in finally."""
from pathlib import Path
import json
import os
import subprocess
from datetime import datetime, timezone

out = Path('artifacts/t130') / ('mutants-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
out.mkdir(exist_ok=False)
mutants = [
    ('drop-first-refusal', 'scripts/eval-set-report.ts',
     'const attempts = checked.flatMap(c => c.attempts);',
     'const attempts = checked.flatMap(c => c.attempts.slice(-1));',
     'tests/t130-eval-set.test.ts', 'all refusals'),
    ('leak-style', 'scripts/eval-set-report.ts',
     '    return item;', '    return { ...item, style: "precision" };',
     'tests/t130-blind-privacy.test.ts', 'separate protocols'),
    ('lose-run-accounting', 'lib/code-site-workflow.ts',
     '...(codeModelCalls.getStore() ? { modelCalls: codeModelCalls.getStore() } : {}),',
     '...{},', 'tests/t130-run-records.test.ts', 'real submission'),
    ('source-first-birthtime', 'scripts/eval-set-report.ts',
     'return [...shuffle(first), ...shuffle(last)];',
     'return [...jobs].sort((a, b) => String(a.identity[field]).localeCompare(String(b.identity[field])));',
     'tests/t130-blind-privacy.test.ts', 'birthtime'),
    ('current-first-birthtime', 'scripts/eval-set-report.ts',
     '  return order;',
     "  return [...jobs].sort((a, b) => a.identity.round === b.identity.round ? 0 : a.identity.round === 'current' ? -1 : 1);",
     'tests/t130-blind-privacy.test.ts', 'birthtime'),
    ('preserve-file-times', 'scripts/eval-set-report.ts',
     "  await uniformTimes(path.join(directory, 'review'), normalizedTime);",
     '  await Promise.resolve();',
     'tests/t130-blind-privacy.test.ts', 'birthtime'),
    ('preserve-image-sizes', 'scripts/eval-set-report.ts',
     'await writeFile(dest, paddedPng(buffers.get(file.source)!, target));',
     'await writeFile(dest, buffers.get(file.source)!);',
     'tests/t130-blind-privacy.test.ts', 'birthtime'),
]
results = []
for name, filename, old, new, test, pattern in mutants:
    file = Path(filename)
    original = file.read_text(encoding='utf-8')
    assert old in original, name
    try:
        file.write_text(original.replace(old, new, 1), encoding='utf-8')
        command = ['node', '--test', '--experimental-strip-types', '--test-name-pattern=' + pattern, test]
        with (out / (name + '.txt')).open('w', encoding='utf-8') as log:
            process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, env=os.environ.copy())
        evidence = (out / (name + '.txt')).read_text(encoding='utf-8')
        assert process.returncode == 1 and 'AssertionError' in evidence, name
        assert 'TypeError:' not in evidence and 'SyntaxError:' not in evidence, name
        if name == 'lose-run-accounting':
            assert 'a completed provider call must persist its reported tokens in the run' in evidence
        results.append({'name': name, 'command': command, 'exit': process.returncode, 'at': datetime.now(timezone.utc).isoformat()})
    finally:
        file.write_text(original, encoding='utf-8')
(out / 'report.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(out)

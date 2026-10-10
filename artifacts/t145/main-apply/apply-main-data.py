from collections import Counter
from pathlib import Path
import datetime
import json
import os
import re
import shutil
import subprocess
import sys

# T-145 controller-approved one-shot application. The plan is the only delete
# allowlist. Existing application records are read for protection, never copied
# into reports. All report files are exclusive-create to preserve failed runs.
ROOT = Path('/Users/luckye/Documents/Code/sitecraft-ai/.sitecraft-data')
OUT = Path(__file__).parent
PLAN = Path('artifacts/t145/main-data-plan.json')
CHROME = '/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def report(name, value):
    with (OUT / name).open('x', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write('\n')

def safe(path):
    if not path.is_absolute() or not path.is_relative_to(ROOT) or path == ROOT:
        raise RuntimeError('Path outside approved data root: ' + str(path))
    if path.resolve() != path or ROOT.resolve() != ROOT:
        raise RuntimeError('Symlink or non-canonical path: ' + str(path))
    for ancestor in [path, *path.parents]:
        if ancestor.is_symlink():
            raise RuntimeError('Symlink target or ancestor: ' + str(path))
        if ancestor == ROOT:
            break

def protected_uploads():
    protected, reasons = set(), []
    for directory in sorted((ROOT / 'uploads').glob('*/*')):
        if not directory.is_dir():
            continue
        entries = list(directory.iterdir())
        metadata = list(directory.glob('*.json'))
        explained = set()
        if directory.is_symlink() or not metadata:
            protected.add(directory.name)
            reasons.append({'siteId': directory.name, 'reason': 'symlink or missing upload metadata'})
        for p in metadata:
            try:
                item = read(p)
                if (item.get('source') != 'public-material' or item.get('license') == 'user-provided'
                        or item.get('siteId') != directory.name):
                    protected.add(directory.name)
                    reasons.append({'siteId': directory.name, 'reason': 'user upload or mismatched ownership'})
            except (OSError, ValueError, AttributeError):
                protected.add(directory.name)
                reasons.append({'siteId': directory.name, 'reason': 'unreadable upload metadata'})
            explained.add(p.name)
            explained.update(f.name for f in directory.glob(p.stem + '.*'))
        if any(p.name not in explained or p.is_symlink() or p.is_dir() for p in entries):
            protected.add(directory.name)
            reasons.append({'siteId': directory.name, 'reason': 'unexplained upload content'})
    return protected, reasons

def profiles():
    active = []
    for line in subprocess.check_output(['ps', '-ax', '-o', 'pid=,command='], text=True).splitlines():
        # Retain only PID and profile basename; do not log process environments.
        for name in set(re.findall(r'site-style-check-[0-9]+', line)):
            active.append({'pid': int(line.strip().split()[0]), 'profile': name})
    return active

plan = read(PLAN)
old = read(Path('artifacts/t145/data-inventory-94b64bf-v2.json'))
assert plan['sourceRoot'] == str(ROOT)
assert len(plan['writePaths']) == 30
assert sum(plan['deleteCounts'].values()) == 12455
demos = set(old['demoIds'])
protected_approved = set(plan['preservedUploadSiteIds'])
shadows = set(old['legacyShadowIds'])
writes = [Path(p) for p in plan['writePaths']]
deletes = [(group, entry, Path(entry['path'])) for group, entries in plan['deleteGroups'].items() for entry in entries]
assert len(set(writes)) == 30 and len({p for _, _, p in deletes}) == 12455
assert not set(writes) & {p for _, _, p in deletes}
expected_writes = {ROOT / 'code-sites' / f'{i}.json' for i in demos | protected_approved}
expected_writes |= {ROOT / 'conversations' / i / 'legacy-import.json' for i in demos}
assert set(writes) == expected_writes
for p in writes:
    safe(p)
for group, entry, p in deletes:
    safe(p)
    relative = p.relative_to(ROOT).parts
    site_id = entry.get('siteId')
    if group == 'sites':
        assert relative == ('sites', f'{site_id}.json')
    elif group == 'conversations':
        assert relative == ('conversations', site_id)
    elif group in ('uploads', 'leads'):
        assert len(relative) == 3 and relative[0] == group
        assert relative[2] == (site_id if group == 'uploads' else f'{site_id}.json')
    elif group == 'quality':
        assert len(relative) == 3 and relative[:2] == ('quality', 'p4')
        if p.exists():
            assert read(p)['siteId'] == site_id
    elif group == 'site-style-check':
        assert len(relative) == 1 and re.fullmatch(r'site-style-check-[0-9]+', relative[0])
    else:
        raise RuntimeError('Unexpected delete group: ' + group)
    assert site_id not in demos | protected_approved

def deletion_reason(group, entry, p, protected, codes, active):
    safe(p)
    if not p.exists():
        return 'no longer exists'
    site_id = entry.get('siteId')
    if site_id in protected | demos:
        return 'upload protection or demonstration source'
    if site_id in codes and not (group == 'sites' and site_id in shadows):
        return 'new-route ownership'
    if group == 'site-style-check' and any(item['profile'] == p.name for item in active):
        return 'active profile'
    if group == 'quality' and read(p).get('siteId') != site_id:
        return 'quality ownership changed'
    return None

def preflight():
    protected, upload_reasons = protected_uploads()
    codes = {p.stem for p in (ROOT / 'code-sites').glob('*.json')}
    active = profiles()
    skipped = []
    for group, entry, p in deletes:
        reason = deletion_reason(group, entry, p, protected | protected_approved, codes, active)
        if reason:
            skipped.append({'group': group, 'path': str(p), 'reason': reason})
    for site_id in demos:
        assert read(ROOT / 'sites' / f'{site_id}.json') == read(Path('artifacts/t145/source-data/sites') / f'{site_id}.json'), 'Demo source changed: ' + site_id
    return {'at': now(), 'plan': str(PLAN), 'writeCount': len(writes), 'deleteCounts': plan['deleteCounts'],
            'existingWritePaths': [str(p) for p in writes if p.exists()], 'protectedUploadIds': sorted(protected | protected_approved),
            'uploadProtectionReasons': upload_reasons, 'existingCodeSiteCount': len(codes),
            'activeProfiles': active, 'skippedDeletePaths': skipped, 'demoSourcesUnchanged': True}

if sys.argv[1:] == ['--preflight']:
    result = preflight()
    report('preflight.json', result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0)
if sys.argv[1:] != ['--apply']:
    raise SystemExit('Use --preflight or --apply.')

# Snapshots stay in memory. Protect every pre-existing code-site JSON and every
# file outside the exact deletion targets. File metadata is used to detect
# unexpected writes; user uploads are not read, copied or compared bytewise.
before = preflight()
report('apply-preflight.json', before)
existing_records = {p: read(p) for p in (ROOT / 'code-sites').glob('*.json')}
demo_sources = {ROOT / 'sites' / f'{i}.json': read(ROOT / 'sites' / f'{i}.json') for i in demos}
delete_files = {p for g, _, p in deletes if g in ('sites', 'leads', 'quality')}
delete_dirs = {p for g, _, p in deletes if g in ('conversations', 'uploads', 'site-style-check')}
def retained_files():
    records = {}
    for directory, children, files in os.walk(ROOT, followlinks=False):
        parent = Path(directory)
        children[:] = [name for name in children if parent / name not in delete_dirs]
        for name in files:
            p = parent / name
            if p in delete_files:
                continue
            stat = p.lstat()
            records[p] = (stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_mode)
    return records
retained_before = retained_files()
summary = {'startedAt': now(), 'codeCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
           'plan': str(PLAN), 'sourceRoot': str(ROOT), 'cli': [], 'deletedCounts': {}, 'skipped': [], 'failures': []}
env = os.environ.copy()
env.update({'SITE_STORE': 'fs', 'SITECRAFT_DATA_ROOT': str(ROOT), 'SITECRAFT_BASE': 'http://127.0.0.1:3155',
            'CHROME_PATH': CHROME, 'DEEPSEEK_API_KEY': '', 'AI_API_KEY': '', 'DEEPSEEK_MODEL': '', 'AI_MODEL': ''})
try:
    for input_path, output in [('artifacts/t145/exports-batch/candidates.json', 'import-demos.json'),
                               ('artifacts/t145/protected-input.json', 'import-protected.json')]:
        args = ['node', '--experimental-strip-types', 'scripts/import-legacy-site-code.ts', '--input', input_path, '--out', str(OUT / output)]
        with (OUT / (output + '.log')).open('x', encoding='utf-8') as log:
            process = subprocess.run(args, env=env, stdout=log, stderr=subprocess.STDOUT)
        summary['cli'].append({'command': args, 'exitCode': process.returncode, 'report': str(OUT / output)})
        print(json.dumps(summary['cli'][-1]), flush=True)
        if process.returncode:
            raise RuntimeError('Import CLI failed; deletion has not started: ' + output)
    # Conversion cannot relax the approved cleanup conditions.
    live = preflight()
    report('before-delete.json', live)
    protected = set(live['protectedUploadIds'])
    codes = {p.stem for p in (ROOT / 'code-sites').glob('*.json')}
    active = profiles()
    report('profiles-immediately-before-delete.json', {'at': now(), 'active': active})
    counts = Counter()
    with (OUT / 'deletions.ndjson').open('x', encoding='utf-8') as log:
        for group, entry, p in deletes:
            item = {'at': now(), 'group': group, 'path': str(p)}
            try:
                # Recheck code ownership per target, and upload metadata before
                # removing the corresponding directory. No prefix glob removal.
                if entry.get('siteId') and (ROOT / 'code-sites' / f"{entry['siteId']}.json").exists():
                    codes.add(entry['siteId'])
                if group == 'uploads':
                    current_protected, _ = protected_uploads()
                    protected |= current_protected
                if group == 'site-style-check':
                    active = profiles()
                reason = deletion_reason(group, entry, p, protected, codes, active)
                if reason:
                    item.update(status='skipped', reason=reason)
                    summary['skipped'].append(item)
                else:
                    if p.is_dir():
                        shutil.rmtree(p)
                    else:
                        p.unlink()
                    assert not p.exists() and not p.is_symlink()
                    counts[group] += 1
                    item['status'] = 'deleted'
            except Exception as error:
                item.update(status='failed', reason=str(error))
                summary['failures'].append(item)
            log.write(json.dumps(item, ensure_ascii=False) + '\n')
            log.flush()
            summary['deletedCounts'] = {group: counts[group] for group in plan['deleteGroups']}
            if sum(counts.values()) % 1000 == 0:
                print(json.dumps({'deleted': sum(counts.values()), 'skipped': len(summary['skipped']), 'failed': len(summary['failures'])}), flush=True)
except Exception as error:
    summary['failures'].append({'stage': 'application', 'reason': str(error)})
finally:
    summary['completedAt'] = now()
    retained_after = retained_files()
    changed = [str(p) for p, metadata in retained_before.items() if retained_after.get(p) != metadata]
    unexpected_added = [str(p) for p in set(retained_after) - set(retained_before) - set(writes)]
    unchanged_codes = all(p.exists() and read(p) == value for p, value in existing_records.items())
    unchanged_sources = all(p.exists() and read(p) == value for p, value in demo_sources.items())
    summary['preservation'] = {'existingCodeSitesChecked': len(existing_records), 'existingCodeSitesUnchanged': unchanged_codes,
                               'demoSourcesChecked': len(demo_sources), 'demoSourcesUnchanged': unchanged_sources,
                               'retainedFilesChecked': len(retained_before), 'changedOrMissingRetainedFiles': changed,
                               'unexpectedAddedFiles': unexpected_added,
                               'protectedSiteIds': before['protectedUploadIds']}
    summary['writtenPaths'] = [str(p) for p in writes if p.exists() and str(p) not in before['existingWritePaths']]
    summary['writtenCount'] = len(summary['writtenPaths'])
    summary['existingWritesPreserved'] = before['existingWritePaths']
    summary['deletedCount'] = sum(summary['deletedCounts'].values())
    summary['status'] = 'PASS' if (summary['writtenCount'] == 30 and summary['deletedCount'] == 12455
        and not summary['skipped'] and not summary['failures'] and unchanged_codes and unchanged_sources
        and not changed and not unexpected_added) else 'INCOMPLETE'
    report('application.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
if summary['status'] != 'PASS':
    raise SystemExit(1)

import type { CodeVersion } from './code-site.ts';

export type VersionGrouping = 'minute' | 'ten-minutes' | 'hour' | 'day';
export function groupCodeVersions(versions: CodeVersion[], grouping: VersionGrouping) {
  const groups = new Map<string, { date: Date; versions: CodeVersion[] }>();
  for (const version of [...versions].sort((a, b) => b.revision - a.revision)) {
    const date = new Date(version.createdAt);
    if (grouping === 'day') date.setHours(0, 0, 0, 0);
    else {
      // Subtract elapsed time within this instance of the local bucket. Local setters
      // choose the earlier DST instance and would merge the repeated autumn hour.
      const minutes = grouping === 'hour' ? date.getMinutes() : grouping === 'ten-minutes' ? date.getMinutes() % 10 : 0;
      date.setTime(date.getTime() - minutes * 60000 - date.getSeconds() * 1000 - date.getMilliseconds());
    }
    const key = date.toISOString();
    const group = groups.get(key) ?? { date, versions: [] };
    group.versions.push(version); groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

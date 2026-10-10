import {spawnSync} from 'node:child_process';
// One actual workbench, owned Chrome, three widths; no fixed legacy sample ID.
const result=spawnSync(process.execPath,['--experimental-strip-types','scripts/capture-workspace-motion-frames.ts',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
process.exitCode=result.status??1;

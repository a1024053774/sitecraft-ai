import {readFileSync} from 'node:fs';
export const base=process.env.SITECRAFT_BASE||'http://127.0.0.1:3034';
export const contrastScan=readFileSync(new URL('../../scripts/workspace-contrast-scan.js',import.meta.url),'utf8');

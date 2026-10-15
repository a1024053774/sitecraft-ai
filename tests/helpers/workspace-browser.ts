import {readFileSync} from 'node:fs';
import { localEndpoint } from '../../scripts/local-endpoint.ts';
export const base=localEndpoint('SITECRAFT_BASE').origin;
export const contrastScan=readFileSync(new URL('../../scripts/workspace-contrast-scan.js',import.meta.url),'utf8');

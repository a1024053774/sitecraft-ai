import { mkdir } from 'node:fs/promises';
import { localEndpoint } from './local-endpoint.ts';
import { createT162ModelFixture } from '../tests/fixtures/t162-model-fixture.ts';
localEndpoint('SITECRAFT_BASE');
const endpoint = localEndpoint('SITECRAFT_FIXTURE_BASE');
const directory = `artifacts/t162/provider-${Date.now()}`;
await mkdir(directory, { recursive: true });
const server = createT162ModelFixture(directory);
server.listen(endpoint.port, endpoint.hostname, () => console.log(`本地替身 ${endpoint.origin}；${directory}`));

import test from 'node:test';

// Bounded comparison with the standard test process. Kept outside tests/ so a
// normal full run does not silently add an uncapped diagnostic benchmark.
test('T-178 标准测试进程中重放同一生产检查（仅诊断，无截止）', async () => {
  process.argv = [process.argv[0], process.argv[1], 'idle', `artifacts/t178/standard-production-uncapped-${Date.now()}-${process.pid}`, '--uncapped', '1'];
  await import('./t178-dynamic-timing.ts');
});

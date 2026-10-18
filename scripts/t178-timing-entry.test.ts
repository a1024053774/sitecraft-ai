import test from 'node:test';

// Bounded comparison with the standard test process. Kept outside tests/ so a
// normal full run does not silently add a restaurant timing benchmark.
test('T-178 标准测试进程中按生产读取预算重放同一检查', async () => {
  process.argv = [process.argv[0], process.argv[1], 'idle', `artifacts/t178/standard-production-budget-${Date.now()}-${process.pid}`, '1'];
  await import('./t178-dynamic-timing.ts');
});

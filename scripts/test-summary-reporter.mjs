// Node's cumulative count includes empty file wrappers. Per-file summaries
// count the declared tests: https://nodejs.org/api/test.html#event-testsummary
export default async function* summaries(source) {
  for await (const event of source) {
    if (event.type === 'test:summary' && event.data.file) yield JSON.stringify(event.data) + '\n';
  }
}

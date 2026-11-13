// Builds qa/QA_REPORT.md from Playwright's qa/results.json (+ optional unit results in qa/unit.json).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const r = JSON.parse(readFileSync('qa/results.json', 'utf8'));
const rows = [];
const walk = (s, path = []) => {
  for (const sp of s.specs ?? []) for (const t of sp.tests) {
    const res = t.results.at(-1);
    rows.push({ suite: path.filter(Boolean).at(-1) ?? '', title: sp.title, status: res?.status ?? 'skipped', ms: res?.duration ?? 0 });
  }
  for (const c of s.suites ?? []) walk(c, [...path, c.title]);
};
for (const s of r.suites) walk(s, [s.title]);
const passed = rows.filter((x) => x.status === 'passed').length;
let unit = '';
if (existsSync('qa/unit.json')) {
  const u = JSON.parse(readFileSync('qa/unit.json', 'utf8'));
  unit = `\n## Unit and database tests\n\n${u.numPassedTests} of ${u.numTotalTests} passed.\n\n| File | Test | Result |\n| --- | --- | --- |\n` +
    u.testResults.flatMap((f) => f.assertionResults.map((a) => `| ${f.name.split('/tests/unit/')[1]} | ${a.ancestorTitles.join(' › ')} › ${a.title} | ${a.status === 'passed' ? 'Pass' : 'FAIL'} |`)).join('\n') + '\n';
}
const shots = existsSync('qa/screenshots') ? readdirSync('qa/screenshots').filter((f) => f.endsWith('.png')).sort() : [];
const md = `# Tawreed Releases 1–3 — QA report

Run: ${new Date(r.stats.startTime).toISOString().replace('T', ' ').slice(0, 16)} UTC · ${passed} of ${rows.length} end-to-end scenarios passed · duration ${(r.stats.duration / 1000).toFixed(0)} s

Environment: production build (standalone server), PostgreSQL 16 with row-level security, two app servers (PAYMENT_MODE=bypass and PAYMENT_MODE=sandbox), local stand-in for the Moyasar API, AI_PROVIDER=mock.

## End-to-end scenarios

| # | Area | Scenario | Result | Time |
| --- | --- | --- | --- | --- |
${rows.map((x, i) => `| ${i + 1} | ${x.suite} | ${x.title} | ${x.status === 'passed' ? 'Pass' : x.status.toUpperCase()} | ${(x.ms / 1000).toFixed(1)} s |`).join('\n')}
${unit}
## Screenshots

${shots.map((s) => `- \`qa/screenshots/${s}\``).join('\n')}

## Not covered by this run
- Live calls to api.moyasar.com, OpenAI and Anthropic (no internet access or keys in the test environment). The Moyasar callback logic was tested against a stand-in API; the OpenAI and Claude adapters were tested with simulated HTTP responses. Run the README section 4 check and the platform admin's AI settings → "Run test" with real keys to confirm.
- ZATCA Phase 2 clearance (Fatoora portal) needs the company's onboarding credentials; this release produces Phase 1 QR codes, UUID and invoice hash.
- The Docker image was not built in the test environment (no Docker daemon); the same standalone server it runs was used for every scenario.
`;
writeFileSync('qa/QA_REPORT.md', md);
console.log(`qa/QA_REPORT.md written: ${passed}/${rows.length} passed`);

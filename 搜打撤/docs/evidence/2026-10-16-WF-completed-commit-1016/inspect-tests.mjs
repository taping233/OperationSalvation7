import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
for (const file of process.argv.slice(2)) {
  const report = JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
  console.log(JSON.stringify({ file, passed:report.numPassedTests, failed:report.numFailedTests,
    failures:report.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed')
      .map(test => ({ file:path.basename(suite.name), name:test.fullName,
        error:test.failureMessages[0]?.split('\n').slice(0,2) }))) }, null, 2));
}

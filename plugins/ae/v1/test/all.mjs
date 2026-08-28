// The V1 suite. Every case names the criterion it exercises.

import { gateTests } from './gate.test.mjs';
import { identityTests } from './identity.test.mjs';
import { authorityTests } from './authority.test.mjs';
import { evidenceTests } from './evidence.test.mjs';
import { concurrentTests } from './concurrent.test.mjs';
import { recordTests } from './record.test.mjs';
import { familyTests } from './family.test.mjs';
import { knowledgeTests } from './knowledge.test.mjs';
import { completionTests } from './completion.test.mjs';
import { structureTests } from './structure.test.mjs';
import { coverageTests } from './coverage.test.mjs';
import { kernelTests } from './kernel.test.mjs';
import { reviewTests } from './review.test.mjs';
import { entryTests } from './entry.test.mjs';
import { report } from './harness.mjs';

gateTests();
identityTests();
authorityTests();
evidenceTests();
recordTests();
familyTests();
knowledgeTests();
completionTests();
structureTests();
coverageTests();
kernelTests();
reviewTests();
entryTests();

concurrentTests();

process.exit(report() ? 0 : 1);

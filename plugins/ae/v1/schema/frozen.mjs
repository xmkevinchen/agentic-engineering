// The freeze — AC-12's second half.
//
// Every persisted format's identity, recorded after AC-9's real run exercised
// them and not before. A format frozen before the run would be a format frozen
// against a guess about what it needs to hold.
//
// Two kinds of identity, because two different things can drift:
//
//   `formats` and `records` are the canonical digests of the schema **values**.
//   A comment moves in the file and these do not; a field, a bound or a nested
//   shape changes and they do.
//
//   `enforcement` is the byte digest of the **files that decide what a schema
//   means** — the validator, the schema definitions, and the canonical encoder
//   the digests themselves are taken through. A schema value can stay identical
//   while `validate` starts accepting more, and then the frozen thing is a
//   description of a check nobody is performing.
//
// A frozen entry is never edited. A change appends a new entry, and records
// written under an earlier entry stay valid under the schemas that entry names.
// With one entry, that property is structural here rather than exercised — there
// is no second version to read an old record against, and saying so is better
// than a fixture pretending there is.

export const FROZEN = [
  {
    id: 'v1',
    // The run that exercised these formats before they were frozen. Both AC-9
    // runs did; this is the one whose evidence reached an Acceptance first.
    // Named by its Acceptance, not only by its label. The run's log is a process
    // artifact that does not ship, so a reader holding only this repository can
    // still see *which* completion the freeze rests on, and a reader holding the
    // log can check that it is that one.
    exercised_by: {
      lineage: 'BL-214',
      run: 'run1',
      acceptance: 'sha256:9ea38e8068401e0a59a8dbdad67d43286bb463e206fbc78f2fc1e4e40af822bc',
    },
    formats: {
      Contract: 'sha256:94b87449e1a1c99b14ebc438bb2ecc69fd2d4135d770fb34f9f0d8f55c1ce141',
      Assignment: 'sha256:c15dc9da38b37a9803640a120b133b1e1015c9806103b5fc085ec77bc696e2d3',
      EvidencePackage: 'sha256:d2f9c5914250d897fef09012b03f7545b36da0dc928a8ad419f61ef49b480e79',
      Acceptance: 'sha256:2f1bcd38af5b88b2f149181cb8992827345caab587c9f2d20707a95652f9512f',
    },
    records: {
      artifact_recorded: 'sha256:2df2926b98903e5a1cf2c8f3dc2f736483ac8247960fb6b7e720e4a3476e58a3',
      assignment_issued: 'sha256:2c613d839fe906e160e01cdd32fb1f59f0138930256561c756d4264226ed99d4',
      attempt_opened: 'sha256:7237c02fef932260c7129983196054ecf267ae58bfa5dcef3671e56f83e4eaed',
      capability_unavailable: 'sha256:11238255d79ef8354a358ecee07074b02d1d1715de34c466b637e409ef728ce7',
      command_result: 'sha256:506c8e6a81c976e7c5e0b2ba13aacc97757ef6b3305432a895778dd3c3efa0a3',
      completion_committed: 'sha256:9c6708ef1fccd34f744c5f66ffc7fc0d29315fd1d37e2ae937d09062aa1a1010',
      contract_approved_genesis: 'sha256:fcd3cda8bcce90bfc84f5643c0f8eaa92b21b12263b36d61aa58f408eddf7cfe',
      contract_approved_revision: 'sha256:a6f85e5a525aa6f6f78943528199ed17613f49d217d844aa2ebc301b5540032f',
      dispatch_attempt: 'sha256:ba2df76bef7885190b6a69fbef020e3e8b1e505fc176aa2b0b00fcafd5485f72',
      evidence_package: 'sha256:ccb7a045e1a143b69168188c91015b8ab5c3cdd6b77797dccb775edc3046f138',
      formation_opened: 'sha256:7cf921a3aa9b05e48f01833ca1aea254deaf953b4a9f1f1dc139d5f045de9c37',
      gate_completed: 'sha256:eeab8fab226938fee931539ab5bad43377b072ae2f9267f2415ba667756c138b',
      gate_result: 'sha256:8b0496497f164e4af6f627dc7a8f980c7de39efa13c9e8749b1408a503715b27',
      human_decision_activation: 'sha256:5f3392af74d3d48dfc206a17baa65a618164a82c0abec96ff85a9923fe2f4db6',
      human_decision_choice: 'sha256:b6be66334692e5c62a8a976aafa5a6611976ad5e22f50b8d2bfde12cb521216e',
      human_decision_judgement: 'sha256:a08ac27c2bf38c6f34ad67426575326841bde8644043c6e282b18f45e6c64633',
      human_decision_unavailable: 'sha256:4098713bc628b1d06a2e10286c718aa828132a66e4caf28cb491f1161ba31863',
      human_signoff: 'sha256:16f825d1f6fd1648f5817ee50de5555390945822e92c7be686655051f1d5ce45',
      input_gone: 'sha256:b4c60e3ea64d0b3a5194966f67fdbae9a6d6b93662a772b77912a0fd9f9dd7b2',
      input_observed: 'sha256:838192c4e3d2b68e6a45ad8c08ab8657ee7ef65dd3654663e5dcfdaf97596970',
      observation: 'sha256:4d64581ab65f89e706b986a18a8746032309beebfdd8e002914008dc1873ea56',
      run_record_caught: 'sha256:2aace28c04749fae72ac3cd1a28f3dd47b223320fd0e46689173bc62f8c24ad6',
      run_record_clean: 'sha256:e427ee120e25b5175b39cad24765f0f45b90f60cdb215c2f385c65d2671ea293',
    },
    enforcement: {
      'lib/schema.mjs': 'sha256:6558b277ca82b5a741e7e9689e8b841084f03850c7f415f50d11304810fb578c',
      'schema/objects.mjs': 'sha256:95f02dc539be97ed6e2023055751cedaecb41869a00f23f4aab0c0b8475c804e',
      'schema/records.mjs': 'sha256:260bc7ead6ba7845056667f31ee6d9d69a16ab9b4f2a773a4084874182137bdc',
      'lib/canonical-json.mjs': 'sha256:5d39dfe194ca9b0f986d00a287d10240bce739720fed24c349d87c8799b8461e',
    },
  },
  {
    id: 'v2',
    // Phase 2 adds two record kinds, so what the freeze pins moved. The `v1`
    // entry above is not edited: an Acceptance written while it was in force was
    // written against those shapes, and a record that overwrites the old set
    // makes that impossible to see afterwards.
    //
    // No dogfood run of its own. `v1` was frozen after AC-9's run exercised the
    // formats it named; this entry names the same formats plus two kinds nothing
    // has exercised yet — which is why the slice that adds them also adds the
    // whole-path run that does.
    supersedes: 'v1',
    exercised_by: {
      lineage: 'BL-214',
      run: 'run1',
      acceptance: 'sha256:9ea38e8068401e0a59a8dbdad67d43286bb463e206fbc78f2fc1e4e40af822bc',
    },
    formats: {
      Contract: 'sha256:94b87449e1a1c99b14ebc438bb2ecc69fd2d4135d770fb34f9f0d8f55c1ce141',
      Assignment: 'sha256:c15dc9da38b37a9803640a120b133b1e1015c9806103b5fc085ec77bc696e2d3',
      EvidencePackage: 'sha256:d2f9c5914250d897fef09012b03f7545b36da0dc928a8ad419f61ef49b480e79',
      Acceptance: 'sha256:2f1bcd38af5b88b2f149181cb8992827345caab587c9f2d20707a95652f9512f',
    },
    records: {
      artifact_recorded: 'sha256:2df2926b98903e5a1cf2c8f3dc2f736483ac8247960fb6b7e720e4a3476e58a3',
      assignment_issued: 'sha256:2c613d839fe906e160e01cdd32fb1f59f0138930256561c756d4264226ed99d4',
      attempt_opened: 'sha256:7237c02fef932260c7129983196054ecf267ae58bfa5dcef3671e56f83e4eaed',
      capability_unavailable: 'sha256:11238255d79ef8354a358ecee07074b02d1d1715de34c466b637e409ef728ce7',
      command_result: 'sha256:506c8e6a81c976e7c5e0b2ba13aacc97757ef6b3305432a895778dd3c3efa0a3',
      completion_committed: 'sha256:9c6708ef1fccd34f744c5f66ffc7fc0d29315fd1d37e2ae937d09062aa1a1010',
      contract_approved_genesis: 'sha256:fcd3cda8bcce90bfc84f5643c0f8eaa92b21b12263b36d61aa58f408eddf7cfe',
      contract_approved_revision: 'sha256:a6f85e5a525aa6f6f78943528199ed17613f49d217d844aa2ebc301b5540032f',
      dispatch_attempt: 'sha256:ba2df76bef7885190b6a69fbef020e3e8b1e505fc176aa2b0b00fcafd5485f72',
      evidence_package: 'sha256:ccb7a045e1a143b69168188c91015b8ab5c3cdd6b77797dccb775edc3046f138',
      formation_opened: 'sha256:7cf921a3aa9b05e48f01833ca1aea254deaf953b4a9f1f1dc139d5f045de9c37',
      gate_completed: 'sha256:eeab8fab226938fee931539ab5bad43377b072ae2f9267f2415ba667756c138b',
      gate_result: 'sha256:8b0496497f164e4af6f627dc7a8f980c7de39efa13c9e8749b1408a503715b27',
      human_decision_activation: 'sha256:5f3392af74d3d48dfc206a17baa65a618164a82c0abec96ff85a9923fe2f4db6',
      human_decision_choice: 'sha256:b6be66334692e5c62a8a976aafa5a6611976ad5e22f50b8d2bfde12cb521216e',
      human_decision_judgement: 'sha256:a08ac27c2bf38c6f34ad67426575326841bde8644043c6e282b18f45e6c64633',
      human_decision_unavailable: 'sha256:4098713bc628b1d06a2e10286c718aa828132a66e4caf28cb491f1161ba31863',
      human_signoff: 'sha256:16f825d1f6fd1648f5817ee50de5555390945822e92c7be686655051f1d5ce45',
      input_gone: 'sha256:b4c60e3ea64d0b3a5194966f67fdbae9a6d6b93662a772b77912a0fd9f9dd7b2',
      input_observed: 'sha256:838192c4e3d2b68e6a45ad8c08ab8657ee7ef65dd3654663e5dcfdaf97596970',
      observation: 'sha256:4d64581ab65f89e706b986a18a8746032309beebfdd8e002914008dc1873ea56',
      review: 'sha256:3d021e8906e41a224eabd2e790d5a9f5dafd78082c9b02cd850441ad2e15797b',
      run_record_caught: 'sha256:2aace28c04749fae72ac3cd1a28f3dd47b223320fd0e46689173bc62f8c24ad6',
      run_record_clean: 'sha256:e427ee120e25b5175b39cad24765f0f45b90f60cdb215c2f385c65d2671ea293',
    },
    enforcement: {
      'lib/schema.mjs': 'sha256:6558b277ca82b5a741e7e9689e8b841084f03850c7f415f50d11304810fb578c',
      'schema/objects.mjs': 'sha256:95f02dc539be97ed6e2023055751cedaecb41869a00f23f4aab0c0b8475c804e',
      'schema/records.mjs': 'sha256:ef66e46dc9fcf66d27113c49778ae0129908d5b77c5fdca6f0eaf88efcff297a',
      'lib/canonical-json.mjs': 'sha256:5d39dfe194ca9b0f986d00a287d10240bce739720fed24c349d87c8799b8461e',
    },
  },
];

// What the freeze says, checked against what is actually here.
//
// Returns problems rather than throwing: the caller is a test, and a list of
// every drift is more useful than the first one. An empty list is the claim.
export function freezeProblems({ readFileSync, canonicalDigest, digestBytes, objects, records, dir }) {
  const entry = FROZEN[FROZEN.length - 1];
  const problems = [];

  const compare = (label, expected, actual) => {
    if (expected === undefined) problems.push({ label, why: 'not named by the freeze' });
    else if (actual === undefined) problems.push({ label, why: 'named by the freeze but not present' });
    else if (expected !== actual) problems.push({ label, why: 'changed in place since it was frozen' });
  };

  // Against `OBJECTS`, the module's own list of the persisted object formats,
  // rather than against a list restated here. A format added there and not frozen
  // is reported; a list restated here would simply not know about it.
  for (const name of new Set([...Object.keys(entry.formats), ...Object.keys(objects)])) {
    compare(name, entry.formats[name], objects[name] && canonicalDigest(objects[name]));
  }
  for (const kind of new Set([...Object.keys(entry.records), ...Object.keys(records)])) {
    compare(`record:${kind}`, entry.records[kind], records[kind] && canonicalDigest(records[kind]));
  }
  for (const file of Object.keys(entry.enforcement)) {
    let actual;
    try { actual = digestBytes(readFileSync(`${dir}/${file}`)); } catch { actual = undefined; }
    compare(`enforcement:${file}`, entry.enforcement[file], actual);
  }
  return problems;
}

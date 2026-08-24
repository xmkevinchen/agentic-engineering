// Typed error taxonomy for the v1 foundation mechanisms.
//
// Every rejection carries a stable `code`. Callers branch on the code, never on
// the message: messages are diagnostics and may gain detail without a version
// bump, codes may not.

export class FoundationError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'FoundationError';
    this.code = code;
    this.detail = detail;
  }
}

export function fail(code, message, detail) {
  throw new FoundationError(code, message, detail);
}

// Codes are grouped by the mechanism that raises them. A code appears in exactly
// one group; overlap between the lexical layer and the schema layer is the defect
// the split exists to prevent.
export const CODES = Object.freeze({
  lexical: [
    'byte_order_mark',
    'invalid_utf8',
    'lone_surrogate',
    'duplicate_key',
    'non_integer_number',
    'number_out_of_range',
    'negative_zero',
    'non_finite_number',
    'malformed_json',
    'trailing_content',
    'ndjson_missing_terminator',
    'ndjson_trailing_terminator',
    'ndjson_carriage_return',
    'ndjson_not_canonical',
  ],
  schema: ['schema_invalid'],
  tree: [
    'invalid_utf8_path',
    'path_collision',
    'symlink_entry',
    'hardlink_entry',
    'special_file_entry',
    'root_not_directory',
    'move_projection_source_mismatch',
    'move_projection_requires_observed_source',
    'move_projection_same_identity',
    'move_projection_cross_device',
    'move_projection_unsupported_operation',
    'move_projection_failed_operation',
    'move_projection_plan_not_qualified',
    'move_projection_unqualified_helper',
    'move_projection_qualification_incomplete',
    'move_projection_qualification_mismatch',
    'move_projection_result_mismatch',
  ],
  release: [
    'manifest_unreadable',
    'manifest_digest_mismatch',
    'manifest_has_self_digest',
    'member_ref_absolute',
    'member_ref_escapes_root',
    'member_ref_symlink',
    'member_ref_duplicate',
    'member_ref_non_canonical',
    'activation_base_member_mismatch',
    'member_missing',
    'member_digest_mismatch',
    'launcher_is_member',
    'unsupported_direct_invocation',
    'release_not_active',
    'active_release_unavailable',
    'capability_not_minted',
    'capability_bootstrap_mismatch',
    'capability_scope_mismatch',
    'capability_expired',
    'bootstrap_result_not_derived',
    'attestation_not_observed',
  ],
  policy: [
    'integrity_error',
    'policy_epoch_stale',
    'base_bundle_not_current',
    'bundle_source_digest_mismatch',
    'bundle_source_missing',
    'snapshot_missing',
    'snapshot_tampered',
    'duplicate_project_ref',
    'short_write',
    'ref_escapes_project_root',
    'ref_non_canonical',
    'ref_symlink_component',
    'plugin_source_escapes_plugin_root',
    'current_release_not_selectable_by_declaration',
  ],
});

export const ALL_CODES = Object.freeze(Object.values(CODES).flat());

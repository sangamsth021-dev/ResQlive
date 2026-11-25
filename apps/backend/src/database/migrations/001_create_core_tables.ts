import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable PostGIS extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis;');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Organizations table
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('organization_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('parent_organization_id').nullable().references('organization_id').inTable('organizations');
    table.string('name', 200).notNullable();
    table.string('organization_type', 40).notNullable(); // municipality, authority, police, fire, health, ngo, eoc
    table.string('jurisdiction_code', 80).nullable();
    table.string('status', 20).notNullable().defaultTo('active'); // active, suspended, archived
    table.string('timezone', 64).notNullable().defaultTo('UTC');
    table.timestamps(true, true); // created_at, updated_at

    // Indexes
    table.index('parent_organization_id');
    table.index('status');
    table.index('organization_type');
  });

  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('user_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('display_name', 160).notNullable();
    table.string('phone_e164', 20).nullable().unique();
    table.string('email', 254).nullable();
    table.string('account_status', 20).notNullable().defaultTo('pending'); // pending, active, locked, disabled
    table.string('preferred_language', 12).notNullable().defaultTo('en');
    table.timestamps(true, true);

    // Indexes
    table.index('phone_e164');
    table.index('email');
    table.index('account_status');
  });

  // Organization memberships (many-to-many with roles)
  await knex.schema.createTable('organization_memberships', (table) => {
    table.uuid('membership_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('user_id').inTable('users').onDelete('CASCADE');
    table.uuid('organization_id').notNullable().references('organization_id').inTable('organizations').onDelete('CASCADE');
    table.string('role_code', 50).notNullable(); // reporter, operator, verifier, team_lead, org_admin
    table.jsonb('scope_json').nullable(); // Optional policy attributes
    table.string('status', 20).notNullable().defaultTo('invited'); // invited, active, suspended, ended
    table.timestamp('valid_from').nullable();
    table.timestamp('valid_to').nullable();
    table.timestamps(true, true);

    // Unique constraint: one membership per user per organization per role
    table.unique(['user_id', 'organization_id', 'role_code']);

    // Indexes
    table.index('user_id');
    table.index('organization_id');
    table.index('role_code');
    table.index('status');
  });

  // Devices table
  await knex.schema.createTable('devices', (table) => {
    table.uuid('device_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.uuid('organization_id').notNullable().references('organization_id').inTable('organizations').onDelete('CASCADE');
    table.string('platform', 20).notNullable(); // android, windows, linux, macos, edge_node
    table.string('app_version', 40).notNullable();
    table.text('public_key').nullable(); // Public portion of device key
    table.string('key_algorithm', 40).nullable();
    table.string('device_status', 20).notNullable().defaultTo('pending'); // pending, active, suspended, revoked
    table.timestamp('last_seen_at').nullable();
    table.timestamp('registered_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    // Indexes
    table.index('user_id');
    table.index('organization_id');
    table.index('device_status');
    table.index('platform');
  });

  // Reference tables for controlled vocabularies
  await knex.schema.createTable('incident_categories', (table) => {
    table.string('code', 50).primary();
    table.string('label', 100).notNullable();
    table.string('description', 500).nullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.integer('schema_version').notNullable().defaultTo(1);
  });

  await knex.schema.createTable('severity_levels', (table) => {
    table.string('code', 30).primary();
    table.string('label', 100).notNullable();
    table.string('help_text', 500).nullable();
    table.integer('rank').notNullable().defaultTo(0);
    table.string('visual_treatment', 50).nullable(); // CSS class or color hint
    table.boolean('active').notNullable().defaultTo(true);
    table.integer('schema_version').notNullable().defaultTo(1);
  });

  await knex.schema.createTable('priority_levels', (table) => {
    table.string('code', 24).primary();
    table.string('label', 100).notNullable();
    table.integer('rank').notNullable().defaultTo(0);
    table.boolean('active').notNullable().defaultTo(true);
    table.integer('schema_version').notNullable().defaultTo(1);
  });

  await knex.schema.createTable('organization_types', (table) => {
    table.string('code', 40).primary();
    table.string('label', 100).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('team_types', (table) => {
    table.string('code', 40).primary();
    table.string('label', 100).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('relationship_types', (table) => {
    table.string('code', 24).primary();
    table.string('label', 100).notNullable();
    table.string('description', 500).nullable();
  });

  await knex.schema.createTable('evidence_kinds', (table) => {
    table.string('code', 20).primary();
    table.string('label', 100).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('reason_codes', (table) => {
    table.string('code', 60).primary();
    table.string('label', 100).notNullable();
    table.string('applies_to', 100).notNullable(); // report, incident, assignment, verification
    table.boolean('requires_text').notNullable().defaultTo(false);
    table.boolean('active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('report_states', (table) => {
    table.string('code', 30).primary();
    table.string('label', 100).notNullable();
    table.string('description', 500).nullable();
    table.boolean('is_terminal').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('incident_states', (table) => {
    table.string('code', 30).primary();
    table.string('label', 100).notNullable();
    table.string('description', 500).nullable();
    table.boolean('is_terminal').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('assignment_states', (table) => {
    table.string('code', 24).primary();
    table.string('label', 100).notNullable();
    table.string('description', 500).nullable();
    table.boolean('is_terminal').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('evidence_storage_states', (table) => {
    table.string('code', 24).primary();
    table.string('label', 100).notNullable();
    table.boolean('is_terminal').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('evidence_integrity_states', (table) => {
    table.string('code', 24).primary();
    table.string('label', 100).notNullable();
    table.boolean('is_verified').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('evidence_access_classes', (table) => {
    table.string('code', 24).primary();
    table.string('label', 100).notNullable();
    table.integer('rank').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('location_sources', (table) => {
    table.string('code', 20).primary();
    table.string('label', 100).notNullable();
  });

  await knex.schema.createTable('capture_modes', (table) => {
    table.string('code', 20).primary();
    table.string('label', 100).notNullable();
  });

  // Insert default reference data
  await knex('organization_types').insert([
    { code: 'municipality', label: 'Municipality' },
    { code: 'authority', label: 'Emergency Authority' },
    { code: 'police', label: 'Police' },
    { code: 'fire', label: 'Fire Department' },
    { code: 'health', label: 'Health Department' },
    { code: 'ngo', label: 'Non-Governmental Organization' },
    { code: 'eoc', label: 'Emergency Operations Centre' },
  ]);

  await knex('incident_categories').insert([
    { code: 'LANDSLIDE', label: 'Landslide', description: 'Slope failure, debris flow', sort_order: 1 },
    { code: 'FLOOD', label: 'Flood', description: 'Riverine, flash, urban flooding', sort_order: 2 },
    { code: 'EARTHQUAKE', label: 'Earthquake', description: 'Seismic event, aftershock', sort_order: 3 },
    { code: 'FIRE', label: 'Fire', description: 'Structural, wildfire, industrial', sort_order: 4 },
    { code: 'COLLAPSE', label: 'Structural Collapse', description: 'Building, bridge, infrastructure collapse', sort_order: 5 },
    { code: 'HAZMAT', label: 'Hazardous Material', description: 'Chemical, radiological, biological release', sort_order: 6 },
    { code: 'TRANSPORT', label: 'Transport Incident', description: 'Road, rail, air, maritime accident', sort_order: 7 },
    { code: 'MEDICAL', label: 'Medical Emergency', description: 'Mass casualty, epidemic, poisoning', sort_order: 8 },
    { code: 'UTILITY', label: 'Utility Disruption', description: 'Power, water, gas, communications outage', sort_order: 9 },
    { code: 'OTHER', label: 'Other', description: 'Other incident type', sort_order: 99 },
  ]);

  await knex('severity_levels').insert([
    { code: 'LOW', label: 'Low', help_text: 'Minor impact, routine handling', rank: 1, visual_treatment: 'severity-low' },
    { code: 'MEDIUM', label: 'Medium', help_text: 'Significant impact, requires attention', rank: 2, visual_treatment: 'severity-medium' },
    { code: 'HIGH', label: 'High', help_text: 'Severe impact, urgent response needed', rank: 3, visual_treatment: 'severity-high' },
    { code: 'CRITICAL', label: 'Critical', help_text: 'Life-threatening, immediate action required', rank: 4, visual_treatment: 'severity-critical' },
  ]);

  await knex('priority_levels').insert([
    { code: 'P1', label: 'Priority 1 - Immediate', rank: 1 },
    { code: 'P2', label: 'Priority 2 - High', rank: 2 },
    { code: 'P3', label: 'Priority 3 - Normal', rank: 3 },
    { code: 'P4', label: 'Priority 4 - Low', rank: 4 },
  ]);

  await knex('team_types').insert([
    { code: 'search_rescue', label: 'Search & Rescue' },
    { code: 'medical', label: 'Medical Team' },
    { code: 'fire_suppression', label: 'Fire Suppression' },
    { code: 'hazmat', label: 'HazMat Response' },
    { code: 'engineering', label: 'Engineering/Infrastructure' },
    { code: 'logistics', label: 'Logistics/Support' },
    { code: 'incident_command', label: 'Incident Command' },
    { code: 'other', label: 'Other' },
  ]);

  await knex('relationship_types').insert([
    { code: 'primary', label: 'Primary Report', description: 'Main report for this incident' },
    { code: 'corroborating', label: 'Corroborating', description: 'Supports primary report' },
    { code: 'duplicate', label: 'Duplicate', description: 'Same event, separate submission' },
    { code: 'related', label: 'Related', description: 'Related but distinct event' },
    { code: 'context_only', label: 'Context Only', description: 'Provides contextual information' },
  ]);

  await knex('evidence_kinds').insert([
    { code: 'photo', label: 'Photograph' },
    { code: 'video', label: 'Video' },
    { code: 'audio', label: 'Audio Recording' },
    { code: 'document', label: 'Document' },
  ]);

  await knex('reason_codes').insert([
    { code: 'VERIFIED_EVIDENCE', label: 'Verified by Evidence', applies_to: 'verification', requires_text: false },
    { code: 'VERIFIED_WITNESS', label: 'Verified by Witness', applies_to: 'verification', requires_text: false },
    { code: 'NEEDS_INFO', label: 'Needs More Information', applies_to: 'verification', requires_text: true },
    { code: 'DUPLICATE_REPORT', label: 'Duplicate of Existing Report', applies_to: 'verification', requires_text: true },
    { code: 'REJECTED_FALSE', label: 'False/Incorrect Report', applies_to: 'verification', requires_text: true },
    { code: 'REJECTED_OUT_OF_SCOPE', label: 'Outside Jurisdiction/Scope', applies_to: 'verification', requires_text: true },
    { code: 'ASSIGNED_NEARBY', label: 'Team Nearby', applies_to: 'assignment', requires_text: false },
    { code: 'ASSIGNED_SPECIALIZED', label: 'Specialized Capability Required', applies_to: 'assignment', requires_text: false },
    { code: 'REASSIGNED_WORKLOAD', label: 'Workload Rebalancing', applies_to: 'assignment', requires_text: true },
    { code: 'RESOLVED_ACTION_TAKEN', label: 'Action Taken - Resolved', applies_to: 'incident', requires_text: true },
    { code: 'RESOLVED_FALSE_ALARM', label: 'False Alarm', applies_to: 'incident', requires_text: true },
    { code: 'CLOSED_COMPLETE', label: 'All Actions Complete', applies_to: 'incident', requires_text: false },
  ]);

  await knex('report_states').insert([
    { code: 'local_saved', label: 'Saved Locally', description: 'Saved on originating device; not yet delivered', sort_order: 1 },
    { code: 'queued', label: 'Queued', description: 'In local outbox awaiting delivery', sort_order: 2 },
    { code: 'sending', label: 'Sending', description: 'Delivery attempt in progress', sort_order: 3 },
    { code: 'relayed', label: 'Relayed', description: 'Trusted intermediary accepted relay packet', sort_order: 4 },
    { code: 'server_received', label: 'Server Received', description: 'Server durably accepted report metadata', sort_order: 5 },
    { code: 'authority_acknowledged', label: 'Authority Acknowledged', description: 'Authorized operator acknowledged receipt', sort_order: 6 },
    { code: 'under_review', label: 'Under Review', description: 'Authority is checking report details', sort_order: 7 },
    { code: 'needs_information', label: 'Needs Information', description: 'Authority requested additional information', sort_order: 8 },
    { code: 'verified', label: 'Verified', description: 'Authority verified report according to policy', sort_order: 9 },
    { code: 'duplicate', label: 'Duplicate', description: 'Report is associated as duplicate/corroborating', sort_order: 10 },
    { code: 'rejected', label: 'Rejected', description: 'Authority rejected report with reason', sort_order: 11 },
    { code: 'closed', label: 'Closed', description: 'Report-level workflow closed', sort_order: 12, is_terminal: true },
  ]);

  await knex('incident_states').insert([
    { code: 'new', label: 'New', description: 'Newly created incident', sort_order: 1 },
    { code: 'triaged', label: 'Triaged', description: 'Initial assessment complete', sort_order: 2 },
    { code: 'verified', label: 'Verified', description: 'Incident verified by authority', sort_order: 3 },
    { code: 'assigned', label: 'Assigned', description: 'Response team assigned', sort_order: 4 },
    { code: 'dispatched', label: 'Dispatched', description: 'Team dispatched to scene', sort_order: 5 },
    { code: 'response_in_progress', label: 'Response In Progress', description: 'Team actively responding', sort_order: 6 },
    { code: 'resolved', label: 'Resolved', description: 'Incident resolved', sort_order: 7 },
    { code: 'closed', label: 'Closed', description: 'Incident closed with outcome', sort_order: 8, is_terminal: true },
  ]);

  await knex('assignment_states').insert([
    { code: 'proposed', label: 'Proposed', description: 'Assignment proposed, not yet sent', sort_order: 1 },
    { code: 'sent', label: 'Sent', description: 'Assignment sent to team', sort_order: 2 },
    { code: 'acknowledged', label: 'Acknowledged', description: 'Team acknowledged assignment', sort_order: 3 },
    { code: 'en_route', label: 'En Route', description: 'Team en route to scene', sort_order: 4 },
    { code: 'on_scene', label: 'On Scene', description: 'Team arrived at scene', sort_order: 5 },
    { code: 'working', label: 'Working', description: 'Team actively working', sort_order: 6 },
    { code: 'completed', label: 'Completed', description: 'Assignment completed', sort_order: 7, is_terminal: true },
    { code: 'cancelled', label: 'Cancelled', description: 'Assignment cancelled', sort_order: 8, is_terminal: true },
    { code: 'declined', label: 'Declined', description: 'Team declined assignment', sort_order: 9, is_terminal: true },
  ]);

  await knex('evidence_storage_states').insert([
    { code: 'local_only', label: 'Local Only', is_terminal: false },
    { code: 'upload_pending', label: 'Upload Pending', is_terminal: false },
    { code: 'uploading', label: 'Uploading', is_terminal: false },
    { code: 'stored', label: 'Stored', is_terminal: false },
    { code: 'failed', label: 'Failed', is_terminal: true },
    { code: 'deleted_per_policy', label: 'Deleted Per Policy', is_terminal: true },
  ]);

  await knex('evidence_integrity_states').insert([
    { code: 'pending', label: 'Pending', is_verified: false },
    { code: 'checksum_verified', label: 'Checksum Verified', is_verified: true },
    { code: 'signature_verified', label: 'Signature Verified', is_verified: true },
    { code: 'warning', label: 'Warning', is_verified: false },
    { code: 'rejected', label: 'Rejected', is_verified: false },
  ]);

  await knex('evidence_access_classes').insert([
    { code: 'restricted', label: 'Restricted', rank: 1 },
    { code: 'operational', label: 'Operational', rank: 2 },
    { code: 'approved_public_derivative', label: 'Approved Public Derivative', rank: 3 },
  ]);

  await knex('location_sources').insert([
    { code: 'GNSS', label: 'GNSS/GPS' },
    { code: 'network', label: 'Network/Cell Tower' },
    { code: 'manual', label: 'Manual Entry' },
    { code: 'map_pin', label: 'Map Pin' },
    { code: 'unknown', label: 'Unknown' },
  ]);

  await knex('capture_modes').insert([
    { code: 'LIVE_CAMERA', label: 'Live Camera' },
    { code: 'DESKTOP_CAMERA', label: 'Desktop Camera' },
    { code: 'STRUCTURED_ONLY', label: 'Structured Only (No Media)' },
    { code: 'APPROVED_IMPORT', label: 'Approved Import' },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('capture_modes');
  await knex.schema.dropTableIfExists('location_sources');
  await knex.schema.dropTableIfExists('evidence_access_classes');
  await knex.schema.dropTableIfExists('evidence_integrity_states');
  await knex.schema.dropTableIfExists('evidence_storage_states');
  await knex.schema.dropTableIfExists('assignment_states');
  await knex.schema.dropTableIfExists('incident_states');
  await knex.schema.dropTableIfExists('report_states');
  await knex.schema.dropTableIfExists('reason_codes');
  await knex.schema.dropTableIfExists('evidence_kinds');
  await knex.schema.dropTableIfExists('relationship_types');
  await knex.schema.dropTableIfExists('team_types');
  await knex.schema.dropTableIfExists('organization_types');
  await knex.schema.dropTableIfExists('priority_levels');
  await knex.schema.dropTableIfExists('severity_levels');
  await knex.schema.dropTableIfExists('incident_categories');
  await knex.schema.dropTableIfExists('devices');
  await knex.schema.dropTableIfExists('organization_memberships');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('organizations');

  await knex.raw('DROP EXTENSION IF EXISTS postgis;');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp";');
}
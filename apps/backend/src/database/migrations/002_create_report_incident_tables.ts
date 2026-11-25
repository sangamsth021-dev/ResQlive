import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Reports table - the core source submission
  await knex.schema.createTable('reports', (table) => {
    table.uuid('report_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('client_report_number', 40).nullable(); // Human-readable local reference
    table.uuid('reporter_user_id').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.uuid('device_id').nullable().references('device_id').inTable('devices').onDelete('SET NULL');
    table.uuid('origin_node_id').nullable(); // EOC/client node identity
    table.uuid('organization_id').notNullable().references('organization_id').inTable('organizations').onDelete('CASCADE');

    table.string('category_code', 50).notNullable().references('code').inTable('incident_categories');
    table.string('severity_code', 30).notNullable().references('code').inTable('severity_levels');
    table.text('description').nullable();
    table.jsonb('impact_json').notNullable().defaultTo('{}'); // Versioned structured impact

    table.string('capture_mode', 20).notNullable().references('code').inTable('capture_modes');
    table.timestamp('captured_at_device').nullable(); // Client claim
    table.smallint('device_timezone_offset_min').nullable(); // Offset at capture

    // Location - using PostGIS geography
    table.geography('reported_location', 'Point', 4326).nullable();
    table.decimal('latitude', 10, 7).nullable(); // For serialization
    table.decimal('longitude', 10, 7).nullable();
    table.decimal('location_accuracy_m', 10, 2).nullable(); // Non-negative
    table.string('location_source', 20).notNullable().references('code').inTable('location_sources');
    table.timestamp('location_captured_at').nullable();

    // Server-side timestamps and state
    table.timestamp('server_received_at').nullable(); // Set by server on durable receipt
    table.string('report_state', 30).notNullable().references('code').inTable('report_states').defaultTo('local_saved');
    table.timestamp('authority_acknowledged_at').nullable(); // Set by authority action

    // Optimistic concurrency and versioning
    table.integer('version').notNullable().defaultTo(1);
    table.integer('schema_version').notNullable().defaultTo(1);

    table.timestamps(true, true);

    // Indexes
    table.index('organization_id');
    table.index('reporter_user_id');
    table.index('device_id');
    table.index('origin_node_id');
    table.index('category_code');
    table.index('severity_code');
    table.index('report_state');
    table.index('server_received_at');
    table.index('created_at');
    table.index(['organization_id', 'server_received_at']);
    table.index(['organization_id', 'report_state', 'server_received_at']);

    // GiST index for spatial queries
    table.index('reported_location', undefined, 'GIST');
  });

  // Evidence table - media attached to reports
  await knex.schema.createTable('evidence', (table) => {
    table.uuid('evidence_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('report_id').notNullable().references('report_id').inTable('reports').onDelete('CASCADE');
    table.uuid('parent_evidence_id').nullable().references('evidence_id').inTable('evidence'); // For derivatives
    table.string('evidence_kind', 20).notNullable().references('code').inTable('evidence_kinds');
    table.string('capture_mode', 20).notNullable().references('code').inTable('capture_modes');
    table.string('local_filename', 255).nullable(); // Client-only pointer
    table.text('object_key').nullable(); // Private object-store key
    table.string('mime_type', 120).notNullable();
    table.bigint('byte_size').notNullable().defaultTo(0);
    table.char('sha256_hex', 64).nullable(); // Hash of exact stored object bytes
    table.timestamp('captured_at_device').nullable();
    table.jsonb('capture_manifest').notNullable().defaultTo('{}'); // Versioned metadata
    table.text('manifest_signature').nullable(); // Device signature over manifest
    table.string('integrity_status', 24).notNullable().references('code').inTable('evidence_integrity_states').defaultTo('pending');
    table.string('storage_status', 24).notNullable().references('code').inTable('evidence_storage_states').defaultTo('local_only');
    table.string('access_class', 24).notNullable().references('code').inTable('evidence_access_classes').defaultTo('restricted');
    table.timestamp('stored_at').nullable(); // Server time for verified storage
    table.timestamps(true, true);

    // Indexes
    table.index('report_id');
    table.index('parent_evidence_id');
    table.index('storage_status');
    table.index('integrity_status');
    table.index('object_key');
    table.unique(['object_key']);
    table.check('byte_size >= 0');
  });

  // Incidents table - authority-managed operational cases
  await knex.schema.createTable('incidents', (table) => {
    table.uuid('incident_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('organization_id').inTable('organizations').onDelete('CASCADE');
    table.string('title', 200).notNullable(); // Operator-approved title
    table.string('category_code', 50).notNullable().references('code').inTable('incident_categories');
    table.string('priority_code', 24).notNullable().references('code').inTable('priority_levels');
    table.string('status', 30).notNullable().references('code').inTable('incident_states').defaultTo('new');
    table.geography('location', 'Point', 4326).nullable(); // Authority-selected canonical location
    table.decimal('location_accuracy_m', 10, 2).nullable();
    table.text('summary').nullable(); // Authority-maintained operational summary
    table.integer('version').notNullable().defaultTo(1); // Optimistic concurrency
    table.uuid('created_by').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.timestamp('closed_at').nullable();
    table.timestamps(true, true);

    // Indexes
    table.index('organization_id');
    table.index('status');
    table.index('priority_code');
    table.index('category_code');
    table.index('created_by');
    table.index('updated_at');
    table.index('location', undefined, 'GIST');
    table.index(['organization_id', 'status', 'priority_code', 'updated_at']);
  });

  // Incident-Reports junction table (many-to-many)
  await knex.schema.createTable('incident_reports', (table) => {
    table.uuid('link_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('incident_id').notNullable().references('incident_id').inTable('incidents').onDelete('CASCADE');
    table.uuid('report_id').notNullable().references('report_id').inTable('reports').onDelete('CASCADE');
    table.string('relationship_type', 24).notNullable().references('code').inTable('relationship_types');
    table.uuid('linked_by').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.timestamp('linked_at').notNullable().defaultTo(knex.fn.now());
    table.text('reason').nullable();

    // Unique constraint: one link per incident/report pair
    table.unique(['incident_id', 'report_id']);

    // Indexes
    table.index('incident_id');
    table.index('report_id');
    table.index('relationship_type');
  });

  // Response Teams table
  await knex.schema.createTable('response_teams', (table) => {
    table.uuid('team_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('organization_id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 160).notNullable(); // Display name/callsign
    table.string('team_type', 40).notNullable().references('code').inTable('team_types');
    table.string('availability_status', 24).notNullable().defaultTo('unknown'); // available, busy, unavailable, unknown
    table.string('contact_channel', 30).nullable(); // Protected operational contact route
    table.timestamps(true, true);

    // Indexes
    table.index('organization_id');
    table.index('team_type');
    table.index('availability_status');
  });

  // Assignments table - links incidents to teams
  await knex.schema.createTable('assignments', (table) => {
    table.uuid('assignment_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('incident_id').notNullable().references('incident_id').inTable('incidents').onDelete('CASCADE');
    table.uuid('team_id').nullable().references('team_id').inTable('response_teams').onDelete('SET NULL');
    table.uuid('assigned_by').notNullable().references('user_id').inTable('users').onDelete('CASCADE');
    table.text('instructions').nullable(); // Task-specific instruction with access controls
    table.string('priority_code', 24).notNullable().references('code').inTable('priority_levels');
    table.string('status', 24).notNullable().references('code').inTable('assignment_states').defaultTo('proposed');
    table.integer('version').notNullable().defaultTo(1); // Optimistic concurrency
    table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('acknowledged_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);

    // Indexes
    table.index('incident_id');
    table.index('team_id');
    table.index('assigned_by');
    table.index('status');
    table.index('priority_code');
    table.index(['incident_id', 'status']);
    table.index(['team_id', 'status']);
    table.index('assigned_at');
  });

  // Status Events table - append-only state transitions
  await knex.schema.createTable('status_events', (table) => {
    table.uuid('event_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('aggregate_type', 24).notNullable(); // report, incident, assignment, membership, device
    table.uuid('aggregate_id').notNullable();
    table.bigint('sequence_number').notNullable(); // Monotonic per aggregate
    table.string('from_state', 30).nullable();
    table.string('to_state', 30).notNullable();
    table.uuid('actor_user_id').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.uuid('actor_node_id').nullable(); // Originating node/device
    table.string('reason_code', 60).nullable().references('code').inTable('reason_codes');
    table.text('reason_text').nullable();
    table.timestamp('occurred_at_device').nullable(); // Client claim for offline-origin events
    table.timestamp('recorded_at_server').notNullable().defaultTo(knex.fn.now());
    table.uuid('correlation_id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // Unique constraint: one event per aggregate per sequence
    table.unique(['aggregate_type', 'aggregate_id', 'sequence_number']);

    // Indexes
    table.index('aggregate_type');
    table.index('aggregate_id');
    table.index(['aggregate_type', 'aggregate_id']);
    table.index('actor_user_id');
    table.index('recorded_at_server');
    table.index('correlation_id');
    table.index('reason_code');
  });

  // Audit Logs table - append-only audit trail
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('audit_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('action_code', 60).notNullable(); // Controlled action vocabulary
    table.string('target_type', 50).notNullable();
    table.uuid('target_id').notNullable();
    table.uuid('actor_user_id').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.uuid('actor_organization_id').nullable().references('organization_id').inTable('organizations').onDelete('SET NULL');
    table.string('result', 20).notNullable().defaultTo('success'); // success, denied, failed
    table.jsonb('metadata_redacted').nullable(); // Limited, reviewed audit context
    table.timestamp('recorded_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('correlation_id').nullable();

    // Indexes
    table.index('action_code');
    table.index('target_type');
    table.index('target_id');
    table.index('actor_user_id');
    table.index('actor_organization_id');
    table.index('recorded_at');
    table.index('correlation_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('status_events');
  await knex.schema.dropTableIfExists('assignments');
  await knex.schema.dropTableIfExists('response_teams');
  await knex.schema.dropTableIfExists('incident_reports');
  await knex.schema.dropTableIfExists('incidents');
  await knex.schema.dropTableIfExists('evidence');
  await knex.schema.dropTableIfExists('reports');
}
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Notifications table - async delivery intents
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('notification_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('recipient_user_id').notNullable().references('user_id').inTable('users').onDelete('CASCADE');
    table.string('channel', 20).notNullable(); // push, sms, email, in_app
    table.string('template_code', 60).notNullable();
    table.string('related_type', 50).nullable(); // report, incident, assignment
    table.uuid('related_id').nullable();
    table.string('delivery_state', 20).notNullable().defaultTo('pending'); // pending, sent, delivered, failed, dead_letter
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('next_attempt_at').nullable();
    table.string('provider_reference', 100).nullable(); // External provider message ID
    table.jsonb('payload').nullable(); // Template variables
    table.timestamp('sent_at').nullable();
    table.timestamp('delivered_at').nullable();
    table.text('error_message').nullable();
    table.timestamps(true, true);

    // Indexes
    table.index('recipient_user_id');
    table.index('delivery_state');
    table.index('next_attempt_at');
    table.index(['related_type', 'related_id']);
    table.index('channel');
  });

  // Sync Nodes table - registered client/EOC nodes
  await knex.schema.createTable('sync_nodes', (table) => {
    table.uuid('node_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('node_type', 20).notNullable(); // mobile, desktop, edge_node
    table.uuid('organization_id').nullable().references('organization_id').inTable('organizations').onDelete('SET NULL');
    table.text('public_key').nullable(); // Node public key/certificate reference
    table.string('status', 20).notNullable().defaultTo('active'); // active, suspended, revoked
    table.timestamp('last_sync_at').nullable();
    table.timestamp('last_seen_at').nullable();
    table.timestamps(true, true);

    // Indexes
    table.index('node_type');
    table.index('organization_id');
    table.index('status');
  });

  // Sync Outbox - durable events awaiting delivery
  await knex.schema.createTable('sync_outbox', (table) => {
    table.uuid('event_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('origin_node_id').notNullable().references('node_id').inTable('sync_nodes').onDelete('CASCADE');
    table.bigint('sequence').notNullable(); // Local sequence per node
    table.string('aggregate_type', 24).notNullable(); // report, incident, assignment, etc.
    table.uuid('aggregate_id').notNullable();
    table.string('event_type', 50).notNullable(); // REPORT_SUBMITTED, REPORT_ACKNOWLEDGED, etc.
    table.integer('schema_version').notNullable().defaultTo(1);
    table.jsonb('payload').notNullable();
    table.char('payload_hash', 64).notNullable(); // SHA-256 of canonical payload
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.string('delivery_state', 20).notNullable().defaultTo('pending'); // pending, delivering, delivered, failed, dead_letter
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('next_attempt_at').nullable();
    table.text('last_error_code').nullable();

    // Indexes
    table.index('origin_node_id');
    table.index(['origin_node_id', 'sequence']);
    table.index('delivery_state');
    table.index('next_attempt_at');
    table.index('created_at');
    table.index(['aggregate_type', 'aggregate_id']);
    table.unique(['origin_node_id', 'sequence']);
  });

  // Sync Inbox - received events for deduplication
  await knex.schema.createTable('sync_inbox', (table) => {
    table.uuid('inbox_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('origin_node_id').notNullable().references('node_id').inTable('sync_nodes').onDelete('CASCADE');
    table.uuid('event_id').notNullable(); // Original event ID from sender
    table.timestamp('received_at').notNullable().defaultTo(knex.fn.now());
    table.char('payload_hash', 64).notNullable();
    table.string('processing_result', 30).notNullable(); // ACCEPTED, ALREADY_PROCESSED, REJECTED_VALIDATION, CONFLICT, etc.
    table.bigint('server_sequence').nullable(); // Server-generated global sequence
    table.jsonb('response_json').nullable(); // Full response for debugging
    table.timestamps(true, true);

    // Unique constraint: one inbox entry per origin_node_id + event_id
    table.unique(['origin_node_id', 'event_id']);

    // Indexes
    table.index('origin_node_id');
    table.index('processing_result');
    table.index('received_at');
    table.index('server_sequence');
  });

  // Sync Cursors - tracks pull progress per consumer
  await knex.schema.createTable('sync_cursors', (table) => {
    table.uuid('cursor_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('consumer_node_id').notNullable().references('node_id').inTable('sync_nodes').onDelete('CASCADE');
    table.string('stream_name', 50).notNullable(); // authority-updates, report-updates, etc.
    table.bigint('last_sequence').notNullable().defaultTo(0); // Last applied server_sequence
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Unique constraint: one cursor per consumer per stream
    table.unique(['consumer_node_id', 'stream_name']);

    // Indexes
    table.index('consumer_node_id');
    table.index('stream_name');
  });

  // Sync Conflicts - quarantined conflicts for manual resolution
  await knex.schema.createTable('sync_conflicts', (table) => {
    table.uuid('conflict_id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('aggregate_type', 24).notNullable();
    table.uuid('aggregate_id').notNullable();
    table.uuid('incoming_event_id').notNullable();
    table.integer('current_version').notNullable();
    table.integer('incoming_version').notNullable();
    table.string('conflict_type', 50).notNullable(); // version_mismatch, transition_invalid, hash_mismatch, etc.
    table.string('resolution_state', 20).notNullable().defaultTo('pending'); // pending, resolved_local, resolved_remote, merged
    table.uuid('resolved_by').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.timestamp('resolved_at').nullable();
    table.jsonb('local_payload').nullable();
    table.jsonb('incoming_payload').nullable();
    table.timestamps(true, true);

    // Indexes
    table.index('aggregate_type');
    table.index('aggregate_id');
    table.index(['aggregate_type', 'aggregate_id']);
    table.index('resolution_state');
    table.index('incoming_event_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sync_conflicts');
  await knex.schema.dropTableIfExists('sync_cursors');
  await knex.schema.dropTableIfExists('sync_inbox');
  await knex.schema.dropTableIfExists('sync_outbox');
  await knex.schema.dropTableIfExists('sync_nodes');
  await knex.schema.dropTableIfExists('notifications');
}
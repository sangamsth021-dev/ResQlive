/**
 * ResQ Live — RBAC Test Data Seeding Script
 *
 * Creates deterministic test fixtures for RBAC integration testing.
 * Uses actual database schema, bcrypt password hashing, and valid relationships.
 *
 * Run with: npx ts-node apps/backend/test/fixtures/rbac-test-seed.ts
 * Requires: DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD environment variables
 *
 * Deterministic UUIDs ensure consistent test data across runs.
 */

import { Knex, knex } from 'knex';
import * as bcrypt from 'bcrypt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Load environment configuration
ConfigModule.forRoot({
  envFilePath: ['.env.local', '.env', '.env.test'],
  isGlobal: true,
});

const configService = new ConfigService();

// ============================================
// Deterministic Test UUIDs
// ============================================

// Organizations
const ORG_A_ID = '11111111-1111-1111-1111-111111111111'; // Test Authority A
const ORG_B_ID = '22222222-2222-2222-2222-222222222222'; // Test Authority B

// Users
const SUPER_ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_ADMIN_A_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ORG_ADMIN_B_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OPERATOR_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const RESPONDER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const REPORTER_A_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const REPORTER_B_ID = '11111111-2222-3333-4444-555555555555';
const AUDITOR_ID = '22222222-3333-4444-5555-666666666666';

// Devices
const DEVICE_SUPER_ADMIN = '33333333-4444-5555-6666-777777777777';
const DEVICE_ORG_ADMIN_A = '44444444-5555-6666-7777-888888888888';
const DEVICE_OPERATOR = '55555555-6666-7777-8888-999999999999';
const DEVICE_RESPONDER = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const DEVICE_REPORTER_A = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
const DEVICE_REPORTER_B = '88888888-9999-aaaa-bbbb-cccccccccccc';
const DEVICE_AUDITOR = '99999999-aaaa-bbbb-cccc-dddddddddddd';

// Reports
const REPORT_A_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; // Reporter A in Org A
const REPORT_B_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'; // Reporter B in Org B

// Incidents
const INCIDENT_A_ID = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'; // Org A, assigned to responder
const INCIDENT_B_ID = 'dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb'; // Org B, unassigned

// Assignments
const ASSIGNMENT_A_ID = 'eeeeeeee-ffff-aaaa-bbbb-cccccccccccc'; // Incident A -> Responder

// Response Team
const TEAM_A_ID = 'ffffffff-aaaa-bbbb-cccc-dddddddddddd';

// Password for all test users (hashed with bcrypt)
const TEST_PASSWORD = 'TestPass123!';
const TEST_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PZvO.S'; // bcrypt hash of 'TestPass123!'

// ============================================
// Knex Configuration
// ============================================

function createKnexClient(): Knex {
  return knex({
    client: 'pg',
    connection: {
      host: configService.get('DB_HOST', 'localhost'),
      port: configService.get('DB_PORT', 5432),
      user: configService.get('DB_USER', 'postgres'),
      password: configService.get('DB_PASSWORD', 'postgres'),
      database: configService.get('DB_NAME', 'resq_live_test'),
    },
    pool: { min: 2, max: 10 },
  });
}

// ============================================
// Helper Functions
// ============================================

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function truncateTables(knexClient: Knex): Promise<void> {
  // Truncate in reverse dependency order
  const tables = [
    'sync_conflicts',
    'sync_cursors',
    'sync_inbox',
    'sync_outbox',
    'sync_nodes',
    'notifications',
    'audit_logs',
    'status_events',
    'assignments',
    'response_teams',
    'incident_reports',
    'incidents',
    'evidence',
    'reports',
    'devices',
    'organization_memberships',
    'users',
    'organizations',
  ];

  for (const table of tables) {
    try {
      await knexClient(table).truncate();
      console.log(`  ✓ Truncated ${table}`);
    } catch (error) {
      // Table might not exist yet
      console.log(`  ⚠ Table ${table} not found (may not exist yet): ${error.message}`);
    }
  }
}

// ============================================
// Seeding Functions
// ============================================

async function seedOrganizations(knexClient: Knex): Promise<void> {
  console.log('\n📦 Seeding Organizations...');

  await knexClient('organizations').insert([
    {
      organization_id: ORG_A_ID,
      name: 'Test Authority A',
      organization_type: 'authority',
      jurisdiction_code: 'TEST-A-001',
      status: 'active',
      timezone: 'UTC',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      organization_id: ORG_B_ID,
      name: 'Test Authority B',
      organization_type: 'authority',
      jurisdiction_code: 'TEST-B-001',
      status: 'active',
      timezone: 'UTC',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
  ]).onConflict('organization_id').merge();

  console.log(`  ✓ Organization A: ${ORG_A_ID}`);
  console.log(`  ✓ Organization B: ${ORG_B_ID}`);
}

async function seedUsers(knexClient: Knex): Promise<void> {
  console.log('\n👥 Seeding Users...');

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const users = [
    {
      user_id: SUPER_ADMIN_ID,
      display_name: 'Super Administrator',
      phone_e164: '+15550000001',
      email: 'superadmin@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: ORG_ADMIN_A_ID,
      display_name: 'Org Admin A',
      phone_e164: '+15550000002',
      email: 'orgadmin-a@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: ORG_ADMIN_B_ID,
      display_name: 'Org Admin B',
      phone_e164: '+15550000003',
      email: 'orgadmin-b@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: OPERATOR_ID,
      display_name: 'Authority Operator',
      phone_e164: '+15550000004',
      email: 'operator@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: RESPONDER_ID,
      display_name: 'Incident Responder',
      phone_e164: '+15550000005',
      email: 'responder@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: REPORTER_A_ID,
      display_name: 'Reporter Alpha',
      phone_e164: '+15550000006',
      email: 'reporter-a@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: REPORTER_B_ID,
      display_name: 'Reporter Bravo',
      phone_e164: '+15550000007',
      email: 'reporter-b@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      user_id: AUDITOR_ID,
      display_name: 'Compliance Auditor',
      phone_e164: '+15550000008',
      email: 'auditor@test.resq.live',
      password_hash: passwordHash,
      account_status: 'active',
      preferred_language: 'en',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
  ];

  for (const user of users) {
    await knexClient('users').insert(user).onConflict('user_id').merge();
    console.log(`  ✓ User: ${user.display_name} (${user.user_id})`);
  }
}

async function seedMemberships(knexClient: Knex): Promise<void> {
  console.log('\n🔗 Seeding Organization Memberships...');

  const memberships = [
    // Super Admin - platform-wide, no org membership needed for platform access
    // But we'll give them an org_admin membership in Org A for convenience
    {
      membership_id: 'm1111111-1111-1111-1111-111111111111',
      user_id: SUPER_ADMIN_ID,
      organization_id: ORG_A_ID,
      role_code: 'org_admin',
      scope_json: { platform_wide: true },
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Org Admin A
    {
      membership_id: 'm2222222-2222-2222-2222-222222222222',
      user_id: ORG_ADMIN_A_ID,
      organization_id: ORG_A_ID,
      role_code: 'org_admin',
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Org Admin B
    {
      membership_id: 'm3333333-3333-3333-3333-333333333333',
      user_id: ORG_ADMIN_B_ID,
      organization_id: ORG_B_ID,
      role_code: 'org_admin',
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Operator in Org A
    {
      membership_id: 'm4444444-4444-4444-4444-444444444444',
      user_id: OPERATOR_ID,
      organization_id: ORG_A_ID,
      role_code: 'operator',
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Responder in Org A
    {
      membership_id: 'm5555555-5555-5555-5555-555555555555',
      user_id: RESPONDER_ID,
      organization_id: ORG_A_ID,
      role_code: 'team_lead', // Using team_lead as it maps to INCIDENT_RESPONDER permissions
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Reporter A in Org A
    {
      membership_id: 'm6666666-6666-6666-6666-666666666666',
      user_id: REPORTER_A_ID,
      organization_id: ORG_A_ID,
      role_code: 'reporter',
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Reporter B in Org B
    {
      membership_id: 'm7777777-7777-7777-7777-777777777777',
      user_id: REPORTER_B_ID,
      organization_id: ORG_B_ID,
      role_code: 'reporter',
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
    // Auditor in Org A
    {
      membership_id: 'm8888888-8888-8888-8888-888888888888',
      user_id: AUDITOR_ID,
      organization_id: ORG_A_ID,
      role_code: 'verifier', // Using verifier as it maps to AUDITOR permissions
      scope_json: {},
      status: 'active',
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_to: null,
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
  ];

  for (const membership of memberships) {
    await knexClient('organization_memberships').insert(membership).onConflict(['user_id', 'organization_id', 'role_code']).merge();
    console.log(`  ✓ Membership: ${membership.user_id} -> ${membership.organization_id} as ${membership.role_code}`);
  }
}

async function seedDevices(knexClient: Knex): Promise<void> {
  console.log('\n📱 Seeding Devices...');

  const devices = [
    { device_id: DEVICE_SUPER_ADMIN, user_id: SUPER_ADMIN_ID, organization_id: ORG_A_ID, platform: 'desktop' },
    { device_id: DEVICE_ORG_ADMIN_A, user_id: ORG_ADMIN_A_ID, organization_id: ORG_A_ID, platform: 'desktop' },
    { device_id: DEVICE_OPERATOR, user_id: OPERATOR_ID, organization_id: ORG_A_ID, platform: 'desktop' },
    { device_id: DEVICE_RESPONDER, user_id: RESPONDER_ID, organization_id: ORG_A_ID, platform: 'android' },
    { device_id: DEVICE_REPORTER_A, user_id: REPORTER_A_ID, organization_id: ORG_A_ID, platform: 'android' },
    { device_id: DEVICE_REPORTER_B, user_id: REPORTER_B_ID, organization_id: ORG_B_ID, platform: 'android' },
    { device_id: DEVICE_AUDITOR, user_id: AUDITOR_ID, organization_id: ORG_A_ID, platform: 'desktop' },
  ];

  for (const device of devices) {
    await knexClient('devices').insert({
      ...device,
      app_version: '1.0.0-test',
      public_key: `test-public-key-${device.device_id}`,
      key_algorithm: 'ED25519',
      device_status: 'active',
      last_seen_at: new Date(),
      registered_at: new Date('2024-01-01T00:00:00Z'),
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    }).onConflict('device_id').merge();
    console.log(`  ✓ Device: ${device.device_id} (${device.platform}) for ${device.user_id}`);
  }
}

async function seedReports(knexClient: Knex): Promise<void> {
  console.log('\n📋 Seeding Reports...');

  const reports = [
    {
      report_id: REPORT_A_ID,
      client_report_number: 'RPT-A-001',
      reporter_user_id: REPORTER_A_ID,
      device_id: DEVICE_REPORTER_A,
      origin_node_id: DEVICE_REPORTER_A,
      organization_id: ORG_A_ID,
      category_code: 'LANDSLIDE',
      severity_code: 'HIGH',
      description: 'Landslide on Main Road, blocking traffic',
      impact_json: { affected_population: 500, road_closure: true, estimated_damage_usd: 100000 },
      capture_mode: 'LIVE_CAMERA',
      captured_at_device: new Date('2024-06-15T10:30:00Z'),
      device_timezone_offset_min: 0,
      reported_location: knexClient.raw("ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography"),
      latitude: 37.7749,
      longitude: -122.4194,
      location_accuracy_m: 10.5,
      location_source: 'GNSS',
      location_captured_at: new Date('2024-06-15T10:30:00Z'),
      server_received_at: new Date('2024-06-15T10:30:05Z'),
      report_state: 'server_received',
      authority_acknowledged_at: null,
      version: 1,
      schema_version: 1,
      created_at: new Date('2024-06-15T10:30:05Z'),
      updated_at: new Date('2024-06-15T10:30:05Z'),
    },
    {
      report_id: REPORT_B_ID,
      client_report_number: 'RPT-B-001',
      reporter_user_id: REPORTER_B_ID,
      device_id: DEVICE_REPORTER_B,
      origin_node_id: DEVICE_REPORTER_B,
      organization_id: ORG_B_ID,
      category_code: 'FLOOD',
      severity_code: 'MEDIUM',
      description: 'Flash flooding in downtown area',
      impact_json: { affected_population: 200, road_closure: false, estimated_damage_usd: 50000 },
      capture_mode: 'LIVE_CAMERA',
      captured_at_device: new Date('2024-06-15T11:00:00Z'),
      device_timezone_offset_min: 0,
      reported_location: knexClient.raw("ST_SetSRID(ST_MakePoint(-122.4000, 37.7800), 4326)::geography"),
      latitude: 37.7800,
      longitude: -122.4000,
      location_accuracy_m: 15.0,
      location_source: 'GNSS',
      location_captured_at: new Date('2024-06-15T11:00:00Z'),
      server_received_at: new Date('2024-06-15T11:00:05Z'),
      report_state: 'server_received',
      authority_acknowledged_at: null,
      version: 1,
      schema_version: 1,
      created_at: new Date('2024-06-15T11:00:05Z'),
      updated_at: new Date('2024-06-15T11:00:05Z'),
    },
  ];

  for (const report of reports) {
    await knexClient('reports').insert(report).onConflict('report_id').merge();
    console.log(`  ✓ Report: ${report.report_id} (${report.category_code}, ${report.severity_code}) by ${report.reporter_user_id} in org ${report.organization_id}`);
  }
}

async function seedIncidents(knexClient: Knex): Promise<void> {
  console.log('\n🚨 Seeding Incidents...');

  const incidents = [
    {
      incident_id: INCIDENT_A_ID,
      organization_id: ORG_A_ID,
      title: 'Landslide Incident - Main Road',
      category_code: 'LANDSLIDE',
      priority_code: 'P1',
      status: 'assigned',
      location: knexClient.raw("ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography"),
      location_accuracy_m: 10.5,
      summary: 'Major landslide blocking Main Road. Response team dispatched.',
      version: 1,
      created_by: OPERATOR_ID,
      closed_at: null,
      created_at: new Date('2024-06-15T10:45:00Z'),
      updated_at: new Date('2024-06-15T10:45:00Z'),
    },
    {
      incident_id: INCIDENT_B_ID,
      organization_id: ORG_B_ID,
      title: 'Flash Flood - Downtown',
      category_code: 'FLOOD',
      priority_code: 'P2',
      status: 'verified',
      location: knexClient.raw("ST_SetSRID(ST_MakePoint(-122.4000, 37.7800), 4326)::geography"),
      location_accuracy_m: 15.0,
      summary: 'Flash flooding reported in downtown area. Awaiting team assignment.',
      version: 1,
      created_by: ORG_ADMIN_B_ID,
      closed_at: null,
      created_at: new Date('2024-06-15T11:15:00Z'),
      updated_at: new Date('2024-06-15T11:15:00Z'),
    },
  ];

  for (const incident of incidents) {
    await knexClient('incidents').insert(incident).onConflict('incident_id').merge();
    console.log(`  ✓ Incident: ${incident.incident_id} (${incident.category_code}, ${incident.priority_code}) in org ${incident.organization_id}`);
  }
}

async function seedIncidentReports(knexClient: Knex): Promise<void> {
  console.log('\n🔗 Seeding Incident-Report Links...');

  const links = [
    {
      link_id: 'l1111111-1111-1111-1111-111111111111',
      incident_id: INCIDENT_A_ID,
      report_id: REPORT_A_ID,
      relationship_type: 'primary',
      linked_by: OPERATOR_ID,
      linked_at: new Date('2024-06-15T10:45:00Z'),
      reason: 'Primary report for this incident',
    },
    {
      link_id: 'l2222222-2222-2222-2222-222222222222',
      incident_id: INCIDENT_B_ID,
      report_id: REPORT_B_ID,
      relationship_type: 'primary',
      linked_by: ORG_ADMIN_B_ID,
      linked_at: new Date('2024-06-15T11:15:00Z'),
      reason: 'Primary report for this incident',
    },
  ];

  for (const link of links) {
    await knexClient('incident_reports').insert(link).onConflict(['incident_id', 'report_id']).merge();
    console.log(`  ✓ Link: Incident ${link.incident_id} <-> Report ${link.report_id} (${link.relationship_type})`);
  }
}

async function seedResponseTeams(knexClient: Knex): Promise<void> {
  console.log('\n🚒 Seeding Response Teams...');

  await knexClient('response_teams').insert({
    team_id: TEAM_A_ID,
    organization_id: ORG_A_ID,
    name: 'Alpha Response Team',
    team_type: 'search_rescue',
    availability_status: 'available',
    contact_channel: 'radio-alpha',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  }).onConflict('team_id').merge();

  console.log(`  ✓ Team: ${TEAM_A_ID} (Alpha Response Team)`);
}

async function seedAssignments(knexClient: Knex): Promise<void> {
  console.log('\n📋 Seeding Assignments...');

  await knexClient('assignments').insert({
    assignment_id: ASSIGNMENT_A_ID,
    incident_id: INCIDENT_A_ID,
    team_id: TEAM_A_ID,
    assigned_by: OPERATOR_ID,
    instructions: 'Respond to landslide on Main Road. Clear debris and assess structural damage.',
    priority_code: 'P1',
    status: 'acknowledged',
    version: 1,
    assigned_at: new Date('2024-06-15T10:50:00Z'),
    acknowledged_at: new Date('2024-06-15T10:55:00Z'),
    completed_at: null,
    created_at: new Date('2024-06-15T10:50:00Z'),
    updated_at: new Date('2024-06-15T10:55:00Z'),
  }).onConflict('assignment_id').merge();

  console.log(`  ✓ Assignment: ${ASSIGNMENT_A_ID} (Incident ${INCIDENT_A_ID} -> Team ${TEAM_A_ID})`);
}

async function seedStatusEvents(knexClient: Knex): Promise<void> {
  console.log('\n📜 Seeding Status Events...');

  const events = [
    {
      event_id: 'e1111111-1111-1111-1111-111111111111',
      aggregate_type: 'report',
      aggregate_id: REPORT_A_ID,
      sequence_number: 1,
      from_state: 'local_saved',
      to_state: 'server_received',
      actor_user_id: REPORTER_A_ID,
      actor_node_id: DEVICE_REPORTER_A,
      reason_code: null,
      reason_text: 'Report submitted and received by server',
      occurred_at_device: new Date('2024-06-15T10:30:00Z'),
      recorded_at_server: new Date('2024-06-15T10:30:05Z'),
      correlation_id: 'c1111111-1111-1111-1111-111111111111',
    },
    {
      event_id: 'e2222222-2222-2222-2222-222222222222',
      aggregate_type: 'incident',
      aggregate_id: INCIDENT_A_ID,
      sequence_number: 1,
      from_state: 'new',
      to_state: 'assigned',
      actor_user_id: OPERATOR_ID,
      actor_node_id: DEVICE_OPERATOR,
      reason_code: 'ASSIGNED_NEARBY',
      reason_text: 'Team assigned to incident',
      occurred_at_device: new Date('2024-06-15T10:50:00Z'),
      recorded_at_server: new Date('2024-06-15T10:50:00Z'),
      correlation_id: 'c2222222-2222-2222-2222-222222222222',
    },
    {
      event_id: 'e3333333-3333-3333-3333-333333333333',
      aggregate_type: 'assignment',
      aggregate_id: ASSIGNMENT_A_ID,
      sequence_number: 1,
      from_state: 'proposed',
      to_state: 'acknowledged',
      actor_user_id: RESPONDER_ID,
      actor_node_id: DEVICE_RESPONDER,
      reason_code: null,
      reason_text: 'Team acknowledged assignment',
      occurred_at_device: new Date('2024-06-15T10:55:00Z'),
      recorded_at_server: new Date('2024-06-15T10:55:00Z'),
      correlation_id: 'c3333333-3333-3333-3333-333333333333',
    },
  ];

  for (const event of events) {
    await knexClient('status_events').insert(event).onConflict(['aggregate_type', 'aggregate_id', 'sequence_number']).merge();
    console.log(`  ✓ Event: ${event.aggregate_type}:${event.aggregate_id} #${event.sequence_number} ${event.from_state} -> ${event.to_state}`);
  }
}

async function seedAuditLogs(knexClient: Knex): Promise<void> {
  console.log('\n📝 Seeding Audit Logs...');

  const logs = [
    {
      audit_id: 'a1111111-1111-1111-1111-111111111111',
      action_code: 'REPORT_SUBMITTED',
      target_type: 'report',
      target_id: REPORT_A_ID,
      actor_user_id: REPORTER_A_ID,
      actor_organization_id: ORG_A_ID,
      result: 'success',
      metadata_redacted: { category: 'LANDSLIDE', severity: 'HIGH' },
      recorded_at: new Date('2024-06-15T10:30:05Z'),
      correlation_id: 'c1111111-1111-1111-1111-111111111111',
    },
    {
      audit_id: 'a2222222-2222-2222-2222-222222222222',
      action_code: 'INCIDENT_CREATED',
      target_type: 'incident',
      target_id: INCIDENT_A_ID,
      actor_user_id: OPERATOR_ID,
      actor_organization_id: ORG_A_ID,
      result: 'success',
      metadata_redacted: { category: 'LANDSLIDE', priority: 'P1' },
      recorded_at: new Date('2024-06-15T10:45:00Z'),
      correlation_id: 'c2222222-2222-2222-2222-222222222222',
    },
    {
      audit_id: 'a3333333-3333-3333-3333-333333333333',
      action_code: 'ASSIGNMENT_CREATED',
      target_type: 'assignment',
      target_id: ASSIGNMENT_A_ID,
      actor_user_id: OPERATOR_ID,
      actor_organization_id: ORG_A_ID,
      result: 'success',
      metadata_redacted: { team: 'Alpha Response Team' },
      recorded_at: new Date('2024-06-15T10:50:00Z'),
      correlation_id: 'c3333333-3333-3333-3333-333333333333',
    },
  ];

  for (const log of logs) {
    await knexClient('audit_logs').insert(log).onConflict('audit_id').merge();
    console.log(`  ✓ Audit: ${log.action_code} on ${log.target_type}:${log.target_id} by ${log.actor_user_id}`);
  }
}

async function seedSyncNodes(knexClient: Knex): Promise<void> {
  console.log('\n🔄 Seeding Sync Nodes...');

  const nodes = [
    { node_id: DEVICE_SUPER_ADMIN, node_type: 'desktop', organization_id: ORG_A_ID },
    { node_id: DEVICE_ORG_ADMIN_A, node_type: 'desktop', organization_id: ORG_A_ID },
    { node_id: DEVICE_OPERATOR, node_type: 'desktop', organization_id: ORG_A_ID },
    { node_id: DEVICE_RESPONDER, node_type: 'mobile', organization_id: ORG_A_ID },
    { node_id: DEVICE_REPORTER_A, node_type: 'mobile', organization_id: ORG_A_ID },
    { node_id: DEVICE_REPORTER_B, node_type: 'mobile', organization_id: ORG_B_ID },
    { node_id: DEVICE_AUDITOR, node_type: 'desktop', organization_id: ORG_A_ID },
  ];

  for (const node of nodes) {
    await knexClient('sync_nodes').insert({
      ...node,
      public_key: `test-node-key-${node.node_id}`,
      status: 'active',
      last_sync_at: new Date(),
      last_seen_at: new Date(),
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    }).onConflict('node_id').merge();
    console.log(`  ✓ Sync Node: ${node.node_id} (${node.node_type}) for org ${node.organization_id}`);
  }
}

// ============================================
// Main Seed Function
// ============================================

async function seed(): Promise<void> {
  console.log('🌱 Starting RBAC Test Data Seeding...');
  console.log('==========================================');

  const knexClient = createKnexClient();

  try {
    // Test connection
    await knexClient.raw('SELECT 1');
    console.log('✅ Database connection established');

    // Truncate existing data (idempotent)
    console.log('\n🧹 Truncating existing test data...');
    await truncateTables(knexClient);

    // Seed in dependency order
    await seedOrganizations(knexClient);
    await seedUsers(knexClient);
    await seedMemberships(knexClient);
    await seedDevices(knexClient);
    await seedReports(knexClient);
    await seedIncidents(knexClient);
    await seedIncidentReports(knexClient);
    await seedResponseTeams(knexClient);
    await seedAssignments(knexClient);
    await seedStatusEvents(knexClient);
    await seedAuditLogs(knexClient);
    await seedSyncNodes(knexClient);

    console.log('\n==========================================');
    console.log('✅ RBAC Test Data Seeding Complete!');
    console.log('\n📋 Test Account Credentials:');
    console.log('   Password for all accounts: TestPass123!');
    console.log('\n   Super Admin:     superadmin@test.resq.live');
    console.log('   Org Admin A:     orgadmin-a@test.resq.live');
    console.log('   Org Admin B:     orgadmin-b@test.resq.live');
    console.log('   Operator:        operator@test.resq.live');
    console.log('   Responder:       responder@test.resq.live');
    console.log('   Reporter A:      reporter-a@test.resq.live');
    console.log('   Reporter B:      reporter-b@test.resq.live');
    console.log('   Auditor:         auditor@test.resq.live');
    console.log('\n🔑 Key Test IDs:');
    console.log(`   Org A:           ${ORG_A_ID}`);
    console.log(`   Org B:           ${ORG_B_ID}`);
    console.log(`   Report A (Org A): ${REPORT_A_ID}`);
    console.log(`   Report B (Org B): ${REPORT_B_ID}`);
    console.log(`   Incident A:      ${INCIDENT_A_ID}`);
    console.log(`   Incident B:      ${INCIDENT_B_ID}`);
    console.log(`   Assignment A:    ${ASSIGNMENT_A_ID}`);
    console.log(`   Team A:          ${TEAM_A_ID}`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  } finally {
    await knexClient.destroy();
  }
}

// Run if executed directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { seed, ORG_A_ID, ORG_B_ID, SUPER_ADMIN_ID, ORG_ADMIN_A_ID, ORG_ADMIN_B_ID, OPERATOR_ID, RESPONDER_ID, REPORTER_A_ID, REPORTER_B_ID, AUDITOR_ID, REPORT_A_ID, REPORT_B_ID, INCIDENT_A_ID, INCIDENT_B_ID, ASSIGNMENT_A_ID, TEAM_A_ID, TEST_PASSWORD };
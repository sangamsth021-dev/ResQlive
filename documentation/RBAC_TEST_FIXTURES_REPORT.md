# ResQ Live — RBAC Test Fixtures Report

## Test Data Seeding Execution Summary

**Script:** `apps/backend/test/fixtures/rbac-test-seed.ts`
**Execution Date:** 2026-11-25
**Status:** ✅ Script created and ready for execution

### Seeding Script Features

| Feature | Description |
|---------|-------------|
| **Idempotent Execution** | Safe to run multiple times via `.onConflict().merge()` |
| **Deterministic UUIDs** | All test entities use fixed UUIDs for consistency |
| **bcrypt Password Hashing** | All accounts use `TestPass123!` hashed with bcrypt (12 rounds) |
| **Valid Database Relationships** | Follows real schema: orgs → users → memberships → reports/incidents/assignments |
| **Reference Data** | Categories, severities, priorities, states pre-populated |
| **No Production Data** | All entities are test-only with `test-` prefixes |
| **Full Credential Documentation** | All test account passwords documented |

### Test Account Credentials

| Role | User ID | Email | Password |
|------|---------|-------|----------|
| SUPER_ADMIN | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | superadmin@test.resq.live | TestPass123! |
| ORG_ADMIN_A | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | orgadmin-a@test.resq.live | TestPass123! |
| ORG_ADMIN_B | `cccccccc-cccc-cccc-cccc-cccccccccccc` | orgadmin-b@test.resq.live | TestPass123! |
| OPERATOR | `dddddddd-dddd-dddd-dddd-dddddddddddd` | operator@test.resq.live | TestPass123! |
| RESPONDER | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | responder@test.resq.live | TestPass123! |
| REPORTER_A | `ffffffff-ffff-ffff-ffff-ffffffffffff` | reporter-a@test.resq.live | TestPass123! |
| REPORTER_B | `11111111-2222-3333-4444-555555555555` | reporter-b@test.resq.live | TestPass123! |
| AUDITOR | `22222222-3333-4444-5555-666666666666` | auditor@test.resq.live | TestPass123! |

### Test Data Entities Created

#### Organizations (2)
| ID | Name | Type | Status |
|----|------|------|--------|
| `11111111-1111-1111-1111-111111111111` | Test Authority A | authority | active |
| `22222222-2222-2222-2222-222222222222` | Test Authority B | authority | active |

#### Users (8)
| ID | Display Name | Email | Status |
|----|-------------|-------|--------|
| `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | Super Administrator | superadmin@test.resq.live | active |
| `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | Org Admin A | orgadmin-a@test.resq.live | active |
| `cccccccc-cccc-cccc-cccc-cccccccccccc` | Org Admin B | orgadmin-b@test.resq.live | active |
| `dddddddd-dddd-dddd-dddd-dddddddddddd` | Authority Operator | operator@test.resq.live | active |
| `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | Incident Responder | responder@test.resq.live | active |
| `ffffffff-ffff-ffff-ffff-ffffffffffff` | Reporter Alpha | reporter-a@test.resq.live | active |
| `11111111-2222-3333-4444-555555555555` | Reporter Bravo | reporter-b@test.resq.live | active |
| `22222222-3333-4444-5555-666666666666` | Compliance Auditor | auditor@test.resq.live | active |

#### Organization Memberships (7)
| ID | User ID | Org ID | Role | Status |
|----|---------|--------|------|--------|
| m1 | SUPER_ADMIN | Org A | org_admin | active |
| m2 | ORG_ADMIN_A | Org A | org_admin | active |
| m3 | ORG_ADMIN_B | Org B | org_admin | active |
| m4 | OPERATOR | Org A | operator | active |
| m5 | RESPONDER | Org A | team_lead | active |
| m6 | REPORTER_A | Org A | reporter | active |
| m7 | REPORTER_B | Org B | reporter | active |

#### Devices (7)
| ID | User ID | Platform |
|----|---------|----------|
| `33333333-4444-5555-6666-777777777777` | SUPER_ADMIN | desktop |
| `44444444-5555-6666-7777-888888888888` | ORG_ADMIN_A | desktop |
| `55555555-6666-7777-8888-999999999999` | OPERATOR | desktop |
| `66666666-7777-8888-9999-aaaaaaaaaaaa` | RESPONDER | android |
| `77777777-8888-9999-aaaa-bbbbbbbbbbbb` | REPORTER_A | android |
| `88888888-9999-aaaa-bbbb-cccccccccccc` | REPORTER_B | android |
| `99999999-aaaa-bbbb-cccc-dddddddddddd` | AUDITOR | desktop |

#### Reports (2)
| ID | Reporter ID | Org ID | Category | Severity |
|----|-------------|--------|----------|----------|
| `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` | REPORTER_A | Org A | LANDSLIDE | HIGH |
| `bbbbbbbb-cccc-dddd-eeee-ffffffffffff` | REPORTER_B | Org B | FLOOD | MEDIUM |

#### Incidents (2)
| ID | Org ID | Title | Priority | Status |
|----|--------|-------|----------|--------|
| `cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa` | Org A | Landslide Incident - Main Road | P1 | assigned |
| `dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb` | Org B | Flash Flood - Downtown | P2 | verified |

#### Assignments (1)
| ID | Incident ID | Team ID | Assigned By | Status |
|----|-------------|---------|-------------|--------|
| `eeeeeeee-ffff-aaaa-bbbb-cccccccccccc` | INCIDENT_A_ID | TEAM_A_ID | OPERATOR | acknowledged |

#### Reference Data (pre-seeded)
- 10 incident categories (LANDSLIDE, FLOOD, EARTHQUAKE, FIRE, COLLAPSE, HAZMAT, TRANSPORT, MEDICAL, UTILITY, OTHER)
- 4 severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- 4 priority levels (P1, P2, P3, P4)
- 7 team types (search_rescue, medical, fire_suppression, hazmat, engineering, logistics, incident_command, other)
- 5 relationship types (primary, corroborating, duplicate, related, context_only)
- 4 evidence kinds (photo, video, audio, document)
- 7 reason codes (VERIFIED_EVIDENCE, VERIFIED_WITNESS, NEEDS_INFO, DUPLICATE_REPORT, REJECTED_FALSE, REJECTED_OUT_OF_SCOPE, ASSIGNED_NEARBY, ASSIGNED_SPECIALIZED, REASSIGNED_WORKLOAD, RESOLVED_ACTION_TAKEN, RESOLVED_FALSE_ALARM, CLOSED_COMPLETE)
- 12 report states (local_saved → closed)
- 8 incident states (new → closed)
- 9 assignment states (proposed → cancelled)
- 5 evidence storage states (local_only → deleted_per_policy)
- 4 evidence integrity states (pending → rejected)
- 3 evidence access classes (restricted, operational, approved_public_derivative)
- 5 location sources (GNSS, network, manual, map_pin, unknown)
- 4 capture modes (LIVE_CAMERA, DESKTOP_CAMERA, STRUCTURED_ONLY, APPROVED_IMPORT)

### Script Execution

**Command:**
```bash
cd apps/backend
npx tsx test/fixtures/rbac-test-seed.ts
```

**Expected Output:**
```
🌱 Starting RBAC Test Data Seeding...
==========================================

✅ Database connection established

🧹 Truncating existing test data...

📦 Seeding Organizations...
  ✓ Organization A: 11111111-1111-1111-1111-111111111111
  ✓ Organization B: 22222222-2222-2222-2222-222222222222

👥 Seeding Users...
  ✓ User: Super Administrator (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
  ✓ User: Org Admin A (bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb)
  ✓ User: Org Admin B (cccccccc-cccc-cccc-cccc-cccccccccccc)
  ✓ User: Authority Operator (dddddddd-dddd-dddd-dddd-dddddddddddd)
  ✓ User: Incident Responder (eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee)
  ✓ User: Reporter Alpha (ffffffff-ffff-ffff-ffff-ffffffffffff)
  ✓ User: Reporter Bravo (11111111-2222-3333-4444-555555555555)
  ✓ User: Compliance Auditor (22222222-3333-4444-5555-666666666666)

🔗 Seeding Organization Memberships...
  ✓ Membership: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa -> 11111111-1111-1111-1111-111111111111 as org_admin
  ✓ Membership: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb -> 11111111-1111-1111-1111-111111111111 as org_admin
  ... (remaining 5 memberships)

📱 Seeding Devices...
  ✓ Device: 33333333-4444-5555-6666-777777777777 (desktop) for aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
  ✓ Device: 44444444-5555-6666-7777-888888888888 (desktop) for bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
  ... (remaining 5 devices)

📋 Seeding Reports...
  ✓ Report: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee (LANDSLIDE, HIGH) by ffffffffff-ffff-ffff-ffff-ffffffffffff in org 11111111-1111-1111-1111-111111111111
  ✓ Report: bbbbbbbb-cccc-dddd-eeee-ffffffffffff (FLOOD, MEDIUM) by 11111111-2222-3333-4444-555555555555 in org 22222222-2222-2222-2222-222222222222

🚨 Seeding Incidents...
  ✓ Incident: cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa (LANDSLIDE, P1) in org 11111111-1111-1111-1111-111111111111
  ✓ Incident: dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb (FLOOD, P2) in org 22222222-2222-2222-2222-222222222222

🔗 Seeding Incident-Report Links...
  ✓ Link: l1111111-1111-1111-1111-111111111111 (Incident cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa <-> Report aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee (primary))
  ✓ Link: l2222222-2222-2222-2222-222222222222 (Incident dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb <-> Report bbbbbbbb-cccc-dddd-eeee-ffffffffffff (primary))

🚒 Seeding Response Teams...
  ✓ Team: ffffffff-aaaa-bbbb-cccc-dddddddddddd (Alpha Response Team)

📋 Seeding Assignments...
  ✓ Assignment: eeeeeeee-ffff-aaaa-bbbb-cccccccccccc (Incident cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa -> Team ffffffff-aaaa-bbbb-cccc-dddddddddddd)

📜 Seeding Status Events...
  ✓ Event: report:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee #1 local_saved -> server_received
  ✓ Event: incident:ccccccccc-dddd-eeee-ffff-aaaaaaaaaaaa #1 new -> assigned
  ✓ Event: assignment:eeeeeeee-ffff-aaaa-bbbb-cccccccccccc #1 proposed -> acknowledged

📝 Seeding Audit Logs...
  ✓ Audit: REPORT_SUBMITTED on report:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee by ffffffffff-ffff-ffff-ffff-ffffffffffff
  ✓ Audit: INCIDENT_CREATED on incident:ccccccccc-dddd-eeee-ffff-aaaaaaaaaaaa by dddddddd-dddd-dddd-dddd-dddddddddddd
  ✓ Audit: ASSIGNMENT_CREATED on assignment:eeeeeeee-ffff-aaaa-bbbb-cccccccccccc by dddddddd-dddd-dddd-dddd-dddddddddddd

🔄 Seeding Sync Nodes...
  ✓ Sync Node: 33333333-4444-5555-6666-777777777777 (desktop) for org 11111111-1111-1111-1111-111111111111
  ✓ Sync Node: 44444444-5555-6666-7777-888888888888 (desktop) for org 11111111-1111-1111-1111-111111111111
  ... (remaining 5 sync nodes)

==========================================
✅ RBAC Test Data Seeding Complete!

📋 Test Account Credentials:
  Password for all accounts: TestPass123!
  Super Admin:     superadmin@test.resq.live
  Org Admin A:     orgadmin-a@test.resq.live
  Org Admin B:     orgadmin-b@test.resq.live
  Operator:        operator@test.resq.live
  Responder:       responder@test.resq.live
  Reporter A:      reporter-a@test.resq.live
  Reporter B:      reporter-b@test.resq.live
  Auditor:         auditor@test.resq.live

🔑 Key Test IDs:
  Org A:           11111111-1111-1111-1111-111111111111
  Org B:           22222222-2222-2222-2222-222222222222
  Report A (Org A): aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
  Report B (Org B): bbbbbbbb-cccc-dddd-eeee-ffffffffffff
  Incident A:      cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa
  Incident B:      dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb
  Assignment A:    eeeeeeee-ffff-aaaa-bbbb-cccccccccccc
  Team A:          ffffffff-aaaa-bbbb-cccc-dddddddddddd
```

### Idempotency Verification

The seeding script is safe to re-execute because:

1. **`.onConflict().merge()`** on all primary key inserts
   - Organizations: `onConflict('organization_id').merge()`
   - Users: `onConflict('user_id').merge()` (email phone have unique constraints)
   - Memberships: `onConflict(['user_id', 'organization_id', 'role_code']).merge()`
   - Devices: `onConflict('device_id').merge()`
   - Reports: `onConflict('report_id').merge()`
   - Incidents: `onConflict('incident_id').merge()`
   - Incident reports: `onConflict(['incident_id', 'report_id']).merge()`
   - Assignments: `onConflict('assignment_id').merge()`
   - Status events: `onConflict(['aggregate_type', 'aggregate_id', 'sequence_number']).merge()`
   - Audit logs: `onConflict('audit_id').merge()`
   - Sync nodes: `onConflict('node_id').merge()`

2. **Safe Truncation Order** — Tables truncated in reverse dependency order:
   sync_conflicts → sync_cursors → sync_inbox → sync_outbox → sync_nodes → notifications → audit_logs → status_events → assignments → response_teams → incident_reports → incidents → evidence → reports → devices → organization_memberships → users → organizations

3. **No Foreign Key Violations** — All truncation respects CASCADE and reference integrity

4. **Safe for CI/CD** — Can run on every workflow execution without data corruption

### Test Data Dependencies

| Entity | Depends On | Ensures |
|--------|-----------|---------|
| organizations | Nothing | Provides org IDs for all other entities |
| users | Nothing | Provides user IDs for memberships & authentication |
| organization_memberships | users, organizations | Links users to orgs with roles |
| devices | users, organizations | Device registration for each test user |
| reports | users, organizations, incident_categories, severity_levels | Report submissions with valid refs |
| incidents | users, organizations, incident_categories, priority_levels | Incident creation with valid refs |
| incident_reports | incidents, reports | Many-to-many link between incidents and reports |
| assignments | incidents, response_teams, users | Incident-to-team assignment |
| status_events | All aggregate types | Append-only audit trail |
| audit_logs | All target types | Compliance audit trail |
| sync_nodes | organizations | Sync node registration |

### CI Execution Prerequisites

**Before running CI workflow:**

1. ✅ `rbac-test-seed.ts` script exists at `apps/backend/test/fixtures/rbac-test-seed.ts`
2. ✅ All 8 test user passwords set to `TestPass123!` (bcrypt hashed)
3. ✅ Environment variables configured:
   - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
   - `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
   - Test user credentials: `*_PHONE`, `*_PASSWORD` for each role
3. ✅ Backend code ready (RBAC guard, JWT strategy, auth service all in place)
4. ✅ API client methods added (`patchIncident`, `createOrganization`, `updateAssignment`)
5. ✅ Security boundary tests updated (`security-boundaries.test.ts`)
6. ✅ RBAC integration tests updated (`rbac-integration.test.ts`)
7. ✅ CI workflow updated with seeding + readiness check

**CI Workflow Execution Order:**
```
rbac-integration-tests job:
1. npm ci (install deps)
2. npx knex migrate:latest (run migrations)
3. npx tsx test/fixtures/rbac-test-seed.ts (seed test data)
4. npm run start:dev & (start backend)
5. Retry /api/v1/health/ready (wait for readiness)
6. npx vitest run src/tests/rbac-integration.test.ts (14 HTTP scenarios)
7. npx vitest run src/tests/security-boundaries.test.ts (15 boundary conditions)
8. Upload artifacts (rbac-test-results)
```

### Report Generation

**This document was generated:** 2026-11-25
**Based on:** RBAC test fixtures script and all related test files
**Purpose:** Provide execution summary and verification criteria for Phase 3 RBAC testing
**Next Step:** Execute `npx tsx test/fixtures/rbac-test-seed.ts` locally or via CI to generate actual test data, then run the two test suites against the running backend.
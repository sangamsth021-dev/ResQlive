# ResQ Live — RBAC Test Architecture

## Overview

This document describes the RBAC test architecture for Phase 3 Final Security Verification of the ResQ Live platform. The architecture consists of two complementary test suites that verify authorization boundaries through both real HTTP integration tests and comprehensive security boundary verification.

## Test Suite Structure

### 1. RBAC Integration Tests (`rbac-integration.test.ts`)

**Type:** Real HTTP integration tests against running backend server
**Purpose:** Verify complete RBAC workflow end-to-end with actual database-backed authorization
**Scope:** 14 documented security scenarios with real user authentication and API calls

**Key Features:**
- Actual HTTP requests against running backend at `TEST_API_BASE_URL`
- Authentication via real JWT tokens obtained from `/auth/session` endpoint
- Database-backed permission enforcement verification
- Cross-organization isolation testing
- Role-based access control validation
- Resource-level permission checks
- Token revocation and session management tests

**Prerequisites:**
- Backend server running (`npm run start:dev` in `apps/backend`)
- PostgreSQL database with seeded test data (via `rbac-test-seed.ts`)
- Valid JWT tokens for each test role (login with phone/email + password)
- Test data: organizations, users, memberships, reports, incidents, assignments

**Test Scenarios (14):**

1. **Unauthenticated Access Rejection** — No token → 401 AUTHENTICATION_REQUIRED
2. **Expired Token Rejection** — Expired JWT → 401 TOKEN_EXPIRED
3. **Cross-Organization Access Prevention** — Org A user → Org B reports → 403 SCOPE_DENIED
4. **Org Admin Scope Restriction** — Org admin restricted to their organization
5. **Reporter Own Report Access** — Reporter can read own reports only
6. **Reporter Cross-Report Denial** — Reporter cannot access another reporter's private reports
7. **Operator Acknowledgment Authorization** — Operator can acknowledge reports
8. **Auditor Permission Denial** — Auditor cannot acknowledge reports (PERMISSION_DENIED)
9. **Responder Assignment Scoping** — Responder accesses only assigned incidents
10. **Responder Unassigned Incident Denial** — Responder cannot access unassigned incidents
11. **Private Report Protection** — Reporter A cannot read Reporter B's reports
12. **Direct API Bypass Enforcement** — Backend enforces permissions even when bypassing frontend
13. **Super Admin Platform-Wide Access** — Super admin has platform-wide permissions
14. **Membership Revocation + Token Refresh** — Revoked membership prevents subsequent access
15. **Role Change + Token Refresh** — New permissions apply after role change + token refresh

**HTTP Methods Tested:** GET, POST, PATCH against `/reports`, `/incidents`, `/auth/session`, `/organizations`

**Success Criteria:**
- ✅ Authorized operations return 200 with expected data
- ✅ Unauthorized operations return 401 (auth) or 403 (permission/scope)
- ✅ Database records remain unchanged after rejected operations
- ✅ Cross-organization data isolation enforced at DB query level

### 2. Security Boundary API Tests (`security-boundaries.test.ts`)

**Type:** Comprehensive HTTP boundary test suite
**Purpose:** Verify all 15 security boundary conditions through actual API requests
**Scope:** Complete coverage of authentication, organization isolation, role permissions, responder scoping, private report protection, API bypass, and membership revocation

**Key Features:**
- Real HTTP requests against running backend
- Token-based authentication for each test role
- Status code and response body verification
- Database state verification for security-critical mutations
- Helper functions: `expectAuthError`, `expectPermissionDenied`, `expectScopeDenied`, `expectSuccess`

**Test Organization:** 6 describe blocks with multiple it blocks each:

- **Authentication** (2 tests): Unauthenticated rejection, expired token rejection
- **Organization Isolation** (5 tests): Cross-org access, own org access, super admin platform-wide
- **Role-Based Permissions** (6 tests): Operator acknowledge, auditor denial, reporter denial, org admin manage, auditor PATCH denial, super admin org creation
- **Responder Assignment Scoping** (4 tests): Responder assigned incident, unassigned denial, assignment update, unassigned assignment update
- **Private Report Protection** (3 tests): Reporter own report, cross-reporter denial, org admin all reports
- **Direct API Bypass** (3 tests): Reporter audit-logs denial, org admin create, super admin audit-logs
- **Membership & Token Revocation** (2 tests): Membership revocation denial, role change + token refresh

**Success Criteria:**
- ✅ Both status codes AND response bodies verified for each scenario
- ✅ Security-critical mutations verified: database unchanged after rejected operations
- ✅ Cross-organization isolation tested with actual DB-backed queries
- ✅ All 15 boundary conditions from Phase 3 requirements covered

## Test Data Architecture

### Deterministic Seeding (`rbac-test-seed.ts`)

**File:** `apps/backend/test/fixtures/rbac-test-seed.ts`

**Purpose:** Create consistent, reproducible test data for RBAC verification

**Features:**
- Deterministic UUIDs for all test entities (orgs, users, reports, incidents, assignments)
- Uses application's bcrypt password hashing mechanism (`TestPass123!` for all accounts)
- Valid database relationships per real schema (organizations → users → memberships → reports/incidents/assignments)
- Idempotent execution (safe to run multiple times via `.onConflict().merge()`)
- Full test account credentials documented
- No production data dependencies

**Test Accounts Created:**
| Role | Email | Permissions |
|------|-------|-------------|
| SUPER_ADMIN | superadmin@test.resq.live | Platform-wide access |
| ORG_ADMIN_A | orgadmin-a@test.resq.live | Org A scoped permissions |
| ORG_ADMIN_B | orgadmin-b@test.resq.live | Org B scoped permissions |
| OPERATOR | operator@test.resq.live | Reports acknowledge, incident read |
| RESPONDER | responder@test.resq.live | Assigned incidents only |
| REPORTER_A | reporter-a@test.resq.live | Own reports only |
| REPORTER_B | reporter-b@test.resq.live | Own reports only (Org B) |
| AUDITOR | auditor@test.resq.live | Read-only audit access |

**Test Data Entities:**
- 2 Organizations (Org A, Org B)
- 8 Users (1 super admin, 2 org admins, 1 operator, 1 responder, 2 reporters, 1 auditor)
- 7 Memberships (linking users to organizations with roles)
- 7 Devices (one per test user, different platforms)
- 2 Reports (reportA in Org A, reportB in Org B)
- 2 Incidents (incidentA assigned to responder, incidentB unassigned in Org B)
- 1 Assignment (incidentA → responder via Alpha Response Team)
- Reference data: categories, severities, priorities, states, etc.

## API Client Extensions

**File:** `apps/authority-web/src/api/client.ts`

**Added Methods (for test coverage):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `patchIncident(incidentId, body)` | `PATCH /incidents/:id` | Test auditor modification denial, responder status updates |
| `createOrganization(body)` | `POST /organizations` | Test super admin platform-wide access, org admin scope |
| `updateAssignment(assignmentId, body)` | `PATCH /assignments/:id` | Test responder assignment status changes |

**Note:** These methods use the generic `patch` request rather than introducing new abstractions, consistent with the existing API client design.

## CI/CD Integration

### GitHub Actions Workflow (`ci.yml`)

**Job:** `rbac-integration-tests`

**Execution Flow:**
1. ✅ Lint and TypeCheck (prerequisite)
2. ✅ Backend Tests (prerequisite — runs migrations + vitest)
3. ✅ PostgreSQL service provisioned (postgis/postgis:16-3.4)
4. ✅ Database migrations executed (`npx knex migrate:latest`)
5. ✅ Deterministic test data seeding (`npx tsx test/fixtures/rbac-test-seed.ts`)
6. ✅ Backend server startup with readiness checking (`/api/v1/health/ready`)
7. ✅ RBAC Integration Tests (`npx vitest run src/tests/rbac-integration.test.ts`)
8. ✅ Security Boundary Tests (`npx vitest run src/tests/security-boundaries.test.ts`)
9. ✅ Test result artifact upload

**Readiness Checking:**
- Retry-based health check with 30 attempts (5s each = 150s timeout)
- Uses `/api/v1/health/ready` endpoint (backend has global prefix `api/v1`)
- Backend only proceeds if readiness endpoint responds successfully
- Fails fast if backend not ready within timeout

**Environment Variables Required:**
- `TEST_API_BASE_URL` — Backend API base URL (e.g. `http://localhost:3000/api/v1`)
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` — PostgreSQL config
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` — Auth config
- Test user credentials: `*_PHONE`, `*_PASSWORD` for each role

**Test Artifacts Uploaded:**
- `rbac-test-results` — Contains test output and coverage data from both test suites

## Verification Criteria

### Phase 3 Can Be Marked Verified When:

#### Database Migration Success
- ✅ `npx knex migrate:latest` executes without errors
- ✅ All migration files found and applied
- ✅ PostGIS extension enabled successfully

#### Deterministic Test-Data Seeding Success
- ✅ `npx tsx test/fixtures/rbac-test-seed.ts` completes without errors
- ✅ All 8 test users created with correct roles and permissions
- ✅ 2 organizations created (Org A, Org B)
- ✅ 2 reports, 2 incidents, 1 assignment created with valid relationships
- ✅ Idempotent: safe to re-execute without errors

#### Backend Startup Success
- ✅ Backend server starts on port 3000
- ✅ `/api/v1/health/ready` endpoint responds with 200
- ✅ All database connections functional
- ✅ JWT authentication operational

#### Real HTTP Authentication Success
- ✅ Valid JWT tokens obtained from `/auth/session` endpoint
- ✅ Tokens accepted by backend RBAC guard
- ✅ Token expiration and refresh functional
- ✅ Invalid/revoked tokens rejected

#### Authorized Operations Success
- ✅ Super admin can perform platform-wide operations
- ✅ Org admin can manage their organization
- ✅ Operator can acknowledge reports and manage incidents
- ✅ Responder can access assigned incidents and update assignments
- ✅ Reporter can create and read own reports

#### Unauthorized Operations Correctly Rejected
- ✅ Unauthenticated requests → 401 AUTHENTICATION_REQUIRED
- ✅ Expired tokens → 401 TOKEN_EXPIRED
- ✅ Cross-organization access → 403 SCOPE_DENIED
- ✅ Permission-deficient operations → 403 PERMISSION_DENIED
- ✅ Reporter cannot acknowledge reports
- ✅ Auditor cannot modify incidents (PATCH denied)
- ✅ Responder cannot access unassigned incidents
- ✅ Reporter cannot read another reporter's private reports
- ✅ Direct API bypass attempts denied at backend level

#### Database Integrity After Rejected Operations
- ✅ No database mutations when authorization fails
- ✅ Rejected PATCH/POST/DELETE operations leave records unchanged
- ✅ Audit logs only record authorized operations
- ✅ No orphaned or half-created records from failed attempts

#### Cross-Organization Isolation
- ✅ Org A users cannot access Org B reports/incidents
- ✅ Org admin scope restricted to their organization
- ✅ Reporter permissions limited to own organization's reports
- ✅ All DB queries apply `whereIn('organization_id', authorizedOrgIds)` filtering

#### No Unintended Database Mutations
- ✅ Test data seeding is idempotent
- ✅ Test cleanup ensures no residual data affects subsequent runs
- ✅ Migration down scripts available for full reset
- ✅ Artifact-based test results preserved for audit

## Test Execution Model

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions Workflow                                    │
│  └─ rbac-integration-tests job                              │
│        │                                                      │
│        ├── PostgreSQL service                               │
│        ├── Migrations                                       │
│        ├── Test Data Seeding (rbac-test-seed.ts)           │
│        ├── Backend Server (with readiness check)           │
│        ├── RBAC Integration Tests (14 HTTP scenarios)     │
│        └── Security Boundary Tests (15 boundary conditions)│
│                                              │             │
│                                              ▼             ▼
│                            Pass/Fail Results              Artifacts
│                            (uploaded for review)          (rbac-test-results)
└─────────────────────────────────────────────────────────────┘
```

## Complementary Test Relationship

The two test suites work together:

- **RBAC Integration Tests** verify the **workflow**: Can a user log in? Can they perform authorized operations? Can they attempt unauthorized operations and get rejected? This is the "happy path + error path" verification.

- **Security Boundary Tests** verify the **boundary conditions**: Exactly which combinations of role + organization + permission result in access vs. denial? This provides comprehensive coverage of all 15 required boundary conditions from the Phase 3 requirements.

Together, they provide:
- ✅ End-to-end workflow verification
- ✅ Comprehensive boundary condition coverage
- ✅ Real database-backed authorization enforcement
- ✅ Both success and rejection scenarios
- ✅ Cross-organization isolation validation
- ✅ Token lifecycle management testing
- ✅ CI/CD pipeline integration
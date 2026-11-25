# ResQ Live — RBAC Permission Matrix

## 1. Roles and Permissions Overview

This document defines the complete role-based access control (RBAC) system for ResQ Live, mapping 6 operational roles to 27 explicit permissions. All authorization uses **explicit permissions** rather than relying exclusively on hardcoded role names. Role names are used only as a supplementary check, with permissions as the primary authorization mechanism.

---

## 2. Role Definitions

### 2.1 SUPER_ADMIN
**Platform-wide administrator** with access to all organizations, users, and system functions.

| Permission | Description |
|---|---|
| `users.manage` | Full user create/update/delete across all organizations |
| `users.read` | View all users and their organization memberships |
| `organizations.manage` | Create/update/delete organizations and jurisdiction settings |
| `organizations.read` | View all organizations and their hierarchy |
| `reports.create` | Create reports across any organization |
| `reports.read.own` | Read own reports only |
| `reports.read.scoped` | Read reports within authorized jurisdictions |
| `reports.acknowledge` | Acknowledge any report in authorized scope |
| `reports.verify` | Verify report evidence and integrity |
| `reports.update` | Update/amend reports within authorized scope |
| `incidents.create` | Create incidents across any organization |
| `incidents.read` | Read any incident in the system |
| `incidents.manage` | Update incident status, assignments, and closure |
| `assignments.read` | View all assignments across the platform |
| `assignments.create` | Create new incident assignments |
| `assignments.update` | Update assignment status (en_route, on_scene, etc.) |
| `notifications.read` | View all notifications system-wide |
| `audit.read` | Read all audit logs and export functionality |
| `system.manage` | System configuration, feature flags, and operational settings |
| `organizations.assign` | Assign organizations to users and teams |
| `reports.delete` | Delete reports (with audit retention) |
| `incidents.delete` | Delete incidents (with audit retention) |
| `assignments.delete` | Delete assignments (with audit retention) |
| `devices.manage` | Register, revoke, and manage devices |
| `reference.data.manage` | Manage reference data (categories, severities, priorities) |

### 2.2 ORGANIZATION_ADMIN
**Organization-level administrator** managing their organization's personnel and operations.

| Permission | Description |
|---|---|
| `users.manage` | Manage users within their organization (create/update memberships) |
| `users.read` | View users in their organization |
| `organizations.read` | View their organization details |
| `organizations.manage` | Update organization settings and jurisdiction |
| `reports.create` | Create reports for their organization |
| `reports.read.own` | Read own reports |
| `reports.read.scoped` | Read reports within their organization |
| `reports.acknowledge` | Acknowledge reports in their organization |
| `reports.verify` | Verify reports within their organization |
| `incidents.create` | Create incidents for their organization |
| `incidents.read` | Read incidents in their organization |
| `incidents.manage` | Manage incidents within their organization |
| `assignments.read` | View assignments in their organization |
| `assignments.create` | Create assignments within their organization |
| `notifications.read` | View notifications for their organization |
| `audit.read` | Read audit logs for their organization |
| `assignments.update` | Update assignment status within their organization |

### 2.3 AUTHORITY_OPERATOR
**Authority workspace operator** managing the report queue and incident verification.

| Permission | Description |
|---|---|
| `reports.read.scoped` | Read reports within authorized jurisdiction |
| `reports.acknowledge` | Acknowledge reports in queue |
| `reports.verify` | Verify report evidence and status |
| `incidents.read` | Read incidents within authorized scope |
| `assignments.read` | View assigned incidents |
| `assignments.create` | Create assignments for incidents |
| `assignments.update` | Update assignment status (en_route, on_scene, working, completed) |
| `notifications.read` | View operational notifications |
| `audit.read` | Read audit events within authorized scope |

### 2.4 INCIDENT_RESPONDER
**Field incident responder** with access to assigned incidents only.

| Permission | Description |
|---|---|
| `assignments.read` | View assignments allocated to them |
| `assignments.update` | Update their assigned incident's arrival/status |
| `incidents.read` | Read their assigned incidents |
| `notifications.read` | View notifications related to their assignments |

### 2.5 INCIDENT_REPORTER
**Reporter** who submitted reports and tracks their submissions.

| Permission | Description |
|---|---|
| `reports.read.own` | Read their own submitted reports |
| `audit.read` | Read audit events related to their reports |
| `notifications.read` | Read notifications about their report status |

### 2.6 AUDITOR
**Compliance and audit role** with read-only access to authorized records.

| Permission | Description |
|---|---|
| `audit.read` | Read audit logs within authorized scope |
| `reports.read.scoped` | Read reports within authorized jurisdiction |
| `incidents.read` | Read incidents within authorized jurisdiction |

---

## 3. Permission Grouping

Permissions are organized into logical groups for API gatekeepers and middleware:

| Group | Permissions |
|---|---|
| **USERS** | `users.read`, `users.manage` |
| **ORGANIZATIONS** | `organizations.read`, `organizations.manage`, `organizations.assign`, `reference.data.manage` |
| **REPORTS** | `reports.create`, `reports.read.own`, `reports.read.scoped`, `reports.acknowledge`, `reports.verify`, `reports.update`, `reports.delete` |
| **INCIDENTS** | `incidents.create`, `incidents.read`, `incidents.manage`, `incidents.delete` |
| **ASSIGNMENTS** | `assignments.read`, `assignments.create`, `assignments.update`, `assignments.delete` |
| **NOTIFICATIONS** | `notifications.read` |
| **AUDIT** | `audit.read` |
| **SYSTEM** | `system.manage`, `devices.manage` |

---

## 4. Role-to-Permission Mapping Table

| Permission | SUPER_ADMIN | ORGANIZATION_ADMIN | AUTHORITY_OPERATOR | INCIDENT_RESPONDER | INCIDENT_REPORTER | AUDITOR |
|---|---|---|---|---|---|---|
| `users.read` | ✅ | ✅ (org users) | ❌ | ❌ | ❌ | ❌ |
| `users.manage` | ✅ | ✅ (org only) | ❌ | ❌ | ❌ | ❌ |
| `organizations.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `organizations.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `organizations.assign` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports.create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports.read.own` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ (scoped) |
| `reports.read.scoped` | ✅ | ✅ | ✅ | ✅ (own org) | ✅ (own reports) | ✅ |
| `reports.acknowledge` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.verify` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.update` | ✅ | ✅ (org reports) | ❌ | ❌ | ❌ | ❌ |
| `incidents.create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `incidents.read` | ✅ | ✅ | ✅ (own org) | ✅ (assigned) | ✅ (own) | ✅ (scoped) |
| `incidents.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `assignments.read` | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ✅ (scoped) |
| `assignments.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `assignments.update` | ✅ | ✅ (org) | ✅ (own assignments) | ✅ (own) | ❌ | ❌ |
| `notifications.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `audit.read` | ✅ | ✅ (org) | ✅ (scoped) | ❌ | ✅ (own) | ✅ |
| `system.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reports.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `incidents.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

✅ = has permission | ❌ = no permission

---

## 5. Backend Authorization Enforcement

### 5.1 Permission-Based Guard Pattern

Every protected endpoint should use the `@Permissions()` decorator with explicit permission strings. Roles may supplement but must not replace permission checks.

**Example:**
```typescript
@Permissions('reports.read.scoped')
@Get('/reports')
async listReports(@Req() request: Request, @User() user: UserPayload) {
  // Permission already verified by guard
  // Proceed with scoped query enforcement
  return this.reportsService.listReports(query, user);
}
```

### 5.2 Required Backend Checks (Every Protected Endpoint)

1. **Authentication**: `JwtAuthGuard` — verifies valid, non-expired JWT token
2. **Authorization**: `RbacGuard` with `@Permissions()` — verifies user has required permission
3. **Organization Scoping**: Backend query filters by user's active organization memberships
4. **Resource-Level Checks**: For individual record access, verify ownership or scope
5. **Audit Logging**: Append-only `status_events` table for all privileged operations

### 5.3 Organization-Scoped Query Enforcement

**Pattern applied in all data services:**

```typescript
private applyScopeFilter(query: Knex.QueryBuilder, user: UserPayload): Knex.QueryBuilder {
  if (user.roles.includes('org_admin')) {
    // Org admin sees all reports in their organizations
    const orgIds = user.memberships
      .filter((m) => m.status === 'active')
      .map((m) => m.organization_id);
    return query.whereIn('organization_id', orgIds);
  }

  if (user.permissions.includes('report:read:scope')) {
    // Scoped access — user's active organizations
    const orgIds = user.memberships
      .filter((m) => m.status === 'active')
      .map((m) => m.organization_id);
    return query.whereIn('organization_id', orgIds);
  }

  // Reporter sees only own
  return query.where('reporter_user_id', user.user_id);
}
```

### 5.4 Resource-Level Authorization Pattern

For individual record access (GET /:id, PUT /:id, DELETE /:id):

```typescript
async getReport(reportId: string, user: UserPayload): Promise<any> {
  const report = await this.knex('reports')
    .where('report_id', reportId)
    .first();

  if (!report) {
    throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
  }

  // Check access: reporter ownership OR org_admin OR scoped permission
  if (!this.canAccessReport(user, report)) {
    throw new ForbiddenException({ code: 'SCOPE_DENIED' });
  }

  // ... return report data
}
```

### 5.5 Insecure Direct Object Reference (IDOR) Prevention

**Never trust** organization IDs, reporter IDs, or role names from frontend requests. Backend must:

1. Verify the requesting user's organization membership is active
2. Check that the resource's organization_id matches an authorized organization
3. Verify reporter_user_id matches user.user_id for reporter-scoped access
4. Apply `whereIn('organization_id', authorizedOrgIds)` for org-scoped access

---

## 6. Frontend Route Protection

### 6.1 Route-Level Guards

- **AuthenticationRequiredGuard** — ensures user has valid JWT token
- **PermissionsGuard** — checks `@Permissions()` from backend (via API client)
- **RoleAwareSidebar** — dynamically shows/hides navigation based on user permissions

### 6.2 Page-Level Permission Checks

Each dashboard page must verify permissions before loading data:

```typescript
// ReportsPage.tsx pattern
const { isAuthenticated, user, logout } = useApiClient();

// Check permission before fetching
if (!user.permissions.includes('reports.read.scoped')) {
  // Redirect or show access-denied view
  return <AccessDeniedPage />;
}

// Proceed with filtered fetch
const response = await api.listReports({ org_id: user.organization_id, ...filters });
```

### 6.3 Unauthorized Access Page

```
403 Forbidden → /unauthorized
- Displays: "You don't have permission to access this resource"
- Offers: Login again, return to dashboard
- Logs the unauthorized attempt to audit
```

---

## 7. Role-Aware Sidebar Navigation

Sidebar items should be conditionally rendered based on user permissions:

```tsx
const sidebarItems = [
  {
    label: 'Reports',
    icon: 'document',
    permission: 'reports.read.scoped',
    target: '/reports',
  },
  {
    label: 'Incidents',
    icon: 'alert',
    permission: 'incidents.read',
    target: '/incidents',
  },
  // ... conditional on user.permissions
];

{/* Render only items where user has permission */}
{sidebarItems.filter(item => user.permissions.includes(item.permission)).map(item => (...))}
```

---

## 8. Role-Specific Dashboard Summaries

Each role sees relevant summary statistics:

| Role | Dashboard Summary |
|---|---|
| SUPER_ADMIN | Platform-wide: total organizations, users, reports, incidents, system health |
| ORGANIZATION_ADMIN | Org-specific: org reports count, pending incidents, team assignments |
| AUTHORITY_OPERATOR | Queue: unacknowledged reports, assigned incidents, backlog count |
| INCIDENT_RESPONDER | Assigned: my incidents, response status, arrival updates |
| INCIDENT_REPORTER | My reports: submitted count, acknowledgments, status history |
| AUDITOR | Audit: total events, scope, recent privileged operations |

---

## 9. Security Constraints

1. **Least-privilege**: Users receive only the minimum permissions needed for their role
2. **Deny-by-default**: Any permission not explicitly granted → access denied
3. **Never trust JWT role claims long-lived**: Permissions are the authoritative source; roles are supplementary
4. **Permission revocation**: System supports removing permissions during active sessions (token refresh invalidates old permissions)
5. **Administrative actions require re-authentication**: System.manage, users.manage, organizations.manage require recent token + MFA
6. **Immutable audit history**: All status changes written to `status_events` with actor_user_id, actor_role, occurred_at, schema_version
7. **No cross-organization data leakage**: Backend `whereIn('organization_id', authorizedOrgIds)` on every query
8. **No sensitive PII exposure**: Personal identifiers truncated in UI; full values only in API responses for authorized roles

---

## 10. Implementation Checklist

### Backend (NestJS)
- [x] Define permission matrix (completed in this document)
- [ ] Add all 27 permissions to user profile on login
- [ ] Update `RbacGuard` to check `@Permissions()` as primary check
- [ ] Implement `@Roles()` as supplementary (never primary)
- [ ] Add organization-scoped query enforcement to all services
- [ ] Implement resource-level authorization for GET/PUT/DELETE /:id endpoints
- [ ] Add audit logging for: report create/update/acknowledge, incident create/update, assignment changes
- [ ] Implement permission revocation on token refresh
- [ ] Add re-authentication requirement for administrative actions

### Frontend (React + TypeScript)
- [ ] Update `useAuth` hook to store user.permissions array
- [ ] Implement `PermissionsGuard` for route protection
- [ ] Build role-aware sidebar component
- [ ] Add permission checks before API calls on each page
- [ ] Create unauthorized access page
- [ ] Adapt dashboard summaries per role
- [ ] Hide/show action buttons based on user permissions

### Testing
- [ ] Create automated authorization tests (14+ scenarios)
- [ ] Test cross-organization access attempts
- [ ] Test role-based access control paths
- [ ] Test insufficient permissions scenarios
- [ ] Test expired session handling
- [ ] Test permission changes during active session

### Documentation
- [ ] Generate `RBAC_IMPLEMENTATION_REPORT.md`
- [ ] Update architecture documentation
- [ ] Update API specification with permission requirements
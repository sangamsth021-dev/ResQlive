export interface UserPayload {
  user_id: string;
  device_id: string;
  organization_id: string;
  memberships: OrganizationMembership[];
  roles: string[];
  permissions: string[];
}

export interface OrganizationMembership {
  membership_id: string;
  organization_id: string;
  role_code: string;
  scope_json: Record<string, unknown> | null;
  status: string;
  valid_from: Date | null;
  valid_to: Date | null;
}

export interface DevicePayload {
  device_id: string;
  user_id: string | null;
  organization_id: string;
  platform: string;
  app_version: string;
  device_status: string;
}
/**
 * Authority Dashboard Main Page
 *
 * Provides a summary of operations based on the user's role and permissions.
 */

import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="mb-8">Welcome back, {user?.display_name || user?.email}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-500 uppercase text-xs mb-2">Role</h3>
          <p className="text-xl font-bold">{user?.role}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-500 uppercase text-xs mb-2">Organization</h3>
          <p className="text-xl font-bold">{user?.organization_id.substring(0, 8)}...</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-500 uppercase text-xs mb-2">Permissions</h3>
          <p className="text-xl font-bold">{user?.permissions?.length || 0} active</p>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="font-bold mb-4">Available Permissions</h3>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {user?.permissions?.map(perm => (
            <li key={perm} className="text-xs bg-gray-100 px-2 py-1 rounded border">
              {perm}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
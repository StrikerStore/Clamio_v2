import { UserManagement } from "@/components/superadmin/user-management"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function SuperAdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["superadmin"]}>
      <div className="container mx-auto py-6">
        <UserManagement />
      </div>
    </ProtectedRoute>
  )
}

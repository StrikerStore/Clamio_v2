import { SuperAdminPanel } from "@/components/superadmin/superadmin-panel"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function SuperAdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["superadmin"]}>
      <SuperAdminPanel />
    </ProtectedRoute>
  )
}

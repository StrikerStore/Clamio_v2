import { VendorDashboard } from "@/components/vendor/vendor-dashboard"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function VendorDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["vendor"]}>
      <VendorDashboard />
    </ProtectedRoute>
  )
}

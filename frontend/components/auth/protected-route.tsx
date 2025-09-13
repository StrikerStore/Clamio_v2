"use client"

import type React from "react"

import { useAuth } from "./auth-provider"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setIsRedirecting(true)
        router.push("/")
        return
      }

      if (!allowedRoles.includes(user.role)) {
        setIsRedirecting(true)
        // Redirect to appropriate dashboard based on role
        switch (user.role) {
          case "vendor":
            router.push("/vendor/dashboard")
            break
          case "admin":
            router.push("/admin/orders")
            break
          case "superadmin":
            router.push("/superadmin/settings")
            break
          default:
            router.push("/")
        }
        return
      }
    }
  }, [user, loading, allowedRoles, router])

  // Show loading state while checking auth or redirecting
  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600">
            {loading ? "Loading..." : "Redirecting..."}
          </p>
        </div>
      </div>
    )
  }

  // Show children only if user is authenticated and has proper role
  if (user && allowedRoles.includes(user.role)) {
    return <>{children}</>
  }

  // Fallback loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

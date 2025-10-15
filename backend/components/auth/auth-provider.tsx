"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api"
import { useClientOnly } from "@/hooks/use-client-only"

interface User {
  id: string
  email: string
  role: "vendor" | "admin" | "superadmin"
  name: string
  status: string
  phone?: string
  warehouseId?: string
  contactNumber?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
  authHeader: string | null
  vendorToken: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authHeader, setAuthHeader] = useState<string | null>(null)
  const [vendorToken, setVendorToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isClient = useClientOnly()
  const router = useRouter()

  useEffect(() => {
    if (!isClient) return

    // Check for stored auth data on mount
    const storedAuthHeader = localStorage.getItem("authHeader")
    const storedVendorToken = localStorage.getItem("vendorToken")
    const userData = localStorage.getItem("user_data")

    console.log("🔑 Auth Provider: Checking stored auth on mount")
    console.log("  - authHeader exists:", !!storedAuthHeader)
    console.log("  - vendorToken exists:", !!storedVendorToken)
    console.log("  - userData exists:", !!userData)

    if (storedAuthHeader && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        console.log("✅ Auth Provider: Restoring user session", parsedUser.role)
        setUser(parsedUser)
        setAuthHeader(storedAuthHeader)
        setVendorToken(storedVendorToken)
        
        // Auto-redirect to appropriate dashboard if on login page
        const currentPath = window.location.pathname
        if (currentPath === '/' || currentPath === '') {
          console.log("🔄 Auth Provider: Auto-redirecting to dashboard")
          switch (parsedUser.role) {
            case "vendor":
              router.replace("/vendor/dashboard")
              break
            case "admin":
              router.replace("/admin/orders")
              break
            case "superadmin":
              router.replace("/superadmin/settings")
              break
          }
        }
      } catch (error) {
        console.error("❌ Auth Provider: Error parsing stored user data:", error)
        localStorage.removeItem("authHeader")
        localStorage.removeItem("vendorToken")
        localStorage.removeItem("user_data")
      }
    } else {
      console.log("ℹ️ Auth Provider: No stored auth found")
    }
    setLoading(false)
  }, [isClient, router])

  const login = async (email: string, password: string) => {
    try {
      // Call the backend API to generate Basic Auth header
      const response = await apiClient.generateAuthHeader(email, password)

      if (response.success) {
        // Store auth header and user data
        localStorage.setItem("authHeader", response.data.authHeader)
        localStorage.setItem("user_data", JSON.stringify(response.data.user))
        setUser(response.data.user)
        setAuthHeader(response.data.authHeader)

        // Store vendor token if present (for vendors)
        if (response.data.vendorToken) {
          localStorage.setItem("vendorToken", response.data.vendorToken)
          setVendorToken(response.data.vendorToken)
        }

        // Redirect based on role
        switch (response.data.user.role) {
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
      } else {
        throw new Error(response.message || 'Login failed')
      }
    } catch (error) {
      console.error("Login error:", error)
      throw new Error(error instanceof Error ? error.message : "Login failed")
    }
  }

  const logout = async () => {
    // Immediately clear state and localStorage for faster response
    localStorage.removeItem("authHeader")
    localStorage.removeItem("vendorToken")
    localStorage.removeItem("user_data")
    setUser(null)
    setAuthHeader(null)
    setVendorToken(null)
    
    // Redirect immediately for better UX (use replace to prevent back button issues)
    router.replace("/")
    
    // Then try to call backend logout (fire and forget)
    try {
      if (authHeader) {
        // Don't await this - let it run in background
        apiClient.logout().catch(error => {
          console.error("Backend logout error:", error)
        })
      }
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <AuthContext.Provider value={{ user: null, login, logout, loading: true, authHeader: null, vendorToken: null }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, authHeader, vendorToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

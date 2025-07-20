"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email: string
  role: "vendor" | "admin" | "superadmin"
  name: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for stored auth token on mount
    const token = localStorage.getItem("auth_token")
    const userData = localStorage.getItem("user_data")

    if (token && userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (error) {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("user_data")
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      // Mock API call - replace with actual API
      const response = await mockLogin(email, password)

      localStorage.setItem("auth_token", response.token)
      localStorage.setItem("user_data", JSON.stringify(response.user))
      setUser(response.user)

      // Redirect based on role
      switch (response.user.role) {
        case "vendor":
          router.push("/vendor/dashboard")
          break
        case "admin":
          router.push("/admin/orders")
          break
        case "superadmin":
          router.push("/superadmin/settings")
          break
      }
    } catch (error) {
      throw new Error("Invalid credentials")
    }
  }

  const logout = () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_data")
    setUser(null)
    router.push("/")
  }

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Mock login function - replace with actual API call
async function mockLogin(email: string, password: string) {
  await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API delay

  // Mock users for demo
  const mockUsers = {
    "vendor@example.com": { id: "1", email: "vendor@example.com", role: "vendor" as const, name: "John Vendor" },
    "admin@example.com": { id: "2", email: "admin@example.com", role: "admin" as const, name: "Jane Admin" },
    "superadmin@example.com": {
      id: "3",
      email: "superadmin@example.com",
      role: "superadmin" as const,
      name: "Super Admin",
    },
  }

  const user = mockUsers[email as keyof typeof mockUsers]
  if (user && password === "password123") {
    return {
      token: "mock_jwt_token_" + Date.now(),
      user,
    }
  }

  throw new Error("Invalid credentials")
}

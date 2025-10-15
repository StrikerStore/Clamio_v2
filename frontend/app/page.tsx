"use client"

import dynamic from "next/dynamic"
import { ClientOnly } from "@/components/auth/client-only"

const LoginForm = dynamic(() => import("@/components/auth/login-form").then(mod => ({ default: mod.LoginForm })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
})

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Claimio</h1>
          <p className="text-gray-600 mt-2">Tap. Claim. Complete.</p>
        </div>
        <ClientOnly>
          <LoginForm />
        </ClientOnly>
      </div>
    </div>
  )
}

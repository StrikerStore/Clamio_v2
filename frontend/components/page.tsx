"use client"

import dynamic from "next/dynamic"
import { ClientOnly } from "@/components/auth/client-only"

const LoginForm = dynamic(() => import("@/components/auth/login-form").then(mod => ({ default: mod.LoginForm })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-white/80 backdrop-blur-sm rounded-2xl animate-pulse flex items-center justify-center shadow-xl">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
})

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-100 via-blue-50 to-gray-100 flex items-center justify-center p-2 sm:p-4 relative overflow-hidden">
      {/* Subtle pattern background */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-pattern-dots" />
        <div className="absolute inset-0 bg-pattern-grid" />
      </div>

      {/* Floating geometric shapes for enhanced glass effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 border-2 border-slate-300/30 rounded-2xl rotate-12 animate-float-slow" />
        <div className="absolute top-40 right-32 w-24 h-24 border-2 border-blue-300/30 rounded-full animate-float-medium" />
        <div className="absolute bottom-32 left-40 w-40 h-40 border-2 border-cyan-300/30 rounded-3xl -rotate-6 animate-float-slow" />
        <div className="absolute bottom-48 right-20 w-20 h-20 border-2 border-slate-300/30 rotate-45 animate-float-medium" />
        <div className="absolute top-1/2 left-10 w-16 h-16 border-2 border-blue-300/30 rounded-xl rotate-12 animate-float-fast" />
      </div>

      {/* Animated background elements - soft pastel */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-200/30 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-slate-200/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-gradient-to-br from-cyan-200/20 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>

      <div className="w-full max-w-md relative z-10 flex flex-col justify-center min-h-[100dvh] py-4 sm:py-0">
        {/* Logo section with subtle gradient background */}
        <div className="text-center mb-4 sm:mb-8 animate-fade-in">
          <div className="mx-auto w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-white/40 to-blue-50/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-6 shadow-xl border border-white/30 transform hover:scale-105 transition-all duration-300 p-3 sm:p-4">
            <img src="/logo.png" alt="Claimio Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-700 mb-1 sm:mb-2 drop-shadow-sm">Claimio</h1>
          <p className="text-slate-600 text-sm sm:text-lg font-medium">Tap. Claim. Complete.</p>
        </div>
        
        <ClientOnly>
          <LoginForm />
        </ClientOnly>
      </div>
    </div>
  )
}

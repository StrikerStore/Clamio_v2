"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Eye, EyeOff, Lock, Key } from "lucide-react"
import { useAuth } from "./auth-provider"
import { apiClient } from "@/lib/api"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resetSuccess, setResetSuccess] = useState("")
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError("")
    setResetSuccess("")
    setResetLoading(true)

    // Validation
    if (newPassword !== confirmPassword) {
      setResetError("New passwords do not match")
      setResetLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setResetError("New password must be at least 6 characters long")
      setResetLoading(false)
      return
    }

    try {
      const response = await apiClient.resetPassword(resetEmail, oldPassword, newPassword, confirmPassword)
      
      if (response.success) {
        setResetSuccess("Password changed successfully! You can now login with your new password.")
        // Reset form
        setOldPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setResetEmail("")
        // Close dialog after 2 seconds
        setTimeout(() => {
          setResetDialogOpen(false)
          setResetSuccess("")
        }, 2000)
      } else {
        setResetError(response.message)
      }
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Failed to change password")
    } finally {
      setResetLoading(false)
    }
  }

  const openResetDialog = () => {
    setResetDialogOpen(true)
    setResetError("")
    setResetSuccess("")
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <>
      {/* SVG Filter for liquid glass distortion */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="glass-distortion">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.01 0.003"
              numOctaves="1"
              result="warp"
            />
            <feDisplacementMap
              xChannelSelector="R"
              yChannelSelector="G"
              scale="30"
              in="SourceGraphic"
              in2="warp"
            />
          </filter>
        </defs>
      </svg>

      <Card className="liquidGlass-wrapper w-full rounded-2xl overflow-hidden border-none bg-transparent">
        {/* Liquid Glass Effect Layer with stronger blur */}
        <div className="liquidGlass-effect absolute inset-0 z-0 backdrop-blur-[20px]" style={{ filter: 'url(#glass-distortion)' }} />
        
        {/* Liquid Glass Tint Layer - more transparent */}
        <div className="liquidGlass-tint absolute inset-0 z-[1] bg-white/20" />
        
        {/* Liquid Glass Shine Layer */}
        <div className="liquidGlass-shine absolute inset-0 z-[2]" />
        
        <CardHeader className="space-y-1 sm:space-y-2 relative z-10 pb-4 sm:pb-6 pt-5 sm:pt-8">
          <CardTitle className="text-2xl sm:text-3xl text-center font-bold text-slate-800">
            Sign In
          </CardTitle>
          <CardDescription className="text-center text-sm sm:text-base text-slate-600">
            Enter your credentials to access your dashboard
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative z-10 pb-5 sm:pb-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 relative">
            <div className="space-y-1.5 sm:space-y-2 autofill-container">
              <Label htmlFor="email" className="text-slate-700 font-medium text-sm sm:text-base">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={true}
                disabled={loading}
                autoComplete="email"
                className="h-10 sm:h-11 bg-white/40 backdrop-blur-md border-white/40 focus:border-blue-400/70 focus:ring-blue-400/20 focus:bg-white/50 transition-all duration-200 shadow-sm text-sm sm:text-base"
              />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2 autofill-container">
              <Label htmlFor="password" className="text-slate-700 font-medium text-sm sm:text-base">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={true}
                  disabled={loading}
                  autoComplete="current-password"
                  className="h-10 sm:h-11 pr-10 bg-white/40 backdrop-blur-md border-white/40 focus:border-blue-400/70 focus:ring-blue-400/20 focus:bg-white/50 transition-all duration-200 shadow-sm text-sm sm:text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-white/40 rounded-r-md transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-slate-600" /> : <Eye className="h-4 w-4 text-slate-600" />}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="animate-shake backdrop-blur-md bg-red-50/80 border-red-200/50">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full h-10 sm:h-11 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 text-sm sm:text-base" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center pt-1 sm:pt-2">
              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 transition-all"
                    onClick={openResetDialog}
                  >
                    <Lock className="mr-2 h-4 w-4 text-slate-500" />
                    Reset Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-blue-600" />
                      Reset Password
                    </DialogTitle>
                    <DialogDescription>
                      Enter your current password and choose a new password
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="Enter your email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required={true}
                        disabled={resetLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="old-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="old-password"
                          type={showOldPassword ? "text" : "password"}
                          placeholder="Enter current password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          required={true}
                          disabled={resetLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          disabled={resetLoading}
                        >
                          {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required={true}
                          disabled={resetLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          disabled={resetLoading}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required={true}
                          disabled={resetLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={resetLoading}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {resetError && (
                      <Alert variant="destructive">
                        <AlertDescription>{resetError}</AlertDescription>
                      </Alert>
                    )}

                    {resetSuccess && (
                      <Alert className="border-green-200 bg-green-50">
                        <AlertDescription className="text-green-800">{resetSuccess}</AlertDescription>
                      </Alert>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setResetDialogOpen(false)}
                        disabled={resetLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={resetLoading}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        {resetLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Changing Password...
                          </>
                        ) : (
                          <>
                            <Key className="mr-2 h-4 w-4" />
                            Change Password
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

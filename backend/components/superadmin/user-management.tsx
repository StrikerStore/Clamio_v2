"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  Loader2, 
  Plus, 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  LogOut, 
  Shield, 
  Building2, 
  UserCheck,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Edit,
  Trash2,
  MoreHorizontal,
  Key,
  Eye,
  EyeOff
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-provider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useDeviceType } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: 'admin' | 'vendor' | 'superadmin'
  status: string
  createdAt: string
  warehouseId?: string
  contactNumber?: string
}

interface CreateUserForm {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  role: 'admin' | 'vendor'
  warehouseId: string
  contactNumber: string
}

interface EditUserForm {
  name: string
  email: string
  phone: string
  role: 'admin' | 'vendor'
  status: string
  warehouseId: string
  contactNumber: string
}

export function UserManagement() {
  const { user: currentUser, logout } = useAuth()
  const { isMobile, isTablet, isDesktop, deviceType } = useDeviceType()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [warehouseValidating, setWarehouseValidating] = useState(false)
  const [warehouseValid, setWarehouseValid] = useState<boolean | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [newUserPassword, setNewUserPassword] = useState("")
  const [confirmUserPassword, setConfirmUserPassword] = useState("")
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [showConfirmUserPassword, setShowConfirmUserPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [warehouseInfo, setWarehouseInfo] = useState<null | { address: string, city: string, pincode: string, state: string, country: string }>(null)
  const [warehouseVerifyLoading, setWarehouseVerifyLoading] = useState(false)
  const [warehouseVerifyError, setWarehouseVerifyError] = useState("")
  const [warehouseVerified, setWarehouseVerified] = useState(false)

  // Mobile UI state
  const [mobileTab, setMobileTab] = useState<'users' | 'create'>("users")
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const [formData, setFormData] = useState<CreateUserForm>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "admin",
    warehouseId: "",
    contactNumber: ""
  })

  const [editFormData, setEditFormData] = useState<EditUserForm>({
    name: "",
    email: "",
    phone: "",
    role: "admin",
    status: "active",
    warehouseId: "",
    contactNumber: ""
  })

  // Check if current user is superadmin
  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Access Denied</h3>
                <p className="text-sm text-gray-600 mt-1">Only superadmin can manage users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleLogout = async () => {
    setLogoutLoading(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLogoutLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await apiClient.getUsers()
      if (response.success) {
        setUsers(response.data.users || [])
      } else {
        setError(response.message)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const validateWarehouse = async (warehouseId: string) => {
    if (!warehouseId.trim()) {
      setWarehouseValid(null)
      setWarehouseInfo(null)
      setWarehouseVerified(false)
      setWarehouseVerifyError("")
      return
    }

    setWarehouseValidating(true)
    setWarehouseValid(null)
    setWarehouseInfo(null)
    setWarehouseVerified(false)
    setWarehouseVerifyError("")
    
    try {
      // Get auth header from localStorage
      const authHeader = localStorage.getItem('authHeader')
      
      if (!authHeader) {
        setWarehouseValid(false)
        setWarehouseVerifyError('Authentication required. Please login again.')
        return
      }

      console.log('🔍 Frontend: Validating warehouse ID:', warehouseId)
      const response = await apiClient.validateWarehouseForUser(warehouseId)
      
      console.log('📦 Frontend: Warehouse validation response:', response)
      
      if (response.success) {
        setWarehouseValid(true)
        setWarehouseInfo(response.data.warehouse)
        setWarehouseVerified(true)
        setWarehouseVerifyError("")
      } else {
        setWarehouseValid(false)
        setWarehouseVerifyError(response.message || 'Warehouse validation failed')
      }
    } catch (error) {
      console.error('❌ Frontend: Warehouse validation error:', error)
      setWarehouseValid(false)
      setWarehouseVerified(false)
      setWarehouseVerifyError(error instanceof Error ? error.message : 'Failed to validate warehouse')
    } finally {
      setWarehouseValidating(false)
    }
  }

  const handleVerifyWarehouse = async () => {
    setWarehouseVerifyLoading(true)
    setWarehouseVerifyError("")
    setWarehouseInfo(null)
    setWarehouseVerified(false)
    
    // Determine which form is active and get the appropriate warehouse ID
    const warehouseId = editDialogOpen ? editFormData.warehouseId : formData.warehouseId
    
    try {
      console.log('🔍 Frontend: Manual warehouse verification for:', warehouseId)
      const response = await apiClient.verifyWarehouse(warehouseId)
      
      console.log('📦 Frontend: Manual verification response:', response)
      
      if (response.success) {
        setWarehouseInfo(response.data)
        setWarehouseVerified(true)
        setWarehouseValid(true)
        setWarehouseVerifyError("")
      } else {
        setWarehouseVerifyError(response.message || 'Warehouse verification failed')
        setWarehouseVerified(false)
        setWarehouseValid(false)
      }
    } catch (err) {
      console.error('❌ Frontend: Manual warehouse verification error:', err)
      setWarehouseVerifyError(err instanceof Error ? err.message : "Failed to verify warehouse")
      setWarehouseVerified(false)
      setWarehouseValid(false)
    } finally {
      setWarehouseVerifyLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateUserForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'warehouseId') {
      // Reset validation states when warehouse ID changes, but don't validate automatically
      setWarehouseValid(null)
      setWarehouseInfo(null)
      setWarehouseVerified(false)
      setWarehouseVerifyError("")
    }
  }

  const handleEditInputChange = (field: keyof EditUserForm, value: string) => {
    setEditFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Handle role changes
      if (field === 'role') {
        if (value === 'admin') {
          // Clear warehouse ID when changing to admin
          newData.warehouseId = ''
          setWarehouseValid(null)
          setWarehouseInfo(null)
          setWarehouseVerified(false)
          setWarehouseVerifyError("")
        } else if (value === 'vendor') {
          // Reset warehouse validation when changing to vendor
          setWarehouseValid(null)
          setWarehouseInfo(null)
          setWarehouseVerified(false)
          setWarehouseVerifyError("")
        }
      }
      
      return newData
    })
    
    // Reset validation states when warehouse ID changes, but don't validate automatically
    if (field === 'warehouseId') {
      setWarehouseValid(null)
      setWarehouseInfo(null)
      setWarehouseVerified(false)
      setWarehouseVerifyError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setCreating(true)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setCreating(false)
      return
    }

    if (formData.role === 'vendor' && !formData.warehouseId.trim()) {
      setError("Warehouse ID is required for vendors")
      setCreating(false)
      return
    }

    if (formData.role === 'vendor' && warehouseValid === false) {
      setError("Invalid warehouse ID. Please verify the warehouse ID is correct.")
      setCreating(false)
      return
    }

    if (formData.role === 'vendor' && !warehouseVerified && warehouseValid !== true) {
      setError("Please verify the warehouse ID before creating the user.")
      setCreating(false)
      return
    }

    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        status: 'active',
        ...(formData.role === 'vendor' && { warehouseId: formData.warehouseId.trim() }),
        ...(formData.contactNumber && { contactNumber: formData.contactNumber })
      }

      console.log('🔍 Frontend: Creating user with data:', {
        ...userData,
        password: '***hidden***'
      })

      const response = await apiClient.createUser(userData)
      
      if (response.success) {
        setSuccess(`User "${formData.name}" created successfully!`)
        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          role: "admin",
          warehouseId: "",
          contactNumber: ""
        })
        setWarehouseValid(null)
        setWarehouseInfo(null)
        setWarehouseVerified(false)
        // Reload users
        loadUsers()
      } else {
        setError(response.message)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setEditFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role as 'admin' | 'vendor',
      status: user.status,
      warehouseId: user.warehouseId || "",
      contactNumber: user.contactNumber || ""
    })
    setEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setError("")
    setSuccess("")
    setEditing(true)

    // Validation
    if (editFormData.role === 'vendor' && !editFormData.warehouseId.trim()) {
      setError("Warehouse ID is required for vendors")
      setEditing(false)
      return
    }

    if (editFormData.role === 'vendor' && warehouseValid === false) {
      setError("Invalid warehouse ID. Please verify the warehouse ID is correct.")
      setEditing(false)
      return
    }

    if (editFormData.role === 'vendor' && !warehouseVerified && warehouseValid !== true) {
      setError("Please verify the warehouse ID before updating the user.")
      setEditing(false)
      return
    }

    try {
      const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        status: editFormData.status,
        ...(editFormData.role === 'vendor' && { warehouseId: editFormData.warehouseId }),
        ...(editFormData.contactNumber && { contactNumber: editFormData.contactNumber })
      }

      const response = await apiClient.updateUser(selectedUser.id, updateData)
      
      if (response.success) {
        setSuccess(`User "${editFormData.name}" updated successfully!`)
        setEditDialogOpen(false)
        setSelectedUser(null)
        // Reload users
        loadUsers()
      } else {
        setError(response.message)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update user")
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteUser = async (user: User) => {
    setDeleting(true)
    setError("")
    setSuccess("")

    try {
      const response = await apiClient.deleteUser(user.id)
      
      if (response.success) {
        setSuccess(`User "${user.name}" deleted successfully!`)
        // Reload users
        loadUsers()
      } else {
        setError(response.message)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete user")
    } finally {
      setDeleting(false)
    }
  }

  const handleChangeUserPassword = (user: User) => {
    setPasswordUser(user)
    setNewUserPassword("")
    setConfirmUserPassword("")
    setPasswordError("")
    setPasswordSuccess("")
    setPasswordDialogOpen(true)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordUser) return

    setPasswordError("")
    setPasswordSuccess("")
    setPasswordLoading(true)

    // Validation
    if (newUserPassword !== confirmUserPassword) {
      setPasswordError("Passwords do not match")
      setPasswordLoading(false)
      return
    }

    if (newUserPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long")
      setPasswordLoading(false)
      return
    }

    try {
      const response = await apiClient.changeUserPassword(passwordUser.id, newUserPassword)
      
      if (response.success) {
        setPasswordSuccess(`Password changed successfully for ${passwordUser.name}!`)
        // Reset form
        setNewUserPassword("")
        setConfirmUserPassword("")
        // Close dialog after 2 seconds
        setTimeout(() => {
          setPasswordDialogOpen(false)
          setPasswordSuccess("")
        }, 2000)
      } else {
        setPasswordError(response.message)
      }
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to change password")
    } finally {
      setPasswordLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    
    return matchesSearch && matchesRole && matchesStatus
  })

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin': return 'default'
      case 'admin': return 'secondary'
      case 'vendor': return 'outline'
      default: return 'default'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    return status === 'active' ? 'default' : 'destructive'
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin': return <Shield className="h-4 w-4" />
      case 'admin': return <UserCheck className="h-4 w-4" />
      case 'vendor': return <Building2 className="h-4 w-4" />
      default: return <Users className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Dedicated Mobile UI
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
          <div className="px-4">
            <div className="flex items-center justify-between h-14">
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">Super Admin</h1>
                <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="gap-2"
              >
                {logoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4 pb-24 space-y-4">
          {/* Mobile Stats Cards */}
          {mobileTab === 'users' && (
            <div className={`grid gap-3 grid-cols-2`}>
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-xs font-medium">Total Users</p>
                      <p className="text-2xl font-bold">{users.length}</p>
                    </div>
                    <Users className="h-6 w-6 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-xs font-medium">Active Users</p>
                      <p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p>
                    </div>
                    <UserCheck className="h-6 w-6 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-xs font-medium">Admins</p>
                      <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
                    </div>
                    <Shield className="h-6 w-6 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-xs font-medium">Vendors</p>
                      <p className="text-2xl font-bold">{users.filter(u => u.role === 'vendor').length}</p>
                    </div>
                    <Building2 className="h-6 w-6 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Search + Filter Row */}
          {mobileTab === 'users' && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="space-y-4">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Role</Label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Filter by Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}

          {/* Users List */}
          {mobileTab === 'users' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-base font-medium text-gray-900 mb-1">No users found</h3>
                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <Card key={user.id} className="border-gray-100">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                              {getRoleIcon(user.role)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{user.name}</div>
                              <div className="text-xs text-gray-500 truncate">{user.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                              {user.role}
                            </Badge>
                            <Badge variant={getStatusBadgeVariant(user.status)} className="text-xs">
                              {user.status}
                            </Badge>
                          </div>
                        </div>
                        {/* Actions */}
                        {user.role !== 'superadmin' && (
                          <div className="flex items-center gap-2">
                            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditUser(user)}
                                  className="h-8 px-2"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeUserPassword(user)}
                              className="h-8 px-2"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{user.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user)} className="bg-red-600 hover:bg-red-700">
                                    {deleting ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      "Delete User"
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Create Form */}
          {mobileTab === 'create' && (
            <Card className="border-gray-100 bg-white">
              <CardHeader>
                <CardTitle className="text-gray-900">Add New User</CardTitle>
                <CardDescription>Create a new admin or vendor account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} required disabled={creating} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} required disabled={creating} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input id="phone" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} required disabled={creating} />
                    </div>
                    <div className="space-y-2">
                      <Label>User Role *</Label>
                      <Select value={formData.role} onValueChange={(value: 'admin' | 'vendor') => handleInputChange('role', value)} disabled={creating}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.role === 'vendor' && (
                      <div className="space-y-2">
                        <Label htmlFor="warehouseId">Warehouse ID *</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="warehouseId"
                            value={formData.warehouseId}
                            onChange={(e) => handleInputChange('warehouseId', e.target.value)}
                            required
                            disabled={creating}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleVerifyWarehouse}
                            disabled={warehouseVerifyLoading || !formData.warehouseId.trim() || creating || editDialogOpen}
                          >
                            {warehouseVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                          </Button>
                        </div>
                        {warehouseVerified && warehouseInfo && (
                          <p className="text-xs text-green-700">
                            Verified: {warehouseInfo.address}, {warehouseInfo.city}, {warehouseInfo.state}, {warehouseInfo.country} (Pincode: {warehouseInfo.pincode})
                          </p>
                        )}
                        {warehouseVerifyError && !warehouseVerifyLoading && (
                          <p className="text-xs text-red-600">{warehouseVerifyError}</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="contactNumber">Contact Number</Label>
                      <Input id="contactNumber" value={formData.contactNumber} onChange={(e) => handleInputChange('contactNumber', e.target.value)} disabled={creating} />
                    </div>
                    {/* Password Requirements Alert */}
                    <Alert className="border-blue-200 bg-blue-50">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 text-xs">
                        <strong>Password Requirements:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Min 6 characters</li>
                          <li>One uppercase (A-Z)</li>
                          <li>One lowercase (a-z)</li>
                          <li>One number (0-9)</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input id="password" type="password" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} required disabled={creating} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input id="confirmPassword" type="password" value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value)} required disabled={creating} />
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">{success}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={creating || (formData.role === 'vendor' && !warehouseVerified && warehouseValid !== true)}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating User...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create User Account
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom Nav */}
        <div className="fixed inset-x-0 bottom-0 z-20 bg-white border-t">
          <div className="grid grid-cols-2">
            <Button variant={mobileTab === 'users' ? 'default' : 'ghost'} className="rounded-none py-4" onClick={() => setMobileTab('users')}>
              <Users className="h-4 w-4 mr-2" /> Users
            </Button>
            <Button variant={mobileTab === 'create' ? 'default' : 'ghost'} className="rounded-none py-4" onClick={() => setMobileTab('create')}>
              <UserPlus className="h-4 w-4 mr-2" /> Add
            </Button>
          </div>
        </div>

        {/* Edit and Password Dialogs for Mobile */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit User
              </DialogTitle>
              <DialogDescription>
                Update user information and settings
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                  <Input id="edit-name" value={editFormData.name} onChange={(e) => handleEditInputChange('name', e.target.value)} required disabled={editing} className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                  <Input id="edit-email" type="email" value={editFormData.email} onChange={(e) => handleEditInputChange('email', e.target.value)} required disabled={editing} className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                  <Input id="edit-phone" value={editFormData.phone} onChange={(e) => handleEditInputChange('phone', e.target.value)} required disabled={editing} className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role" className="text-sm font-medium text-gray-700">User Role *</Label>
                  <Select value={editFormData.role} onValueChange={(value: 'admin' | 'vendor') => handleEditInputChange('role', value)} disabled={editing}>
                    <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-sm font-medium text-gray-700">Status *</Label>
                  <Select value={editFormData.status} onValueChange={(value: string) => handleEditInputChange('status', value)} disabled={editing}>
                    <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Warehouse ID field for vendors */}
              {editFormData.role === 'vendor' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-warehouseId" className="text-sm font-medium text-gray-700">Warehouse ID *</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="edit-warehouseId"
                        value={editFormData.warehouseId}
                        onChange={(e) => handleEditInputChange('warehouseId', e.target.value)}
                        required
                        disabled={editing}
                        className={`bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${
                          warehouseValid === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                          warehouseValid === true ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''
                        }`}
                        placeholder="Enter warehouse ID"
                      />
                      {warehouseValidating && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleVerifyWarehouse}
                      disabled={warehouseVerifyLoading || !editFormData.warehouseId.trim() || editing || !editDialogOpen}
                    >
                      {warehouseVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                  {warehouseValid === true && (
                    <div className="space-y-1">
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        Valid warehouse ID
                      </p>
                      {warehouseInfo && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                          <p><strong>Address:</strong> {warehouseInfo.address}</p>
                          <p><strong>City:</strong> {warehouseInfo.city}</p>
                          <p><strong>Pincode:</strong> {warehouseInfo.pincode}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {warehouseValid === false && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Invalid warehouse ID
                    </p>
                  )}
                </div>
              )}

              {/* Contact Number field */}
              <div className="space-y-2">
                <Label htmlFor="edit-contactNumber" className="text-sm font-medium text-gray-700">Contact Number</Label>
                <Input
                  id="edit-contactNumber"
                  value={editFormData.contactNumber}
                  onChange={(e) => handleEditInputChange('contactNumber', e.target.value)}
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter contact number (optional)"
                />
              </div>

              {/* Error and Success Messages */}
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button type="submit" disabled={editing}>
                  {editing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-purple-600" />
                Change Password for {passwordUser?.name}
              </DialogTitle>
              <DialogDescription>
                Enter new password for {passwordUser?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Password Requirements Alert */}
              <Alert className="border-purple-200 bg-purple-50">
                <Shield className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-800 text-xs">
                  <strong>Password Requirements:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Min 6 characters</li>
                    <li>One uppercase (A-Z)</li>
                    <li>One lowercase (a-z)</li>
                    <li>One number (0-9)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" value={confirmUserPassword} onChange={(e) => setConfirmUserPassword(e.target.value)} required />
              </div>

              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              {passwordSuccess && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{passwordSuccess}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Change Password
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between ${isMobile ? 'h-14' : 'h-16'}`}>
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center`}>
                <Shield className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
              </div>
              <div className="min-w-0">
                <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {isMobile ? 'Clamio' : 'Clamio - Super Admin'}
                </h1>
                {!isMobile && (
                  <p className="text-sm text-gray-600">Welcome back, Super Admin</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isMobile && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{currentUser?.name}</p>
                  <p className="text-xs text-gray-500 break-all max-w-[200px]">{currentUser?.email}</p>
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={handleLogout}
                disabled={logoutLoading}
                size={isMobile ? 'sm' : 'default'}
                className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                {logoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {!isMobile && 'Logout'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className={`space-y-6 md:space-y-8`}>
          {/* Stats Cards */}
          <div className={`grid gap-4 md:gap-6 ${
            isMobile ? 'grid-cols-2' : 
            isTablet ? 'grid-cols-2' : 
            'grid-cols-4'
          }`}>
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-blue-100 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {isMobile ? 'Users' : 'Total Users'}
                    </p>
                    <p className={`font-bold ${isMobile ? 'text-2xl' : 'text-3xl'}`}>{users.length}</p>
                  </div>
                  <Users className={`text-blue-200 ${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-green-100 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {isMobile ? 'Active' : 'Active Users'}
                    </p>
                    <p className={`font-bold ${isMobile ? 'text-2xl' : 'text-3xl'}`}>{users.filter(u => u.status === 'active').length}</p>
                  </div>
                  <UserCheck className={`text-green-200 ${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-purple-100 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Admins</p>
                    <p className={`font-bold ${isMobile ? 'text-2xl' : 'text-3xl'}`}>{users.filter(u => u.role === 'admin').length}</p>
                  </div>
                  <Shield className={`text-purple-200 ${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-orange-100 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Vendors</p>
                    <p className={`font-bold ${isMobile ? 'text-2xl' : 'text-3xl'}`}>{users.filter(u => u.role === 'vendor').length}</p>
                  </div>
                  <Building2 className={`text-orange-200 ${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">User Management</CardTitle>
              <CardDescription className="text-gray-600">
                Manage admin and vendor accounts with full control and oversight
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="users" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
                  <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Users className="h-4 w-4" />
                    All Users
                  </TabsTrigger>
                  <TabsTrigger value="create" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-6">
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search users by name or email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-40 bg-white border-gray-200">
                        <SelectValue placeholder="Filter by Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="superadmin">Superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40 bg-white border-gray-200">
                        <SelectValue placeholder="Filter by Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Users List */}
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                        <p className="text-gray-600">Loading users...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredUsers.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                          <p className="text-gray-500">Try adjusting your search or filters</p>
                        </div>
                      ) : (
                        filteredUsers.map((user) => (
                          <Card key={user.id} className="hover:shadow-md transition-shadow duration-200 border-gray-100">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                                    {getRoleIcon(user.role)}
                                  </div>
                                  <div className="space-y-1">
                                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                                      <div className="flex items-center space-x-1">
                                        <Mail className="h-3 w-3" />
                                        <span>{user.email}</span>
                                      </div>
                                      {user.phone && (
                                        <div className="flex items-center space-x-1">
                                          <Phone className="h-3 w-3" />
                                          <span>{user.phone}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{formatDate(user.createdAt)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  {user.warehouseId && (
                                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                                      <MapPin className="h-3 w-3" />
                                      <span>WH: {user.warehouseId}</span>
                                    </div>
                                  )}
                                  <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1">
                                    {getRoleIcon(user.role)}
                                    {user.role}
                                  </Badge>
                                  <Badge variant={getStatusBadgeVariant(user.status)}>
                                    {user.status}
                                  </Badge>
                                  
                                  {/* Action Buttons - Only show for non-superadmin users */}
                                  {user.role !== 'superadmin' && (
                                    <div className="flex items-center space-x-2">
                                      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditUser(user)}
                                            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </DialogTrigger>
                                      </Dialog>
                                      
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleChangeUserPassword(user)}
                                        className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
                                      >
                                        <Key className="h-4 w-4" />
                                      </Button>
                                      
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete "{user.name}"? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteUser(user)}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              {deleting ? (
                                                <>
                                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                  Deleting...
                                                </>
                                              ) : (
                                                "Delete User"
                                              )}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="create" className="space-y-6">
                  <Card className="border-gray-100 bg-gradient-to-br from-white to-blue-50/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-gray-900">
                        <UserPlus className="h-5 w-5 text-blue-600" />
                        Add New User
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        Create a new admin or vendor account with full system access
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              required
                              disabled={creating}
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter full name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              required
                              disabled={creating}
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter email address"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                            <Input
                              id="phone"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              required
                              disabled={creating}
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter phone number"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="role" className="text-sm font-medium text-gray-700">User Role *</Label>
                            <Select
                              value={formData.role}
                              onValueChange={(value: 'admin' | 'vendor') => handleInputChange('role', value)}
                              disabled={creating}
                            >
                              <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin" className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Admin
                                </SelectItem>
                                <SelectItem value="vendor" className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  Vendor
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {formData.role === 'vendor' && (
                            <div className="space-y-2">
                              <Label htmlFor="warehouseId" className="text-sm font-medium text-gray-700">Warehouse ID *</Label>
                              <div className="flex items-center gap-2 relative">
                                <Input
                                  id="warehouseId"
                                  value={formData.warehouseId}
                                  onChange={(e) => handleInputChange('warehouseId', e.target.value)}
                                  required
                                  disabled={creating}
                                  className={`bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${
                                    warehouseValid === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                                    warehouseValid === true ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''
                                  }`}
                                  placeholder="Enter warehouse ID"
                                />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="ml-2"
                                        onClick={handleVerifyWarehouse}
                                        disabled={warehouseVerifyLoading || !formData.warehouseId.trim() || creating || editDialogOpen}
                                      >
                                        {warehouseVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Warehouse"}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      {warehouseVerifyLoading ? (
                                        <span>Verifying...</span>
                                      ) : warehouseVerifyError ? (
                                        <span className="text-red-600">{warehouseVerifyError}</span>
                                      ) : warehouseInfo ? (
                                        <div>
                                          <div className="font-semibold text-sm">Address:</div>
                                          <div className="text-xs text-gray-700">{warehouseInfo.address}</div>
                                          <div className="text-xs text-gray-700">{warehouseInfo.city}, {warehouseInfo.state}, {warehouseInfo.country}</div>
                                          <div className="text-xs text-gray-700">Pincode: {warehouseInfo.pincode}</div>
                                        </div>
                                      ) : (
                                        <span>Click to verify warehouse and view details</span>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {warehouseValid === true && !warehouseVerified && (
                                <div className="space-y-1 mt-1">
                                  <p className="text-sm text-green-600 flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" />
                                    Valid warehouse ID
                                  </p>
                                  {warehouseInfo && (
                                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                                      <p><strong>Address:</strong> {warehouseInfo.address}</p>
                                      <p><strong>City:</strong> {warehouseInfo.city}</p>
                                      <p><strong>Pincode:</strong> {warehouseInfo.pincode}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {warehouseVerified && warehouseInfo && (
                                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                  <UserCheck className="h-3 w-3" />
                                  Verified: {warehouseInfo.address}, {warehouseInfo.city}, {warehouseInfo.state}, {warehouseInfo.country} (Pincode: {warehouseInfo.pincode})
                                </p>
                              )}
                              {warehouseValid === false && (
                                <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                                  <Shield className="h-3 w-3" />
                                  Invalid warehouse ID
                                </p>
                              )}
                              {warehouseVerifyError && !warehouseVerifyLoading && (
                                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                  <Shield className="h-3 w-3" />
                                  {warehouseVerifyError}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700">Contact Number</Label>
                            <Input
                              id="contactNumber"
                              value={formData.contactNumber}
                              onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                              disabled={creating}
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter contact number (optional)"
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Password Requirements Alert */}
                        <Alert className="border-blue-200 bg-blue-50">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800 text-sm">
                            <strong>Password Requirements:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              <li>Minimum 6 characters long</li>
                              <li>At least one uppercase letter (A-Z)</li>
                              <li>At least one lowercase letter (a-z)</li>
                              <li>At least one number (0-9)</li>
                            </ul>
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password *</Label>
                            <Input
                              id="password"
                              type="password"
                              value={formData.password}
                              onChange={(e) => handleInputChange('password', e.target.value)}
                              required
                              disabled={creating}
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter password"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm Password *</Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={formData.confirmPassword}
                              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                              required
                              disabled={creating}
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Confirm password"
                            />
                          </div>
                        </div>

                        {error && (
                          <Alert variant="destructive" className="border-red-200 bg-red-50">
                            <AlertDescription className="text-red-800">{error}</AlertDescription>
                          </Alert>
                        )}

                        {success && (
                          <Alert className="border-green-200 bg-green-50">
                            <AlertDescription className="text-green-800">{success}</AlertDescription>
                          </Alert>
                        )}

                        <Button 
                          type="submit" 
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg" 
                          disabled={creating || (formData.role === 'vendor' && !warehouseVerified && warehouseValid !== true)}
                        >
                          {creating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating User...
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Create User Account
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update user information and settings
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => handleEditInputChange('name', e.target.value)}
                  required
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => handleEditInputChange('email', e.target.value)}
                  required
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={(e) => handleEditInputChange('phone', e.target.value)}
                  required
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role" className="text-sm font-medium text-gray-700">User Role *</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value: 'admin' | 'vendor') => handleEditInputChange('role', value)}
                  disabled={editing}
                >
                  <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </SelectItem>
                    <SelectItem value="vendor" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Vendor
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status" className="text-sm font-medium text-gray-700">Status *</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value: string) => handleEditInputChange('status', value)}
                  disabled={editing}
                >
                  <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editFormData.role === 'vendor' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-warehouseId" className="text-sm font-medium text-gray-700">Warehouse ID *</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="edit-warehouseId"
                        value={editFormData.warehouseId}
                        onChange={(e) => handleEditInputChange('warehouseId', e.target.value)}
                        required
                        disabled={editing}
                        className={`bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${
                          warehouseValid === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                          warehouseValid === true ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''
                        }`}
                        placeholder="Enter warehouse ID"
                      />
                      {warehouseValidating && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleVerifyWarehouse}
                      disabled={warehouseVerifyLoading || !editFormData.warehouseId.trim() || editing || !editDialogOpen}
                    >
                      {warehouseVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                  {warehouseValid === true && (
                    <div className="space-y-1">
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        Valid warehouse ID
                      </p>
                      {warehouseInfo && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                          <p><strong>Address:</strong> {warehouseInfo.address}</p>
                          <p><strong>City:</strong> {warehouseInfo.city}</p>
                          <p><strong>Pincode:</strong> {warehouseInfo.pincode}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {warehouseValid === false && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Invalid warehouse ID
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-contactNumber" className="text-sm font-medium text-gray-700">Contact Number</Label>
                <Input
                  id="edit-contactNumber"
                  value={editFormData.contactNumber}
                  onChange={(e) => handleEditInputChange('contactNumber', e.target.value)}
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={editing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editing}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {editing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update User
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-600" />
              Change Password for {passwordUser?.name}
            </DialogTitle>
            <DialogDescription>
              Enter new password for {passwordUser?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Password Requirements Alert */}
            <Alert className="border-purple-200 bg-purple-50">
              <Shield className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-800 text-sm">
                <strong>Password Requirements:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Minimum 6 characters long</li>
                  <li>At least one uppercase letter (A-Z)</li>
                  <li>At least one lowercase letter (a-z)</li>
                  <li>At least one number (0-9)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">New Password *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewUserPassword ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                  className="bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                  disabled={passwordLoading}
                >
                  {showNewUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-gray-700">Confirm New Password *</Label>
              <div className="relative">
                <Input
                  id="confirmNewPassword"
                  type={showConfirmUserPassword ? 'text' : 'password'}
                  value={confirmUserPassword}
                  onChange={(e) => setConfirmUserPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                  className="bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="Confirm new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmUserPassword(!showConfirmUserPassword)}
                  disabled={passwordLoading}
                >
                  {showConfirmUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {passwordError && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{passwordError}</AlertDescription>
              </Alert>
            )}

            {passwordSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{passwordSuccess}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
                disabled={passwordLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={passwordLoading}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {passwordLoading ? (
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
  )
} 
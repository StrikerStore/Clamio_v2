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
  Key
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-provider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
      return
    }

    setWarehouseValidating(true)
    try {
      // Get auth header from localStorage
      const authHeader = localStorage.getItem('authHeader')
      
      if (!authHeader) {
        setWarehouseValid(false)
        setError('Authentication required. Please login again.')
        return
      }

      const response = await apiClient.validateWarehouseForUser(warehouseId)
      setWarehouseValid(response.success)
    } catch (error) {
      console.error('Warehouse validation error:', error)
      setWarehouseValid(false)
    } finally {
      setWarehouseValidating(false)
    }
  }

  const handleVerifyWarehouse = async () => {
    setWarehouseVerifyLoading(true)
    setWarehouseVerifyError("")
    setWarehouseInfo(null)
    setWarehouseVerified(false)
    try {
      const response = await apiClient.verifyWarehouse(formData.warehouseId)
      if (response.success) {
        setWarehouseInfo(response.data)
        setWarehouseVerified(true)
      } else {
        setWarehouseVerifyError(response.message)
        setWarehouseVerified(false)
      }
    } catch (err) {
      setWarehouseVerifyError(err instanceof Error ? err.message : "Failed to verify warehouse")
      setWarehouseVerified(false)
    } finally {
      setWarehouseVerifyLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateUserForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'warehouseId') {
      setWarehouseValid(null)
      setWarehouseInfo(null)
      setWarehouseVerified(false)
      setWarehouseVerifyError("")
      validateWarehouse(value)
    }
  }

  const handleEditInputChange = (field: keyof EditUserForm, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }))
    
    // Auto-validate warehouse ID when it changes
    if (field === 'warehouseId') {
      validateWarehouse(value)
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
      setError("Invalid warehouse ID")
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
        ...(formData.role === 'vendor' && { warehouseId: formData.warehouseId }),
        ...(formData.contactNumber && { contactNumber: formData.contactNumber })
      }

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
      setError("Invalid warehouse ID")
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Super Admin Panel</h1>
                <p className="text-sm text-gray-600">User Management & System Control</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{currentUser?.name}</p>
                <p className="text-xs text-gray-500">{currentUser?.email}</p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                disabled={logoutLoading}
                className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                {logoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Users</p>
                    <p className="text-3xl font-bold">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Active Users</p>
                    <p className="text-3xl font-bold">{users.filter(u => u.status === 'active').length}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Admins</p>
                    <p className="text-3xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
                  </div>
                  <Shield className="h-8 w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Vendors</p>
                    <p className="text-3xl font-bold">{users.filter(u => u.role === 'vendor').length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-orange-200" />
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
                                        disabled={warehouseVerifyLoading || !formData.warehouseId.trim() || creating}
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
                              {warehouseVerified && warehouseInfo && (
                                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                  <UserCheck className="h-3 w-3" />
                                  Verified: {warehouseInfo.address}, {warehouseInfo.city}, {warehouseInfo.state}, {warehouseInfo.country} (Pincode: {warehouseInfo.pincode})
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
                          disabled={creating || (formData.role === 'vendor' && !warehouseVerified)}
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
                  <div className="relative">
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
                    />
                    {warehouseValidating && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                    )}
                  </div>
                  {warehouseValid === true && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      Valid warehouse ID
                    </p>
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
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                required
                disabled={passwordLoading}
                className="bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-gray-700">Confirm New Password *</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmUserPassword}
                onChange={(e) => setConfirmUserPassword(e.target.value)}
                required
                disabled={passwordLoading}
                className="bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                placeholder="Confirm new password"
              />
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
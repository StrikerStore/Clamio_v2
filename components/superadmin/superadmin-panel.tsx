"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Settings, Users, Upload, LogOut, Plus, Edit, Trash2, Menu, X } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { useDeviceType } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Mock data
const mockUsers = [
  { id: "1", name: "John Vendor", email: "john@vendor.com", role: "vendor", status: "active", lastLogin: "2024-01-15" },
  {
    id: "2",
    name: "Sarah Vendor",
    email: "sarah@vendor.com",
    role: "vendor",
    status: "active",
    lastLogin: "2024-01-14",
  },
  { id: "3", name: "Jane Admin", email: "jane@admin.com", role: "admin", status: "active", lastLogin: "2024-01-15" },
  {
    id: "4",
    name: "Mike Vendor",
    email: "mike@vendor.com",
    role: "vendor",
    status: "inactive",
    lastLogin: "2024-01-10",
  },
]

export function SuperAdminPanel() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const { isMobile, isTablet, isDesktop, deviceType } = useDeviceType()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "vendor",
    status: "active",
    password: "",
    userType: "",
    warehouseId: "",
    contactNumber: "",
  })
  const [newApiKey, setNewApiKey] = useState({ name: "", key: "" })
  const [csvData, setCsvData] = useState("")
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isAddApiKeyOpen, setIsAddApiKeyOpen] = useState(false)
  const [users, setUsers] = useState(mockUsers)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<any>(null)

  const handleAddUser = () => {
    if (!newUser.userType) {
      toast({
        title: "Error",
        description: "Please select a user type",
        variant: "destructive",
      })
      return
    }

    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (newUser.userType === "vendor" && !newUser.warehouseId) {
      toast({
        title: "Error",
        description: "Warehouse ID is required for vendors",
        variant: "destructive",
      })
      return
    }

    if (newUser.userType === "admin" && !newUser.contactNumber) {
      toast({
        title: "Error",
        description: "Contact number is required for admins",
        variant: "destructive",
      })
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newUser.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    // Check if email already exists
    if (users.some((user) => user.email === newUser.email)) {
      toast({
        title: "Error",
        description: "A user with this email already exists",
        variant: "destructive",
      })
      return
    }

    const newUserData = {
      id: `user_${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      lastLogin: "Never",
      warehouseId: newUser.warehouseId || undefined,
      contactNumber: newUser.contactNumber || undefined,
    }

    setUsers((prev) => [...prev, newUserData])
    toast({
      title: "User Added",
      description: `${newUser.name} has been added successfully as ${newUser.userType}`,
    })
    setNewUser({
      name: "",
      email: "",
      role: "vendor",
      status: "active",
      password: "",
      userType: "",
      warehouseId: "",
      contactNumber: "",
    })
    setIsAddUserOpen(false)
  }

  const handleEditUser = (user: any) => {
    setEditingUser({ ...user })
    setIsEditUserOpen(true)
  }

  const handleUpdateUser = () => {
    if (!editingUser.name || !editingUser.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editingUser.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    // Check if email already exists (excluding current user)
    if (users.some((user) => user.email === editingUser.email && user.id !== editingUser.id)) {
      toast({
        title: "Error",
        description: "A user with this email already exists",
        variant: "destructive",
      })
      return
    }

    setUsers((prev) => prev.map((user) => (user.id === editingUser.id ? editingUser : user)))

    toast({
      title: "User Updated",
      description: `${editingUser.name} has been updated successfully`,
    })
    setEditingUser(null)
    setIsEditUserOpen(false)
  }

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (userToDelete) {
      setUsers((prev) => prev.filter((user) => user.id !== userToDelete.id))
      toast({
        title: "User Deleted",
        description: `${userToDelete.name} has been removed from the system`,
      })
      setUserToDelete(null)
      setIsDeleteConfirmOpen(false)
    }
  }

  const handleDeleteUser = (userId: string, userName: string) => {
    toast({
      title: "User Deleted",
      description: `${userName} has been removed from the system`,
    })
  }

  const handleAddApiKey = () => {
    if (!newApiKey.name || !newApiKey.key) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "API Key Added",
      description: `API key for ${newApiKey.name} has been added successfully`,
    })
    setNewApiKey({ name: "", key: "" })
    setIsAddApiKeyOpen(false)
  }

  const handleCsvUpload = () => {
    if (!csvData.trim()) {
      toast({
        title: "Error",
        description: "Please enter CSV data",
        variant: "destructive",
      })
      return
    }

    const lines = csvData.trim().split("\n")
    const userCount = lines.length - 1 // Excluding header

    toast({
      title: "CSV Uploaded",
      description: `${userCount} users have been imported successfully`,
    })
    setCsvData("")
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      vendor: "bg-blue-100 text-blue-800",
      admin: "bg-purple-100 text-purple-800",
      superadmin: "bg-red-100 text-red-800",
    }

    return <Badge className={colors[role as keyof typeof colors]}>{role.toUpperCase()}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
    }

    return <Badge className={colors[status as keyof typeof colors]}>{status.toUpperCase()}</Badge>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {isMobile ? 'Admin' : 'Super Admin Panel'}
                </h1>
                {!isMobile && (
                  <p className="text-sm text-gray-500 truncate">Welcome back, {user?.name}</p>
                )}
              </div>
            </div>
            
            {/* Desktop/Tablet Logout */}
            {!isMobile && (
              <Button variant="outline" onClick={logout} className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                {isDesktop && 'Logout'}
              </Button>
            )}
            
            {/* Mobile Menu Button */}
            {isMobile && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            )}
          </div>
          
          {/* Mobile Menu */}
          {isMobile && isMobileMenuOpen && (
            <div className="border-t bg-white py-4">
              <div className="space-y-3">
                <div className="px-2">
                  <p className="text-sm text-gray-600 truncate">Welcome, {user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={logout} 
                  className="w-full flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Stats Cards */}
        <div className={`grid gap-4 md:gap-6 mb-6 md:mb-8 ${
          isMobile ? 'grid-cols-1' : 
          isTablet ? 'grid-cols-2' : 
          'grid-cols-3'
        }`}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter((u) => u.status === "active").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Vendors</p>
                  <p className="text-2xl font-bold text-gray-900">{users.filter((u) => u.role === "vendor").length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>System Management</CardTitle>
            <CardDescription>Manage users, API keys, and system settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="users" className="w-full">
              <TabsList className={`grid w-full grid-cols-2 ${isMobile ? 'h-auto' : ''}`}>
                <TabsTrigger value="users" className={`${isMobile ? 'text-xs px-2 py-3' : ''}`}>
                  {isMobile ? 'Users' : 'User Management'}
                </TabsTrigger>
                <TabsTrigger value="bulk-import" className={`${isMobile ? 'text-xs px-2 py-3' : ''}`}>
                  {isMobile ? 'Import' : 'Bulk Import'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4 md:space-y-6">
                <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'justify-between items-center'}`}>
                  <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>User Management</h3>
                  <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                      <Button className={`${isMobile ? 'w-full' : ''}`} size={isMobile ? 'default' : 'default'}>
                        <Plus className="w-4 h-4 mr-2" />
                        {isMobile ? 'Add User' : 'Add User'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto' : 'max-w-md'}`}>
                      <DialogHeader>
                        <DialogTitle className={`${isMobile ? 'text-lg' : 'text-xl'}`}>Add New User</DialogTitle>
                        <DialogDescription className={`${isMobile ? 'text-sm' : ''}`}>
                          Create a new user account for the vendor portal
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {!newUser.userType ? (
                          <div>
                            <Label>Select User Type</Label>
                            <div className={`grid grid-cols-2 gap-3 mt-2`}>
                              <Button
                                variant="outline"
                                className={`${isMobile ? 'h-16 text-sm' : 'h-20'} flex flex-col items-center justify-center bg-transparent`}
                                onClick={() => setNewUser({ ...newUser, userType: "vendor", role: "vendor" })}
                              >
                                <Users className={`${isMobile ? 'w-5 h-5 mb-1' : 'w-6 h-6 mb-2'}`} />
                                Vendor
                              </Button>
                              <Button
                                variant="outline"
                                className={`${isMobile ? 'h-16 text-sm' : 'h-20'} flex flex-col items-center justify-center bg-transparent`}
                                onClick={() => setNewUser({ ...newUser, userType: "admin", role: "admin" })}
                              >
                                <Settings className={`${isMobile ? 'w-5 h-5 mb-1' : 'w-6 h-6 mb-2'}`} />
                                Admin
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">
                                Adding {newUser.userType === "vendor" ? "Vendor" : "Admin"}
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setNewUser({
                                    name: "",
                                    email: "",
                                    role: "vendor",
                                    status: "active",
                                    password: "",
                                    userType: "",
                                    warehouseId: "",
                                    contactNumber: "",
                                  })
                                }
                              >
                                Change Type
                              </Button>
                            </div>

                            <div>
                              <Label htmlFor="name">Full Name *</Label>
                              <Input
                                id="name"
                                value={newUser.name}
                                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                placeholder="Enter full name"
                              />
                            </div>

                            {newUser.userType === "vendor" && (
                              <div>
                                <Label htmlFor="warehouseId">Warehouse ID *</Label>
                                <Input
                                  id="warehouseId"
                                  value={newUser.warehouseId}
                                  onChange={(e) => setNewUser({ ...newUser, warehouseId: e.target.value })}
                                  placeholder="Enter warehouse ID"
                                />
                              </div>
                            )}

                            <div>
                              <Label htmlFor="email">Email Address *</Label>
                              <Input
                                id="email"
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                placeholder="Enter email address"
                              />
                            </div>

                            {newUser.userType === "admin" && (
                              <div>
                                <Label htmlFor="contactNumber">Contact Number *</Label>
                                <Input
                                  id="contactNumber"
                                  type="tel"
                                  value={newUser.contactNumber}
                                  onChange={(e) => setNewUser({ ...newUser, contactNumber: e.target.value })}
                                  placeholder="Enter contact number"
                                />
                              </div>
                            )}

                            <div>
                              <Label htmlFor="password">Password *</Label>
                              <Input
                                id="password"
                                type="password"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                placeholder="Enter password"
                              />
                            </div>

                            <div>
                              <Label htmlFor="status">Status</Label>
                              <Select
                                value={newUser.status}
                                onValueChange={(value) => setNewUser({ ...newUser, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddUser}>Add User</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Mobile Card Layout */}
                {isMobile ? (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <Card key={user.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 truncate">{user.name}</h4>
                              <p className="text-sm text-gray-600 truncate">{user.email}</p>
                            </div>
                            <div className="flex space-x-1 ml-2">
                              <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteClick(user)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {getRoleBadge(user.role)}
                            {getStatusBadge(user.status)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Last login: {user.lastLogin}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Desktop/Tablet Table Layout */
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Login</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell className={`${isTablet ? 'max-w-[150px] truncate' : ''}`}>
                                {user.email}
                              </TableCell>
                              <TableCell>{getRoleBadge(user.role)}</TableCell>
                              <TableCell>{getStatusBadge(user.status)}</TableCell>
                              <TableCell className={`${isTablet ? 'text-sm' : ''}`}>
                                {user.lastLogin}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleDeleteClick(user)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bulk-import" className="space-y-4 md:space-y-6">
                <div>
                  <h3 className={`font-medium mb-4 ${isMobile ? 'text-base' : 'text-lg'}`}>Bulk Import Users</h3>
                  <Card>
                    <CardHeader>
                      <CardTitle>CSV Import</CardTitle>
                      <CardDescription>
                        Import multiple users at once using CSV format. Expected format: Name, Email, Role
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="csv-data">CSV Data</Label>
                        <Textarea
                          id="csv-data"
                          placeholder="Name,Email,Role&#10;John Doe,john@example.com,vendor&#10;Jane Smith,jane@example.com,admin"
                          value={csvData}
                          onChange={(e) => setCsvData(e.target.value)}
                          rows={8}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={handleCsvUpload}>
                          <Upload className="w-4 h-4 mr-2" />
                          Import Users
                        </Button>
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload CSV File
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Import Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          <strong>CSV Format:</strong> Name, Email, Role
                        </p>
                        <p>
                          <strong>Supported Roles:</strong> vendor, admin, superadmin
                        </p>
                        <p>
                          <strong>Example:</strong>
                        </p>
                        <pre className="bg-gray-100 p-2 rounded text-xs">
                          Name,Email,Role{"\n"}
                          John Vendor,john@vendor.com,vendor{"\n"}
                          Jane Admin,jane@admin.com,admin{"\n"}
                          Super User,super@admin.com,superadmin
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account information</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email Address *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editingUser.status}
                  onValueChange={(value) => setEditingUser({ ...editingUser, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Update User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

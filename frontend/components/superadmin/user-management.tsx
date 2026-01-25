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
  EyeOff,
  Store,
  CheckCircle,
  XCircle
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-provider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useDeviceType } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  address: string
  city: string
  pincode: string
}

interface EditUserForm {
  name: string
  email: string
  phone: string
  role: 'admin' | 'vendor'
  status: string
  warehouseId: string
  contactNumber: string
  address: string
  pincode: string
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
  const [storeSearchTerm, setStoreSearchTerm] = useState("")
  const [storeStatusFilter, setStoreStatusFilter] = useState<string>("all")
  const [storeShippingPartnerFilter, setStoreShippingPartnerFilter] = useState<string>("all")
  const [mobileStoreFilterOpen, setMobileStoreFilterOpen] = useState(false)
  const [mobileWhMappingFilterOpen, setMobileWhMappingFilterOpen] = useState(false)
  const [whMappingSearchTerm, setWhMappingSearchTerm] = useState("")
  const [whMappingStoreFilter, setWhMappingStoreFilter] = useState<string>("all")
  const [whMappingVendorFilter, setWhMappingVendorFilter] = useState<string>("all")
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
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false)

  // Mobile UI state
  const [mobileTab, setMobileTab] = useState<'users' | 'stores' | 'warehouse-mapping'>("users")
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("users")

  // Store management state
  const [stores, setStores] = useState<any[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [updatingStore, setUpdatingStore] = useState(false)
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false)
  const [isEditStoreOpen, setIsEditStoreOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<any>(null)
  const [isDeleteStoreConfirmOpen, setIsDeleteStoreConfirmOpen] = useState(false)
  const [storeToDelete, setStoreToDelete] = useState<any>(null)
  const [newStore, setNewStore] = useState({
    store_name: "",
    shipping_partner: "",
    username: "",
    password: "",
    shopify_store_url: "",
    shopify_token: "",
    status: "active" as "active" | "inactive"
  })
  const [shippingPartners, setShippingPartners] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showShopifyToken, setShowShopifyToken] = useState(false)
  const [testingConnection, setTestingConnection] = useState<{ type: 'shipway' | 'shopify' | null, loading: boolean }>({ type: null, loading: false })
  const [shipwayTestResult, setShipwayTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [shopifyTestResult, setShopifyTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isAddingStore, setIsAddingStore] = useState(false)

  // Warehouse Mapping state
  const [whMappings, setWhMappings] = useState<any[]>([])
  const [whMappingsLoading, setWhMappingsLoading] = useState(false)
  const [vendorsForMapping, setVendorsForMapping] = useState<any[]>([])
  const [storesForMapping, setStoresForMapping] = useState<any[]>([])
  const [isAddMappingOpen, setIsAddMappingOpen] = useState(false)
  const [isDeleteMappingConfirmOpen, setIsDeleteMappingConfirmOpen] = useState(false)
  const [mappingToDelete, setMappingToDelete] = useState<any>(null)
  const [newMapping, setNewMapping] = useState({
    claimio_wh_id: "",
    account_code: "",
    vendor_wh_id: "",
    return_warehouse_id: ""
  })
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [validatingWarehouse, setValidatingWarehouse] = useState(false)

  const [formData, setFormData] = useState<CreateUserForm>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "admin",
    warehouseId: "",
    contactNumber: "",
    address: "",
    city: "",
    pincode: ""
  })

  const [editFormData, setEditFormData] = useState<EditUserForm>({
    name: "",
    email: "",
    phone: "",
    role: "admin",
    status: "active",
    warehouseId: "",
    contactNumber: "",
    address: "",
    pincode: ""
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
    fetchShippingPartners()
    fetchWhMappings()
    fetchVendorsForMapping()
    fetchStoresForMapping()
  }, [])

  const fetchShippingPartners = async () => {
    try {
      const response = await apiClient.getShippingPartners()
      if (response.success && Array.isArray(response.data)) {
        setShippingPartners(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch shipping partners:', error)
    }
  }

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
    const warehouseId = editDialogOpen ? editFormData.warehouseId : formData.warehouseId
    if (!warehouseId.trim()) return

    setWarehouseVerifyLoading(true)
    try {
      await validateWarehouse(warehouseId)
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


    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        status: 'active',
        ...(formData.role === 'vendor' && { warehouseId: formData.warehouseId.trim() }),
        ...(formData.contactNumber && { contactNumber: formData.contactNumber }),
        ...(formData.address && { address: formData.address.trim() }),
        ...(formData.city && { city: formData.city.trim() }),
        ...(formData.pincode && { pincode: formData.pincode.trim() })
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
          contactNumber: "",
          address: "",
          city: "",
          pincode: ""
        })
        setWarehouseValid(null)
        setWarehouseInfo(null)
        setWarehouseVerified(false)
        setAddUserDialogOpen(false)
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
      contactNumber: user.contactNumber || "",
      address: (user as any).address || "",
      pincode: (user as any).pincode || ""
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

    try {
      const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        status: editFormData.status,
        ...(editFormData.role === 'vendor' && { warehouseId: editFormData.warehouseId }),
        ...(editFormData.contactNumber && { contactNumber: editFormData.contactNumber }),
        ...(editFormData.address && { address: editFormData.address.trim() }),
        ...(editFormData.pincode && { pincode: editFormData.pincode.trim() })
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

  // Store management functions
  const fetchStores = async () => {
    setStoresLoading(true)
    try {
      const response = await apiClient.getAllStores()
      if (response.success) {
        setStores(response.data || [])
      } else {
        setError(response.message || "Failed to fetch stores")
      }
    } catch (error: any) {
      setError(error?.message || "Failed to fetch stores")
    } finally {
      setStoresLoading(false)
    }
  }

  const handleAddStore = async () => {
    if (!newStore.store_name || !newStore.shipping_partner || !newStore.username || !newStore.password ||
      !newStore.shopify_store_url || !newStore.shopify_token) {
      setError("Please fill in all required fields")
      return
    }

    setIsAddingStore(true)
    try {
      const response = await apiClient.createStore(newStore)
      if (response.success) {
        setSuccess(`${newStore.store_name} has been added successfully. Syncing orders, carriers, and products...`)
        setNewStore({
          store_name: "",
          shipping_partner: "",
          username: "",
          password: "",
          shopify_store_url: "",
          shopify_token: "",
          status: "active"
        })
        setShipwayTestResult(null)
        setShopifyTestResult(null)
        setIsAddStoreOpen(false)
        fetchStores()
      } else {
        setError(response.message || "Failed to create store")
      }
    } catch (error: any) {
      setError(error?.message || "Failed to create store")
    } finally {
      setIsAddingStore(false)
    }
  }

  const handleEditStore = (store: any) => {
    setError("")
    setSuccess("")
    setEditingStore({
      ...store,
      password: store.password || '',
      shopify_token: store.shopify_token || '',
      shopify_store_url: store.shopify_store_url || '',
      username: store.username || '',
      store_name: store.store_name || '',
      status: store.status || 'active'
    })
    setIsEditStoreOpen(true)
  }

  const handleUpdateStore = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (!editingStore) return

    if (!editingStore.store_name || !editingStore.username ||
      !editingStore.shopify_store_url || !editingStore.shopify_token) {
      setError("Please fill in all required fields")
      return
    }

    setError("")
    setSuccess("")
    setUpdatingStore(true)

    try {
      const updateData: any = {
        store_name: editingStore.store_name,
        username: editingStore.username,
        shopify_store_url: editingStore.shopify_store_url,
        shopify_token: editingStore.shopify_token,
        status: editingStore.status
      }

      if (editingStore.password && editingStore.password.trim() !== '') {
        updateData.password = editingStore.password
      }

      const response = await apiClient.updateStore(editingStore.account_code, updateData)
      if (response.success) {
        setSuccess(`${editingStore.store_name} has been updated successfully`)
        setTimeout(() => {
          setIsEditStoreOpen(false)
          setEditingStore(null)
          setError("")
          setSuccess("")
          fetchStores()
        }, 1000)
      } else {
        setError(response.message || "Failed to update store")
      }
    } catch (error: any) {
      setError(error?.message || "Failed to update store")
    } finally {
      setUpdatingStore(false)
    }
  }

  const handleDeleteStoreClick = (store: any) => {
    setStoreToDelete(store)
    setIsDeleteStoreConfirmOpen(true)
  }

  const handleConfirmDeleteStore = async () => {
    if (storeToDelete) {
      try {
        const response = await apiClient.deleteStore(storeToDelete.account_code)
        if (response.success) {
          setSuccess(`${storeToDelete.store_name} has been removed from the system`)
          setStoreToDelete(null)
          setIsDeleteStoreConfirmOpen(false)
          fetchStores()
        } else {
          setError(response.message || "Failed to delete store")
        }
      } catch (error: any) {
        setError(error?.message || "Failed to delete store")
      }
    }
  }

  const handleTestShipway = async (username: string, password: string) => {
    if (!username || !password) {
      setShipwayTestResult({ success: false, message: "Please enter username and password" })
      setError("Please enter username and password")
      return
    }

    setTestingConnection({ type: 'shipway', loading: true })
    setShipwayTestResult(null) // Clear previous result
    try {
      const response = await apiClient.testStoreShipwayConnection({ username: username, password: password })

      // Handle response - check for success property (handle both boolean true and string "true")
      const isSuccess = response?.success === true || (response?.success as any) === 'true' || (response?.success as any) === 1

      if (isSuccess) {
        const successMessage = response.message || "Connection successful! Credentials are valid."
        setShipwayTestResult({ success: true, message: successMessage })
        setSuccess("Shipping partner credentials are valid")
      } else {
        const errorMessage = response?.message || "Invalid credentials"
        setShipwayTestResult({ success: false, message: errorMessage })
        setError(errorMessage)
      }
    } catch (error: any) {
      // Extract error message from various possible error formats
      let errorMessage = "Failed to test connection"
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      setShipwayTestResult({ success: false, message: errorMessage })
      setError(errorMessage)
    } finally {
      setTestingConnection({ type: null, loading: false })
    }
  }

  const handleTestShopify = async (url: string, token: string) => {
    if (!url || !token) {
      setShopifyTestResult({ success: false, message: "Please enter Shopify store URL and token" })
      return
    }

    setTestingConnection({ type: 'shopify', loading: true })
    setShopifyTestResult(null) // Clear previous result
    try {
      const response = await apiClient.testShopifyConnection({ shopify_store_url: url, shopify_token: token })
      if (response.success) {
        setShopifyTestResult({ success: true, message: response.message || "Connection successful! Credentials are valid." })
        setSuccess("Shopify credentials are valid")
      } else {
        setShopifyTestResult({ success: false, message: response.message || "Invalid Shopify credentials" })
        setError(response.message || "Invalid Shopify credentials")
      }
    } catch (error: any) {
      // Extract error message from various possible error formats
      let errorMessage = "Failed to test Shopify connection"
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      setShopifyTestResult({ success: false, message: errorMessage })
      setError(errorMessage)
    } finally {
      setTestingConnection({ type: null, loading: false })
    }
  }

  // Warehouse Mapping functions
  const fetchWhMappings = async () => {
    setWhMappingsLoading(true)
    try {
      const response = await apiClient.getAllWhMappings(true)
      if (response.success) {
        setWhMappings(response.data || [])
      }
    } catch (error: any) {
      setError(error?.message || "Failed to load warehouse mappings")
    } finally {
      setWhMappingsLoading(false)
    }
  }

  const fetchVendorsForMapping = async () => {
    try {
      const response = await apiClient.getWhMappingVendors()
      if (response.success) {
        setVendorsForMapping(response.data || [])
      }
    } catch (error: any) {
      console.error('Failed to load vendors:', error)
    }
  }

  const fetchStoresForMapping = async () => {
    try {
      const response = await apiClient.getWhMappingStores()
      if (response.success) {
        setStoresForMapping(response.data || [])
      }
    } catch (error: any) {
      console.error('Failed to load stores:', error)
    }
  }

  const handleValidateWarehouse = async () => {
    if (!newMapping.vendor_wh_id || !newMapping.account_code) {
      setError("Please enter Vendor WH ID and select Account Code first")
      return
    }

    setValidatingWarehouse(true)
    setWarehouseInfo(null)
    setWarehouseVerified(false)
    try {
      const response = await apiClient.validateVendorWhId(newMapping.vendor_wh_id, newMapping.account_code)
      if (response.success) {
        setWarehouseInfo(response.data?.warehouse)
        setWarehouseVerified(true)
        setSuccess("Warehouse verified successfully")
      } else {
        setWarehouseInfo(null)
        setWarehouseVerified(false)
        setError(response.message || "Warehouse not found in Shipway system")
      }
    } catch (error: any) {
      setWarehouseInfo(null)
      setWarehouseVerified(false)
      setError(error?.message || "Failed to validate warehouse")
    } finally {
      setValidatingWarehouse(false)
    }
  }

  const handleCreateMapping = async () => {
    if (!newMapping.claimio_wh_id || !newMapping.account_code || !newMapping.vendor_wh_id) {
      setError("Please fill in all required fields")
      return
    }

    if (!warehouseVerified) {
      setError("Please verify the warehouse ID before saving")
      return
    }

    try {
      const response = await apiClient.createWhMapping({
        claimio_wh_id: newMapping.claimio_wh_id,
        vendor_wh_id: newMapping.vendor_wh_id,
        account_code: newMapping.account_code,
        return_warehouse_id: newMapping.return_warehouse_id
      })
      if (response.success) {
        setSuccess("Warehouse mapping created successfully")
        setIsAddMappingOpen(false)
        setNewMapping({ claimio_wh_id: "", account_code: "", vendor_wh_id: "", return_warehouse_id: "" })
        setSelectedVendor(null)
        setSelectedStore(null)
        setWarehouseInfo(null)
        setWarehouseVerified(false)
        fetchWhMappings()
      } else {
        setError(response.message || "Failed to create warehouse mapping")
      }
    } catch (error: any) {
      setError(error?.message || "Failed to create warehouse mapping")
    }
  }

  const handleDeleteMapping = async () => {
    if (!mappingToDelete) return

    try {
      const response = await apiClient.deleteWhMapping(mappingToDelete.id)
      if (response.success) {
        setSuccess("Warehouse mapping deleted successfully")
        setIsDeleteMappingConfirmOpen(false)
        setMappingToDelete(null)
        fetchWhMappings()
      } else {
        setError(response.message || "Failed to delete warehouse mapping")
      }
    } catch (error: any) {
      setError(error?.message || "Failed to delete warehouse mapping")
    }
  }

  // Fetch stores on component mount
  useEffect(() => {
    fetchStores()
  }, [])

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  const filteredStores = stores.filter(store => {
    const matchesSearch =
      (store.store_name || '').toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
      (store.account_code || '').toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
      (store.username || '').toLowerCase().includes(storeSearchTerm.toLowerCase())
    const matchesStatus = storeStatusFilter === "all" || store.status === storeStatusFilter
    const matchesShippingPartner = storeShippingPartnerFilter === "all" || store.shipping_partner === storeShippingPartnerFilter

    return matchesSearch && matchesStatus && matchesShippingPartner
  })

  const filteredWhMappings = whMappings.filter(mapping => {
    const matchesSearch =
      (mapping.claimio_wh_id || '').toLowerCase().includes(whMappingSearchTerm.toLowerCase()) ||
      (mapping.vendor_name || '').toLowerCase().includes(whMappingSearchTerm.toLowerCase()) ||
      (mapping.account_code || '').toLowerCase().includes(whMappingSearchTerm.toLowerCase()) ||
      (mapping.store_name || '').toLowerCase().includes(whMappingSearchTerm.toLowerCase()) ||
      (mapping.vendor_wh_id || '').toLowerCase().includes(whMappingSearchTerm.toLowerCase())
    const matchesStore = whMappingStoreFilter === "all" || mapping.account_code === whMappingStoreFilter || mapping.store_name === whMappingStoreFilter
    const matchesVendor = whMappingVendorFilter === "all" || mapping.vendor_name === whMappingVendorFilter || mapping.claimio_wh_id === whMappingVendorFilter

    return matchesSearch && matchesStore && matchesVendor
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
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img src="/logo.png" alt="CLAIMIO Logo" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-gray-900 truncate">Super Admin</h1>
                  <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                </div>
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
          {(mobileTab === 'users' || mobileTab === 'stores') && (
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
                  <Button variant="outline" size="icon" className="shrink-0 relative">
                    <Filter className="h-4 w-4" />
                    {(roleFilter !== "all" || statusFilter !== "all") && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full"></span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="space-y-4">
                  <SheetHeader>
                    <div className="flex items-center relative">
                      {(roleFilter !== "all" || statusFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-auto py-1 px-2 absolute left-0"
                          onClick={() => {
                            setRoleFilter("all")
                            setStatusFilter("all")
                          }}
                        >
                          Reset
                        </Button>
                      )}
                      <SheetTitle className="flex-1 text-center">Filters</SheetTitle>
                    </div>
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
              <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </Dialog>
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
                            <Badge
                              variant={getStatusBadgeVariant(user.status)}
                              className={`text-xs ${user.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                            >
                              {user.status}
                            </Badge>
                          </div>
                        </div>
                        {/* Actions */}
                        {user.role !== 'superadmin' && (
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
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
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit User</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Dialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleChangeUserPassword(user)}
                                    className="h-8 px-2"
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Change Password</p>
                                </TooltipContent>
                              </Tooltip>
                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete User</p>
                                  </TooltipContent>
                                </Tooltip>
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
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Store Management */}
          {mobileTab === 'stores' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Store Management</h3>
                  <p className="text-sm text-gray-600 mt-1">Manage Shipway and Shopify stores</p>
                </div>
                <Dialog open={isAddStoreOpen} onOpenChange={setIsAddStoreOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Store</DialogTitle>
                      <DialogDescription>
                        Create a new store with shipping partner and Shopify credentials
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="store-name">Store Name *</Label>
                        <Input
                          id="store-name"
                          value={newStore.store_name}
                          onChange={(e) => setNewStore({ ...newStore, store_name: e.target.value })}
                          placeholder="e.g., Striker Store"
                        />
                      </div>

                      <div>
                        <Label htmlFor="shipping-partner">Shipping Partner *</Label>
                        <Select
                          value={newStore.shipping_partner}
                          onValueChange={(value) => {
                            setNewStore({ ...newStore, shipping_partner: value, username: "", password: "" })
                            setShipwayTestResult(null)
                            setShopifyTestResult(null)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping partner" />
                          </SelectTrigger>
                          <SelectContent>
                            {shippingPartners.map((partner) => (
                              <SelectItem key={partner} value={partner}>
                                {partner}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {newStore.shipping_partner && (
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">{newStore.shipping_partner} Credentials</Label>
                          <div>
                            <Label htmlFor="shipping-username">Username *</Label>
                            <Input
                              id="shipping-username"
                              value={newStore.username}
                              onChange={(e) => setNewStore({ ...newStore, username: e.target.value })}
                              placeholder={`Enter ${newStore.shipping_partner} username`}
                            />
                          </div>
                          <div>
                            <Label htmlFor="shipping-password">Password *</Label>
                            <div className="relative">
                              <Input
                                id="shipping-password"
                                type={showPassword ? "text" : "password"}
                                value={newStore.password}
                                onChange={(e) => setNewStore({ ...newStore, password: e.target.value })}
                                placeholder={`Enter ${newStore.shipping_partner} password`}
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleTestShipway(newStore.username, newStore.password)}
                            disabled={testingConnection.loading && testingConnection.type === 'shipway'}
                          >
                            {testingConnection.loading && testingConnection.type === 'shipway' ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-2" />
                                Test {newStore.shipping_partner} Connection
                              </>
                            )}
                          </Button>
                          {shipwayTestResult && (
                            <div className={`text-sm mt-2 p-2 rounded-md flex items-start gap-2 ${shipwayTestResult.success
                              ? 'bg-green-50 text-green-800 border border-green-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                              }`}>
                              {shipwayTestResult.success ? (
                                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                              )}
                              <span className="flex-1">{shipwayTestResult.message}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Shopify Credentials</Label>
                        <div>
                          <Label htmlFor="shopify-url">Shopify Store URL *</Label>
                          <Input
                            id="shopify-url"
                            value={newStore.shopify_store_url}
                            onChange={(e) => setNewStore({ ...newStore, shopify_store_url: e.target.value })}
                            placeholder="https://your-store.myshopify.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="shopify-token">Shopify Token *</Label>
                          <div className="relative">
                            <Input
                              id="shopify-token"
                              type={showShopifyToken ? "text" : "password"}
                              value={newStore.shopify_token}
                              onChange={(e) => setNewStore({ ...newStore, shopify_token: e.target.value })}
                              placeholder="Enter Shopify access token"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowShopifyToken(!showShopifyToken)}
                            >
                              {showShopifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleTestShopify(newStore.shopify_store_url, newStore.shopify_token)}
                          disabled={testingConnection.loading && testingConnection.type === 'shopify'}
                        >
                          {testingConnection.loading && testingConnection.type === 'shopify' ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-2" />
                              Test Shopify Connection
                            </>
                          )}
                        </Button>
                        {shopifyTestResult && (
                          <div className={`text-sm mt-2 p-2 rounded-md flex items-start gap-2 ${shopifyTestResult.success
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                            {shopifyTestResult.success ? (
                              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                            )}
                            <span className="flex-1">{shopifyTestResult.message}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="status">Status *</Label>
                        <Select
                          value={newStore.status}
                          onValueChange={(value: "active" | "inactive") => setNewStore({ ...newStore, status: value })}
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
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddStoreOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddStore}
                        disabled={isAddingStore}
                      >
                        {isAddingStore ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Adding Store...
                          </>
                        ) : (
                          'Add Store'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search + Filter Row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search stores..."
                    value={storeSearchTerm}
                    onChange={(e) => setStoreSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <Sheet open={mobileStoreFilterOpen} onOpenChange={setMobileStoreFilterOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0 relative">
                      <Filter className="h-4 w-4" />
                      {(storeStatusFilter !== "all" || storeShippingPartnerFilter !== "all") && (
                        <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full"></span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="space-y-4">
                    <SheetHeader>
                      <div className="flex items-center relative">
                        {(storeStatusFilter !== "all" || storeShippingPartnerFilter !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-auto py-1 px-2 absolute left-0"
                            onClick={() => {
                              setStoreStatusFilter("all")
                              setStoreShippingPartnerFilter("all")
                            }}
                          >
                            Reset
                          </Button>
                        )}
                        <SheetTitle className="flex-1 text-center">Filters</SheetTitle>
                      </div>
                    </SheetHeader>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Status</Label>
                        <Select value={storeStatusFilter} onValueChange={setStoreStatusFilter}>
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
                      <div>
                        <Label className="text-sm">Shipping Partner</Label>
                        <Select value={storeShippingPartnerFilter} onValueChange={setStoreShippingPartnerFilter}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Filter by Partner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Partners</SelectItem>
                            {shippingPartners.map((partner) => (
                              <SelectItem key={partner} value={partner}>
                                {partner}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Stores List */}
              {storesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                  <p className="text-sm text-gray-500 mt-2">Loading stores...</p>
                </div>
              ) : filteredStores.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">No stores found. {storeSearchTerm || storeStatusFilter !== 'all' || storeShippingPartnerFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first store to get started.'}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredStores.map((store) => (
                    <Card key={store.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-medium text-gray-900 truncate">{store.store_name}</h4>
                            <p className="text-xs text-gray-600 truncate">Code: {store.account_code}</p>
                          </div>
                          <div className="flex space-x-1 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => handleEditStore(store)} className="h-8 w-8 p-0">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteStoreClick(store)} className="h-8 w-8 p-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={store.status === 'active' ? 'default' : 'destructive'}
                            className={store.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                          >
                            {store.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Shipway: {store.username}</p>
                          <p className="truncate">Shopify: {store.shopify_store_url || 'N/A'}</p>
                          {store.last_synced_at && <p>Last synced: {new Date(store.last_synced_at).toLocaleDateString()}</p>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Warehouse Mapping */}
          {mobileTab === 'warehouse-mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Warehouse Mapping</h3>
                  <p className="text-sm text-gray-600 mt-1">Map claimio warehouse IDs to vendor warehouse IDs per store</p>
                </div>
                <Dialog open={isAddMappingOpen} onOpenChange={(open) => {
                  setIsAddMappingOpen(open)
                  if (!open) {
                    setNewMapping({ claimio_wh_id: "", account_code: "", vendor_wh_id: "", return_warehouse_id: "" })
                    setSelectedVendor(null)
                    setSelectedStore(null)
                    setWarehouseInfo(null)
                    setWarehouseVerified(false)
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Warehouse Mapping</DialogTitle>
                      <DialogDescription>
                        Map claimio warehouse ID to vendor warehouse ID for a specific store
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="claimio-wh-id">Claimio WH ID *</Label>
                        <Select
                          value={newMapping.claimio_wh_id}
                          onValueChange={(value) => {
                            setNewMapping({ ...newMapping, claimio_wh_id: value })
                            const vendor = vendorsForMapping.find(v => v.warehouse_id === value)
                            setSelectedVendor(vendor || null)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor warehouse ID" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendorsForMapping.map((vendor) => (
                              <SelectItem key={vendor.warehouse_id} value={vendor.warehouse_id}>
                                {vendor.warehouse_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedVendor && (
                          <p className="text-sm text-gray-600 mt-1">Vendor: {selectedVendor.name}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="account-code">Account Code *</Label>
                        <Select
                          value={newMapping.account_code}
                          onValueChange={(value) => {
                            setNewMapping({ ...newMapping, account_code: value })
                            const store = storesForMapping.find(s => s.account_code === value)
                            setSelectedStore(store || null)
                            setWarehouseVerified(false)
                            setWarehouseInfo(null)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account code" />
                          </SelectTrigger>
                          <SelectContent>
                            {storesForMapping.map((store) => (
                              <SelectItem key={store.account_code} value={store.account_code}>
                                {store.account_code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedStore && (
                          <p className="text-sm text-gray-600 mt-1">Store: {selectedStore.store_name}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="vendor-wh-id">Vendor WH ID *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="vendor-wh-id"
                            value={newMapping.vendor_wh_id}
                            onChange={(e) => {
                              setNewMapping({ ...newMapping, vendor_wh_id: e.target.value })
                              setWarehouseVerified(false)
                              setWarehouseInfo(null)
                            }}
                            placeholder="Enter shipping partner warehouse ID"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleValidateWarehouse}
                            disabled={validatingWarehouse || !newMapping.vendor_wh_id || !newMapping.account_code}
                            variant="outline"
                          >
                            {validatingWarehouse ? "Verifying..." : "Verify"}
                          </Button>
                        </div>
                        {warehouseInfo && warehouseVerified && (
                          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm font-medium text-green-800 mb-1">Warehouse Verified</p>
                            <p className="text-xs text-green-700">Address: {warehouseInfo.address}</p>
                            <p className="text-xs text-green-700">City: {warehouseInfo.city}, Pincode: {warehouseInfo.pincode}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="return-warehouse-id">Return Warehouse ID</Label>
                        <Input
                          id="return-warehouse-id"
                          value={newMapping.return_warehouse_id}
                          onChange={(e) => {
                            setNewMapping({ ...newMapping, return_warehouse_id: e.target.value })
                          }}
                          placeholder="Enter return warehouse ID (optional, e.g., 67311)"
                          className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Optional: The return warehouse ID configured in Shipway for this store. If not provided, the pickup warehouse ID (Vendor WH ID) will be used for returns.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddMappingOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateMapping}
                        disabled={!warehouseVerified}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Save Mapping
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search + Filter Row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search mappings..."
                    value={whMappingSearchTerm}
                    onChange={(e) => setWhMappingSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <Sheet open={mobileWhMappingFilterOpen} onOpenChange={setMobileWhMappingFilterOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0 relative">
                      <Filter className="h-4 w-4" />
                      {(whMappingStoreFilter !== "all" || whMappingVendorFilter !== "all") && (
                        <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full"></span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="space-y-4">
                    <SheetHeader>
                      <div className="flex items-center relative">
                        {(whMappingStoreFilter !== "all" || whMappingVendorFilter !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-auto py-1 px-2 absolute left-0"
                            onClick={() => {
                              setWhMappingStoreFilter("all")
                              setWhMappingVendorFilter("all")
                            }}
                          >
                            Reset
                          </Button>
                        )}
                        <SheetTitle className="flex-1 text-center">Filters</SheetTitle>
                      </div>
                    </SheetHeader>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Store</Label>
                        <Select value={whMappingStoreFilter} onValueChange={setWhMappingStoreFilter}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Filter by Store" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Stores</SelectItem>
                            {storesForMapping.map((store) => (
                              <SelectItem key={store.account_code} value={store.account_code}>
                                {store.store_name || store.account_code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Vendor</Label>
                        <Select value={whMappingVendorFilter} onValueChange={setWhMappingVendorFilter}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Filter by Vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Vendors</SelectItem>
                            {vendorsForMapping.map((vendor) => (
                              <SelectItem key={vendor.warehouse_id} value={vendor.warehouse_id}>
                                {vendor.name || vendor.warehouse_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Warehouse Mappings List */}
              {whMappingsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                  <p className="text-sm text-gray-500 mt-2">Loading mappings...</p>
                </div>
              ) : filteredWhMappings.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">No warehouse mappings found. {whMappingSearchTerm || whMappingStoreFilter !== 'all' || whMappingVendorFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first mapping to get started.'}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredWhMappings.map((mapping) => (
                    <Card key={mapping.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-medium text-gray-900">Claimio WH: {mapping.claimio_wh_id}</h4>
                            <p className="text-xs text-gray-600 mt-1">Vendor: {mapping.vendor_name || 'N/A'}</p>
                            <p className="text-xs text-gray-600">Store: {mapping.store_name || mapping.account_code}</p>
                            <p className="text-xs text-gray-600">Vendor WH: {mapping.vendor_wh_id}</p>
                            <p className="text-xs text-gray-600">Return WH: {mapping.return_warehouse_id || 'N/A'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              variant={mapping.is_active ? 'default' : 'destructive'}
                              className={mapping.is_active ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                            >
                              {mapping.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </Badge>
                            {mapping.is_active && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setMappingToDelete(mapping)
                                  setIsDeleteMappingConfirmOpen(true)
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Bottom Nav */}
        <div className="fixed inset-x-0 bottom-0 z-20 bg-white border-t">
          <div className="grid grid-cols-3">
            <Button variant={mobileTab === 'users' ? 'default' : 'ghost'} className="rounded-none py-4" onClick={() => setMobileTab('users')}>
              <Users className="h-4 w-4 mr-1" /> Users
            </Button>
            <Button variant={mobileTab === 'stores' ? 'default' : 'ghost'} className="rounded-none py-4" onClick={() => setMobileTab('stores')}>
              <Store className="h-4 w-4 mr-1" /> Stores
            </Button>
            <Button variant={mobileTab === 'warehouse-mapping' ? 'default' : 'ghost'} className="rounded-none py-4" onClick={() => setMobileTab('warehouse-mapping')}>
              <MapPin className="h-4 w-4 mr-1" /> Mapping
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
                  <Input
                    id="edit-warehouseId"
                    value={editFormData.warehouseId}
                    onChange={(e) => handleEditInputChange('warehouseId', e.target.value)}
                    required
                    disabled={editing}
                    className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter warehouse ID"
                  />
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

              {/* Address field */}
              <div className="space-y-2">
                <Label htmlFor="edit-address" className="text-sm font-medium text-gray-700">Address</Label>
                <Input
                  id="edit-address"
                  value={editFormData.address}
                  onChange={(e) => handleEditInputChange('address', e.target.value)}
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter address (optional)"
                />
              </div>

              {/* Pincode field */}
              <div className="space-y-2">
                <Label htmlFor="edit-pincode" className="text-sm font-medium text-gray-700">Pincode</Label>
                <Input
                  id="edit-pincode"
                  value={editFormData.pincode}
                  onChange={(e) => handleEditInputChange('pincode', e.target.value)}
                  disabled={editing}
                  className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter pincode (optional)"
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

  // Main Desktop UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between ${isMobile ? 'h-14' : 'h-16'}`}>
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <img src="/logo.png" alt="CLAIMIO Logo" className="w-full h-full object-contain" />
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
          <div className={`grid gap-4 md:gap-6 ${isMobile ? 'grid-cols-2' :
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
              <CardTitle className="text-2xl font-bold text-gray-900">
                {activeTab === "users" && "User Management"}
                {activeTab === "stores" && "Store Management"}
                {activeTab === "warehouse-mapping" && "Warehouse Mapping"}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {activeTab === "users" && "Manage admin and vendor accounts with full control and oversight"}
                {activeTab === "stores" && "Manage Shipway and Shopify store accounts"}
                {activeTab === "warehouse-mapping" && "Map claimio warehouse IDs to vendor warehouse IDs per store"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-lg">
                  <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Users className="h-4 w-4" />
                    All Users
                  </TabsTrigger>
                  <TabsTrigger value="stores" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Store className="h-4 w-4" />
                    Store Management
                  </TabsTrigger>
                  <TabsTrigger value="warehouse-mapping" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <MapPin className="h-4 w-4" />
                    Warehouse Mapping
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
                    <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add User
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-gray-900">
                            <UserPlus className="h-5 w-5 text-blue-600" />
                            Add New User
                          </DialogTitle>
                          <DialogDescription className="text-gray-600">
                            Create a new admin or vendor account with full system access
                          </DialogDescription>
                        </DialogHeader>
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
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      id="warehouseId"
                                      value={formData.warehouseId}
                                      onChange={(e) => handleInputChange('warehouseId', e.target.value)}
                                      required
                                      disabled={creating}
                                      className={`bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${warehouseValid === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500' :
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
                                    disabled={warehouseVerifyLoading || !formData.warehouseId.trim() || creating || !addUserDialogOpen}
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

                            <div className="space-y-2">
                              <Label htmlFor="address" className="text-sm font-medium text-gray-700">Address</Label>
                              <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => handleInputChange('address', e.target.value)}
                                disabled={creating}
                                className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Enter address (optional)"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="city" className="text-sm font-medium text-gray-700">City</Label>
                              <Input
                                id="city"
                                value={formData.city}
                                onChange={(e) => handleInputChange('city', e.target.value)}
                                disabled={creating}
                                className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Enter city (optional)"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="pincode" className="text-sm font-medium text-gray-700">Pincode</Label>
                              <Input
                                id="pincode"
                                value={formData.pincode}
                                onChange={(e) => handleInputChange('pincode', e.target.value)}
                                disabled={creating}
                                className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Enter pincode (optional)"
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
                            <Alert variant="destructive">
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          )}

                          {success && (
                            <Alert className="border-green-200 bg-green-50">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-800">{success}</AlertDescription>
                            </Alert>
                          )}

                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setAddUserDialogOpen(false)
                                setError("")
                                setSuccess("")
                              }}
                              disabled={creating}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={creating}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {creating ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Create User
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
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
                                  <Badge
                                    variant={getStatusBadgeVariant(user.status)}
                                    className={user.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                                  >
                                    {user.status}
                                  </Badge>

                                  {/* Action Buttons - Only show for non-superadmin users */}
                                  {user.role !== 'superadmin' && (
                                    <div className="flex items-center space-x-2">
                                      <TooltipProvider>
                                        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
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
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Edit User</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </Dialog>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleChangeUserPassword(user)}
                                              className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
                                            >
                                              <Key className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Change Password</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <AlertDialog>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </AlertDialogTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Delete User</p>
                                            </TooltipContent>
                                          </Tooltip>
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
                                      </TooltipProvider>
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

                <TabsContent value="stores" className="space-y-6">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search stores by name, code, or username..."
                          value={storeSearchTerm}
                          onChange={(e) => setStoreSearchTerm(e.target.value)}
                          className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <Select value={storeStatusFilter} onValueChange={setStoreStatusFilter}>
                      <SelectTrigger className="w-40 bg-white border-gray-200">
                        <SelectValue placeholder="Filter by Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={storeShippingPartnerFilter} onValueChange={setStoreShippingPartnerFilter}>
                      <SelectTrigger className="w-48 bg-white border-gray-200">
                        <SelectValue placeholder="Filter by Partner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Partners</SelectItem>
                        {shippingPartners.map((partner) => (
                          <SelectItem key={partner} value={partner}>
                            {partner}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={isAddStoreOpen} onOpenChange={setIsAddStoreOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Store
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Add New Store</DialogTitle>
                          <DialogDescription>
                            Create a new store with shipping partner and Shopify credentials
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="store-name">Store Name *</Label>
                            <Input
                              id="store-name"
                              value={newStore.store_name}
                              onChange={(e) => setNewStore({ ...newStore, store_name: e.target.value })}
                              placeholder="e.g., Striker Store"
                            />
                          </div>

                          <div>
                            <Label htmlFor="shipping-partner">Shipping Partner *</Label>
                            <Select
                              value={newStore.shipping_partner}
                              onValueChange={(value) => {
                                setNewStore({ ...newStore, shipping_partner: value, username: "", password: "" })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select shipping partner" />
                              </SelectTrigger>
                              <SelectContent>
                                {shippingPartners.map((partner) => (
                                  <SelectItem key={partner} value={partner}>
                                    {partner}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {newStore.shipping_partner && (
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">{newStore.shipping_partner} Credentials</Label>
                              <div>
                                <Label htmlFor="shipping-username">Username *</Label>
                                <Input
                                  id="shipping-username"
                                  value={newStore.username}
                                  onChange={(e) => setNewStore({ ...newStore, username: e.target.value })}
                                  placeholder={`Enter ${newStore.shipping_partner} username`}
                                />
                              </div>
                              <div>
                                <Label htmlFor="shipping-password">Password *</Label>
                                <div className="relative">
                                  <Input
                                    id="shipping-password"
                                    type={showPassword ? "text" : "password"}
                                    value={newStore.password}
                                    onChange={(e) => setNewStore({ ...newStore, password: e.target.value })}
                                    placeholder={`Enter ${newStore.shipping_partner} password`}
                                    className="pr-10"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                  >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleTestShipway(newStore.username, newStore.password)}
                                disabled={testingConnection.loading && testingConnection.type === 'shipway'}
                              >
                                {testingConnection.loading && testingConnection.type === 'shipway' ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                    Testing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-2" />
                                    Test {newStore.shipping_partner} Connection
                                  </>
                                )}
                              </Button>
                              {shipwayTestResult && (
                                <div className={`text-sm mt-2 p-2 rounded-md flex items-start gap-2 ${shipwayTestResult.success
                                  ? 'bg-green-50 text-green-800 border border-green-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                                  }`}>
                                  {shipwayTestResult.success ? (
                                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                                  )}
                                  <span className="flex-1">{shipwayTestResult.message}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">Shopify Credentials</Label>
                            <div>
                              <Label htmlFor="shopify-url">Shopify Store URL *</Label>
                              <Input
                                id="shopify-url"
                                value={newStore.shopify_store_url}
                                onChange={(e) => setNewStore({ ...newStore, shopify_store_url: e.target.value })}
                                placeholder="https://your-store.myshopify.com"
                              />
                            </div>
                            <div>
                              <Label htmlFor="shopify-token">Shopify Token *</Label>
                              <div className="relative">
                                <Input
                                  id="shopify-token"
                                  type={showShopifyToken ? "text" : "password"}
                                  value={newStore.shopify_token}
                                  onChange={(e) => setNewStore({ ...newStore, shopify_token: e.target.value })}
                                  placeholder="Enter Shopify access token"
                                  className="pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowShopifyToken(!showShopifyToken)}
                                >
                                  {showShopifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleTestShopify(newStore.shopify_store_url, newStore.shopify_token)}
                              disabled={testingConnection.loading && testingConnection.type === 'shopify'}
                            >
                              {testingConnection.loading && testingConnection.type === 'shopify' ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  Testing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-2" />
                                  Test Shopify Connection
                                </>
                              )}
                            </Button>
                            {shopifyTestResult && (
                              <div className={`text-sm mt-2 p-2 rounded-md flex items-start gap-2 ${shopifyTestResult.success
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {shopifyTestResult.success ? (
                                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                                )}
                                <span className="flex-1">{shopifyTestResult.message}</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="status">Status *</Label>
                            <Select
                              value={newStore.status}
                              onValueChange={(value: "active" | "inactive") => setNewStore({ ...newStore, status: value })}
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
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddStoreOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddStore}
                            disabled={isAddingStore}
                          >
                            {isAddingStore ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Adding Store...
                              </>
                            ) : (
                              'Add Store'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Stores List */}
                  {storesLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-gray-500 mt-2">Loading stores...</p>
                    </div>
                  ) : filteredStores.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-500">No stores found. {storeSearchTerm || storeStatusFilter !== 'all' || storeShippingPartnerFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first store to get started.'}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Store Name</TableHead>
                              <TableHead>Account Code</TableHead>
                              <TableHead>Username</TableHead>
                              <TableHead>Shopify URL</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Last Synced</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStores.map((store) => (
                              <TableRow key={store.id}>
                                <TableCell className="font-medium">{store.store_name}</TableCell>
                                <TableCell className="font-mono text-xs">{store.account_code}</TableCell>
                                <TableCell>{store.username}</TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {store.shopify_store_url || 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={store.status === 'active' ? 'default' : 'destructive'}
                                    className={store.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                                  >
                                    {store.status.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {store.last_synced_at ? new Date(store.last_synced_at).toLocaleDateString() : 'Never'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button size="sm" variant="outline" onClick={() => handleEditStore(store)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleDeleteStoreClick(store)}>
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

                <TabsContent value="warehouse-mapping" className="space-y-6">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search mappings by ID, vendor, store, or code..."
                          value={whMappingSearchTerm}
                          onChange={(e) => setWhMappingSearchTerm(e.target.value)}
                          className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <Select value={whMappingStoreFilter} onValueChange={setWhMappingStoreFilter}>
                      <SelectTrigger className="w-48 bg-white border-gray-200">
                        <SelectValue placeholder="Filter by Store" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stores</SelectItem>
                        {storesForMapping.map((store) => (
                          <SelectItem key={store.account_code} value={store.account_code}>
                            {store.store_name || store.account_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={whMappingVendorFilter} onValueChange={setWhMappingVendorFilter}>
                      <SelectTrigger className="w-48 bg-white border-gray-200">
                        <SelectValue placeholder="Filter by Vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendorsForMapping.map((vendor) => (
                          <SelectItem key={vendor.warehouse_id} value={vendor.warehouse_id}>
                            {vendor.name || vendor.warehouse_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={isAddMappingOpen} onOpenChange={(open) => {
                      setIsAddMappingOpen(open)
                      if (!open) {
                        setNewMapping({ claimio_wh_id: "", account_code: "", vendor_wh_id: "", return_warehouse_id: "" })
                        setSelectedVendor(null)
                        setSelectedStore(null)
                        setWarehouseInfo(null)
                        setWarehouseVerified(false)
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Mapping
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Add Warehouse Mapping</DialogTitle>
                          <DialogDescription>
                            Map claimio warehouse ID to vendor warehouse ID for a specific store
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="claimio-wh-id">Claimio WH ID *</Label>
                            <Select
                              value={newMapping.claimio_wh_id}
                              onValueChange={(value) => {
                                setNewMapping({ ...newMapping, claimio_wh_id: value })
                                const vendor = vendorsForMapping.find(v => v.warehouse_id === value)
                                setSelectedVendor(vendor || null)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select vendor warehouse ID" />
                              </SelectTrigger>
                              <SelectContent>
                                {vendorsForMapping.map((vendor) => (
                                  <SelectItem key={vendor.warehouse_id} value={vendor.warehouse_id}>
                                    {vendor.warehouse_id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedVendor && (
                              <p className="text-sm text-gray-600 mt-1">Vendor: {selectedVendor.name}</p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="account-code">Account Code *</Label>
                            <Select
                              value={newMapping.account_code}
                              onValueChange={(value) => {
                                setNewMapping({ ...newMapping, account_code: value })
                                const store = storesForMapping.find(s => s.account_code === value)
                                setSelectedStore(store || null)
                                setWarehouseVerified(false)
                                setWarehouseInfo(null)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select account code" />
                              </SelectTrigger>
                              <SelectContent>
                                {storesForMapping.map((store) => (
                                  <SelectItem key={store.account_code} value={store.account_code}>
                                    {store.account_code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedStore && (
                              <p className="text-sm text-gray-600 mt-1">Store: {selectedStore.store_name}</p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="vendor-wh-id">Vendor WH ID *</Label>
                            <div className="flex gap-2">
                              <Input
                                id="vendor-wh-id"
                                value={newMapping.vendor_wh_id}
                                onChange={(e) => {
                                  setNewMapping({ ...newMapping, vendor_wh_id: e.target.value })
                                  setWarehouseVerified(false)
                                  setWarehouseInfo(null)
                                }}
                                placeholder="Enter shipping partner warehouse ID"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                onClick={handleValidateWarehouse}
                                disabled={validatingWarehouse || !newMapping.vendor_wh_id || !newMapping.account_code}
                                variant="outline"
                              >
                                {validatingWarehouse ? "Verifying..." : "Verify"}
                              </Button>
                            </div>
                            {warehouseInfo && warehouseVerified && (
                              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                                <p className="text-sm font-medium text-green-800 mb-1">Warehouse Verified</p>
                                <p className="text-xs text-green-700">Address: {warehouseInfo.address}</p>
                                <p className="text-xs text-green-700">City: {warehouseInfo.city}, Pincode: {warehouseInfo.pincode}</p>
                              </div>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="return-warehouse-id">Return Warehouse ID</Label>
                            <Input
                              id="return-warehouse-id"
                              value={newMapping.return_warehouse_id}
                              onChange={(e) => {
                                setNewMapping({ ...newMapping, return_warehouse_id: e.target.value })
                              }}
                              placeholder="Enter return warehouse ID (optional, e.g., 67311)"
                              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Optional: The return warehouse ID configured in Shipway for this store. If not provided, the pickup warehouse ID (Vendor WH ID) will be used for returns.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddMappingOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreateMapping}
                            disabled={!warehouseVerified}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Save Mapping
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {whMappingsLoading ? (
                    <div className="text-center py-8">Loading mappings...</div>
                  ) : filteredWhMappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No warehouse mappings found. {whMappingSearchTerm || whMappingStoreFilter !== 'all' || whMappingVendorFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first mapping to get started.'}</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Claimio WH ID</TableHead>
                              <TableHead>Vendor Name</TableHead>
                              <TableHead>Account Code</TableHead>
                              <TableHead>Store Name</TableHead>
                              <TableHead>Vendor WH ID</TableHead>
                              <TableHead>Return WH ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredWhMappings.map((mapping) => (
                              <TableRow key={mapping.id} className={mapping.is_active === false ? 'opacity-50' : ''}>
                                <TableCell>{mapping.claimio_wh_id}</TableCell>
                                <TableCell>{mapping.vendor_name || 'N/A'}</TableCell>
                                <TableCell>{mapping.account_code}</TableCell>
                                <TableCell>{mapping.store_name || 'N/A'}</TableCell>
                                <TableCell>{mapping.vendor_wh_id}</TableCell>
                                <TableCell>{mapping.return_warehouse_id || 'N/A'}</TableCell>
                                <TableCell>
                                  {mapping.is_active ? (
                                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {mapping.is_active && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        setMappingToDelete(mapping)
                                        setIsDeleteMappingConfirmOpen(true)
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
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
                        className={`bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${warehouseValid === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500' :
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

      {/* Edit Store Dialog */}
      <Dialog open={isEditStoreOpen} onOpenChange={(open) => {
        setIsEditStoreOpen(open)
        if (!open) {
          setError("")
          setSuccess("")
          setEditingStore(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
            <DialogDescription>
              Update store information and credentials
            </DialogDescription>
          </DialogHeader>
          {editingStore && (
            <div className="space-y-4">
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
              <div>
                <Label htmlFor="edit-store-name">Store Name *</Label>
                <Input
                  id="edit-store-name"
                  value={editingStore.store_name || ''}
                  onChange={(e) => setEditingStore({ ...editingStore, store_name: e.target.value })}
                  placeholder="e.g., Striker Store"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Shipway Credentials</Label>
                <div>
                  <Label htmlFor="edit-shipway-username">Shipway Username *</Label>
                  <Input
                    id="edit-shipway-username"
                    value={editingStore.username || ''}
                    onChange={(e) => setEditingStore({ ...editingStore, username: e.target.value })}
                    placeholder="Enter Shipway username"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-shipway-password">Shipway Password (leave blank to keep current)</Label>
                  <div className="relative">
                    <Input
                      id="edit-shipway-password"
                      type={showPassword ? "text" : "password"}
                      value={editingStore.password || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, password: e.target.value })}
                      placeholder="Enter new password or leave blank"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleTestShipway(editingStore.username, editingStore.password || '')}
                  disabled={testingConnection.loading && testingConnection.type === 'shipway'}
                >
                  {testingConnection.loading && testingConnection.type === 'shipway' ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 mr-2" />
                      Test Shipway Connection
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Shopify Credentials</Label>
                <div>
                  <Label htmlFor="edit-shopify-url">Shopify Store URL *</Label>
                  <Input
                    id="edit-shopify-url"
                    value={editingStore.shopify_store_url || ''}
                    onChange={(e) => setEditingStore({ ...editingStore, shopify_store_url: e.target.value })}
                    placeholder="https://your-store.myshopify.com"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-shopify-token">Shopify Token *</Label>
                  <div className="relative">
                    <Input
                      id="edit-shopify-token"
                      type={showShopifyToken ? "text" : "password"}
                      value={editingStore.shopify_token || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, shopify_token: e.target.value })}
                      placeholder="Enter Shopify access token"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowShopifyToken(!showShopifyToken)}
                    >
                      {showShopifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleTestShopify(editingStore.shopify_store_url || '', editingStore.shopify_token || '')}
                  disabled={testingConnection.loading && testingConnection.type === 'shopify'}
                >
                  {testingConnection.loading && testingConnection.type === 'shopify' ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 mr-2" />
                      Test Shopify Connection
                    </>
                  )}
                </Button>
              </div>

              <div>
                <Label htmlFor="edit-status">Status *</Label>
                <Select
                  value={editingStore.status || 'active'}
                  onValueChange={(value: "active" | "inactive") => setEditingStore({ ...editingStore, status: value })}
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
            <Button
              variant="outline"
              onClick={() => {
                setIsEditStoreOpen(false)
                setEditingStore(null)
                setError("")
                setSuccess("")
              }}
              disabled={updatingStore}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateStore}
              disabled={updatingStore}
            >
              {updatingStore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Store"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Store Confirmation Dialog */}
      <AlertDialog open={isDeleteStoreConfirmOpen} onOpenChange={setIsDeleteStoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {storeToDelete?.store_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteStoreConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteStore} className="bg-red-600 hover:bg-red-700">
              Delete Store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Warehouse Mapping Confirmation Dialog */}
      <AlertDialog open={isDeleteMappingConfirmOpen} onOpenChange={setIsDeleteMappingConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this warehouse mapping? This action will deactivate the mapping and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteMappingConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMapping} className="bg-red-600 hover:bg-red-700">
              Delete Mapping
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 
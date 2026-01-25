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
import { Settings, Users, Upload, LogOut, Plus, Edit, Trash2, Menu, X, Store, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { useDeviceType } from "@/hooks/use-mobile"
import { apiClient } from "@/lib/api"
import { useEffect } from "react"
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

  // Store management state
  const [stores, setStores] = useState<any[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
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
  const [vendors, setVendors] = useState<any[]>([])
  const [storesForMapping, setStoresForMapping] = useState<any[]>([])
  const [isAddMappingOpen, setIsAddMappingOpen] = useState(false)
  const [isDeleteMappingConfirmOpen, setIsDeleteMappingConfirmOpen] = useState(false)
  const [mappingToDelete, setMappingToDelete] = useState<any>(null)
  const [newMapping, setNewMapping] = useState({
    claimio_wh_id: "",
    account_code: "",
    vendor_wh_id: ""
  })
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [warehouseInfo, setWarehouseInfo] = useState<any>(null)
  const [validatingWarehouse, setValidatingWarehouse] = useState(false)
  const [warehouseVerified, setWarehouseVerified] = useState(false)

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

    return <Badge className={`${colors[role as keyof typeof colors]} text-[10px] sm:text-xs truncate`}>{role.toUpperCase()}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
    }

    return <Badge className={`${colors[status as keyof typeof colors]} text-[10px] sm:text-xs truncate`}>{status.toUpperCase()}</Badge>
  }

  // Store management functions
  const fetchStores = async () => {
    setStoresLoading(true)
    try {
      const response = await apiClient.getAllStores()
      if (response.success) {
        setStores(response.data || [])
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to fetch stores",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch stores",
        variant: "destructive",
      })
    } finally {
      setStoresLoading(false)
    }
  }

  const handleAddStore = async () => {
    if (!newStore.store_name || !newStore.shipping_partner || !newStore.username || !newStore.password ||
      !newStore.shopify_store_url || !newStore.shopify_token) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsAddingStore(true)
    try {
      const response = await apiClient.createStore(newStore)
      if (response.success) {
        toast({
          title: "Store Added",
          description: `${newStore.store_name} has been added successfully. Syncing orders, carriers, and products...`,
        })
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
        toast({
          title: "Error",
          description: response.message || "Failed to create store",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create store",
        variant: "destructive",
      })
    } finally {
      setIsAddingStore(false)
    }
  }

  const handleEditStore = (store: any) => {
    setEditingStore({
      ...store,
      password: '' // Don't show existing password, user needs to enter new one if changing
    })
    setIsEditStoreOpen(true)
  }

  const handleUpdateStore = async () => {
    if (!editingStore.store_name || !editingStore.username ||
      !editingStore.shopify_store_url || !editingStore.shopify_token) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const updateData: any = {
        store_name: editingStore.store_name,
        username: editingStore.username,
        shopify_store_url: editingStore.shopify_store_url,
        shopify_token: editingStore.shopify_token,
        status: editingStore.status
      }

      // Only include password if it was changed (not empty)
      if (editingStore.password && editingStore.password.trim() !== '') {
        updateData.password = editingStore.password
      }

      const response = await apiClient.updateStore(editingStore.account_code, updateData)
      if (response.success) {
        toast({
          title: "Store Updated",
          description: `${editingStore.store_name} has been updated successfully`,
        })
        setIsEditStoreOpen(false)
        setEditingStore(null)
        fetchStores()
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to update store",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update store",
        variant: "destructive",
      })
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
          toast({
            title: "Store Deleted",
            description: `${storeToDelete.store_name} has been removed from the system`,
          })
          setStoreToDelete(null)
          setIsDeleteStoreConfirmOpen(false)
          fetchStores()
        } else {
          toast({
            title: "Error",
            description: response.message || "Failed to delete store",
            variant: "destructive",
          })
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to delete store",
          variant: "destructive",
        })
      }
    }
  }

  const handleTestShipway = async (username: string, password: string) => {
    if (!username || !password) {
      setShipwayTestResult({ success: false, message: "Please enter Shipway username and password" })
      toast({
        title: "Error",
        description: "Please enter Shipway username and password",
        variant: "destructive",
      })
      return
    }

    setTestingConnection({ type: 'shipway', loading: true })
    setShipwayTestResult(null) // Clear previous result
    try {
      const response = await apiClient.testStoreShipwayConnection({ username: username, password: password })

      // Handle response - check for success property (handle both boolean true and string "true")
      const isSuccess = response?.success === true || (response?.success as any) === 'true' || (response?.success as any) === 1

      if (isSuccess) {
        const successMessage = response.message || `${newStore.shipping_partner || 'Shipping partner'} connection successful! Credentials are valid.`
        setShipwayTestResult({ success: true, message: successMessage })
        toast({
          title: "Connection Successful",
          description: successMessage,
        })
      } else {
        const errorMessage = response?.message || "Invalid credentials"
        setShipwayTestResult({ success: false, message: errorMessage })
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to test connection"
      setShipwayTestResult({ success: false, message: errorMessage })
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setTestingConnection({ type: null, loading: false })
    }
  }

  const handleTestShopify = async (url: string, token: string) => {
    if (!url || !token) {
      setShopifyTestResult({ success: false, message: "Please enter Shopify store URL and token" })
      toast({
        title: "Error",
        description: "Please enter Shopify store URL and token",
        variant: "destructive",
      })
      return
    }

    setTestingConnection({ type: 'shopify', loading: true })
    setShopifyTestResult(null) // Clear previous result
    try {
      const response = await apiClient.testShopifyConnection({ shopify_store_url: url, shopify_token: token })
      if (response.success) {
        setShopifyTestResult({ success: true, message: response.message || "Shopify connection successful! Credentials are valid." })
        toast({
          title: "Connection Successful",
          description: "Shopify credentials are valid",
        })
      } else {
        setShopifyTestResult({ success: false, message: response.message || "Invalid Shopify credentials" })
        toast({
          title: "Connection Failed",
          description: response.message || "Invalid Shopify credentials",
          variant: "destructive",
        })
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
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      })
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
      toast({
        title: "Error",
        description: error?.message || "Failed to load warehouse mappings",
        variant: "destructive",
      })
    } finally {
      setWhMappingsLoading(false)
    }
  }

  const fetchVendors = async () => {
    try {
      const response = await apiClient.getWhMappingVendors()
      if (response.success) {
        setVendors(response.data || [])
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
      toast({
        title: "Error",
        description: "Please enter Vendor WH ID and select Account Code first",
        variant: "destructive",
      })
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
        toast({
          title: "Warehouse Validated",
          description: "Warehouse verified successfully",
        })
      } else {
        setWarehouseInfo(null)
        setWarehouseVerified(false)
        toast({
          title: "Validation Failed",
          description: response.message || "Warehouse not found in Shipway system",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      setWarehouseInfo(null)
      setWarehouseVerified(false)
      toast({
        title: "Validation Error",
        description: error?.message || "Failed to validate warehouse",
        variant: "destructive",
      })
    } finally {
      setValidatingWarehouse(false)
    }
  }

  const handleCreateMapping = async () => {
    if (!newMapping.claimio_wh_id || !newMapping.account_code || !newMapping.vendor_wh_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (!warehouseVerified) {
      toast({
        title: "Error",
        description: "Please verify the warehouse ID before saving",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await apiClient.createWhMapping({
        claimio_wh_id: newMapping.claimio_wh_id,
        vendor_wh_id: newMapping.vendor_wh_id,
        account_code: newMapping.account_code
      })
      if (response.success) {
        toast({
          title: "Mapping Created",
          description: "Warehouse mapping created successfully",
        })
        setIsAddMappingOpen(false)
        setNewMapping({ claimio_wh_id: "", account_code: "", vendor_wh_id: "" })
        setSelectedVendor(null)
        setSelectedStore(null)
        setWarehouseInfo(null)
        setWarehouseVerified(false)
        fetchWhMappings()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create warehouse mapping",
        variant: "destructive",
      })
    }
  }

  const handleDeleteMapping = async () => {
    if (!mappingToDelete) return

    try {
      const response = await apiClient.deleteWhMapping(mappingToDelete.id)
      if (response.success) {
        toast({
          title: "Mapping Deleted",
          description: "Warehouse mapping deleted successfully",
        })
        setIsDeleteMappingConfirmOpen(false)
        setMappingToDelete(null)
        fetchWhMappings()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete warehouse mapping",
        variant: "destructive",
      })
    }
  }

  // Fetch stores and shipping partners on component mount
  useEffect(() => {
    fetchStores()
    fetchShippingPartners()
    fetchWhMappings()
    fetchVendors()
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="CLAIMIO Logo" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className={`font-semibold text-gray-900 truncate ${isMobile ? 'text-sm' : 'text-lg sm:text-xl'}`}>
                  {isMobile ? 'CLAIMIO Admin' : 'CLAIMIO Super Admin Panel'}
                </h1>
                {!isMobile && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate">Welcome back, {user?.name}</p>
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
            <div className="border-t bg-white py-3">
              <div className="space-y-2">
                <div className="px-2">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Welcome, {user?.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 truncate break-all">{user?.email}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 text-sm"
                >
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-4 md:py-8">
        {/* Stats Cards */}
        <div className={`grid gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8 ${isMobile ? 'grid-cols-1' :
          isTablet ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
          <Card>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 truncate">Total Users</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 truncate">Active Users</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">
                    {users.filter((u) => u.status === "active").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 truncate">Vendors</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">{users.filter((u) => u.role === "vendor").length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">System Management</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Manage users, API keys, and system settings</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6">
            <Tabs defaultValue="users" className="w-full">
              <TabsList className={`grid w-full grid-cols-4 ${isMobile ? 'h-auto' : ''}`}>
                <TabsTrigger value="users" className={`${isMobile ? 'text-[10px] sm:text-xs px-2 py-2.5 sm:py-3' : ''}`}>
                  {isMobile ? 'Users' : 'User Management'}
                </TabsTrigger>
                <TabsTrigger value="stores" className={`${isMobile ? 'text-[10px] sm:text-xs px-2 py-2.5 sm:py-3' : ''}`}>
                  {isMobile ? 'Stores' : 'Store Management'}
                </TabsTrigger>
                <TabsTrigger value="warehouse-mapping" className={`${isMobile ? 'text-[10px] sm:text-xs px-2 py-2.5 sm:py-3' : ''}`}>
                  {isMobile ? 'WH Map' : 'Warehouse Mapping'}
                </TabsTrigger>
                <TabsTrigger value="bulk-import" className={`${isMobile ? 'text-[10px] sm:text-xs px-2 py-2.5 sm:py-3' : ''}`}>
                  {isMobile ? 'Import' : 'Bulk Import'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-3 sm:space-y-4 md:space-y-6">
                <div className={`flex ${isMobile ? 'flex-col space-y-2 sm:space-y-3' : 'justify-between items-center'}`}>
                  <h3 className={`font-medium ${isMobile ? 'text-sm sm:text-base' : 'text-lg'}`}>User Management</h3>
                  <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                      <Button className={`${isMobile ? 'w-full text-sm' : ''}`} size={isMobile ? 'default' : 'default'}>
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        {isMobile ? 'Add User' : 'Add User'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6' : 'max-w-md'}`}>
                      <DialogHeader>
                        <DialogTitle className={`${isMobile ? 'text-sm sm:text-lg' : 'text-xl'}`}>Add New User</DialogTitle>
                        <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
                          Create a new user account for the vendor portal
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 sm:space-y-4">
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
                      <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
                        <Button variant="outline" onClick={() => setIsAddUserOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddUser} className={`${isMobile ? 'w-full text-sm' : ''}`}>Add User</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Mobile Card Layout */}
                {isMobile ? (
                  <div className="space-y-3 sm:space-y-4">
                    {users.map((user) => (
                      <Card key={user.id} className="p-2.5 sm:p-4">
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm sm:text-base font-medium text-gray-900 truncate">{user.name}</h4>
                              <p className="text-xs sm:text-sm text-gray-600 truncate break-all">{user.email}</p>
                            </div>
                            <div className="flex space-x-1 flex-shrink-0">
                              <Button size="sm" variant="outline" onClick={() => handleEditUser(user)} className="h-8 w-8 p-0">
                                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteClick(user)} className="h-8 w-8 p-0">
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {getRoleBadge(user.role)}
                            {getStatusBadge(user.status)}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate">
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

              <TabsContent value="stores" className="space-y-3 sm:space-y-4 md:space-y-6">
                <div className={`flex ${isMobile ? 'flex-col space-y-2 sm:space-y-3' : 'justify-between items-center'}`}>
                  <h3 className={`font-medium ${isMobile ? 'text-sm sm:text-base' : 'text-lg'}`}>Store Management</h3>
                  <Dialog open={isAddStoreOpen} onOpenChange={(open) => {
                    setIsAddStoreOpen(open)
                    if (!open) {
                      // Clear test results when dialog closes
                      setShipwayTestResult(null)
                      setShopifyTestResult(null)
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button className={`${isMobile ? 'w-full text-sm' : ''}`} size={isMobile ? 'default' : 'default'}>
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        {isMobile ? 'Add Store' : 'Add Store'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6' : 'max-w-2xl'}`}>
                      <DialogHeader>
                        <DialogTitle className={`${isMobile ? 'text-sm sm:text-lg' : 'text-xl'}`}>Add New Store</DialogTitle>
                        <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
                          Create a new store with shipping partner and Shopify credentials
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 sm:space-y-4">
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
                                  id="shipway-password"
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
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
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
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
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
                      <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
                        <Button variant="outline" onClick={() => setIsAddStoreOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddStore}
                          disabled={isAddingStore}
                          className={`${isMobile ? 'w-full text-sm' : ''}`}
                        >
                          {isAddingStore ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading stores...</p>
                  </div>
                ) : stores.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-500">No stores found. Add your first store to get started.</p>
                    </CardContent>
                  </Card>
                ) : isMobile ? (
                  <div className="space-y-3 sm:space-y-4">
                    {stores.map((store) => (
                      <Card key={store.id} className="p-2.5 sm:p-4">
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm sm:text-base font-medium text-gray-900 truncate">{store.store_name}</h4>
                              <p className="text-xs sm:text-sm text-gray-600 truncate">Code: {store.account_code}</p>
                            </div>
                            <div className="flex space-x-1 flex-shrink-0">
                              <Button size="sm" variant="outline" onClick={() => handleEditStore(store)} className="h-8 w-8 p-0">
                                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteStoreClick(store)} className="h-8 w-8 p-0">
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {getStatusBadge(store.status)}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 space-y-1">
                            <p>Shipway: {store.username}</p>
                            <p>Shopify: {store.shopify_store_url || 'N/A'}</p>
                            {store.last_synced_at && <p>Last synced: {new Date(store.last_synced_at).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
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
                          {stores.map((store) => (
                            <TableRow key={store.id}>
                              <TableCell className="font-medium">{store.store_name}</TableCell>
                              <TableCell className="font-mono text-xs">{store.account_code}</TableCell>
                              <TableCell>{store.username}</TableCell>
                              <TableCell className={`${isTablet ? 'max-w-[150px] truncate' : ''}`}>
                                {store.shopify_store_url || 'N/A'}
                              </TableCell>
                              <TableCell>{getStatusBadge(store.status)}</TableCell>
                              <TableCell className={`${isTablet ? 'text-sm' : ''}`}>
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

              <TabsContent value="warehouse-mapping" className="space-y-3 sm:space-y-4 md:space-y-6">
                <div className={`flex ${isMobile ? 'flex-col space-y-2 sm:space-y-3' : 'justify-between items-center'}`}>
                  <h3 className={`font-medium ${isMobile ? 'text-sm sm:text-base' : 'text-lg'}`}>Warehouse Mapping</h3>
                  <Dialog open={isAddMappingOpen} onOpenChange={(open) => {
                    setIsAddMappingOpen(open)
                    if (!open) {
                      setNewMapping({ claimio_wh_id: "", account_code: "", vendor_wh_id: "" })
                      setSelectedVendor(null)
                      setSelectedStore(null)
                      setWarehouseInfo(null)
                      setWarehouseVerified(false)
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button className={`${isMobile ? 'w-full text-sm' : ''}`} size={isMobile ? 'default' : 'default'}>
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        {isMobile ? 'Add Mapping' : 'Add Mapping'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6' : 'max-w-2xl'}`}>
                      <DialogHeader>
                        <DialogTitle className={`${isMobile ? 'text-sm sm:text-lg' : 'text-xl'}`}>Add Warehouse Mapping</DialogTitle>
                        <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
                          Map claimio warehouse ID to vendor warehouse ID for a specific store
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <Label htmlFor="claimio-wh-id">Claimio WH ID *</Label>
                          <Select
                            value={newMapping.claimio_wh_id}
                            onValueChange={(value) => {
                              setNewMapping({ ...newMapping, claimio_wh_id: value })
                              const vendor = vendors.find(v => v.warehouse_id === value)
                              setSelectedVendor(vendor || null)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor warehouse ID" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendors.map((vendor) => (
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
                      </div>
                      <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
                        <Button variant="outline" onClick={() => setIsAddMappingOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateMapping}
                          disabled={!warehouseVerified}
                          className={`${isMobile ? 'w-full text-sm' : ''}`}
                        >
                          Save Mapping
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {whMappingsLoading ? (
                  <div className="text-center py-8">Loading mappings...</div>
                ) : whMappings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No warehouse mappings found</div>
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
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {whMappings.map((mapping) => (
                            <TableRow key={mapping.id} className={mapping.is_active === false ? 'opacity-50' : ''}>
                              <TableCell>{mapping.claimio_wh_id}</TableCell>
                              <TableCell>{mapping.vendor_name || 'N/A'}</TableCell>
                              <TableCell>{mapping.account_code}</TableCell>
                              <TableCell>{mapping.store_name || 'N/A'}</TableCell>
                              <TableCell>{mapping.vendor_wh_id}</TableCell>
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

              <TabsContent value="bulk-import" className="space-y-3 sm:space-y-4 md:space-y-6">
                <div>
                  <h3 className={`font-medium mb-3 sm:mb-4 ${isMobile ? 'text-sm sm:text-base' : 'text-lg'}`}>Bulk Import Users</h3>
                  <Card>
                    <CardHeader className="p-3 sm:p-6">
                      <CardTitle className="text-sm sm:text-base md:text-lg">CSV Import</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Import multiple users at once using CSV format. Expected format: Name, Email, Role
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                      <div>
                        <Label htmlFor="csv-data" className="text-xs sm:text-sm">CSV Data</Label>
                        <Textarea
                          id="csv-data"
                          placeholder="Name,Email,Role&#10;John Doe,john@example.com,vendor&#10;Jane Smith,jane@example.com,admin"
                          value={csvData}
                          onChange={(e) => setCsvData(e.target.value)}
                          rows={isMobile ? 6 : 8}
                          className="font-mono text-xs sm:text-sm mt-1"
                        />
                      </div>
                      <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row space-x-2'}`}>
                        <Button onClick={handleCsvUpload} className={`${isMobile ? 'w-full text-sm' : ''}`}>
                          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Import Users
                        </Button>
                        <Button variant="outline" className={`${isMobile ? 'w-full text-sm' : ''}`}>
                          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Upload CSV File
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card>
                    <CardHeader className="p-3 sm:p-6">
                      <CardTitle className="text-sm sm:text-base md:text-lg">Import Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                      <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                        <p>
                          <strong>CSV Format:</strong> Name, Email, Role
                        </p>
                        <p>
                          <strong>Supported Roles:</strong> vendor, admin, superadmin
                        </p>
                        <p>
                          <strong>Example:</strong>
                        </p>
                        <pre className="bg-gray-100 p-2 rounded text-[10px] sm:text-xs overflow-x-auto">
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
        <DialogContent className={`${isMobile ? 'max-w-[95vw] p-3 sm:p-6' : ''}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-sm sm:text-base' : ''}`}>Edit User</DialogTitle>
            <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>Update user account information</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-3 sm:space-y-4">
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
          <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} className={`${isMobile ? 'w-full text-sm' : ''}`}>Update User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] p-3 sm:p-6' : ''}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-sm sm:text-base' : ''}`}>Confirm Delete</DialogTitle>
            <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
              Are you sure you want to delete {userToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog open={isEditStoreOpen} onOpenChange={(open) => {
        setIsEditStoreOpen(open)
        if (!open) {
          // Clear test results when dialog closes
          setShipwayTestResult(null)
          setShopifyTestResult(null)
        }
      }}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6' : 'max-w-2xl'}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-sm sm:text-lg' : 'text-xl'}`}>Edit Store</DialogTitle>
            <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
              Update store information and credentials
            </DialogDescription>
          </DialogHeader>
          {editingStore && (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="edit-store-name">Store Name *</Label>
                <Input
                  id="edit-store-name"
                  value={editingStore.store_name}
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
                    value={editingStore.username}
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
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 mr-2" />
                      Test Shipway Connection
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

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Shopify Credentials</Label>
                <div>
                  <Label htmlFor="edit-shopify-url">Shopify Store URL *</Label>
                  <Input
                    id="edit-shopify-url"
                    value={editingStore.shopify_store_url}
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
                      value={editingStore.shopify_token}
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
                  onClick={() => handleTestShopify(editingStore.shopify_store_url, editingStore.shopify_token)}
                  disabled={testingConnection.loading && testingConnection.type === 'shopify'}
                >
                  {testingConnection.loading && testingConnection.type === 'shopify' ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
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
                <Label htmlFor="edit-status">Status *</Label>
                <Select
                  value={editingStore.status}
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
          <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
            <Button variant="outline" onClick={() => setIsEditStoreOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStore} className={`${isMobile ? 'w-full text-sm' : ''}`}>Update Store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Store Confirmation Dialog */}
      <Dialog open={isDeleteStoreConfirmOpen} onOpenChange={setIsDeleteStoreConfirmOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] p-3 sm:p-6' : ''}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-sm sm:text-base' : ''}`}>Confirm Delete</DialogTitle>
            <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
              Are you sure you want to delete {storeToDelete?.store_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
            <Button variant="outline" onClick={() => setIsDeleteStoreConfirmOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteStore} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Delete Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Warehouse Mapping Confirmation Dialog */}
      <Dialog open={isDeleteMappingConfirmOpen} onOpenChange={setIsDeleteMappingConfirmOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] p-3 sm:p-6' : ''}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-sm sm:text-base' : ''}`}>Confirm Delete</DialogTitle>
            <DialogDescription className={`${isMobile ? 'text-xs sm:text-sm' : ''}`}>
              Are you sure you want to delete this warehouse mapping? This action will deactivate the mapping and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={`${isMobile ? 'flex-col space-y-2' : ''}`}>
            <Button variant="outline" onClick={() => setIsDeleteMappingConfirmOpen(false)} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMapping} className={`${isMobile ? 'w-full text-sm' : ''}`}>
              Delete Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

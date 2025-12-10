"use client"

import type React from "react"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Users,
  Package,
  DollarSign,
  LogOut,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  UserPlus,
  Trash2,
  Edit,
  IndianRupee,
  Shield,
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Menu,
  X,
  Store,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { useEffect, useMemo, useRef } from "react"
import { useDeviceType } from "@/hooks/use-mobile"
import { InventoryAggregation } from "@/components/admin/inventory/inventory-aggregation"
import { NotificationDialog } from "./notification-dialog"

// Mock data for admin dashboard
const mockVendors = [
  {
    id: "V001",
    name: "TechStore",
    email: "contact@techstore.com",
    phone: "+1234567890",
    status: "active",
    totalOrders: 156,
    completedOrders: 142,
    revenue: "$12,450",
    joinedDate: "2023-06-15",
  },
  {
    id: "V002",
    name: "GadgetHub",
    email: "info@gadgethub.com",
    phone: "+1234567891",
    status: "active",
    totalOrders: 89,
    completedOrders: 78,
    revenue: "$8,920",
    joinedDate: "2023-08-22",
  },
  {
    id: "V003",
    name: "ElectroMart",
    email: "support@electromart.com",
    phone: "+1234567892",
    status: "pending",
    totalOrders: 23,
    completedOrders: 18,
    revenue: "$2,340",
    joinedDate: "2024-01-10",
  },
]

const mockCarriers = [
  {
    id: "C001",
    name: "Express Delivery",
    status: "active",
    priority: 1,
    weight: "0.5kg",
  },
  {
    id: "C002",
    name: "FastTrack Logistics",
    status: "active",
    priority: 3,
    weight: "1kg",
  },
  {
    id: "C003",
    name: "QuickShip Express",
    status: "pending",
    priority: 2,
    weight: "0.5kg",
  },
  {
    id: "C004",
    name: "SpeedPost Express",
    status: "active",
    priority: 4,
    weight: "1kg",
  },
  {
    id: "C005",
    name: "Reliable Couriers",
    status: "inactive",
    priority: 5,
    weight: "0.5kg",
  },
]

const mockSettlements = [
  {
    id: "S001",
    vendor: "TechStore",
    amount: "$1,250",
    requestDate: "2024-01-10",
    status: "pending",
    upiId: "techstore@paytm",
    orders: ["ORD-001", "ORD-003", "ORD-005"],
  },
  {
    id: "S002",
    vendor: "GadgetHub",
    amount: "$890",
    requestDate: "2024-01-08",
    status: "completed",
    upiId: "gadgethub@gpay",
    orders: ["ORD-002", "ORD-004"],
    completedDate: "2024-01-09",
    transactionId: "TXN123456789",
  },
  {
    id: "S003",
    vendor: "ElectroMart",
    amount: "$450",
    requestDate: "2024-01-12",
    status: "rejected",
    upiId: "electromart@phonepe",
    orders: ["ORD-006"],
    rejectionReason: "Incomplete documentation",
  },
]

export function AdminDashboard() {
  const { user, logout, authHeader } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("orders")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [selectedVendorFilters, setSelectedVendorFilters] = useState<string[]>([])
  const [selectedStoreFilters, setSelectedStoreFilters] = useState<string[]>([])
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([])
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showCarrierModal, setShowCarrierModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null)
  const [settlementAction, setSettlementAction] = useState<"approve" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [newVendor, setNewVendor] = useState({
    name: "",
    email: "",
    phone: "",
    warehouseId: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
  })
  // Admin vendor warehouse verification state
  const [vendorWarehouseVerifyLoading, setVendorWarehouseVerifyLoading] = useState(false)
  const [vendorWarehouseVerifyError, setVendorWarehouseVerifyError] = useState("")
  const [vendorWarehouseInfo, setVendorWarehouseInfo] = useState<null | { address: string, city: string, pincode: string, state: string, country: string }>(null)
  const [vendorWarehouseVerified, setVendorWarehouseVerified] = useState(false)
  // Edit dialog warehouse verification state (separate from add)
  const [editWarehouseVerifyLoading, setEditWarehouseVerifyLoading] = useState(false)
  const [editWarehouseVerifyError, setEditWarehouseVerifyError] = useState("")
  const [editWarehouseInfo, setEditWarehouseInfo] = useState<null | { address: string, city: string, pincode: string, state: string, country: string }>(null)
  const [editWarehouseVerified, setEditWarehouseVerified] = useState(false)
  // Admin vendor view/edit/delete state
  const [vendorDialogVendor, setVendorDialogVendor] = useState<any>(null)
  const [showVendorViewDialog, setShowVendorViewDialog] = useState(false)
  const [showVendorEditDialog, setShowVendorEditDialog] = useState(false)
  const [editVendorForm, setEditVendorForm] = useState({ name: "", email: "", phone: "", status: "active", warehouseId: "", contactNumber: "" })
  const [newCarrier, setNewCarrier] = useState({
    name: "",
    priority: 1,
  })
  const [transactionProof, setTransactionProof] = useState<File | null>(null)

  // Orders state
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersStats, setOrdersStats] = useState({
    totalOrders: 0,
    claimedOrders: 0,
    unclaimedOrders: 0
  })
  // Grouped view (mobile) state
  const buildGroupedOrders = (list: any[]) => {
    const groups: Record<string, any> = {}
    list.forEach(o => {
      const key = String(o.order_id)
      if (!groups[key]) {
        groups[key] = {
          order_id: o.order_id,
          created_at: o.created_at,
          status: o.status,
          vendor_name: o.vendor_name,
          total_value: 0,
          products: [] as any[]
        }
      }
      groups[key].products.push({ ...o, key: String(o.unique_id || `${o.order_id}-${o.product_code || Math.random()}`) })
      const val = parseFloat(o.value || 0)
      groups[key].total_value += isNaN(val) ? 0 : val
      if (o.vendor_name) groups[key].vendor_name = o.vendor_name
      if (o.status) groups[key].status = o.status
      if (o.created_at) groups[key].created_at = o.created_at
    })
    return Object.values(groups)
  }

  // Settlement management state
  const [allSettlements, setAllSettlements] = useState<any[]>([])
  const [settlementsLoading, setSettlementsLoading] = useState(false)
  const [currentSettlement, setCurrentSettlement] = useState<any>(null)
  const [showSettlementDialog, setShowSettlementDialog] = useState(false)
  const [settlementModalAction, setSettlementModalAction] = useState<"view" | "approve" | "reject" | null>(null)
  const [approvalData, setApprovalData] = useState({ amountPaid: "", transactionId: "", paymentProof: null as File | null })
  const [settlementRejectionReason, setSettlementRejectionReason] = useState("")
  const [settlementFilters, setSettlementFilters] = useState({ status: "all", vendorName: "", startDate: "", endDate: "" })
  const [settlementPage, setSettlementPage] = useState(1)
  const [settlementPagination, setSettlementPagination] = useState({ totalPages: 1, totalItems: 0 })
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)

  // Notification management state
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationStats, setNotificationStats] = useState<any>(null)
  const [selectedNotification, setSelectedNotification] = useState<any>(null)
  const [showNotificationDialog, setShowNotificationDialog] = useState(false)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [notificationFilters, setNotificationFilters] = useState({ 
    status: "all", 
    type: "all", 
    severity: "all",
    search: "",
    vendor: "all",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined
  })
  const [notificationPage, setNotificationPage] = useState(1)
  const [notificationPagination, setNotificationPagination] = useState({ totalPages: 1, totalItems: 0 })
  const [showNotificationInfo, setShowNotificationInfo] = useState(false)
  const [notificationFilterOptions, setNotificationFilterOptions] = useState<{
    vendors: string[],
    types: string[],
    severities: string[],
    statuses: string[]
  }>({
    vendors: [],
    types: [],
    severities: [],
    statuses: []
  })
  const [showProofDialog, setShowProofDialog] = useState(false)

  // Image modal state
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [selectedImageProduct, setSelectedImageProduct] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)

  // Vendor assignment state
  const [vendors, setVendors] = useState<any[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedOrderForAssignment, setSelectedOrderForAssignment] = useState<any>(null)
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  // Bulk assign state
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [selectedBulkVendorId, setSelectedBulkVendorId] = useState<string>("")
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false)
  
  // Individual assign/unassign loading states (similar to vendor claim/unclaim)
  const [assignLoading, setAssignLoading] = useState<{[key: string]: boolean}>({})
  const [unassignLoading, setUnassignLoading] = useState<{[key: string]: boolean}>({})

  // Derived selection state for bulk actions
  const selectedOrderObjects = orders.filter((o) => selectedOrders.includes(o.unique_id))
  const assignedSelectedOrders = selectedOrderObjects.filter((o) => (o.status || '').toString().toLowerCase() !== 'unclaimed')
  const unclaimedSelectedOrders = selectedOrderObjects.filter((o) => (o.status || '').toString().toLowerCase() === 'unclaimed')
  const isAllUnclaimedSelected = selectedOrderObjects.length > 0 && assignedSelectedOrders.length === 0
  const isAllAssignedSelected = selectedOrderObjects.length > 0 && unclaimedSelectedOrders.length === 0
  const isMixedSelected = assignedSelectedOrders.length > 0 && unclaimedSelectedOrders.length > 0

  // Carrier state
  const [carriers, setCarriers] = useState<any[]>([])
  const [carriersLoading, setCarriersLoading] = useState(false)
  const [movingCarrier, setMovingCarrier] = useState<string | null>(null)
  // Carrier edit dialog state
  const [carrierEditState, setCarrierEditState] = useState<{ open: boolean; carrierId: string | null; carrier_id: string; status: string }>({ open: false, carrierId: null, carrier_id: "", status: "active" })
  // Store filter state
  const [stores, setStores] = useState<any[]>([])
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("")

  const { isMobile, isTablet } = useDeviceType()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const getStatusBadge = (status: string) => {
    const colors = {
      unclaimed: "bg-gray-100 text-gray-800",
      in_pack: "bg-blue-100 text-blue-800",
      handover: "bg-yellow-100 text-yellow-800",
      picked: "bg-purple-100 text-purple-800",
      in_transit: "bg-orange-100 text-orange-800",
      "in transit": "bg-orange-100 text-orange-800",
      out_for_delivery: "bg-orange-100 text-orange-800",
      delivered: "bg-green-100 text-green-800",
      rto: "bg-red-100 text-red-800",
      // Additional shipping status values
      "shipment booked": "bg-cyan-100 text-cyan-800",
      "picked up": "bg-purple-100 text-purple-800",
      "in warehouse": "bg-blue-100 text-blue-800",
      "dispatched": "bg-indigo-100 text-indigo-800",
      "out for pickup": "bg-yellow-100 text-yellow-800",
      "attempted delivery": "bg-orange-100 text-orange-800",
      "returned": "bg-red-100 text-red-800",
      "cancelled": "bg-gray-100 text-gray-800",
      "failed delivery": "bg-red-100 text-red-800",
      "pickup failed": "bg-red-100 text-red-800",
      "pickup_failed": "bg-red-100 text-red-800",
      "rto delivered": "bg-red-100 text-red-800",
      "rto_delivered": "bg-red-100 text-red-800",
      // Legacy status values for backward compatibility
      claimed: "bg-blue-100 text-blue-800",
      ready_for_handover: "bg-purple-100 text-purple-800",
      // Vendor management status values
      active: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      inactive: "bg-red-100 text-red-800",
      completed: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }

    const displayNames = {
      unclaimed: "UNCLAIMED",
      in_pack: "IN PACK",
      handover: "HANDOVER",
      picked: "PICKED",
      in_transit: "IN TRANSIT",
      "in transit": "IN TRANSIT",
      out_for_delivery: "OUT FOR DELIVERY",
      delivered: "DELIVERED",
      rto: "RTO",
      // Additional shipping status values
      "shipment booked": "SHIPMENT BOOKED",
      "picked up": "PICKED UP",
      "in warehouse": "IN WAREHOUSE",
      "dispatched": "DISPATCHED",
      "out for pickup": "OUT FOR PICKUP",
      "attempted delivery": "ATTEMPTED DELIVERY",
      "returned": "RETURNED",
      "cancelled": "CANCELLED",
      "failed delivery": "FAILED DELIVERY",
      "pickup failed": "PICKUP FAILED",
      "pickup_failed": "PICKUP FAILED",
      "rto delivered": "RTO DELIVERED",
      "rto_delivered": "RTO DELIVERED",
      // Legacy status values for backward compatibility
      claimed: "CLAIMED",
      ready_for_handover: "READY FOR HANDOVER",
      // Vendor management status values
      active: "ACTIVE",
      pending: "PENDING",
      inactive: "INACTIVE",
      completed: "COMPLETED",
      rejected: "REJECTED",
    }

    // Handle undefined or null status
    if (!status) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 text-xs truncate">UNKNOWN</Badge>
    }

    // Normalize status to lowercase for lookup (handles "ACTIVE", "active", etc.)
    // Also normalize spaces to underscores to handle "in transit" -> "in_transit"
    let normalizedStatus = (status || '').toString().trim().toLowerCase().replace(/\s+/g, '_')
    const statusKey = normalizedStatus as keyof typeof colors

    return (
      <Badge variant="outline" className={`${colors[statusKey] || "bg-gray-100 text-gray-800"} text-xs truncate max-w-full px-1.5 py-0.5`}>
        {displayNames[statusKey] || status.replace("_", " ").toUpperCase()}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    }

    return <Badge className={colors[priority as keyof typeof colors]}>{priority.toUpperCase()}</Badge>
  }

  const getPriorityNumberBadge = (priority: number) => {
    const colors = {
      1: "bg-purple-100 text-purple-800",
      2: "bg-blue-100 text-blue-800", 
      3: "bg-green-100 text-green-800",
      4: "bg-yellow-100 text-yellow-800",
      5: "bg-gray-100 text-gray-800",
    }

    // Handle undefined or null priority
    if (!priority) {
      return <Badge className="bg-gray-100 text-gray-800 text-xs">Priority N/A</Badge>
    }

    return <Badge className={`${colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800"} text-xs`}>Priority {priority}</Badge>
  }

  // Get unique status values from orders data
  const getUniqueStatuses = () => {
    const uniqueStatuses = new Set<string>();
    orders.forEach(order => {
      if (order.status && order.status.trim() !== '') {
        uniqueStatuses.add(order.status);
      }
    });
    return Array.from(uniqueStatuses).sort();
  }

  const getUniqueVendorNames = () => {
    const uniqueVendors = new Set<string>();
    orders.forEach(order => {
      if (order.vendor_name && order.vendor_name.trim() !== '' && order.vendor_name !== 'Unclaimed') {
        uniqueVendors.add(order.vendor_name);
      }
    });
    return Array.from(uniqueVendors).sort();
  }

  const getFilteredOrdersForTab = (tab: string) => {
    const baseOrders = orders

    // Apply search, status, date, vendor, and store filters
    return baseOrders.filter((order) => {
      const matchesSearch =
        order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      
      // Vendor filter - multiple selection
      const matchesVendor = selectedVendorFilters.length === 0 || 
        selectedVendorFilters.includes(order.vendor_name) ||
        (selectedVendorFilters.includes('Unclaimed') && (!order.vendor_name || order.vendor_name === 'Unclaimed'))
      
      // Store filter - multiple selection
      const matchesStore = selectedStoreFilters.length === 0 || 
        selectedStoreFilters.includes(order.account_code)
      
      // Date filtering
      let matchesDate = true;
      if (order.created_at) {
        const orderDate = new Date(order.created_at);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && orderDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && orderDate <= toDate;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate && matchesVendor && matchesStore
    })
  }

  const getFilteredOrdersQuantity = (tab: string) => {
    const filteredOrders = getFilteredOrdersForTab(tab);
    return filteredOrders.reduce((sum: number, order: any) => {
      const qty = parseInt(order.quantity) || 1;
      return sum + qty;
    }, 0);
  }

  const getFilteredVendors = () => {
    return vendors.filter((vendor) => {
      const matchesSearch =
        vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || vendor.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const getFilteredCarriers = () => {
    // If no store is selected, return empty array (don't show any carriers)
    if (!selectedStoreFilter) {
      return [];
    }

    let filtered = carriers.filter((carrier) => {
      const matchesSearch =
        carrier.carrier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        carrier.carrier_id?.toLowerCase().includes(searchTerm.toLowerCase())
      const carrierStatus = (carrier.status || '').toString().trim().toLowerCase()
      const filterStatus = (statusFilter || '').toString().trim().toLowerCase()
      const matchesStatus = filterStatus === "all" || carrierStatus === filterStatus
      
      // Store filter - MUST match selected store (required, no "all" option)
      const matchesStore = carrier.account_code === selectedStoreFilter
      
      return matchesSearch && matchesStatus && matchesStore
    })

    // Sort by priority (1st priority comes first)
    filtered.sort((a, b) => {
      const priorityA = parseInt(a.priority) || 0;
      const priorityB = parseInt(b.priority) || 0;
      return priorityA - priorityB; // Ascending order (1, 2, 3...)
    });

    return filtered;
  }

  const getFilteredSettlements = () => {
    return mockSettlements.filter((settlement) => {
      const matchesSearch =
        settlement.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        settlement.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || settlement.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const handleBulkOrderAction = (action: string) => {
    if (selectedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to perform bulk actions",
        variant: "destructive",
      })
      return
    }

    // Get selected order details for better feedback
    const selectedOrderDetails = orders.filter(order => 
      selectedOrders.includes(order.unique_id)
    ).map(order => order.order_id);

    toast({
      title: "Bulk Action Completed",
      description: `${action} applied to ${selectedOrders.length} orders: ${selectedOrderDetails.slice(0, 3).join(', ')}${selectedOrderDetails.length > 3 ? '...' : ''}`,
    })
    setSelectedOrders([])
  }

  const handleCarrierAction = (carrierId: string, action: string) => {
    toast({
      title: "Carrier Action",
      description: `${action} applied to carrier ${carrierId}`,
    })
  }

  const handleAddVendor = async () => {
    if (!newVendor.name || !newVendor.email || !newVendor.phone || !newVendor.password || !newVendor.confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in all vendor details",
        variant: "destructive",
      })
      return
    }

    if (!vendorWarehouseVerified) {
      toast({
        title: "Verify Warehouse",
        description: "Please verify the warehouse ID before creating vendor",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await apiClient.createUser({
        name: newVendor.name,
        email: newVendor.email,
        phone: newVendor.phone,
        password: newVendor.password,
        role: 'vendor',
        warehouseId: newVendor.warehouseId,
        contactNumber: newVendor.contactNumber,
        status: 'active',
      })
      if (response.success) {
        toast({
          title: "Vendor Added",
          description: `${newVendor.name} has been added successfully`,
        })
        setNewVendor({ name: "", email: "", phone: "", warehouseId: "", contactNumber: "", password: "", confirmPassword: "" })
        setVendorWarehouseVerified(false)
        setVendorWarehouseInfo(null)
        setShowVendorModal(false)
        fetchVendors()
      } else {
        toast({ title: "Error", description: response.message, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || 'Failed to add vendor', variant: 'destructive' })
    }
  }

  const handleVerifyVendorWarehouse = async (warehouseIdOverride?: string) => {
    const id = (warehouseIdOverride ?? newVendor.warehouseId).trim();
    if (!id) return;
    setVendorWarehouseVerifyLoading(true)
    setVendorWarehouseVerifyError("")
    setVendorWarehouseInfo(null)
    setVendorWarehouseVerified(false)
    try {
      const response = await apiClient.verifyWarehouse(id)
      if (response.success && response.data && (response.data.address || (response.data.city && response.data.pincode))) {
        setVendorWarehouseInfo(response.data)
        setVendorWarehouseVerified(true)
      } else {
        setVendorWarehouseVerifyError(response.message || 'Invalid warehouse ID')
        setVendorWarehouseVerified(false)
        setVendorWarehouseInfo(null)
      }
    } catch (error: any) {
      setVendorWarehouseVerifyError(error?.message || 'Verification failed')
    } finally {
      setVendorWarehouseVerifyLoading(false)
    }
  }

  const handleVerifyEditWarehouse = async (warehouseId: string) => {
    const id = (warehouseId || '').trim();
    if (!id) return;
    setEditWarehouseVerifyLoading(true)
    setEditWarehouseVerifyError("")
    setEditWarehouseInfo(null)
    setEditWarehouseVerified(false)
    try {
      const response = await apiClient.verifyWarehouse(id)
      if (response.success && response.data && (response.data.address || (response.data.city && response.data.pincode))) {
        setEditWarehouseInfo(response.data)
        setEditWarehouseVerified(true)
      } else {
        setEditWarehouseVerifyError(response.message || 'Invalid warehouse ID')
        setEditWarehouseVerified(false)
        setEditWarehouseInfo(null)
      }
    } catch (error: any) {
      setEditWarehouseVerifyError(error?.message || 'Verification failed')
    } finally {
      setEditWarehouseVerifyLoading(false)
    }
  }

  const handleAddCarrier = () => {
    if (!newCarrier.name) {
      toast({
        title: "Missing Information",
        description: "Please fill in carrier name",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Carrier Added",
      description: `${newCarrier.name} has been added successfully`,
    })
    setNewCarrier({ name: "", priority: 1 })
    setShowCarrierModal(false)
  }

  const handleProofUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setTransactionProof(file)
    }
  }

  const handleSettlementAction = () => {
    if (settlementAction === "approve" && (!transactionId || !transactionProof)) {
      toast({
        title: "Missing Information",
        description: "Please provide both transaction ID and payment proof",
        variant: "destructive",
      })
      return
    }

    if (settlementAction === "reject" && !rejectionReason) {
      toast({
        title: "Missing Rejection Reason",
        description: "Please provide reason for rejection",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Settlement Updated",
      description: `Settlement ${selectedSettlement?.id} has been ${settlementAction}d with proof uploaded`,
    })
    setShowSettlementModal(false)
    setSelectedSettlement(null)
    setSettlementAction(null)
    setRejectionReason("")
    setTransactionId("")
    setTransactionProof(null)
  }

  // Settlement Management Functions
  const fetchSettlements = async () => {
    setSettlementsLoading(true);
    try {
      const response = await apiClient.getAllSettlements({
        page: settlementPage,
        limit: 10,
        ...settlementFilters
      });
      if (response.success) {
        setAllSettlements(response.data.settlements);
        setSettlementPagination(response.data.pagination);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch settlements",
        variant: "destructive",
      });
    } finally {
      setSettlementsLoading(false);
    }
  };

  // Auto-load settlements when component mounts or settlement filters change
  useEffect(() => {
    fetchSettlements();
  }, [settlementPage, settlementFilters]);

  const handleViewSettlement = async (settlement: any) => {
    setCurrentSettlement(settlement);
    setSettlementModalAction("view");
    setShowSettlementDialog(true);
  };

  const handleApproveSettlement = async (settlement: any) => {
    setCurrentSettlement(settlement);
    setSettlementModalAction("approve");
    setApprovalData({ amountPaid: settlement.amount.toString(), transactionId: "", paymentProof: null });
    setShowSettlementDialog(true);
  };

  const handleRejectSettlement = async (settlement: any) => {
    setCurrentSettlement(settlement);
    setSettlementModalAction("reject");
    setSettlementRejectionReason("");
    setShowSettlementDialog(true);
  };

  const submitSettlementAction = async () => {
    if (!currentSettlement) return;

    try {
      if (settlementModalAction === "approve") {
        if (!approvalData.amountPaid || !approvalData.transactionId) {
          toast({
            title: "Missing Information",
            description: "Please provide amount and transaction ID",
            variant: "destructive",
          });
          return;
        }

        const paidAmount = parseFloat(approvalData.amountPaid);
        if (paidAmount > currentSettlement.amount) {
          toast({
            title: "Invalid Amount",
            description: "Amount cannot exceed the requested amount",
            variant: "destructive",
          });
          return;
        }

        const response = await apiClient.approveSettlement(
          currentSettlement.id,
          parseFloat(approvalData.amountPaid),
          approvalData.transactionId,
          approvalData.paymentProof || undefined
        );

        if (response.success) {
          toast({
            title: "Settlement Approved",
            description: "Settlement has been approved successfully",
          });
          fetchSettlements();
        } else {
          toast({
            title: "Error",
            description: response.message || "Failed to approve settlement",
            variant: "destructive",
          });
        }
      } else if (settlementModalAction === "reject") {
        if (!settlementRejectionReason.trim()) {
          toast({
            title: "Missing Rejection Reason",
            description: "Please provide a reason for rejection",
            variant: "destructive",
          });
          return;
        }

        const response = await apiClient.rejectSettlement(
          currentSettlement.id,
          settlementRejectionReason
        );

        if (response.success) {
          toast({
            title: "Settlement Rejected",
            description: "Settlement has been rejected successfully",
          });
          fetchSettlements();
        } else {
          toast({
            title: "Error",
            description: response.message || "Failed to reject settlement",
            variant: "destructive",
          });
        }
      }

      setShowSettlementDialog(false);
      setCurrentSettlement(null);
      setSettlementModalAction(null);
      setApprovalData({ amountPaid: "", transactionId: "", paymentProof: null });
      setSettlementRejectionReason("");
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while processing the settlement",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await apiClient.exportSettlementsCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlements_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Settlement data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export settlement data",
        variant: "destructive",
      });
    }
  };

  const handleViewProof = async (filename: string) => {
    try {
      const blob = await apiClient.getPaymentProof(filename);
      const url = URL.createObjectURL(blob);
      setSelectedProofUrl(url);
      setShowProofDialog(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payment proof",
        variant: "destructive",
      });
    }
  };

  // Fetch orders for admin panel
  const fetchOrders = async (syncFromShipway = false) => {
    setOrdersLoading(true);
    try {
      // If syncFromShipway is true, sync orders from Shipway first
      if (syncFromShipway) {
        try {
          const syncResponse = await apiClient.refreshAdminOrders();
          if (syncResponse.success) {
            toast({
              title: "Orders Synced",
              description: syncResponse.message || "Orders have been synced from Shipway successfully",
            });
          } else {
            toast({
              title: "Sync Warning",
              description: syncResponse.message || "Orders sync completed with warnings",
              variant: "default",
            });
          }
        } catch (syncError) {
          console.error('Error syncing orders:', syncError);
          toast({
            title: "Sync Error",
            description: syncError instanceof Error ? syncError.message : "Failed to sync orders from Shipway",
            variant: "destructive",
          });
          // Continue to fetch orders even if sync fails
        }
      }

      const response = await apiClient.getAdminOrders();
      
      if (response.success) {
        const ordersData = response.data.orders;
        setOrders(ordersData);
        
        // Calculate stats by summing quantities
        const totalQuantity = ordersData.reduce((sum: number, order: any) => {
          const qty = parseInt(order.quantity) || 1;
          return sum + qty;
        }, 0);
        
        const unclaimedQuantity = ordersData
          .filter((order: any) => (order.status || '').toString().toLowerCase() === 'unclaimed')
          .reduce((sum: number, order: any) => {
            const qty = parseInt(order.quantity) || 1;
            return sum + qty;
          }, 0);
        
        const claimedQuantity = ordersData
          .filter((order: any) => (order.status || '').toString().toLowerCase() !== 'unclaimed')
          .reduce((sum: number, order: any) => {
            const qty = parseInt(order.quantity) || 1;
            return sum + qty;
          }, 0);
        
        setOrdersStats({
          totalOrders: totalQuantity,
          claimedOrders: claimedQuantity,
          unclaimedOrders: unclaimedQuantity
        });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to fetch orders",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Reset status filter to "all" when switching to orders tab
    if (value === 'orders') {
      setStatusFilter('all');
      setDateFrom(undefined);
      setDateTo(undefined);
    }
  };

  const handleMoveCarrier = async (carrierId: string, direction: 'up' | 'down') => {
    if (movingCarrier) {
      return; // Prevent multiple simultaneous moves
    }
    
    if (!selectedStoreFilter) {
      toast({
        title: 'Error',
        description: 'Please select a store first',
        variant: 'destructive'
      });
      return;
    }
    
    setMovingCarrier(carrierId);
    try {
      const res = await apiClient.moveCarrier(carrierId, direction, selectedStoreFilter);
      if (!res.success) {
        throw new Error(res.message);
      }
      await fetchCarriers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to move carrier',
        variant: 'destructive'
      });
    } finally {
      setMovingCarrier(null);
    }
  };

  // Auto-load orders when component mounts (only once on initial load)
  useEffect(() => {
    fetchOrders();
    fetchVendors();
    fetchStores(); // Fetch stores first for carrier filtering
  }, []);

  // Fetch carriers after stores are loaded and a store is selected
  useEffect(() => {
    if (stores.length > 0 && selectedStoreFilter) {
      fetchCarriers();
    }
  }, [stores, selectedStoreFilter]);

  // Note: Removed automatic order refresh on:
  // - Window visibility change (was causing frequent refreshes)
  // - Tab switching (was causing refreshes on every navigation)
  // Orders now only refresh:
  // 1. On initial component mount
  // 2. When user clicks the refresh button
  // 3. When cron job triggers a refresh (via refresh button or manual trigger)

  // Ensure a store is selected when stores are loaded
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreFilter) {
      setSelectedStoreFilter(stores[0].account_code);
    }
  }, [stores]);

  // Fetch vendors for assignment dropdown
  const fetchVendors = async () => {
    setVendorsLoading(true);
    try {
      const response = await apiClient.getAdminVendors();
      if (response.success) {
        setVendors(response.data.vendors);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch vendors",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch vendors",
        variant: "destructive",
      });
    } finally {
      setVendorsLoading(false);
    }
  };

  const fetchCarriers = async () => {
    // Don't fetch if no store is selected
    if (!selectedStoreFilter) {
      setCarriers([]);
      return;
    }

    setCarriersLoading(true);
    try {
      const response = await apiClient.getCarriers(selectedStoreFilter);
      if (response.success) {
        console.log('Carriers data received:', response.data);
        setCarriers(response.data.carriers);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch carriers",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching carriers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch carriers",
        variant: "destructive",
      });
    } finally {
      setCarriersLoading(false);
    }
  };

  // Fetch stores for filtering
  const fetchStores = async () => {
    try {
      const response = await apiClient.getStoresForFilter();
      
      if (response.success && response.data) {
        setStores(response.data);
        // Automatically select the first store
        if (response.data.length > 0) {
          const firstStoreCode = response.data[0].account_code;
          setSelectedStoreFilter(firstStoreCode);
        }
      } else {
        console.error('Failed to fetch stores:', response.message);
      }
    } catch (error: any) {
      console.error('Error fetching stores:', error);
    }
  };

  // Fetch notifications from database with filters
  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      
      // Build query params based on filters
      const params: any = {
        page: notificationPage,
        limit: 20
      };
      
      if (notificationFilters.status !== 'all') {
        params.status = notificationFilters.status;
      }
      if (notificationFilters.type !== 'all') {
        params.type = notificationFilters.type;
      }
      if (notificationFilters.severity !== 'all') {
        params.severity = notificationFilters.severity;
      }
      if (notificationFilters.vendor !== 'all') {
        params.vendor_id = notificationFilters.vendor;
      }
      if (notificationFilters.search) {
        params.search = notificationFilters.search;
      }
      if (notificationFilters.dateFrom) {
        params.start_date = notificationFilters.dateFrom.toISOString();
      }
      if (notificationFilters.dateTo) {
        params.end_date = notificationFilters.dateTo.toISOString();
      }
      
      const response = await apiClient.getNotifications(params);
      
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setNotificationPagination({
          totalPages: response.data.pagination?.pages || 1,
          totalItems: response.data.pagination?.total || 0
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notifications",
        variant: "destructive"
      });
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Fetch notification statistics
  const fetchNotificationStats = async () => {
    try {
      const response = await apiClient.getNotificationStats();
      if (response.success && response.data) {
        setNotificationStats(response.data.overview);
      }
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  };

  // Fetch notification filter options from database
  const fetchNotificationFilterOptions = async () => {
    try {
      const response = await apiClient.getNotifications({ page: 1, limit: 1000 });
      if (response.success && response.data.notifications) {
        const notifications = response.data.notifications;
        
        // Extract unique values for each filter
        const uniqueVendors = [...new Set(notifications
          .map((n: any) => n.vendor_name)
          .filter((v: any) => v)
        )].sort() as string[];
        
        const uniqueTypes = [...new Set(notifications
          .map((n: any) => n.type)
          .filter((t: any) => t)
        )].sort() as string[];
        
        const uniqueSeverities = [...new Set(notifications
          .map((n: any) => n.severity)
          .filter((s: any) => s)
        )].sort() as string[];
        
        const uniqueStatuses = [...new Set(notifications
          .map((n: any) => n.status)
          .filter((s: any) => s)
        )].sort() as string[];
        
        setNotificationFilterOptions({
          vendors: uniqueVendors,
          types: uniqueTypes,
          severities: uniqueSeverities,
          statuses: uniqueStatuses
        });
      }
    } catch (error) {
      console.error('Error fetching notification filter options:', error);
      // Use default values if fetch fails
      setNotificationFilterOptions({
        vendors: ['Mumbai Warehouse', 'Delhi Warehouse', 'Bangalore Warehouse'],
        types: ['reverse_order_failure', 'shipment_assignment_error', 'carrier_unavailable', 'low_balance'],
        severities: ['critical', 'high', 'medium', 'low'],
        statuses: ['pending', 'in_progress', 'resolved', 'dismissed']
      });
    }
  };

  // Handle order assignment to vendor
  const handleAssignOrder = async (order?: any, vendorId?: string) => {
    const orderToAssign = order || selectedOrderForAssignment;
    const vendorToAssign = vendorId || selectedVendorId;
    
    if (!orderToAssign || !vendorToAssign) {
      toast({
        title: "Missing Information",
        description: "Please select a vendor",
        variant: "destructive",
      });
      return;
    }

    // Find vendor name
    const vendor = vendors.find(v => v.warehouseId === vendorToAssign);
    const vendorName = vendor?.name || vendorToAssign;

    // Set loading state for this order
    setAssignLoading(prev => ({ ...prev, [orderToAssign.unique_id]: true }));

    // Optimistically update the order state immediately
    setOrders(prevOrders => prevOrders.map(o => 
      o.unique_id === orderToAssign.unique_id 
        ? { ...o, vendor_name: vendorName, status: 'claimed' }
        : o
    ));

    try {
      const response = await apiClient.assignOrderToVendor(
        orderToAssign.unique_id,
        vendorToAssign
      );

      if (response.success) {
        toast({
          title: "Order Assigned",
          description: response.message,
        });
        
        // Close modal if it was opened from modal
        if (!order) {
          setShowAssignModal(false);
          setSelectedOrderForAssignment(null);
          setSelectedVendorId("");
        }
        
        // Refresh orders list to get latest data from server
        await fetchOrders();
      } else {
        // Revert optimistic update on failure
        setOrders(prevOrders => prevOrders.map(o => 
          o.unique_id === orderToAssign.unique_id 
            ? { ...o, vendor_name: orderToAssign.vendor_name, status: orderToAssign.status }
            : o
        ));
        toast({
          title: "Assignment Failed",
          description: response.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      setOrders(prevOrders => prevOrders.map(o => 
        o.unique_id === orderToAssign.unique_id 
          ? { ...o, vendor_name: orderToAssign.vendor_name, status: orderToAssign.status }
          : o
      ));
      toast({
        title: "Error",
        description: "Failed to assign order",
        variant: "destructive",
      });
    } finally {
      // Clear loading state
      setAssignLoading(prev => ({ ...prev, [orderToAssign.unique_id]: false }));
    }
  };

  // Handle order unassignment
  const handleUnassignOrder = async (order: any) => {
    // Set loading state for this order
    setUnassignLoading(prev => ({ ...prev, [order.unique_id]: true }));

    // Store original values for potential revert
    const originalVendorName = order.vendor_name;
    const originalStatus = order.status;

    // Optimistically update the order state immediately
    setOrders(prevOrders => prevOrders.map(o => 
      o.unique_id === order.unique_id 
        ? { ...o, vendor_name: 'Unclaimed', status: 'unclaimed' }
        : o
    ));

    try {
      const response = await apiClient.unassignOrder(order.unique_id);

      if (response.success) {
        toast({
          title: "Order Unassigned",
          description: response.message,
        });
        // Refresh orders list to get latest data from server
        await fetchOrders();
      } else {
        // Revert optimistic update on failure
        setOrders(prevOrders => prevOrders.map(o => 
          o.unique_id === order.unique_id 
            ? { ...o, vendor_name: originalVendorName, status: originalStatus }
            : o
        ));
        toast({
          title: "Unassignment Failed",
          description: response.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      setOrders(prevOrders => prevOrders.map(o => 
        o.unique_id === order.unique_id 
          ? { ...o, vendor_name: originalVendorName, status: originalStatus }
          : o
      ));
      toast({
        title: "Error",
        description: "Failed to unassign order",
        variant: "destructive",
      });
    } finally {
      // Clear loading state
      setUnassignLoading(prev => ({ ...prev, [order.unique_id]: false }));
    }
  };

  // Open assignment modal
  const openAssignModal = (order: any) => {
    setSelectedOrderForAssignment(order);
    setSelectedVendorId("");
    setShowAssignModal(true);
  };

  // Download carriers CSV
  const handleDownloadCarriers = async () => {
    try {
      await apiClient.downloadCarriersCSV();
      toast({
        title: "Success",
        description: "Carriers data downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading carriers CSV:', error);
      toast({
        title: "Error",
        description: "Failed to download carriers data",
        variant: "destructive",
      });
    }
  };

  // Upload carrier priorities CSV
  const handleUploadCarrierPriorities = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Show validation dialog first
      const formatInfo = await apiClient.getCarrierFormat();
      if (formatInfo.success) {
        const confirmed = window.confirm(
          `CSV Upload Requirements (Multi-Store):\n\n` +
          `• Expected columns: ${formatInfo.data.expectedColumns.join(', ')}, account_code\n` +
          `• CSV must include "account_code" column for each carrier\n` +
          `• CSV can contain carriers from multiple stores\n` +
          `• All existing carrier IDs for each store must be included\n` +
          `• Priority values must be unique within each store\n` +
          `• Same carrier_id can appear multiple times if they belong to different stores\n\n` +
          `Do you want to proceed with the upload?`
        );
        
        if (!confirmed) {
          event.target.value = '';
          return;
        }
      }

      const response = await apiClient.uploadCarrierPriorities(file);
      
      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        
        // Refresh carriers data to show updated priorities
        await fetchCarriers();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to upload carrier priorities",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error uploading carrier priorities:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload carrier priorities",
        variant: "destructive",
      });
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };

  // Load notifications data when notifications tab is active
  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotificationFilterOptions();
      fetchNotifications();
      fetchNotificationStats();
    }
  }, [activeTab]);

  // Reload notifications when filters or page change
  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotifications();
    }
  }, [notificationPage, notificationFilters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="CLAIMIO Logo" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className={`font-bold text-gray-900 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>CLAIMIO - Admin</h1>
                {!isMobile && <p className="text-sm sm:text-base text-gray-600 truncate">Welcome back, {user?.name}</p>}
              </div>
            </div>

            {/* Desktop: Show notification bell, user info and logout */}
            {!isMobile && (
              <div className="flex items-center space-x-2">
                {/* Notification Bell */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowNotificationPanel(true)}
                  className="p-2 relative"
                >
                  <Bell className="w-5 h-5" />
                  {notificationStats && notificationStats.pending > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                      {notificationStats.pending > 99 ? '99+' : notificationStats.pending}
                    </span>
                  )}
                </Button>
                
                <div className="text-right">
                  <p className="text-sm sm:text-base font-medium text-gray-900 truncate max-w-[120px]">{user?.name}</p>
                  <p className="text-sm text-gray-500 break-all max-w-[200px]">{user?.email}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={logout}
                  className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            )}

            {/* Mobile: Notification Bell, Inventory Icon and Menu Button */}
            {isMobile && (
              <div className="flex items-center space-x-2">
                {/* Notification Bell */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowNotificationPanel(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="p-2 relative"
                >
                  <Bell className="w-5 h-5" />
                  {notificationStats && notificationStats.pending > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                      {notificationStats.pending > 99 ? '99+' : notificationStats.pending}
                    </span>
                  )}
                </Button>

                {/* Inventory Icon */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setActiveTab('inventory');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-2 ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-600' : ''}`}
                  title="Inventory"
                >
                  <Package className="w-5 h-5" />
                </Button>
                
                {/* Menu Button */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu */}
          {isMobile && isMobileMenuOpen && (
            <div className="border-t bg-white py-3">
              <div className="space-y-2">
                <div className="px-2">
                  <p className="text-sm sm:text-base text-gray-600 truncate">Welcome, {user?.name}</p>
                  <p className="text-xs sm:text-sm text-gray-400 truncate break-all">{user?.email}</p>
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
        {/* Stats Cards - compact, colorful, 2x2 on mobile */}
        <div className={`grid gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8 ${
          isMobile ? 'grid-cols-2' : 
          isTablet ? 'grid-cols-2' : 
          'grid-cols-4'
        }`}>
          <Card 
            className={`bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg ${isMobile ? 'cursor-pointer hover:shadow-xl transition-all duration-200 active:scale-95' : ''}`}
            onClick={() => {
              if (isMobile) {
                setActiveTab('orders');
                setStatusFilter('all');
              }
            }}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-blue-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Total Orders</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>{ordersStats.totalOrders}</p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Package className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>


          <Card 
            className={`bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg ${isMobile ? 'cursor-pointer hover:shadow-xl transition-all duration-200 active:scale-95' : ''}`}
            onClick={() => {
              if (isMobile) {
                setActiveTab('orders');
                setStatusFilter('claimed');
              }
            }}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-green-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Claimed</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {ordersStats.claimedOrders}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Package className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg ${isMobile ? 'cursor-pointer hover:shadow-xl transition-all duration-200 active:scale-95' : ''}`}
            onClick={() => {
              if (isMobile) {
                setActiveTab('orders');
                setStatusFilter('unclaimed');
              }
            }}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-orange-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Unclaimed</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {ordersStats.unclaimedOrders}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Clock className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>


          <Card 
            className={`bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg ${isMobile ? 'cursor-pointer hover:shadow-xl transition-all duration-200 active:scale-95' : ''}`}
            onClick={() => {
              if (isMobile) {
                setActiveTab('vendors');
                setStatusFilter('active');
              }
            }}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-purple-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Vendors</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {vendors.filter((v) => (v.status || '').toString().trim().toLowerCase() === 'active').length}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Users className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className={`${isMobile ? 'text-lg sm:text-xl' : 'text-2xl'} ${isMobile ? 'leading-tight' : ''}`}>
                  {isMobile ? (
                    <>
                      Admin<br />
                      Management
                    </>
                  ) : (
                    'Admin Management'
                  )}
                </CardTitle>
                {!isMobile && <CardDescription className="text-sm sm:text-base truncate">Manage orders, vendors, and carriers</CardDescription>}
              </div>
              <Button
                onClick={() => fetchOrders(true)}
                disabled={ordersLoading}
                variant="outline"
                className={`${isMobile ? 'h-8 sm:h-10 text-sm sm:text-base px-2 sm:px-4' : 'h-10'} bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:from-blue-600 hover:to-blue-700 flex-shrink-0`}
                size="default"
              >
                {ordersLoading ? (
                  <>
                    <div className={`animate-spin rounded-full border-b-2 border-white ${isMobile ? 'h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2' : 'h-4 w-4 mr-2'}`}></div>
                    {isMobile ? 'Loading' : 'Refreshing...'}
                  </>
                ) : (
                  <>
                    <RefreshCw className={`${isMobile ? 'w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2' : 'w-4 h-4 mr-2'}`} />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              {/* Fixed Controls Section */}
              <div className={`sticky ${isMobile ? 'top-16' : 'top-20'} bg-white z-40 pb-3 sm:pb-4 border-b mb-3 sm:mb-4`}>
                <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3' : 'grid-cols-4'} ${isMobile ? 'h-auto mb-3 sm:mb-4' : 'mb-6'}`}>
                  <TabsTrigger value="orders" className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''}`}>
                    Orders ({getFilteredOrdersQuantity("orders")})
                  </TabsTrigger>
                  <TabsTrigger value="vendors" className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''}`}>
                    Vendors ({vendors.length})
                  </TabsTrigger>
                  <TabsTrigger value="carrier" className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''}`}>
                    Carrier ({getFilteredCarriers().length})
                  </TabsTrigger>
                  {!isMobile && (
                    <TabsTrigger value="inventory" className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''}`}>
                      Inventory
                    </TabsTrigger>
                  )}
                  {/* Settlement Management Tab - Hidden for now */}
                  {/* <TabsTrigger value="settlement-management" className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''}`}>
                    Settlement Management
                  </TabsTrigger> */}
                </TabsList>

                {/* Filters - Only show for orders, vendors, and carriers tabs */}
                {(activeTab === "orders" || activeTab === "vendors" || activeTab === "carrier") && (
                  <div className={`flex flex-col gap-3 ${isMobile && (activeTab === "orders" || activeTab === "vendors" || activeTab === "carrier") ? 'mb-2' : 'mb-4 md:mb-6'} ${!isMobile && 'sm:flex-row sm:items-center'}`}>
                    {/* Mobile Carrier Tab - All filters in one row */}
                    {activeTab === "carrier" && isMobile ? (
                      <div className="flex gap-1.5 items-center">
                        {/* Search Input */}
                        <div className="flex-1 min-w-0">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                              placeholder="Search carrier..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-10"
                              id="admin-search-input"
                            />
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                type="button"
                                title="Clear"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Combined Filter - Status and Store filters in one popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-9 h-9 p-0 justify-center flex-shrink-0">
                              <Filter className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4" align="start">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">Filters</h4>
                                {(statusFilter !== "all" || selectedStoreFilter) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => {
                                      setStatusFilter("all");
                                      if (stores.length > 0) {
                                        setSelectedStoreFilter(stores[0].account_code);
                                      }
                                    }}
                                  >
                                    Clear All
                                  </Button>
                                )}
                              </div>

                              {/* Status Filter */}
                              <div>
                                <Label className="text-xs font-medium mb-2 block">Status</Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                  <SelectTrigger className="w-full h-9">
                                    <SelectValue placeholder="All Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Store Filter - Single Select */}
                              <div>
                                <Label className="text-xs font-medium mb-2 block">Store</Label>
                                <Select 
                                  value={selectedStoreFilter || ''} 
                                  onValueChange={setSelectedStoreFilter}
                                  disabled={stores.length === 0}
                                >
                                  <SelectTrigger className="w-full h-9">
                                    <SelectValue placeholder="Select Store" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stores.map((store) => (
                                      <SelectItem key={store.account_code} value={store.account_code}>
                                        {store.store_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : activeTab === "vendors" && isMobile ? (
                      <div className="flex gap-1.5 items-center">
                        {/* Search Input */}
                        <div className="flex-1 min-w-0">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                              placeholder="Search vendors..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-10"
                              id="admin-search-input"
                            />
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                type="button"
                                title="Clear"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Status Filter - Icon only */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-9 h-9 p-0 justify-center flex-shrink-0">
                              <Filter className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-4" align="start">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">Status</h4>
                                {statusFilter !== "all" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => {
                                      setStatusFilter("all");
                                    }}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>
                              <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full h-9">
                                  <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Status</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : (
                      <>
                        {/* Search Input Row - Desktop and other tabs */}
                        <div className={`flex-1 ${activeTab === "orders" && isMobile ? 'flex items-center gap-1.5' : ''}`}>
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                              placeholder={`Search ${activeTab}...`}
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className={`pl-10 ${searchTerm && isMobile ? 'pr-20' : 'pr-10'}`}
                              id="admin-search-input"
                            />
                            {searchTerm && isMobile && (
                              <button
                                onClick={() => {
                                  document.getElementById('admin-search-input')?.blur();
                                }}
                                className="absolute right-11 top-1/2 transform -translate-y-1/2 text-green-500 hover:text-green-700 transition-colors"
                                type="button"
                                title="Done"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                type="button"
                                title="Clear"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          {/* Combined Filter - Only for orders tab on mobile */}
                          {activeTab === "orders" && isMobile && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-9 h-9 p-0 justify-center flex-shrink-0">
                                <Filter className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm">Filters</h4>
                                  {(statusFilter !== "all" || selectedVendorFilters.length > 0 || selectedStoreFilters.length > 0 || dateFrom || dateTo) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => {
                                        setStatusFilter("all");
                                        setSelectedVendorFilters([]);
                                        setSelectedStoreFilters([]);
                                        setDateFrom(undefined);
                                        setDateTo(undefined);
                                      }}
                                    >
                                      Clear All
                                    </Button>
                                  )}
                                </div>

                                {/* Status Filter */}
                                <div>
                                  <Label className="text-xs font-medium mb-2 block">Status</Label>
                                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full h-9">
                                      <SelectValue placeholder="All Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All Status</SelectItem>
                                      {getUniqueStatuses().map((status) => (
                                        <SelectItem key={status} value={status}>
                                          {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Vendor Filter */}
                                <div>
                                  <Label className="text-xs font-medium mb-2 block">Vendors</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-full h-9 justify-between text-left font-normal">
                                        <span className="truncate">
                                          {selectedVendorFilters.length === 0 
                                            ? "All Vendors" 
                                            : selectedVendorFilters.length === 1 
                                            ? selectedVendorFilters[0]
                                            : `${selectedVendorFilters.length} Vendors`}
                                        </span>
                                        <ChevronDown className="w-4 h-4 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-0" align="start">
                                      <div className="p-2">
                                        <div className="flex items-center justify-between mb-2">
                                          <Label className="text-xs font-medium">Select Vendors</Label>
                                          {selectedVendorFilters.length > 0 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-xs"
                                              onClick={() => setSelectedVendorFilters([])}
                                            >
                                              Clear
                                            </Button>
                                          )}
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-1">
                                          <label className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={selectedVendorFilters.length === 0}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedVendorFilters([])
                                                }
                                              }}
                                              className="w-4 h-4"
                                            />
                                            <span className="text-xs">All Vendors</span>
                                          </label>
                                          <label className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={selectedVendorFilters.includes('Unclaimed')}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedVendorFilters([...selectedVendorFilters, 'Unclaimed'])
                                                } else {
                                                  const newFilters = selectedVendorFilters.filter(v => v !== 'Unclaimed')
                                                  setSelectedVendorFilters(newFilters)
                                                }
                                              }}
                                              className="w-4 h-4"
                                            />
                                            <span className="text-xs">Unclaimed</span>
                                          </label>
                                          {getUniqueVendorNames().map((vendorName) => (
                                            <label key={vendorName} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={selectedVendorFilters.includes(vendorName)}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setSelectedVendorFilters([...selectedVendorFilters, vendorName])
                                                  } else {
                                                    const newFilters = selectedVendorFilters.filter(v => v !== vendorName)
                                                    setSelectedVendorFilters(newFilters)
                                                  }
                                                }}
                                                className="w-4 h-4"
                                              />
                                              <span className="text-xs">{vendorName}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>

                                {/* Store Filter */}
                                <div>
                                  <Label className="text-xs font-medium mb-2 block">Stores</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-full h-9 justify-between text-left font-normal">
                                        <span className="truncate">
                                          {selectedStoreFilters.length === 0 
                                            ? "All Stores" 
                                            : selectedStoreFilters.length === 1 
                                            ? stores.find(s => s.account_code === selectedStoreFilters[0])?.store_name || selectedStoreFilters[0]
                                            : `${selectedStoreFilters.length} Stores`}
                                        </span>
                                        <ChevronDown className="w-4 h-4 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-0" align="start">
                                      <div className="p-2">
                                        <div className="flex items-center justify-between mb-2">
                                          <Label className="text-xs font-medium">Select Stores</Label>
                                          {selectedStoreFilters.length > 0 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-xs"
                                              onClick={() => setSelectedStoreFilters([])}
                                            >
                                              Clear
                                            </Button>
                                          )}
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-1">
                                          <label className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={selectedStoreFilters.length === 0}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedStoreFilters([])
                                                }
                                              }}
                                              className="w-4 h-4"
                                            />
                                            <span className="text-xs">All Stores</span>
                                          </label>
                                          {stores.map((store) => (
                                            <label key={store.account_code} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={selectedStoreFilters.includes(store.account_code)}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setSelectedStoreFilters([...selectedStoreFilters, store.account_code])
                                                  } else {
                                                    const newFilters = selectedStoreFilters.filter(s => s !== store.account_code)
                                                    setSelectedStoreFilters(newFilters)
                                                  }
                                                }}
                                                className="w-4 h-4"
                                              />
                                              <span className="text-xs">{store.store_name}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>

                                {/* Date Range */}
                                <div>
                                  <Label className="text-xs font-medium mb-2 block">Date Range</Label>
                                  <div className="flex gap-2 items-center">
                                    <DatePicker
                                      date={dateFrom}
                                      onDateChange={(date) => {
                                        setDateFrom(date);
                                        if (date && dateTo && date > dateTo) {
                                          setDateTo(undefined);
                                          toast({
                                            title: "Date Range Adjusted",
                                            description: "To date was cleared as From date is after it",
                                          });
                                        }
                                      }}
                                      placeholder="From"
                                      className="flex-1 min-w-0 text-xs h-9"
                                    />
                                    <span className="text-gray-500 text-xs flex-shrink-0">to</span>
                                    <DatePicker
                                      date={dateTo}
                                      onDateChange={(date) => {
                                        setDateTo(date);
                                        if (date && dateFrom && date < dateFrom) {
                                          setDateFrom(undefined);
                                          toast({
                                            title: "Date Range Adjusted",
                                            description: "From date was cleared as To date is before it",
                                          });
                                        }
                                      }}
                                      placeholder="To"
                                      className="flex-1 min-w-0 text-xs h-9"
                                    />
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          )}
                        </div>

                        {/* Status Filter for Non-Orders tabs and Desktop (exclude vendors mobile as it's inline) */}
                        {(activeTab !== "orders" || !isMobile) && !(activeTab === "vendors" && isMobile) && (
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                              <Filter className="w-4 h-4 mr-2" />
                              <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              {activeTab === "orders" && (
                                <>
                                  {getUniqueStatuses().map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              {activeTab === "vendors" && (
                                <>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </>
                              )}
                              {activeTab === "carrier" && (
                                <>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Add New Vendor Button - Only for Vendors tab */}
                        {activeTab === "vendors" && !isMobile && (
                          <Button onClick={() => setShowVendorModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add New Vendor
                          </Button>
                        )}

                        {/* Vendor Filter - Only for Orders tab (Desktop) */}
                        {activeTab === "orders" && !isMobile && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full sm:w-40 justify-start text-left font-normal">
                                <Users className="w-4 h-4 mr-2" />
                                <span className="truncate">
                                  {selectedVendorFilters.length === 0 
                                    ? "All Vendors" 
                                    : selectedVendorFilters.length === 1 
                                    ? selectedVendorFilters[0]
                                    : `${selectedVendorFilters.length} Vendors`}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0" align="start">
                              <div className="p-2">
                                <div className="flex items-center justify-between mb-2">
                                  <Label className="text-sm font-medium">Select Vendors</Label>
                                  {selectedVendorFilters.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => setSelectedVendorFilters([])}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                  <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedVendorFilters.includes('Unclaimed')}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedVendorFilters([...selectedVendorFilters, 'Unclaimed'])
                                        } else {
                                          setSelectedVendorFilters(selectedVendorFilters.filter(v => v !== 'Unclaimed'))
                                        }
                                      }}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">Unclaimed</span>
                                  </label>
                                  {getUniqueVendorNames().map((vendorName) => (
                                    <label key={vendorName} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedVendorFilters.includes(vendorName)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedVendorFilters([...selectedVendorFilters, vendorName])
                                          } else {
                                            setSelectedVendorFilters(selectedVendorFilters.filter(v => v !== vendorName))
                                          }
                                        }}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">{vendorName}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}

                        {/* Store Filter - Only for Orders tab (Desktop) */}
                        {activeTab === "orders" && !isMobile && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full sm:w-40 justify-start text-left font-normal">
                                <Store className="w-4 h-4 mr-2" />
                                <span className="truncate">
                                  {selectedStoreFilters.length === 0 
                                    ? "All Stores" 
                                    : selectedStoreFilters.length === 1 
                                    ? stores.find(s => s.account_code === selectedStoreFilters[0])?.store_name || selectedStoreFilters[0]
                                    : `${selectedStoreFilters.length} Stores`}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0" align="start">
                              <div className="p-2">
                                <div className="flex items-center justify-between mb-2">
                                  <Label className="text-sm font-medium">Select Stores</Label>
                                  {selectedStoreFilters.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => setSelectedStoreFilters([])}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                  {stores.map((store) => (
                                    <label key={store.account_code} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedStoreFilters.includes(store.account_code)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedStoreFilters([...selectedStoreFilters, store.account_code])
                                          } else {
                                            setSelectedStoreFilters(selectedStoreFilters.filter(s => s !== store.account_code))
                                          }
                                        }}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">{store.store_name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}

                        {/* Store Filter - Only for Carrier tab (Desktop) */}
                        {activeTab === "carrier" && !isMobile && (
                          <Select 
                            value={selectedStoreFilter} 
                            onValueChange={setSelectedStoreFilter}
                            disabled={stores.length === 0}
                          >
                            <SelectTrigger className="w-full sm:w-40">
                              <SelectValue placeholder={stores.length === 0 ? "Loading..." : "Select Store"} />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.account_code} value={store.account_code}>
                                  {store.store_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </>
                    )}

                    {activeTab === "orders" && !isMobile && (
                      <Button
                        onClick={() => setShowBulkAssignModal(true)}
                        disabled={selectedOrders.length === 0}
                        variant="default"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Bulk Assign ({selectedOrders.length})
                      </Button>
                    )}
                    {activeTab === "carrier" && !isMobile && (
                      <>
                        <Button
                          onClick={handleDownloadCarriers}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download CSV
                        </Button>
                        <Button
                          onClick={() => document.getElementById('carrier-csv-upload')?.click()}
                          variant="outline"
                          size="sm"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Priority
                        </Button>
                      </>
                    )}
                    {/* Hidden file input for carrier CSV upload - accessible from both desktop and mobile */}
                    <input
                      id="carrier-csv-upload"
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleUploadCarrierPriorities}
                    />
                      </div>
                )}

                {/* Tab-specific Actions */}

                {/* Add Vendor Dialog - Accessible from both desktop and mobile */}
                <Dialog open={showVendorModal} onOpenChange={setShowVendorModal}>
                  <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[85vh]' : 'max-w-2xl max-h-[85vh]'} overflow-y-auto`}>
                            <DialogHeader>
                              <DialogTitle>Add New Vendor</DialogTitle>
                              <DialogDescription>Enter vendor details to add them to the system</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="vendor-name">Vendor Name</Label>
                                <Input
                                  id="vendor-name"
                                  value={newVendor.name}
                                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                                  placeholder="Enter vendor name"
                                />
                              </div>
                              <div>
                                <Label htmlFor="vendor-email">Email</Label>
                                <Input
                                  id="vendor-email"
                                  type="email"
                                  value={newVendor.email}
                                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                                  placeholder="Enter email address"
                                />
                              </div>
                              <div>
                                <Label htmlFor="vendor-phone">Phone</Label>
                                <Input
                                  id="vendor-phone"
                                  value={newVendor.phone}
                                  onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                                  placeholder="Enter phone number"
                                />
                              </div>
                              <div>
                                <Label htmlFor="vendor-warehouse">Warehouse ID</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id="vendor-warehouse"
                                    value={newVendor.warehouseId}
                                    onChange={(e) => setNewVendor({ ...newVendor, warehouseId: e.target.value })}
                                    placeholder="Enter warehouse ID"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVerifyVendorWarehouse()}
                                    disabled={vendorWarehouseVerifyLoading || !newVendor.warehouseId.trim()}
                                  >
                                    {vendorWarehouseVerifyLoading ? 'Verifying...' : 'Verify'}
                                  </Button>
                                </div>
                                {vendorWarehouseVerified && vendorWarehouseInfo && (
                                  <p className="text-xs text-green-700 mt-1">
                                    Verified: {vendorWarehouseInfo.address}, {vendorWarehouseInfo.city}, {vendorWarehouseInfo.state}, {vendorWarehouseInfo.country} (Pincode: {vendorWarehouseInfo.pincode})
                                  </p>
                                )}
                                {vendorWarehouseVerifyError && !vendorWarehouseVerifyLoading && (
                                  <p className="text-xs text-red-600 mt-1">{vendorWarehouseVerifyError}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="vendor-contact">Contact Number</Label>
                                <Input
                                  id="vendor-contact"
                                  value={newVendor.contactNumber}
                                  onChange={(e) => setNewVendor({ ...newVendor, contactNumber: e.target.value })}
                                  placeholder="Enter contact number (optional)"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="vendor-password">Password</Label>
                                  <Input
                                    id="vendor-password"
                                    type="password"
                                    value={newVendor.password}
                                    onChange={(e) => setNewVendor({ ...newVendor, password: e.target.value })}
                                    placeholder="Enter password"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="vendor-cpassword">Confirm Password</Label>
                                  <Input
                                    id="vendor-cpassword"
                                    type="password"
                                    value={newVendor.confirmPassword}
                                    onChange={(e) => setNewVendor({ ...newVendor, confirmPassword: e.target.value })}
                                    placeholder="Confirm password"
                                  />
                                </div>
                              </div>
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
                              <Button onClick={handleAddVendor} className="w-full">
                                Add Vendor
                              </Button>
                            </div>
                  </DialogContent>
                </Dialog>


              </div>

              {/* Scrollable Content Section */}
              <div className={isMobile ? "" : ""}>
                <TabsContent value="orders" className="mt-0">
                  <div className={`rounded-md border ${!isMobile ? 'overflow-y-auto max-h-[600px]' : ''}`}>
                    {!isMobile ? (
                      <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                        <TableRow className="[&>th]:py-2">
                          <TableHead className="w-12 text-xs">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const orders = getFilteredOrdersForTab("orders")
                                if (e.target.checked) {
                                  setSelectedOrders(orders.map((o) => o.unique_id))
                                } else {
                                  setSelectedOrders([])
                                }
                              }}
                              checked={
                                selectedOrders.length > 0 &&
                                selectedOrders.length === getFilteredOrdersForTab("orders").length
                              }
                            />
                          </TableHead>
                          <TableHead className="text-xs">Image</TableHead>
                          <TableHead className="text-xs">Order ID</TableHead>
                          <TableHead className="text-xs">Customer</TableHead>
                          <TableHead className="text-xs">Store</TableHead>
                          <TableHead className="text-xs">Vendor</TableHead>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs">Value</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Created</TableHead>
                          <TableHead className="text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                                                 {ordersLoading ? (
                           <TableRow>
                             <TableCell colSpan={10} className="text-center py-8">
                               Loading orders...
                             </TableCell>
                           </TableRow>
                        ) : getFilteredOrdersForTab("orders").length > 0 ? (
                          getFilteredOrdersForTab("orders").map((order) => (
                            <TableRow 
                              key={order.unique_id}
                              className="cursor-pointer hover:bg-gray-50 [&>td]:py-2"
                              onClick={() => {
                                if (selectedOrders.includes(order.unique_id)) {
                                  setSelectedOrders(selectedOrders.filter((id) => id !== order.unique_id))
                                } else {
                                  setSelectedOrders([...selectedOrders, order.unique_id])
                                }
                              }}
                            >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                  checked={selectedOrders.includes(order.unique_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                      setSelectedOrders([...selectedOrders, order.unique_id])
                                  } else {
                                      setSelectedOrders(selectedOrders.filter((id) => id !== order.unique_id))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()} className="py-2">
                              <img
                                src={order.image || "/placeholder.svg"}
                                  alt={order.product_name}
                                  className="w-10 h-10 rounded object-cover cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageUrl(order.image || null);
                                    setSelectedImageProduct(order.product_name || null);
                                    setShowImageModal(true);
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "/placeholder.svg";
                                  }}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-xs">{order.order_id}</TableCell>
                            <TableCell className="text-xs">{order.customer_name}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col">
                                <span className="font-medium">{order.store_name || 'N/A'}</span>
                                <span className="text-[10px] text-gray-500">{order.account_code || ''}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{order.vendor_name}</TableCell>
                            <TableCell className="text-xs">{order.product_name}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">₹{order.value}</TableCell>
                            <TableCell className="text-xs">{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-xs">
                              {order.created_at ? (
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    {new Date(order.created_at).toLocaleTimeString()}
                                  </span>
                                </div>
                              ) : "N/A"}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()} className="py-2">
                              <div className="flex gap-1">
                                  {order.status === 'unclaimed' ? (
                                    <Button 
                                      size="sm" 
                                      variant="default"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAssignModal(order);
                                      }}
                                      disabled={assignLoading[order.unique_id]}
                                      className="text-xs h-7 px-2"
                                    >
                                      {assignLoading[order.unique_id] ? (
                                        <>
                                          <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-white mr-1"></div>
                                          Assigning...
                                        </>
                                      ) : (
                                        'Assign'
                                      )}
                                </Button>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnassignOrder(order);
                                      }}
                                      disabled={unassignLoading[order.unique_id]}
                                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-7 px-2"
                                    >
                                      {unassignLoading[order.unique_id] ? (
                                        <>
                                          <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-red-600 mr-1"></div>
                                          Unassigning...
                                        </>
                                      ) : (
                                        'Unassign'
                                      )}
                                    </Button>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                          ))
                                                 ) : (
                           <TableRow>
                             <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                               No orders found
                             </TableCell>
                           </TableRow>
                         )}
                      </TableBody>
                      </Table>
                    ) : (
                      <div className="space-y-2.5 sm:space-y-3 pb-24">
                        {ordersLoading ? (
                          <Card className="p-4 text-center">Loading orders...</Card>
                        ) : (
                          getFilteredOrdersForTab("orders").map((order: any) => (
                            <Card 
                              key={order.unique_id} 
                              className="p-2.5 sm:p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors border-l-4"
                              style={{ 
                                borderLeftColor: 
                                  order.status === 'unclaimed' ? '#f59e0b' : 
                                  order.status === 'in_pack' ? '#3b82f6' : 
                                  order.status === 'handover' ? '#eab308' :
                                  order.status === 'picked' ? '#8b5cf6' :
                                  order.status === 'in_transit' ? '#6366f1' :
                                  order.status === 'out_for_delivery' ? '#f97316' :
                                  order.status === 'delivered' ? '#10b981' :
                                  order.status === 'rto' ? '#ef4444' :
                                  // Additional shipping status values
                                  order.status === 'shipment booked' ? '#06b6d4' :
                                  order.status === 'picked up' ? '#8b5cf6' :
                                  order.status === 'in warehouse' ? '#3b82f6' :
                                  order.status === 'dispatched' ? '#6366f1' :
                                  order.status === 'out for pickup' ? '#eab308' :
                                  order.status === 'attempted delivery' ? '#f97316' :
                                  order.status === 'returned' ? '#ef4444' :
                                  order.status === 'cancelled' ? '#6b7280' :
                                  order.status === 'failed delivery' ? '#ef4444' :
                                  // Legacy status values for backward compatibility
                                  order.status === 'claimed' ? '#3b82f6' : 
                                  order.status === 'ready_for_handover' ? '#8b5cf6' :
                                  '#6b7280'
                              }}
                              onClick={() => {
                                if (selectedOrders.includes(order.unique_id)) {
                                  setSelectedOrders(selectedOrders.filter((id) => id !== order.unique_id))
                                } else {
                                  setSelectedOrders([...selectedOrders, order.unique_id])
                                }
                              }}
                            >
                              <div className="space-y-2 sm:space-y-3">
                              {/* Top Row: Checkbox, Vendor, and Status */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedOrders.includes(order.unique_id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedOrders([...selectedOrders, order.unique_id])
                                      } else {
                                        setSelectedOrders(selectedOrders.filter((id) => id !== order.unique_id))
                                      }
                                    }}
                                    className="mt-1 w-3.5 h-3.5 sm:w-4 sm:h-4"
                                  />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs sm:text-sm font-mono text-purple-600 truncate">
                                    AWB: {order.awb || order.airway_bill || order.airwaybill || 'NA'}
                                  </span>
                                  {getStatusBadge(order.status)}
                                </div>
                              </div>

                              {/* Order ID and Image Row */}
                              <div className="flex items-start gap-2 sm:gap-3">
                                <img
                                  src={order.image || "/placeholder.svg"}
                                  alt={order.product_name}
                                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover cursor-pointer flex-shrink-0"
                                  onClick={(e) => { 
                                    e.stopPropagation();
                                    setSelectedImageUrl(order.image || null); 
                                    setSelectedImageProduct(order.product_name || null); 
                                    setShowImageModal(true); 
                                  }}
                                  onError={(e) => { const t = e.target as HTMLImageElement; t.src = "/placeholder.svg"; }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 className="font-medium text-sm sm:text-base text-gray-900 truncate">{order.order_id}</h4>
                                    {order.store_name && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto bg-blue-50 text-blue-700 border-blue-200">
                                        {order.store_name}
                                      </Badge>
                                    )}
                                    {order.value && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto bg-green-50 text-green-700 border-green-200">
                                        ₹{order.value}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-600 break-words leading-relaxed">
                                    {order.product_name}
                                  </p>
                                  <p className="text-xs sm:text-sm text-gray-500 break-words leading-relaxed">
                                    Code: {order.product_code || 'N/A'}
                                  </p>
                                </div>
                              </div>

                              {/* Details Row - Date, Qty, Vendor, Customer side by side */}
                              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <div>
                                  <span className="text-gray-500">Date:</span>
                                  <p className="font-medium truncate">
                                    {order.created_at ? 
                                      (() => {
                                        const date = new Date(order.created_at);
                                        return date.toLocaleDateString();
                                      })()
                                    : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Qty:</span>
                                  <p className="font-medium truncate">{order.quantity || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Vendor:</span>
                                  <p className={`font-medium truncate ${String(order.vendor_name || '').toLowerCase().includes('unclaimed') ? 'text-red-600' : 'text-blue-600'}`}>
                                    {order.vendor_name || 'Unclaimed'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Customer:</span>
                                  <p className="font-medium break-words">
                                    {order.customer_name ? order.customer_name.split(' ')[0] : 'N/A'}
                                  </p>
                                </div>
                              </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="vendors" className="mt-0">
                  <div className={`rounded-md border ${!isMobile ? 'overflow-y-auto max-h-[600px]' : ''}`}>
                    {!isMobile ? (
                      <Table>
                      <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const vendors = getFilteredVendors()
                                if (e.target.checked) {
                                  setSelectedVendors(vendors.map((v) => v.warehouse_id))
                                } else {
                                  setSelectedVendors([])
                                }
                              }}
                              checked={
                                selectedVendors.length > 0 && selectedVendors.length === getFilteredVendors().length
                              }
                            />
                          </TableHead>
                          <TableHead>Vendor Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Warehouse ID</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total Orders</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredVendors().map((vendor) => (
                          <TableRow key={vendor.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedVendors.includes(vendor.warehouse_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedVendors([...selectedVendors, vendor.warehouse_id])
                                  } else {
                                    setSelectedVendors(selectedVendors.filter((id) => id !== vendor.warehouse_id))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{vendor.name}</TableCell>
                            <TableCell>{vendor.email}</TableCell>
                            <TableCell>{vendor.warehouseId || '—'}</TableCell>
                            <TableCell>{vendor.city || '—'}</TableCell>
                            <TableCell>{vendor.phone || '—'}</TableCell>
                            <TableCell>{getStatusBadge(vendor.status === 'active' || vendor.status === 'inactive' ? vendor.status : (vendor.status ? vendor.status : 'unclaimed'))}</TableCell>
                            <TableCell>{vendor.totalOrders ?? 0}</TableCell>
                            <TableCell>{vendor.completedOrders ?? 0}</TableCell>
                            <TableCell>{vendor.revenue ?? '0.00'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setVendorDialogVendor(vendor); setShowVendorViewDialog(true) }}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setVendorDialogVendor(vendor); setEditVendorForm({ name: vendor.name, email: vendor.email, phone: vendor.phone, status: vendor.status, warehouseId: vendor.warehouseId || '', contactNumber: vendor.contactNumber || '' }); setShowVendorEditDialog(true) }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="destructive">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Delete Vendor</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to delete {vendor.name}? This action cannot be undone.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline">Cancel</Button>
                                      <Button
                                        variant="destructive"
                                        onClick={async () => {
                                          try {
                                            // Check localStorage directly for auth header
                                            const storedAuthHeader = localStorage.getItem('authHeader')
                                            if (!storedAuthHeader) throw new Error('Not authenticated. Please login again.')
                                            const res = await apiClient.deleteUser(vendor.id)
                                            if (res.success) {
                                              toast({ title: 'Vendor Deleted', description: `${vendor.name} removed.` })
                                              fetchVendors()
                                            } else {
                                              toast({ title: 'Error', description: res.message, variant: 'destructive' })
                                            }
                                          } catch (err: any) {
                                            toast({ title: 'Error', description: err?.message || 'Failed to delete vendor', variant: 'destructive' })
                                          }
                                        }}
                                      >
                                        Confirm Delete
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    ) : (
                      <div className="space-y-3 p-2 pb-24">
                        {getFilteredVendors().map((vendor) => (
                          <Card key={vendor.id} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{vendor.name}</p>
                                <p className="text-sm text-gray-600 truncate">{vendor.email}</p>
                              </div>
                              {getStatusBadge(vendor.status)}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700">
                              <span>Warehouse: {vendor.warehouseId || '—'}</span>
                              <span>City: {vendor.city || '—'}</span>
                              <span>Phone: {vendor.phone || '—'}</span>
                              <span>Orders: {vendor.totalOrders ?? 0} • Completed: {vendor.completedOrders ?? 0}</span>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setVendorDialogVendor(vendor); setShowVendorViewDialog(true) }}><Eye className="w-3 h-3" /></Button>
                              <Button size="sm" variant="outline" onClick={() => { setVendorDialogVendor(vendor); setEditVendorForm({ name: vendor.name, email: vendor.email, phone: vendor.phone, status: vendor.status, warehouseId: vendor.warehouseId || '', contactNumber: vendor.contactNumber || '' }); setShowVendorEditDialog(true) }}><Edit className="w-3 h-3" /></Button>
                              <Button size="sm" variant="destructive" onClick={async () => {
                                try {
                                  // Ensure auth header exists (admin only action) - check localStorage directly
                                  const storedAuthHeader = localStorage.getItem('authHeader')
                                  if (!storedAuthHeader) throw new Error('Not authenticated. Please login again.')
                                  const res = await apiClient.deleteUser(vendor.id)
                                  if (res.success) {
                                    toast({ title: 'Vendor Deleted', description: `${vendor.name} removed.` })
                                    fetchVendors()
                                  } else {
                                    toast({ title: 'Error', description: res.message, variant: 'destructive' })
                                  }
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err?.message || 'Failed to delete vendor', variant: 'destructive' })
                                }
                              }}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* View Vendor Dialog */}
                {vendorDialogVendor && (
                  <Dialog open={showVendorViewDialog} onOpenChange={setShowVendorViewDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Vendor Details</DialogTitle>
                        <DialogDescription>View vendor information</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2 text-sm">
                        <div><strong>ID:</strong> {vendorDialogVendor.id}</div>
                        <div><strong>Name:</strong> {vendorDialogVendor.name}</div>
                        <div><strong>Email:</strong> {vendorDialogVendor.email}</div>
                        <div><strong>Phone:</strong> {vendorDialogVendor.phone}</div>
                        <div><strong>Status:</strong> {vendorDialogVendor.status}</div>
                        <div><strong>Warehouse ID:</strong> {vendorDialogVendor.warehouseId || '—'}</div>
                        <div><strong>Joined:</strong> {vendorDialogVendor.joinedDate}</div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Edit Vendor Dialog */}
                {vendorDialogVendor && (
                  <Dialog open={showVendorEditDialog} onOpenChange={(open) => {
                    // Reset edit verification state when dialog closes
                    if (!open) {
                      setEditWarehouseVerifyLoading(false)
                      setEditWarehouseVerifyError("")
                      setEditWarehouseInfo(null)
                      setEditWarehouseVerified(false)
                    }
                    setShowVendorEditDialog(open)
                  }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Vendor</DialogTitle>
                        <DialogDescription>Update vendor details</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Name</Label>
                          <Input value={editVendorForm.name} onChange={(e) => setEditVendorForm({ ...editVendorForm, name: e.target.value })} />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input type="email" value={editVendorForm.email} onChange={(e) => setEditVendorForm({ ...editVendorForm, email: e.target.value })} />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input value={editVendorForm.phone} onChange={(e) => setEditVendorForm({ ...editVendorForm, phone: e.target.value })} />
                        </div>
                        <div>
                          <Label>Warehouse ID</Label>
                          <Input 
                            value={editVendorForm.warehouseId} 
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditVendorForm({ ...editVendorForm, warehouseId: value });
                              // Reset verification state when input changes
                              setEditWarehouseVerified(false);
                              setEditWarehouseInfo(null);
                              setEditWarehouseVerifyError("");
                            }} 
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerifyEditWarehouse(editVendorForm.warehouseId)}
                              disabled={editWarehouseVerifyLoading || !editVendorForm.warehouseId.trim()}
                            >
                              {editWarehouseVerifyLoading ? 'Verifying...' : 'Verify Warehouse'}
                            </Button>
                            {editWarehouseVerified && (
                              <Badge className="bg-green-100 text-green-800">Verified</Badge>
                            )}
                          </div>
                          {editWarehouseVerified && editWarehouseInfo && (
                            <p className="text-xs text-green-700 mt-1">
                              {editWarehouseInfo.address && editWarehouseInfo.city && editWarehouseInfo.state && editWarehouseInfo.pincode
                                ? `${editWarehouseInfo.address}, ${editWarehouseInfo.city}, ${editWarehouseInfo.state} - ${editWarehouseInfo.pincode}`
                                : `${editWarehouseInfo.address || ''}${editWarehouseInfo.city ? (editWarehouseInfo.address ? ', ' : '') + editWarehouseInfo.city : ''}${editWarehouseInfo.state ? (editWarehouseInfo.address || editWarehouseInfo.city ? ', ' : '') + editWarehouseInfo.state : ''}${editWarehouseInfo.pincode ? ` - ${editWarehouseInfo.pincode}` : ''}`}
                            </p>
                          )}
                          {editWarehouseVerifyError && !editWarehouseVerifyLoading && (
                            <p className="text-xs text-red-600 mt-1">{editWarehouseVerifyError}</p>
                          )}
                        </div>
                        <div>
                          <Label>Contact Number</Label>
                          <Input value={editVendorForm.contactNumber} onChange={(e) => setEditVendorForm({ ...editVendorForm, contactNumber: e.target.value })} />
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select value={editVendorForm.status} onValueChange={(value) => setEditVendorForm({ ...editVendorForm, status: value })}>
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
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setShowVendorEditDialog(false)}>Cancel</Button>
                        <Button onClick={async () => {
                          try {
                            // Check localStorage directly for auth header
                            const storedAuthHeader = localStorage.getItem('authHeader')
                            if (!storedAuthHeader) throw new Error('Not authenticated. Please login again.')
                            const payload: any = {}
                            if (editVendorForm.name && editVendorForm.name.trim()) payload.name = editVendorForm.name.trim()
                            if (editVendorForm.email && editVendorForm.email.trim()) payload.email = editVendorForm.email.trim()
                            if (editVendorForm.phone && editVendorForm.phone.trim()) payload.phone = editVendorForm.phone.trim()
                            if (editVendorForm.status) payload.status = editVendorForm.status
                            if (editVendorForm.contactNumber && editVendorForm.contactNumber.trim()) payload.contactNumber = editVendorForm.contactNumber.trim()
                            if (editVendorForm.warehouseId && editVendorForm.warehouseId.trim()) {
                              const wid = editVendorForm.warehouseId.trim()
                              const currentWid = String(vendorDialogVendor.warehouseId || vendorDialogVendor.warehouse_id || '')
                              // Only send warehouseId if unchanged OR verified
                              if (wid === currentWid || editWarehouseVerified) {
                                payload.warehouseId = wid
                              }
                            }

                            const res = await apiClient.updateUser(vendorDialogVendor.id, payload)
                            if (res.success) {
                              toast({ title: 'Vendor Updated', description: 'Changes saved.' })
                              setShowVendorEditDialog(false)
                              fetchVendors()
                            } else {
                              toast({ title: 'Error', description: res.message, variant: 'destructive' })
                            }
                          } catch (err: any) {
                            // Surface backend validation errors if available
                            const msg = err?.message || 'Failed to update vendor'
                            toast({ title: 'Validation error', description: msg, variant: 'destructive' })
                          }
                        }}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <TabsContent value="carrier" className="mt-0">
                  <div className={`rounded-md border ${!isMobile ? 'overflow-y-auto max-h-[600px]' : ''}`}>
                    {carriersLoading ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading carriers...</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop table */}
                        {!isMobile ? (
                          <Table>
                            <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                              <TableRow>
                                <TableHead>Carrier ID</TableHead>
                                <TableHead>Carrier Name</TableHead>
                                <TableHead>Store</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Weight</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {getFilteredCarriers().map((carrier) => (
                                <TableRow key={carrier.carrier_id}>
                                  <TableCell className="font-medium">{carrier.carrier_id}</TableCell>
                                  <TableCell>{carrier.carrier_name}</TableCell>
                                  <TableCell>
                                    {carrier.store_name ? (
                                      <div className="flex flex-col gap-1">
                                        <span className="text-xs text-gray-900">{carrier.store_name}</span>
                                        <span className="text-xs text-gray-500">{carrier.account_code}</span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {getStatusBadge(carrier.status)}
                                  </TableCell>
                                  <TableCell>{getPriorityNumberBadge(carrier.priority)}</TableCell>
                                  <TableCell>{carrier.weight_in_kg ? `${carrier.weight_in_kg}kg` : 'N/A'}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="outline" disabled={movingCarrier === carrier.carrier_id} onClick={() => handleMoveCarrier(carrier.carrier_id, 'up')} title="Move Up">
                                        {movingCarrier === carrier.carrier_id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div> : '▲'}
                                      </Button>
                                      <Button size="sm" variant="outline" disabled={movingCarrier === carrier.carrier_id} onClick={() => handleMoveCarrier(carrier.carrier_id, 'down')} title="Move Down">
                                        {movingCarrier === carrier.carrier_id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div> : '▼'}
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => { setCarrierEditState({ open: true, carrierId: carrier.carrier_id, carrier_id: carrier.carrier_id, status: carrier.status || 'active' }) }}><Edit className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="destructive" onClick={async () => { try { const res = await apiClient.deleteCarrier(carrier.carrier_id); if (res.success) { toast({ title: 'Carrier Deleted', description: `Carrier ${carrier.carrier_id} removed` }); await fetchCarriers() } else { toast({ title: 'Error', description: res.message, variant: 'destructive' }) } } catch (err: any) { toast({ title: 'Error', description: err?.message || 'Failed to delete carrier', variant: 'destructive' }) } }}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          // Mobile card layout
                          <div className="space-y-3 p-2 pb-24">
                             {getFilteredCarriers().map((carrier) => (
                               <Card key={carrier.carrier_id} className="p-3 space-y-3">
                                 {/* Header Section */}
                                 <div className="flex items-start justify-between gap-3">
                                   <div className="min-w-0 flex-1">
                                     <div className="flex flex-col gap-1 mb-2">
                                       <h3 className="font-semibold text-base text-gray-900 break-words leading-tight">{carrier.carrier_name}</h3>
                                       <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full self-start">
                                         ID: {carrier.carrier_id}
                                       </span>
                                     </div>
                                     <div className="flex items-center gap-2 flex-wrap">
                                       {carrier.store_name && (
                                         <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                           {carrier.store_name}
                                         </Badge>
                                       )}
                                       {getStatusBadge(carrier.status)}
                                       {getPriorityNumberBadge(carrier.priority)}
                                     </div>
                                   </div>
                                 </div>

                                 {/* Details Section */}
                                 <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                   <div className="grid grid-cols-1 gap-2">
                                     <div className="flex justify-between items-center">
                                       <span className="text-sm text-gray-600">Weight Limit:</span>
                                       <span className="text-sm font-medium text-gray-900">
                                         {carrier.weight_in_kg ? `${carrier.weight_in_kg} kg` : 'N/A'}
                                       </span>
                                     </div>
                                   </div>
                                 </div>

                                 {/* Actions Section */}
                                 <div className="flex gap-2 items-center">
                                   {/* Priority Control */}
                                   <Button 
                                     size="sm" 
                                     variant="outline" 
                                     disabled={movingCarrier === carrier.carrier_id} 
                                     onClick={() => handleMoveCarrier(carrier.carrier_id, 'up')} 
                                     className="h-9 w-9 p-0"
                                     title="Move Up"
                                   >
                                     {movingCarrier === carrier.carrier_id ? 
                                       <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div> : 
                                       <span className="text-sm">▲</span>
                                     }
                                   </Button>
                                   <Button 
                                     size="sm" 
                                     variant="outline" 
                                     disabled={movingCarrier === carrier.carrier_id} 
                                     onClick={() => handleMoveCarrier(carrier.carrier_id, 'down')} 
                                     className="h-9 w-9 p-0"
                                     title="Move Down"
                                   >
                                     {movingCarrier === carrier.carrier_id ? 
                                       <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div> : 
                                       <span className="text-sm">▼</span>
                                     }
                                   </Button>

                                   {/* Management Actions */}
                                     <Button 
                                       size="sm" 
                                       variant="outline" 
                                       onClick={() => { 
                                         setCarrierEditState({ 
                                           open: true, 
                                           carrierId: carrier.carrier_id, 
                                           carrier_id: carrier.carrier_id, 
                                           status: carrier.status || 'active' 
                                         }) 
                                       }}
                                       className="flex-1 h-9 text-sm"
                                     >
                                       <Edit className="w-4 h-4 mr-2" />
                                       Edit
                                     </Button>
                                     <Button 
                                       size="sm" 
                                       variant="destructive" 
                                       onClick={async () => { 
                                         try { 
                                           const res = await apiClient.deleteCarrier(carrier.carrier_id); 
                                           if (res.success) { 
                                             toast({ 
                                               title: 'Carrier Deleted', 
                                               description: `Carrier ${carrier.carrier_id} removed` 
                                             }); 
                                             await fetchCarriers() 
                                           } else { 
                                             toast({ 
                                               title: 'Error', 
                                               description: res.message, 
                                               variant: 'destructive' 
                                             }) 
                                           } 
                                         } catch (err: any) { 
                                           toast({ 
                                             title: 'Error', 
                                             description: err?.message || 'Failed to delete carrier', 
                                             variant: 'destructive' 
                                           }) 
                                         } 
                                       }}
                                       className="flex-1 h-9 text-sm"
                                     >
                                       <Trash2 className="w-4 h-4 mr-2" />
                                       Delete
                                     </Button>
                                 </div>
                               </Card>
                             ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

                {/* Inventory Tab */}
                <TabsContent value="inventory" className="mt-0">
                  <InventoryAggregation />
                </TabsContent>

                {/* Settlement Management Tab - Hidden for now (tab trigger is commented out, content kept for future use) */}
                <TabsContent value="settlement-management" className="mt-0">
                  <div className="space-y-4">
                    {/* Settlement Filters */}
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Settlement Filters</CardTitle>
                          <Button onClick={handleExportCSV} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Status</Label>
                            <Select 
                              value={settlementFilters.status} 
                              onValueChange={(value) => setSettlementFilters({...settlementFilters, status: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Vendor Name</Label>
                            <Input
                              placeholder="Search by vendor..."
                              value={settlementFilters.vendorName}
                              onChange={(e) => setSettlementFilters({...settlementFilters, vendorName: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label>Start Date</Label>
                            <Input
                              type="date"
                              value={settlementFilters.startDate}
                              onChange={(e) => setSettlementFilters({...settlementFilters, startDate: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label>End Date</Label>
                            <Input
                              type="date"
                              value={settlementFilters.endDate}
                              onChange={(e) => setSettlementFilters({...settlementFilters, endDate: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                          <Button onClick={fetchSettlements} disabled={settlementsLoading}>
                            <Search className="w-4 h-4 mr-2" />
                            {settlementsLoading ? "Loading..." : "Search"}
                          </Button>
                          <div className="text-sm text-gray-500">
                            Page {settlementPage} of {settlementPagination.totalPages} ({settlementPagination.totalItems} total)
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Settlements: table on desktop, cards on mobile */}
                    <div className={`rounded-md border ${!isMobile ? 'overflow-y-auto max-h-[600px]' : ''}`}>
                      {!isMobile ? (
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                          <TableRow>
                            <TableHead>Settlement ID</TableHead>
                            <TableHead>Vendor Name</TableHead>
                            <TableHead>Amount (₹)</TableHead>
                            <TableHead>Request Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Payment Status</TableHead>
                            <TableHead>UPI ID</TableHead>
                            <TableHead>Orders</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {settlementsLoading ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8">
                                Loading settlements...
                              </TableCell>
                            </TableRow>
                          ) : allSettlements.length > 0 ? (
                            allSettlements.map((settlement: any) => (
                              <TableRow key={settlement.id}>
                                <TableCell className="font-medium">{settlement.id}</TableCell>
                                <TableCell>{settlement.vendorName}</TableCell>
                                <TableCell>₹{settlement.amount}</TableCell>
                                <TableCell>{new Date(settlement.createdAt).toLocaleDateString('en-IN')}</TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      settlement.status === "approved"
                                        ? "bg-green-100 text-green-800"
                                        : settlement.status === "rejected"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }
                                  >
                                    {settlement.status.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      settlement.paymentStatus === "settled_fully"
                                        ? "bg-green-100 text-green-800"
                                        : settlement.paymentStatus === "settled_partially"
                                        ? "bg-orange-100 text-orange-800"
                                        : "bg-gray-100 text-gray-800"
                                    }
                                  >
                                    {settlement.paymentStatus ? settlement.paymentStatus.replace("_", " ").toUpperCase() : "PENDING"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-32 truncate">{settlement.upiId}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{settlement.numberOfOrders} orders</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewSettlement(settlement)}
                                    >
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    {settlement.status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => handleApproveSettlement(settlement)}
                                        >
                                          <CheckCircle className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleRejectSettlement(settlement)}
                                        >
                                          <XCircle className="w-3 h-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                No settlements found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      ) : (
                        <div className="space-y-3 p-2">
                          {settlementsLoading ? (
                            <Card className="p-4 text-center">Loading settlements...</Card>
                          ) : (
                            allSettlements.map((s: any) => (
                              <Card key={s.id} className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{s.vendorName}</p>
                                    <p className="text-xs text-gray-600 truncate">Settlement #{s.id}</p>
                                  </div>
                                  <Badge className={s.status === 'approved' ? 'bg-green-100 text-green-800' : s.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{s.status.toUpperCase()}</Badge>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                                  <span>Amount: ₹{s.amount}</span>
                                  <span>Date: {new Date(s.createdAt).toLocaleDateString('en-IN')}</span>
                                  <span className="col-span-2">UPI: {s.upiId || '—'}</span>
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleViewSettlement(s)}>View</Button>
                                  {s.status === 'pending' && (
                                    <>
                                      <Button size="sm" onClick={() => handleApproveSettlement(s)}>Approve</Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleRejectSettlement(s)}>Reject</Button>
                                    </>
                                  )}
                                </div>
                              </Card>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pagination */}
                    {settlementPagination.totalPages > 1 && (
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setSettlementPage(Math.max(1, settlementPage - 1))}
                          disabled={settlementPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSettlementPage(Math.min(settlementPagination.totalPages, settlementPage + 1))}
                          disabled={settlementPage === settlementPagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="mt-0">
                  <div className="space-y-4">
                    {/* Filters Section */}
                    {isMobile ? (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="filters" className="border rounded-lg bg-white">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-2">
                              <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-semibold text-gray-700">Filters</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowNotificationInfo(!showNotificationInfo);
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                <Info className="w-3 h-3 mr-1" />
                                Info
                              </Button>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="space-y-3 pt-2">
                              {/* Filter Controls */}
                              <div className="grid grid-cols-1 gap-3">
                            {/* Order ID Filter */}
                            <div>
                              <Label htmlFor="filter-order-id" className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-600 mb-1`}>Order ID</Label>
                              <div className="relative">
                                <Input
                                  id="filter-order-id"
                                  placeholder={isMobile ? "Order ID..." : "Search by order ID..."}
                                  value={notificationFilters.search}
                                  onChange={(e) => setNotificationFilters({...notificationFilters, search: e.target.value})}
                                  className={`${isMobile ? 'h-10' : 'h-9'} ${notificationFilters.search && isMobile ? 'pr-20' : 'pr-3'}`}
                                />
                                {notificationFilters.search && isMobile && (
                                  <button
                                    onClick={() => {
                                      document.getElementById('filter-order-id')?.blur();
                                    }}
                                    className="absolute right-11 top-1/2 transform -translate-y-1/2 text-green-500 hover:text-green-700 transition-colors"
                                    type="button"
                                    title="Done"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                {notificationFilters.search && (
                                  <button
                                    onClick={() => setNotificationFilters({...notificationFilters, search: ''})}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    type="button"
                                    title="Clear"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Status Filter */}
                            <div>
                              <Label htmlFor="filter-status" className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-600 mb-1`}>Status</Label>
                              <Select
                                value={notificationFilters.status}
                                onValueChange={(value) => setNotificationFilters({...notificationFilters, status: value})}
                              >
                                <SelectTrigger id="filter-status" className={isMobile ? "h-10" : "h-9"}>
                                  <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Status</SelectItem>
                                  {notificationFilterOptions.statuses.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Severity/Criticality Filter */}
                            <div>
                              <Label htmlFor="filter-severity" className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-600 mb-1`}>Criticality</Label>
                              <Select
                                value={notificationFilters.severity}
                                onValueChange={(value) => setNotificationFilters({...notificationFilters, severity: value})}
                              >
                                <SelectTrigger id="filter-severity" className={isMobile ? "h-10" : "h-9"}>
                                  <SelectValue placeholder="All Levels" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Levels</SelectItem>
                                  {notificationFilterOptions.severities.map((severity) => {
                                    const emoji = severity === 'critical' ? '🔴' : 
                                                  severity === 'high' ? '🟠' : 
                                                  severity === 'medium' ? '🟡' : '🔵';
                                    return (
                                      <SelectItem key={severity} value={severity}>
                                        {emoji} {severity.charAt(0).toUpperCase() + severity.slice(1)}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Type Filter */}
                            <div>
                              <Label htmlFor="filter-type" className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-600 mb-1`}>Type</Label>
                              <Select
                                value={notificationFilters.type}
                                onValueChange={(value) => setNotificationFilters({...notificationFilters, type: value})}
                              >
                                <SelectTrigger id="filter-type" className={isMobile ? "h-10" : "h-9"}>
                                  <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Types</SelectItem>
                                  {notificationFilterOptions.types.map((type) => {
                                    const typeLabels: any = {
                                      reverse_order_failure: 'Reverse Order Failed',
                                      shipment_assignment_error: 'Shipment Error',
                                      carrier_unavailable: 'Carrier Unavailable',
                                      low_balance: 'Low Balance',
                                      warehouse_issue: 'Warehouse Issue',
                                      payment_failed: 'Payment Failed',
                                      order_stuck: 'Order Stuck',
                                      other: 'Other'
                                    };
                                    return (
                                      <SelectItem key={type} value={type}>
                                        {typeLabels[type] || type}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Vendor Filter */}
                            <div>
                              <Label htmlFor="filter-vendor" className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-600 mb-1`}>Vendor</Label>
                              <Select
                                value={notificationFilters.vendor || 'all'}
                                onValueChange={(value) => setNotificationFilters({...notificationFilters, vendor: value})}
                              >
                                <SelectTrigger id="filter-vendor" className={isMobile ? "h-10" : "h-9"}>
                                  <SelectValue placeholder="All Vendors" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Vendors</SelectItem>
                                  {notificationFilterOptions.vendors.map((vendor) => (
                                    <SelectItem key={vendor} value={vendor}>
                                      {vendor}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Date Filter */}
                            <div className={isMobile ? "" : "md:col-span-2"}>
                              <Label className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-600 mb-1`}>Date Range</Label>
                              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-2 items-center'}`}>
                                <DatePicker
                                  date={notificationFilters.dateFrom}
                                  onDateChange={(date) => {
                                    // Date validation logic
                                    if (date && notificationFilters.dateTo && date > notificationFilters.dateTo) {
                                      setNotificationFilters({...notificationFilters, dateFrom: date, dateTo: undefined});
                                      setTimeout(() => {
                                        toast({
                                          title: "Date Adjusted",
                                          description: "To date was cleared as From date is after it",
                                          variant: "default"
                                        });
                                      }, 100);
                                    } else {
                                      setNotificationFilters({...notificationFilters, dateFrom: date});
                                    }
                                  }}
                                  placeholder="From date"
                                  className={isMobile ? "w-full" : "flex-1"}
                                />
                                {!isMobile && <span className="text-gray-500 text-sm px-1">to</span>}
                                {isMobile && <div className="text-center text-xs text-gray-500">to</div>}
                                <DatePicker
                                  date={notificationFilters.dateTo}
                                  onDateChange={(date) => {
                                    // Date validation logic
                                    if (date && notificationFilters.dateFrom && date < notificationFilters.dateFrom) {
                                      setNotificationFilters({...notificationFilters, dateTo: date, dateFrom: undefined});
                                      setTimeout(() => {
                                        toast({
                                          title: "Date Adjusted",
                                          description: "From date was cleared as To date is before it",
                                          variant: "default"
                                        });
                                      }, 100);
                                    } else {
                                      setNotificationFilters({...notificationFilters, dateTo: date});
                                    }
                                  }}
                                  placeholder="To date"
                                  className={isMobile ? "w-full" : "flex-1"}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Clear Filters Button */}
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNotificationFilters({
                                  status: "all",
                                  type: "all",
                                  severity: "all",
                                  search: "",
                                  vendor: "all",
                                  dateFrom: undefined,
                                  dateTo: undefined
                                });
                                toast({
                                  title: "Filters Cleared",
                                  description: "All notification filters have been reset"
                                });
                              }}
                              className={`flex items-center ${isMobile ? 'gap-1 h-8 px-2 text-xs' : 'gap-2'}`}
                            >
                              <XCircle className={isMobile ? "w-3 h-3" : "w-4 h-4"} />
                              {isMobile ? 'Clear' : 'Clear Filters'}
                            </Button>
                          </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : (
                      <Card>
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            {/* Header with Info Button */}
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filter Notifications
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowNotificationInfo(!showNotificationInfo)}
                                className="flex items-center gap-1"
                              >
                                <Info className="w-4 h-4" />
                                {showNotificationInfo ? 'Hide Info' : 'Show Info'}
                              </Button>
                            </div>

                            {/* Filter Controls - Desktop */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Order ID Filter */}
                              <div>
                                <Label htmlFor="filter-order-id-desktop" className="text-xs text-gray-600 mb-1">Order ID</Label>
                                <div className="relative">
                                  <Input
                                    id="filter-order-id-desktop"
                                    placeholder="Search by order ID..."
                                    value={notificationFilters.search}
                                    onChange={(e) => setNotificationFilters({...notificationFilters, search: e.target.value})}
                                    className={`h-9 ${notificationFilters.search ? 'pr-10' : 'pr-3'}`}
                                  />
                                  {notificationFilters.search && (
                                    <button
                                      onClick={() => setNotificationFilters({...notificationFilters, search: ''})}
                                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                      type="button"
                                      title="Clear"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Status Filter */}
                              <div>
                                <Label htmlFor="filter-status-desktop" className="text-xs text-gray-600 mb-1">Status</Label>
                                <Select
                                  value={notificationFilters.status}
                                  onValueChange={(value) => setNotificationFilters({...notificationFilters, status: value})}
                                >
                                  <SelectTrigger id="filter-status-desktop" className="h-9">
                                    <SelectValue placeholder="All Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    {notificationFilterOptions.statuses.map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Severity/Criticality Filter */}
                              <div>
                                <Label htmlFor="filter-severity-desktop" className="text-xs text-gray-600 mb-1">Criticality</Label>
                                <Select
                                  value={notificationFilters.severity}
                                  onValueChange={(value) => setNotificationFilters({...notificationFilters, severity: value})}
                                >
                                  <SelectTrigger id="filter-severity-desktop" className="h-9">
                                    <SelectValue placeholder="All Levels" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Levels</SelectItem>
                                    {notificationFilterOptions.severities.map((severity) => {
                                      const emoji = severity === 'critical' ? '🔴' : 
                                                    severity === 'high' ? '🟠' : 
                                                    severity === 'medium' ? '🟡' : '🔵';
                                      return (
                                        <SelectItem key={severity} value={severity}>
                                          {emoji} {severity.charAt(0).toUpperCase() + severity.slice(1)}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Type Filter */}
                              <div>
                                <Label htmlFor="filter-type-desktop" className="text-xs text-gray-600 mb-1">Notification Type</Label>
                                <Select
                                  value={notificationFilters.type}
                                  onValueChange={(value) => setNotificationFilters({...notificationFilters, type: value})}
                                >
                                  <SelectTrigger id="filter-type-desktop" className="h-9">
                                    <SelectValue placeholder="All Types" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {notificationFilterOptions.types.map((type) => {
                                      const typeLabels: any = {
                                        reverse_order_failure: 'Reverse Order Failed',
                                        shipment_assignment_error: 'Shipment Assignment Error',
                                        carrier_unavailable: 'Carrier Unavailable',
                                        low_balance: 'Low Balance',
                                        warehouse_issue: 'Warehouse Issue',
                                        payment_failed: 'Payment Failed',
                                        order_stuck: 'Order Stuck',
                                        other: 'Other'
                                      };
                                      return (
                                        <SelectItem key={type} value={type}>
                                          {typeLabels[type] || type}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Vendor Filter */}
                              <div>
                                <Label htmlFor="filter-vendor-desktop" className="text-xs text-gray-600 mb-1">Vendor</Label>
                                <Select
                                  value={notificationFilters.vendor || 'all'}
                                  onValueChange={(value) => setNotificationFilters({...notificationFilters, vendor: value})}
                                >
                                  <SelectTrigger id="filter-vendor-desktop" className="h-9">
                                    <SelectValue placeholder="All Vendors" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Vendors</SelectItem>
                                    {notificationFilterOptions.vendors.map((vendor) => (
                                      <SelectItem key={vendor} value={vendor}>
                                        {vendor}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Date Filter */}
                              <div className="md:col-span-2">
                                <Label className="text-xs text-gray-600 mb-1">Date Range</Label>
                                <div className="flex gap-2 items-center">
                                  <DatePicker
                                    date={notificationFilters.dateFrom}
                                    onDateChange={(date) => {
                                      if (date && notificationFilters.dateTo && date > notificationFilters.dateTo) {
                                        setNotificationFilters({...notificationFilters, dateFrom: date, dateTo: undefined});
                                        setTimeout(() => {
                                          toast({
                                            title: "Date Adjusted",
                                            description: "To date was cleared as From date is after it",
                                            variant: "default"
                                          });
                                        }, 100);
                                      } else {
                                        setNotificationFilters({...notificationFilters, dateFrom: date});
                                      }
                                    }}
                                    placeholder="From date"
                                    className="flex-1"
                                  />
                                  <span className="text-gray-500 text-sm px-1">to</span>
                                  <DatePicker
                                    date={notificationFilters.dateTo}
                                    onDateChange={(date) => {
                                      if (date && notificationFilters.dateFrom && date < notificationFilters.dateFrom) {
                                        setNotificationFilters({...notificationFilters, dateTo: date, dateFrom: undefined});
                                        setTimeout(() => {
                                          toast({
                                            title: "Date Adjusted",
                                            description: "From date was cleared as To date is before it",
                                            variant: "default"
                                          });
                                        }, 100);
                                      } else {
                                        setNotificationFilters({...notificationFilters, dateTo: date});
                                      }
                                    }}
                                    placeholder="To date"
                                    className="flex-1"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Clear Filters Button */}
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNotificationFilters({
                                    status: "all",
                                    type: "all",
                                    severity: "all",
                                    search: "",
                                    vendor: "all",
                                    dateFrom: undefined,
                                    dateTo: undefined
                                  });
                                  toast({
                                    title: "Filters Cleared",
                                    description: "All notification filters have been reset"
                                  });
                                }}
                                className="flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Clear Filters
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Collapsible Info Section */}
                    {showNotificationInfo && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Bell className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg text-gray-900 mb-2">Notification System - Coming Soon!</h3>
                              <p className="text-gray-700 mb-4">
                                Track system alerts, vendor-reported issues, and critical errors in real-time.
                              </p>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-gray-700">Reverse order failure notifications</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-gray-700">Shipment assignment error tracking</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-gray-700">Carrier unavailability alerts</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-gray-700">Low balance warnings</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Notifications UI */}
                    <Card>
                      <CardHeader className={isMobile ? "p-4" : ""}>
                        <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : ''}`}>
                          <Bell className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600`} />
                          Notifications
                          {notificationStats && notificationStats.pending > 0 && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              {notificationStats.pending} pending
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className={isMobile ? "text-xs" : ""}>
                          {notificationPagination.totalItems === 0 ? 'No notifications found' : `Showing ${notifications.length} of ${notificationPagination.totalItems} notifications`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className={isMobile ? "p-4 pt-0" : ""}>
                        {notificationsLoading ? (
                          <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">No notifications found</p>
                            <p className="text-sm mt-2">All clear! No issues to report.</p>
                          </div>
                        ) : (
                          <div className={isMobile ? "space-y-2" : "space-y-3"}>
                          {/* Map over real notifications from database */}
                          {notifications.map((notification) => {
                            const getSeverityColor = (severity: string) => {
                              switch (severity) {
                                case 'critical': return { border: 'border-red-200', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
                                case 'high': return { border: 'border-orange-200', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle };
                                case 'medium': return { border: 'border-yellow-200', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Info };
                                case 'low': return { border: 'border-blue-200', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: Info };
                                default: return { border: 'border-gray-200', bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-700 border-gray-200', icon: Info };
                              }
                            };

                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case 'resolved': return 'bg-green-100 text-green-700';
                                case 'in_progress': return 'bg-blue-100 text-blue-700';
                                case 'dismissed': return 'bg-gray-100 text-gray-700';
                                default: return 'bg-orange-100 text-orange-700';
                              }
                            };

                            const severity = getSeverityColor(notification.severity);
                            const SeverityIcon = severity.icon;
                            const isResolved = notification.status === 'resolved' || notification.status === 'dismissed';

                            return (
                              <div
                                key={notification.id}
                                className={`border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${
                                  isMobile ? 'p-3' : 'p-4'
                                } ${
                                  isResolved
                                  ? `border-green-200 bg-green-50 opacity-60`
                                  : `${severity.border} ${severity.bg}`
                                }`}
                                onClick={() => {
                                  setSelectedNotification(notification);
                                  setShowNotificationDialog(true);
                                }}
                          >
                                <div className={`flex items-start ${isMobile ? 'flex-col gap-2' : 'justify-between gap-4'}`}>
                                  <div className="flex-1 w-full">
                                    <div className={`flex ${isMobile ? 'flex-wrap' : 'items-center'} gap-1 mb-2`}>
                                      <Badge className={`${severity.badge} ${isMobile ? 'text-[10px] px-1.5 py-0.5' : ''}`}>
                                        <SeverityIcon className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} mr-1`} />
                                        {notification.severity.toUpperCase()}
                                      </Badge>
                                      <Badge variant="outline" className={isMobile ? 'text-[10px] px-1.5 py-0.5' : ''}>
                                        {notification.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                      </Badge>
                                      <Badge className={`${getStatusColor(notification.status)} ${isMobile ? 'text-[10px] px-1.5 py-0.5' : ''}`}>
                                        {notification.status.toUpperCase().replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <h3 className={`font-semibold text-gray-900 mb-1 ${isMobile ? 'text-sm' : ''}`}>
                                      {notification.title}
                                    </h3>
                                    <p className={`text-gray-700 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                      {notification.message}
                                    </p>
                                    <div className={`flex flex-wrap ${isMobile ? 'gap-2' : 'gap-4'} text-xs text-gray-600`}>
                                      {notification.vendor_name && (
                                        <span>📍 {isMobile ? notification.vendor_name.split(' ')[0] : `Vendor: ${notification.vendor_name}`}</span>
                                      )}
                                      {notification.order_id && (
                                        <span>📦 {isMobile ? `#${notification.order_id}` : `Order: #${notification.order_id}`}</span>
                                      )}
                                      <span>🕐 {isMobile 
                                        ? new Date(notification.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) 
                                        : new Date(notification.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className={isMobile ? "w-full mt-2 h-8 text-xs" : ""} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedNotification(notification);
                                      setShowNotificationDialog(true);
                                    }}
                                  >
                                    View Details <ExternalLink className="w-3 h-3 ml-1" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Pagination */}
                    {notificationPagination.totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNotificationPage(Math.max(1, notificationPage - 1))}
                          disabled={notificationPage === 1 || notificationsLoading}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {notificationPage} of {notificationPagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNotificationPage(Math.min(notificationPagination.totalPages, notificationPage + 1))}
                          disabled={notificationPage === notificationPagination.totalPages || notificationsLoading}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>

              {/* Fixed Bottom Bulk Assign Button for Mobile Orders */}
              {isMobile && activeTab === "orders" && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:p-4 shadow-lg z-50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Move to Top Button */}
                    <Button
                      onClick={scrollToTop}
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-full border-gray-300 hover:bg-gray-50 flex-shrink-0"
                    >
                      <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                    
                    {/* Bulk Assign Button */}
                    <Button 
                      onClick={() => setShowBulkAssignModal(true)}
                      disabled={selectedOrders.length === 0} 
                      className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg min-w-0"
                    >
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Bulk Assign ({selectedOrders.length})</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Fixed Bottom Add Vendor Button for Mobile Vendors */}
              {isMobile && activeTab === "vendors" && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:p-4 shadow-lg z-50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Move to Top Button */}
                    <Button
                      onClick={scrollToTop}
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-full border-gray-300 hover:bg-gray-50 flex-shrink-0"
                    >
                      <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                    
                    {/* Add Vendor Button */}
                    <Button 
                      onClick={() => setShowVendorModal(true)}
                      className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg min-w-0"
                    >
                      <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Add Vendor</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Fixed Bottom Carrier Actions for Mobile Carrier */}
              {isMobile && activeTab === "carrier" && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:p-4 shadow-lg z-50">
                  <div className="flex items-center gap-1.5 sm:gap-3">
                    {/* Move to Top Button */}
                    <Button
                      onClick={scrollToTop}
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-full border-gray-300 hover:bg-gray-50 flex-shrink-0"
                    >
                      <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                    
                    {/* Download CSV Button */}
                    <Button 
                      onClick={handleDownloadCarriers}
                      className="flex-1 h-10 sm:h-12 text-xs sm:text-sm font-medium bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-0 shadow-lg min-w-0"
                    >
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Download</span>
                    </Button>

                    {/* Upload Priority Button */}
                    <Button 
                      onClick={() => document.getElementById('carrier-csv-upload')?.click()}
                      className="flex-1 h-10 sm:h-12 text-xs sm:text-sm font-medium bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 border-0 shadow-lg min-w-0"
                    >
                      <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Priority</span>
                    </Button>
                  </div>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>


      {/* Notification Detail Dialog */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Notification Details
            </DialogTitle>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge className={
                  selectedNotification.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                  selectedNotification.severity === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                  selectedNotification.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                  'bg-blue-100 text-blue-700 border-blue-200'
                }>
                  {selectedNotification.severity === 'critical' && <AlertCircle className="w-3 h-3 mr-1" />}
                  {selectedNotification.severity === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {selectedNotification.severity === 'medium' && <Info className="w-3 h-3 mr-1" />}
                  <span className="uppercase">{selectedNotification.severity}</span>
                </Badge>
                <Badge variant="outline">
                  {selectedNotification.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Badge>
                <Badge className={
                  selectedNotification.status === 'resolved' ? 'bg-green-100 text-green-700' :
                  selectedNotification.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  selectedNotification.status === 'dismissed' ? 'bg-gray-100 text-gray-700' :
                  'bg-orange-100 text-orange-700'
                }>
                  {selectedNotification.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              {/* Title & Message */}
              <div>
                <h3 className="font-bold text-xl text-gray-900 mb-2">{selectedNotification.title}</h3>
                <p className="text-gray-700 leading-relaxed">{selectedNotification.message}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                {selectedNotification.vendor_name && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Vendor</p>
                    <p className="text-gray-900">{selectedNotification.vendor_name}</p>
                  </div>
                )}
                {selectedNotification.vendor_warehouse_id && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Warehouse ID</p>
                    <p className="text-gray-900 font-mono">{selectedNotification.vendor_warehouse_id}</p>
                  </div>
                )}
                {selectedNotification.order_id && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Order ID</p>
                    <p className="text-gray-900 font-mono">{selectedNotification.order_id}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 font-medium">Created At</p>
                  <p className="text-gray-900">{new Date(selectedNotification.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Metadata */}
              {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-2">Additional Information</p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {Object.entries(selectedNotification.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:</span>
                        <span className="text-gray-900 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {selectedNotification.error_details && (
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-2">Error Details</p>
                  <pre className="text-sm bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {selectedNotification.error_details}
                  </pre>
                </div>
              )}

              {/* Resolution Section */}
              {selectedNotification.status === 'pending' || selectedNotification.status === 'in_progress' ? (
                <div className="border-t pt-4">
                  <Label htmlFor="resolution-notes" className="text-base font-semibold">Resolution Notes</Label>
                  <Textarea
                    id="resolution-notes"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter resolution notes (optional)..."
                    rows={4}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Describe how this issue was resolved or what actions were taken.
                  </p>
                </div>
              ) : selectedNotification.status === 'resolved' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-green-800 font-semibold mb-1">
                        ✅ Resolved by {selectedNotification.resolved_by_name || 'Admin'}
                      </p>
                      <p className="text-sm text-green-700">
                        {selectedNotification.resolved_at && new Date(selectedNotification.resolved_at).toLocaleString()}
                      </p>
                      {selectedNotification.resolution_notes && (
                        <p className="text-sm text-green-800 mt-2 bg-green-100 p-2 rounded">
                          <span className="font-medium">Note:</span> {selectedNotification.resolution_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedNotification && (selectedNotification.status === 'pending' || selectedNotification.status === 'in_progress') && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await apiClient.dismissNotification(selectedNotification.id, 'Dismissed by admin');
                      setShowNotificationDialog(false);
                      setResolutionNotes("");
                      fetchNotifications();
                      fetchNotificationStats();
                      toast({
                        title: "Notification Dismissed",
                        description: "Notification has been dismissed successfully.",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to dismiss notification",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Dismiss
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await apiClient.resolveNotification(selectedNotification.id, resolutionNotes || 'Issue resolved by admin');
                      setShowNotificationDialog(false);
                      setResolutionNotes("");
                      fetchNotifications();
                      fetchNotificationStats();
                      toast({
                        title: "✅ Notification Resolved",
                        description: `Marked as resolved by ${user?.name}${resolutionNotes ? ' with notes' : ''}.`,
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to resolve notification",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Resolved
                </Button>
              </>
            )}
            {selectedNotification && selectedNotification.status === 'resolved' && (
              <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement Modal */}
      <Dialog open={showSettlementModal} onOpenChange={setShowSettlementModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {settlementAction === "approve"
                ? "Approve Settlement"
                : settlementAction === "reject"
                  ? "Reject Settlement"
                  : "Settlement Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedSettlement && `Settlement ${selectedSettlement.id} for ${selectedSettlement.vendor}`}
            </DialogDescription>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <p className="text-lg font-semibold">{selectedSettlement.amount}</p>
                </div>
                <div>
                  <Label>UPI ID</Label>
                  <p>{selectedSettlement.upiId}</p>
                </div>
                <div>
                  <Label>Request Date</Label>
                  <p>{selectedSettlement.requestDate}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedSettlement.status)}</div>
                </div>
              </div>

              <div>
                <Label>Orders Included</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSettlement.orders.map((orderId: string) => (
                    <Badge key={orderId} variant="outline">
                      {orderId}
                    </Badge>
                  ))}
                </div>
              </div>

              {settlementAction === "approve" && (
                <>
                  <div>
                    <Label htmlFor="transaction-id">Transaction ID</Label>
                    <Input
                      id="transaction-id"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter transaction ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="transaction-proof">Transaction Proof (Screenshot)</Label>
                    <Input
                      id="transaction-proof"
                      type="file"
                      accept="image/*"
                      onChange={handleProofUpload}
                      className="cursor-pointer"
                    />
                    {transactionProof && (
                      <p className="text-sm text-green-600 mt-1">✓ Proof uploaded: {transactionProof.name}</p>
                    )}
                  </div>
                </>
              )}

              {settlementAction === "reject" && (
                <div>
                  <Label htmlFor="rejection-reason">Rejection Reason</Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection"
                  />
                </div>
              )}

              {settlementAction && (
                <Button onClick={handleSettlementAction} className="w-full">
                  {settlementAction === "approve" ? "Approve Settlement" : "Reject Settlement"}
                </Button>
              )}
            </div>
          )}
                  </DialogContent>
        </Dialog>

      {/* Settlement Management Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {settlementModalAction === "view" ? "Settlement Details" :
               settlementModalAction === "approve" ? "Approve Settlement" : "Reject Settlement"}
            </DialogTitle>
            <DialogDescription>
              {settlementModalAction === "view" ? "View settlement request details" :
               settlementModalAction === "approve" ? "Approve and process payment" : "Reject settlement request"}
            </DialogDescription>
          </DialogHeader>
          
          {currentSettlement && (
            <div className="space-y-6">
              {/* Settlement Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Settlement ID</Label>
                  <p>{currentSettlement.id}</p>
                </div>
                <div>
                  <Label className="font-semibold">Vendor Name</Label>
                  <p>{currentSettlement.vendorName}</p>
                </div>
                <div>
                  <Label className="font-semibold">Amount</Label>
                  <p className="text-xl font-bold text-green-600">₹{currentSettlement.amount}</p>
                </div>
                <div>
                  <Label className="font-semibold">Request Date</Label>
                  <p>{new Date(currentSettlement.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <Label className="font-semibold">UPI ID</Label>
                  <p className="font-mono">{currentSettlement.upiId}</p>
                </div>
                                 <div>
                   <Label className="font-semibold">Number of Orders</Label>
                   <p>{currentSettlement.numberOfOrders}</p>
                 </div>
                 {currentSettlement.status === "approved" && (
                   <>
                     <div>
                       <Label className="font-semibold">Settled Amount</Label>
                       <p className="text-xl font-bold text-green-600">₹{currentSettlement.amountPaid || currentSettlement.amount}</p>
                     </div>
                     <div>
                       <Label className="font-semibold">Transaction ID</Label>
                       <p className="font-mono">{currentSettlement.transactionId}</p>
                     </div>
                   </>
                 )}
                 {currentSettlement.status === "rejected" && (
                   <div className="col-span-2">
                     <Label className="font-semibold">Rejection Reason</Label>
                     <p className="text-red-600 bg-red-50 p-3 rounded-lg mt-1">{currentSettlement.rejectionReason}</p>
                   </div>
                 )}
               </div>

                             {/* Order IDs */}
               <div>
                 <Label className="font-semibold">Order IDs</Label>
                 <div className="flex flex-wrap gap-2 mt-2">
                   {currentSettlement.orderIds && currentSettlement.orderIds.split(',').map((orderId: string) => (
                     <Badge key={orderId.trim()} variant="outline">
                       {orderId.trim()}
                     </Badge>
                   ))}
                 </div>
               </div>

               {/* Payment Proof */}
               {currentSettlement.status === "approved" && currentSettlement.paymentProofPath && (
                 <div>
                   <Label className="font-semibold">Payment Proof</Label>
                   <div className="mt-2">
                     <Button
                       variant="outline"
                       onClick={() => handleViewProof(currentSettlement.paymentProofPath)}
                       className="flex items-center gap-2"
                     >
                       <Eye className="w-4 h-4" />
                       View Payment Proof
                     </Button>
                   </div>
                 </div>
               )}

              {/* Action-specific content */}
              {settlementModalAction === "approve" && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold">Approval Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                                         <div>
                       <Label htmlFor="amount-paid">Amount to Pay (₹)</Label>
                       <Input
                         id="amount-paid"
                         type="number"
                         step="0.01"
                         max={currentSettlement.amount}
                         value={approvalData.amountPaid}
                         onChange={(e) => setApprovalData({...approvalData, amountPaid: e.target.value})}
                         placeholder="Enter amount to pay"
                         className={
                           approvalData.amountPaid && parseFloat(approvalData.amountPaid) > currentSettlement.amount
                             ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                             : ""
                         }
                       />
                       <p className="text-xs text-gray-500 mt-1">Max: ₹{currentSettlement.amount}</p>
                       {approvalData.amountPaid && parseFloat(approvalData.amountPaid) > currentSettlement.amount && (
                         <p className="text-xs text-red-500 mt-1">Amount cannot exceed requested amount</p>
                       )}
                     </div>
                    <div>
                      <Label htmlFor="transaction-id-approval">Transaction ID</Label>
                      <Input
                        id="transaction-id-approval"
                        value={approvalData.transactionId}
                        onChange={(e) => setApprovalData({...approvalData, transactionId: e.target.value})}
                        placeholder="Enter transaction ID"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="payment-proof">Payment Proof (Screenshot)</Label>
                    <Input
                      id="payment-proof"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setApprovalData({...approvalData, paymentProof: file || null});
                      }}
                      className="cursor-pointer"
                    />
                    {approvalData.paymentProof && (
                      <p className="text-sm text-green-600 mt-1">✓ Proof uploaded: {approvalData.paymentProof.name}</p>
                    )}
                  </div>
                </div>
              )}

              {settlementModalAction === "reject" && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold">Rejection Details</h4>
                  <div>
                    <Label htmlFor="rejection-reason-detailed">Rejection Reason</Label>
                    <Textarea
                      id="rejection-reason-detailed"
                      value={settlementRejectionReason}
                      onChange={(e) => setSettlementRejectionReason(e.target.value)}
                      placeholder="Please provide a detailed reason for rejecting this settlement request..."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSettlementDialog(false)}
                >
                  Cancel
                </Button>
                {settlementModalAction !== "view" && (
                  <Button
                    onClick={submitSettlementAction}
                    className={settlementModalAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                  >
                    {settlementModalAction === "approve" ? "Approve Settlement" : "Reject Settlement"}
                  </Button>
                )}
              </div>
            </div>
                     )}
         </DialogContent>
       </Dialog>

      {/* Payment Proof Dialog */}
      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {selectedProofUrl && (
              <img 
                src={selectedProofUrl} 
                alt="Payment Proof" 
                className="max-w-full max-h-96 object-contain"
                onLoad={() => {
                  // Clean up object URL after image loads
                  setTimeout(() => {
                    if (selectedProofUrl) {
                      URL.revokeObjectURL(selectedProofUrl);
                    }
                  }, 1000);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

             {/* Image Modal */}
       <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
         <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
           <DialogHeader className="p-6 pb-2">
             <DialogTitle className="text-lg font-semibold">
               {selectedImageProduct ? `${selectedImageProduct}` : "Image Preview"}
             </DialogTitle>
           </DialogHeader>
           <div className="flex justify-center items-center p-6 pt-2" style={{ maxHeight: 'calc(95vh - 80px)' }}>
             {selectedImageUrl && (
               <img 
                 src={selectedImageUrl} 
                 alt={selectedImageProduct || "Image"} 
                 className="max-w-full max-h-full object-contain"
                 style={{ maxHeight: 'calc(95vh - 120px)' }}
               />
             )}
           </div>
         </DialogContent>
       </Dialog>

       {/* Order Assignment Modal */}
       <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Assign / Unassign Order</DialogTitle>
           </DialogHeader>
           {selectedOrderForAssignment && (
             <div className="space-y-4">
               <div className="p-4 bg-gray-50 rounded-lg">
                 <h4 className="font-medium">Order Details</h4>
                 <p className="text-sm text-gray-600">Order ID: {selectedOrderForAssignment.order_id}</p>
                 <p className="text-sm text-gray-600">Customer: {selectedOrderForAssignment.customer_name}</p>
                 <p className="text-sm text-gray-600">Product: {selectedOrderForAssignment.product_name}</p>
               </div>
               <div>
                 <Label htmlFor="vendor-select">Choose one</Label>
                 <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                   <SelectTrigger id="vendor-select">
                     <SelectValue placeholder="Select vendor or Unassign" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="__UNASSIGN__">Unassign</SelectItem>
                     {vendors
                       .filter((v) => (v.warehouse_id || v.warehouseId))
                       .map((vendor) => {
                         const key = String(vendor.id ?? vendor.warehouse_id ?? vendor.warehouseId)
                         const value = String(vendor.warehouse_id ?? vendor.warehouseId)
                         const labelWid = String(vendor.warehouse_id ?? vendor.warehouseId)
                         return (
                           <SelectItem key={key} value={value}>
                             {vendor.name} ({labelWid})
                           </SelectItem>
                         )
                       })}
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
                 <Button onClick={async () => {
                   if (selectedVendorId === '__UNASSIGN__') {
                     await handleUnassignOrder(selectedOrderForAssignment)
                     setShowAssignModal(false)
                   } else {
                     await handleAssignOrder()
                   }
                 }} disabled={!selectedVendorId || assignLoading[selectedOrderForAssignment?.unique_id] || unassignLoading[selectedOrderForAssignment?.unique_id]}>
                   {assignLoading[selectedOrderForAssignment?.unique_id] || unassignLoading[selectedOrderForAssignment?.unique_id] ? (
                     <>
                       <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                       Processing...
                     </>
                   ) : (
                     'Confirm'
                   )}
                 </Button>
               </div>
             </div>
           )}
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign / Unassign</DialogTitle>
            <DialogDescription>
              Assign or unassign the selected {selectedOrders.length} orders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded bg-gray-50 text-xs text-gray-700">
              <div className="font-medium mb-1">Selection Summary</div>
              <div>Total Selected: {selectedOrderObjects.length}</div>
              <div>Assigned: {assignedSelectedOrders.length}</div>
              <div>Unclaimed: {unclaimedSelectedOrders.length}</div>
            </div>
            <div>
              <Label htmlFor="bulk-vendor-select">Select Vendor</Label>
              <Select value={selectedBulkVendorId} onValueChange={setSelectedBulkVendorId}>
                <SelectTrigger id="bulk-vendor-select">
                  <SelectValue placeholder={isAllUnclaimedSelected ? "Choose a vendor" : "Choose a vendor (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {vendors
                    .filter((v) => (v.warehouse_id || v.warehouseId))
                    .map((vendor) => {
                      const key = String(vendor.id ?? vendor.warehouse_id ?? vendor.warehouseId)
                      const value = String(vendor.warehouse_id ?? vendor.warehouseId)
                      const labelWid = String(vendor.warehouse_id ?? vendor.warehouseId)
                      return (
                        <SelectItem key={key} value={value}>
                          {vendor.name} ({labelWid})
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkAssignModal(false)}>Cancel</Button>
              <Button variant="destructive" disabled={selectedOrders.length === 0 || bulkAssignLoading || isAllUnclaimedSelected} onClick={async () => {
                try {
                  setBulkAssignLoading(true)
                  // If mixed, unassign only assigned ones
                  const targetIds = isMixedSelected ? assignedSelectedOrders.map(o => o.unique_id) : selectedOrders
                  const res = await apiClient.bulkUnassignOrders(targetIds)
                  if (res.success) {
                    toast({ title: 'Bulk Unassigned', description: res.message })
                    setShowBulkAssignModal(false)
                    setSelectedBulkVendorId('')
                    setSelectedOrders([])
                    await fetchOrders()
                  } else {
                    toast({ title: 'Error', description: res.message, variant: 'destructive' })
                  }
                } catch (err: any) {
                  toast({ title: 'Error', description: err?.message || 'Bulk unassignment failed', variant: 'destructive' })
                } finally {
                  setBulkAssignLoading(false)
                }
              }}>Unassign</Button>
              <Button disabled={(isAllUnclaimedSelected && !selectedBulkVendorId) || selectedOrders.length === 0 || bulkAssignLoading} onClick={async () => {
                if (selectedOrders.length === 0) return;
                try {
                  setBulkAssignLoading(true)
                  // If no vendor chosen and mixed/all assigned, treat as unassign assigned ones
                  if (!selectedBulkVendorId) {
                    const targetIds = isMixedSelected ? assignedSelectedOrders.map(o => o.unique_id) : selectedOrders
                    const resUn = await apiClient.bulkUnassignOrders(targetIds)
                    if (resUn.success) {
                      toast({ title: 'Bulk Unassigned', description: resUn.message })
                      setShowBulkAssignModal(false)
                      setSelectedBulkVendorId('')
                      setSelectedOrders([])
                      await fetchOrders()
                    } else {
                      toast({ title: 'Error', description: resUn.message, variant: 'destructive' })
                    }
                    return;
                  }
                  // Assign chosen vendor to all selected
                  const res = await apiClient.bulkAssignOrdersToVendor(selectedOrders, selectedBulkVendorId)
                  if (res.success) {
                    toast({ title: 'Bulk Assigned', description: res.message })
                    setShowBulkAssignModal(false)
                    setSelectedBulkVendorId('')
                    setSelectedOrders([])
                    await fetchOrders()
                  } else {
                    toast({ title: 'Error', description: res.message, variant: 'destructive' })
                  }
                } catch (err: any) {
                  toast({ title: 'Error', description: err?.message || 'Bulk assignment failed', variant: 'destructive' })
                } finally {
                  setBulkAssignLoading(false)
                }
              }}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Carrier Edit Dialog */}
      <Dialog open={carrierEditState.open} onOpenChange={(open) => setCarrierEditState(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Carrier</DialogTitle>
            <DialogDescription>Update carrier ID and status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Carrier ID</Label>
              <Input
                value={carrierEditState.carrier_id}
                onChange={(e) => setCarrierEditState(prev => ({ ...prev, carrier_id: e.target.value }))}
                placeholder="Enter carrier ID"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={carrierEditState.status} onValueChange={(v) => setCarrierEditState(prev => ({ ...prev, status: v }))}>
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
            <Button variant="outline" onClick={() => setCarrierEditState({ open: false, carrierId: null, carrier_id: "", status: "active" })}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!carrierEditState.carrierId) return;
                try {
                  const res = await apiClient.updateCarrier(carrierEditState.carrierId, { carrier_id: carrierEditState.carrier_id, status: carrierEditState.status })
                  if (res.success) {
                    toast({ title: 'Carrier Updated', description: `Carrier updated successfully` })
                    setCarrierEditState({ open: false, carrierId: null, carrier_id: "", status: "active" })
                    await fetchCarriers()
                  } else {
                    toast({ title: 'Error', description: res.message, variant: 'destructive' })
                  }
                } catch (err: any) {
                  toast({ title: 'Error', description: err?.message || 'Failed to update carrier', variant: 'destructive' })
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <NotificationDialog
        isOpen={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
        notificationStats={notificationStats}
        onNotificationUpdate={() => {
          fetchNotificationStats();
          // Refresh other data if needed
        }}
      />
    </div>
  )
}


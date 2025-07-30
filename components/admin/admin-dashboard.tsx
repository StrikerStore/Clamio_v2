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
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { useEffect } from "react"

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
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("orders")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
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
  })
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

  // Carrier state
  const [carriers, setCarriers] = useState<any[]>([])
  const [carriersLoading, setCarriersLoading] = useState(false)

  const getStatusBadge = (status: string) => {
    const colors = {
      unclaimed: "bg-gray-100 text-gray-800",
      claimed: "bg-blue-100 text-blue-800",
      ready_for_handover: "bg-purple-100 text-purple-800",
      handover: "bg-yellow-100 text-yellow-800",
      picked: "bg-purple-100 text-purple-800",
      in_transit: "bg-indigo-100 text-indigo-800",
      out_for_delivery: "bg-orange-100 text-orange-800",
      delivered: "bg-green-100 text-green-800",
      rto: "bg-red-100 text-red-800",
      active: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      inactive: "bg-red-100 text-red-800",
      completed: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }

    // Handle undefined or null status
    if (!status) {
      return <Badge className="bg-gray-100 text-gray-800">UNKNOWN</Badge>
    }

    return <Badge className={colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"}>{status.replace("_", " ").toUpperCase()}</Badge>
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
      return <Badge className="bg-gray-100 text-gray-800">Priority N/A</Badge>
    }

    return <Badge className={colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800"}>Priority {priority}</Badge>
  }

  const getFilteredOrdersForTab = (tab: string) => {
    const baseOrders = orders

    // Apply search and status filters
    return baseOrders.filter((order) => {
      const matchesSearch =
        order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
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
    let filtered = carriers.filter((carrier) => {
      const matchesSearch =
        carrier.carrier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        carrier.carrier_id?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || carrier.status === statusFilter
      return matchesSearch && matchesStatus
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

  const handleVendorAction = (vendorId: string, action: string) => {
    toast({
      title: "Vendor Action",
      description: `${action} applied to vendor ${vendorId}`,
    })
  }

  const handleCarrierAction = (carrierId: string, action: string) => {
    toast({
      title: "Carrier Action",
      description: `${action} applied to carrier ${carrierId}`,
    })
  }

  const handleAddVendor = () => {
    if (!newVendor.name || !newVendor.email || !newVendor.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all vendor details",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Vendor Added",
      description: `${newVendor.name} has been added successfully`,
    })
    setNewVendor({ name: "", email: "", phone: "" })
    setShowVendorModal(false)
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
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await apiClient.getAdminOrders();
      
      if (response.success) {
        setOrders(response.data.orders);
        setOrdersStats({
          totalOrders: response.data.totalOrders,
          claimedOrders: response.data.claimedOrders,
          unclaimedOrders: response.data.unclaimedOrders
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

  // Auto-load orders when component mounts
  useEffect(() => {
    fetchOrders();
    fetchVendors();
    fetchCarriers();
  }, []);

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
    setCarriersLoading(true);
    try {
      const response = await apiClient.getCarriers();
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

  // Handle order assignment to vendor
  const handleAssignOrder = async () => {
    if (!selectedOrderForAssignment || !selectedVendorId) {
      toast({
        title: "Missing Information",
        description: "Please select a vendor",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiClient.assignOrderToVendor(
        selectedOrderForAssignment.unique_id,
        selectedVendorId
      );

      if (response.success) {
        toast({
          title: "Order Assigned",
          description: response.message,
        });
        setShowAssignModal(false);
        setSelectedOrderForAssignment(null);
        setSelectedVendorId("");
        fetchOrders(); // Refresh orders list
      } else {
        toast({
          title: "Assignment Failed",
          description: response.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign order",
        variant: "destructive",
      });
    }
  };

  // Handle order unassignment
  const handleUnassignOrder = async (order: any) => {
    try {
      const response = await apiClient.unassignOrder(order.unique_id);

      if (response.success) {
        toast({
          title: "Order Unassigned",
          description: response.message,
        });
        fetchOrders(); // Refresh orders list
      } else {
        toast({
          title: "Unassignment Failed",
          description: response.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign order",
        variant: "destructive",
      });
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
          `CSV Upload Requirements:\n\n` +
          `• Expected columns: ${formatInfo.data.expectedColumns.join(', ')}\n` +
          `• Total carriers required: ${formatInfo.data.totalCarriers}\n` +
          `• All existing carrier IDs must be included\n` +
          `• Priority values must be unique\n\n` +
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard v4</h1>
                <p className="text-sm text-gray-500">Welcome back, {user?.name}</p>
              </div>
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{ordersStats.totalOrders}</p>
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
                  <p className="text-sm font-medium text-gray-600">Active Vendors</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mockVendors.filter((v) => v.status === "active").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Claimed Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {ordersStats.claimedOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unclaimed Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {ordersStats.unclaimedOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Management</CardTitle>
            <CardDescription>Manage orders, vendors, and settlements</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Fixed Controls Section */}
              <div className="sticky top-20 bg-white z-40 pb-4 border-b mb-4">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="orders">Orders ({ordersStats.totalOrders})</TabsTrigger>
                  <TabsTrigger value="vendors">Vendors ({vendors.length})</TabsTrigger>
                  <TabsTrigger value="carrier">Carrier ({carriers.length})</TabsTrigger>
                  <TabsTrigger value="settlement-management">Settlement Management</TabsTrigger>
                </TabsList>

                {/* Filters - Only show for orders, vendors, and carriers tabs */}
                {(activeTab === "orders" || activeTab === "vendors" || activeTab === "carrier") && (
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder={`Search ${activeTab}...`}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {activeTab === "orders" && (
                          <>
                            <SelectItem value="unclaimed">Unclaimed</SelectItem>
                            <SelectItem value="claimed">Claimed</SelectItem>
                            <SelectItem value="ready_for_handover">Ready for Handover</SelectItem>
                            <SelectItem value="handover">Handover</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
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
                {activeTab === "orders" && (
                        <Button
                        onClick={fetchOrders}
                        disabled={ordersLoading}
                          variant="outline"
                        size="sm"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        {ordersLoading ? "Refreshing..." : "Refresh Orders"}
                      </Button>
                    )}
                    {activeTab === "carrier" && (
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
                        <input
                          id="carrier-csv-upload"
                          type="file"
                          accept=".csv"
                          style={{ display: 'none' }}
                          onChange={handleUploadCarrierPriorities}
                        />
                      </>
                    )}
                      </div>
                )}

                {/* Tab-specific Actions */}

                {activeTab === "vendors" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Vendor Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Dialog open={showVendorModal} onOpenChange={setShowVendorModal}>
                          <DialogTrigger asChild>
                            <Button>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Add New Vendor
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
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
                              <Button onClick={handleAddVendor} className="w-full">
                                Add Vendor
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          onClick={() => handleBulkOrderAction("Export Vendors")}
                          disabled={selectedVendors.length === 0}
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export Selected ({selectedVendors.length})
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}


              </div>

              {/* Scrollable Content Section */}
              <div className="max-h-[600px] overflow-y-auto">
                <TabsContent value="orders" className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-12">
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
                          <TableHead>Image</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                                                 {ordersLoading ? (
                           <TableRow>
                             <TableCell colSpan={9} className="text-center py-8">
                               Loading orders...
                             </TableCell>
                           </TableRow>
                        ) : getFilteredOrdersForTab("orders").length > 0 ? (
                          getFilteredOrdersForTab("orders").map((order) => (
                            <TableRow key={order.unique_id}>
                            <TableCell>
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
                            <TableCell>
                              <img
                                src={order.image || "/placeholder.svg"}
                                  alt={order.product_name}
                                  className="w-12 h-12 rounded-lg object-cover cursor-pointer"
                                  onClick={() => {
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
                                                             <TableCell className="font-medium">{order.order_id}</TableCell>
                               <TableCell>{order.customer_name}</TableCell>
                               <TableCell>{order.vendor_name}</TableCell>
                               <TableCell>{order.product_name}</TableCell>
                               <TableCell>₹{order.value}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                               <TableCell>{order.created_at}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                  {order.status === 'unclaimed' ? (
                                    <Button 
                                      size="sm" 
                                      variant="default"
                                      onClick={() => openAssignModal(order)}
                                    >
                                      Assign
                                </Button>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleUnassignOrder(order)}
                                    >
                                      Unassign
                                    </Button>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                          ))
                                                 ) : (
                           <TableRow>
                             <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                               No orders found
                             </TableCell>
                           </TableRow>
                         )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="vendors" className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const vendors = getFilteredVendors()
                                if (e.target.checked) {
                                  setSelectedVendors(vendors.map((v) => v.id))
                                } else {
                                  setSelectedVendors([])
                                }
                              }}
                              checked={
                                selectedVendors.length > 0 && selectedVendors.length === getFilteredVendors().length
                              }
                            />
                          </TableHead>
                          <TableHead>Vendor ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total Orders</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredVendors().map((vendor) => (
                          <TableRow key={vendor.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedVendors.includes(vendor.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedVendors([...selectedVendors, vendor.id])
                                  } else {
                                    setSelectedVendors(selectedVendors.filter((id) => id !== vendor.id))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{vendor.id}</TableCell>
                            <TableCell>{vendor.name}</TableCell>
                            <TableCell>{vendor.email}</TableCell>
                            <TableCell>{vendor.phone}</TableCell>
                            <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                            <TableCell>{vendor.totalOrders}</TableCell>
                            <TableCell>{vendor.completedOrders}</TableCell>
                            <TableCell>{vendor.revenue}</TableCell>
                            <TableCell>{vendor.joinedDate}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVendorAction(vendor.id, "View")}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVendorAction(vendor.id, "Edit")}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleVendorAction(vendor.id, "Delete")}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="carrier" className="mt-0">
                  <div className="rounded-md border">
                    {carriersLoading ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading carriers...</p>
                      </div>
                    ) : (
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const carriers = getFilteredCarriers()
                                if (e.target.checked) {
                                  setSelectedCarriers(carriers.map((c) => c.carrier_id))
                                } else {
                                  setSelectedCarriers([])
                                }
                              }}
                              checked={
                                selectedCarriers.length > 0 && selectedCarriers.length === getFilteredCarriers().length
                              }
                            />
                          </TableHead>
                          <TableHead>Carrier ID</TableHead>
                          <TableHead>Carrier Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredCarriers().map((carrier) => (
                          <TableRow key={carrier.carrier_id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedCarriers.includes(carrier.carrier_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCarriers([...selectedCarriers, carrier.carrier_id])
                                  } else {
                                    setSelectedCarriers(selectedCarriers.filter((id) => id !== carrier.carrier_id))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{carrier.carrier_id}</TableCell>
                            <TableCell>{carrier.carrier_name}</TableCell>
                            <TableCell>{getStatusBadge(carrier.status)}</TableCell>
                            <TableCell>{getPriorityNumberBadge(carrier.priority)}</TableCell>
                            <TableCell>{carrier.weight_in_kg ? `${carrier.weight_in_kg}kg` : 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCarrierAction(carrier.carrier_id, "View")}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCarrierAction(carrier.carrier_id, "Edit")}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCarrierAction(carrier.carrier_id, "Delete")}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    )}
                  </div>
                </TabsContent>

                {/* Settlement Management Tab */}
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

                    {/* Settlements Table */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
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
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

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
             <DialogTitle>Assign Order to Vendor</DialogTitle>
             <DialogDescription>
               {selectedOrderForAssignment && 
                 `Assign order ${selectedOrderForAssignment.order_id} to a vendor`
               }
             </DialogDescription>
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
                 <Label htmlFor="vendor-select">Select Vendor</Label>
                 <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Choose a vendor..." />
                   </SelectTrigger>
                   <SelectContent>
                     {vendors.map((vendor) => (
                       <SelectItem key={vendor.warehouse_id} value={vendor.warehouse_id}>
                         {vendor.name} ({vendor.warehouse_id})
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <div className="flex justify-end gap-2">
                 <Button
                   variant="outline"
                   onClick={() => setShowAssignModal(false)}
                 >
                   Cancel
                 </Button>
                 <Button
                   onClick={handleAssignOrder}
                   disabled={!selectedVendorId}
                 >
                   Assign Order
                 </Button>
               </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

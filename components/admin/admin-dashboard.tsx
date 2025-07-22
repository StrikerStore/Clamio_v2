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
const mockOrders = [
  {
    id: "ORD-001",
    customer: "John Doe",
    vendor: "TechStore",
    product: "Wireless Headphones",
    value: "$299.99",
    status: "unclaimed",
    priority: "high",
    sla: "2 days",
    createdAt: "2024-01-15",
    image: "/placeholder.svg?height=60&width=60",
  },
  {
    id: "ORD-002",
    customer: "Jane Smith",
    vendor: "GadgetHub",
    product: "Smart Watch",
    value: "$199.99",
    status: "in_pack",
    priority: "urgent",
    sla: "1 day",
    createdAt: "2024-01-14",
    image: "/placeholder.svg?height=60&width=60",
  },
  {
    id: "ORD-003",
    customer: "Bob Johnson",
    vendor: "TechStore",
    product: "Bluetooth Speaker",
    value: "$89.99",
    status: "handover",
    priority: "medium",
    sla: "3 days",
    createdAt: "2024-01-13",
    image: "/placeholder.svg?height=60&width=60",
  },
  {
    id: "ORD-004",
    customer: "Alice Brown",
    vendor: "ElectroMart",
    product: "Phone Case",
    value: "$29.99",
    status: "delivered",
    priority: "low",
    sla: "2 days",
    createdAt: "2024-01-12",
    image: "/placeholder.svg?height=60&width=60",
  },
  {
    id: "ORD-005",
    customer: "Charlie Wilson",
    vendor: "GadgetHub",
    product: "Tablet Stand",
    value: "$49.99",
    status: "picked",
    priority: "high",
    sla: "1 day",
    createdAt: "2024-01-11",
    image: "/placeholder.svg?height=60&width=60",
  },
]

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
  const [showVendorModal, setShowVendorModal] = useState(false)
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
  const [transactionProof, setTransactionProof] = useState<File | null>(null)

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

  const getStatusBadge = (status: string) => {
    const colors = {
      unclaimed: "bg-gray-100 text-gray-800",
      in_pack: "bg-blue-100 text-blue-800",
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

    return <Badge className={colors[status as keyof typeof colors]}>{status.replace("_", " ").toUpperCase()}</Badge>
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

  const getFilteredOrdersForTab = (tab: string) => {
    const baseOrders = mockOrders

    // Apply search and status filters
    return baseOrders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.product.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const getFilteredVendors = () => {
    return mockVendors.filter((vendor) => {
      const matchesSearch =
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || vendor.status === statusFilter
      return matchesSearch && matchesStatus
    })
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

    toast({
      title: "Bulk Action Completed",
      description: `${action} applied to ${selectedOrders.length} orders`,
    })
    setSelectedOrders([])
  }

  const handleVendorAction = (vendorId: string, action: string) => {
    toast({
      title: "Vendor Action",
      description: `${action} applied to vendor ${vendorId}`,
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
                  <p className="text-2xl font-bold text-gray-900">{mockOrders.length}</p>
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
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Settlements</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {allSettlements.filter((s) => s.status === "pending").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">$23,710</p>
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
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="orders">Orders ({mockOrders.length})</TabsTrigger>
                  <TabsTrigger value="vendors">Vendors ({mockVendors.length})</TabsTrigger>
                  <TabsTrigger value="settlement-management">Settlement Management</TabsTrigger>
                </TabsList>

                {/* Filters - Only show for orders and vendors tabs */}
                {(activeTab === "orders" || activeTab === "vendors") && (
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
                            <SelectItem value="in_pack">In Pack</SelectItem>
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
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tab-specific Actions */}
                {activeTab === "orders" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Bulk Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleBulkOrderAction("Export")}
                          disabled={selectedOrders.length === 0}
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export Selected ({selectedOrders.length})
                        </Button>
                        <Button
                          onClick={() => handleBulkOrderAction("Update Status")}
                          disabled={selectedOrders.length === 0}
                        >
                          Update Status ({selectedOrders.length})
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                                  setSelectedOrders(orders.map((o) => o.id))
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
                          <TableHead>Priority</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredOrdersForTab("orders").map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedOrders.includes(order.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrders([...selectedOrders, order.id])
                                  } else {
                                    setSelectedOrders(selectedOrders.filter((id) => id !== order.id))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <img
                                src={order.image || "/placeholder.svg"}
                                alt={order.product}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{order.id}</TableCell>
                            <TableCell>{order.customer}</TableCell>
                            <TableCell>{order.vendor}</TableCell>
                            <TableCell>{order.product}</TableCell>
                            <TableCell>{order.value}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                            <TableCell>{order.createdAt}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
    </div>
  )
}

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
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"

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
                    {mockSettlements.filter((s) => s.status === "pending").length}
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
                  <TabsTrigger value="settlements">Settlements ({mockSettlements.length})</TabsTrigger>
                </TabsList>

                {/* Filters */}
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
                      {activeTab === "settlements" && (
                        <>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

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

                <TabsContent value="settlements" className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead>Settlement ID</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Request Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>UPI ID</TableHead>
                          <TableHead>Orders</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredSettlements().map((settlement) => (
                          <TableRow key={settlement.id}>
                            <TableCell className="font-medium">{settlement.id}</TableCell>
                            <TableCell>{settlement.vendor}</TableCell>
                            <TableCell>{settlement.amount}</TableCell>
                            <TableCell>{settlement.requestDate}</TableCell>
                            <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                            <TableCell>{settlement.upiId}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{settlement.orders.length} orders</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedSettlement(settlement)
                                    setShowSettlementModal(true)
                                  }}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                {settlement.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedSettlement(settlement)
                                        setSettlementAction("approve")
                                        setShowSettlementModal(true)
                                      }}
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        setSelectedSettlement(settlement)
                                        setSettlementAction("reject")
                                        setShowSettlementModal(true)
                                      }}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
    </div>
  )
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  BinaryIcon,
  Package,
  Clock,
  CheckCircle,
  LogOut,
  Search,
  Filter,
  Download,
  DollarSign,
  Eye,
  IndianRupee,
  CreditCard,
  History,
  FileText,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiClient } from "@/lib/api"

// Mock data - Version 4
const mockOrders = [
  {
    id: "ORD-001",
    customer: "John Doe",
    product: "Wireless Headphones",
    value: "$299.99",
    status: "unclaimed",
    sla: "2 days",
    priority: "high",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 1,
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "ORD-002",
    customer: "Jane Smith",
    product: "Smart Watch",
    value: "$199.99",
    status: "unclaimed",
    sla: "1 day",
    priority: "urgent",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 2,
    lastUpdated: new Date(Date.now() - 10 * 60 * 60 * 1000),
  },
  {
    id: "ORD-003",
    customer: "Bob Johnson",
    product: "Bluetooth Speaker",
    value: "$89.99",
    status: "in_pack",
    sla: "3 days",
    priority: "medium",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 1,
    lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "ORD-004",
    customer: "Alice Brown",
    product: "Phone Case",
    value: "$29.99",
    status: "handover",
    sla: "2 days",
    priority: "low",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 0,
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    handoverDate: "2024-01-15",
    pickupDate: "2024-01-16",
  },
  {
    id: "ORD-005",
    customer: "Charlie Wilson",
    product: "Tablet Stand",
    value: "$49.99",
    status: "in_pack",
    sla: "1 day",
    priority: "high",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 0,
    lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: "ORD-006",
    customer: "David Lee",
    product: "Gaming Mouse",
    value: "$79.99",
    status: "handover",
    sla: "2 days",
    priority: "medium",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 1,
    lastUpdated: new Date(Date.now() - 8 * 60 * 60 * 1000),
    handoverDate: "2024-01-14",
    pickupDate: "2024-01-15",
  },
  {
    id: "ORD-007",
    customer: "Emma Davis",
    product: "USB Cable",
    value: "$19.99",
    status: "unclaimed",
    sla: "3 days",
    priority: "low",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 0,
    lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: "ORD-008",
    customer: "Frank Miller",
    product: "Laptop Charger",
    value: "$59.99",
    status: "in_pack",
    sla: "1 day",
    priority: "urgent",
    image: "/placeholder.svg?height=60&width=60",
    daysOld: 1,
    lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
]

export function VendorDashboard() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("all-orders")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [labelFormat, setLabelFormat] = useState("thermal")
  const [selectedOrdersForDownload, setSelectedOrdersForDownload] = useState<string[]>([])
  const [upiId, setUpiId] = useState("")
  const [selectedMyOrders, setSelectedMyOrders] = useState<string[]>([])
  const [selectedUnclaimedOrders, setSelectedUnclaimedOrders] = useState<string[]>([])
  const [vendorAddress, setVendorAddress] = useState<null | {
    warehouseId: string
    address: string
    city: string
    pincode: string
  }>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState("")

  // Settlement-related state
  const [payments, setPayments] = useState<{ currentPayment: number; futurePayment: number } | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [settlementLoading, setSettlementLoading] = useState(false)
  const [settlements, setSettlements] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)
  const [showProofDialog, setShowProofDialog] = useState(false)
  const [selectedSettlementForView, setSelectedSettlementForView] = useState<any>(null)
  const [showViewRequestDialog, setShowViewRequestDialog] = useState(false)

  useEffect(() => {
    async function fetchAddress() {
      console.log("fetchAddress: Starting address fetch...");
      console.log("fetchAddress: User object:", user);
      console.log("fetchAddress: User role:", user?.role);
      
      setAddressLoading(true);
      setAddressError("");
      try {
        if (user?.role !== "vendor") {
          console.log("fetchAddress: User is not a vendor, throwing error");
          throw new Error("User is not a vendor");
        }
        console.log("fetchAddress: User is a vendor, proceeding with API call");
        const response = await apiClient.getVendorAddress();
        console.log("fetchAddress: API response received:", response);
        if (response.success) {
          console.log("fetchAddress: Setting vendor address:", response.data);
          setVendorAddress(response.data);
        } else {
          console.log("fetchAddress: API call failed:", response.message);
          setAddressError(response.message || "Failed to fetch address");
        }
      } catch (err) {
        console.error("fetchAddress: Error occurred:", err); // More detailed logging
        setAddressError(err instanceof Error ? err.message : "Failed to fetch address");
      } finally {
        console.log("fetchAddress: Setting loading to false");
        setAddressLoading(false);
      }
    }

    async function fetchPayments() {
      setPaymentsLoading(true);
      try {
        const response = await apiClient.getVendorPayments();
        if (response.success) {
          setPayments(response.data);
        }
      } catch (err) {
        console.error("Error fetching payments:", err);
      } finally {
        setPaymentsLoading(false);
      }
    }

    async function fetchSettlements() {
      try {
        const response = await apiClient.getVendorSettlements();
        if (response.success) {
          setSettlements(response.data);
        }
      } catch (err) {
        console.error("Error fetching settlements:", err);
      }
    }

    async function fetchTransactions() {
      try {
        const response = await apiClient.getVendorTransactions();
        if (response.success) {
          setTransactions(response.data);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
      }
    }
    
    console.log("useEffect: User object:", user);
    console.log("useEffect: User role:", user?.role);
    if (user?.role === "vendor") {
      console.log("useEffect: User is vendor, calling fetch functions");
      fetchAddress();
      fetchPayments();
      fetchSettlements();
      fetchTransactions();
    } else {
      console.log("useEffect: User is not a vendor, skipping fetch functions");
    }
  }, [user])

  const handleClaimOrder = (orderId: string) => {
    toast({
      title: "Order Claimed",
      description: `Successfully claimed order ${orderId}`,
    })
  }

  const handleMarkReady = (orderId: string) => {
    toast({
      title: "Order Marked Ready",
      description: `Order ${orderId} is now ready for handover`,
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleConfirmHandover = (orderId: string) => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please upload a shipping label first",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Handover Confirmed",
      description: `Order ${orderId} handover confirmed with shipping label`,
    })
    setSelectedFile(null)
  }

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
    }

    const displayNames = {
      unclaimed: "UNCLAIMED",
      in_pack: "IN PACK",
      handover: "HANDOVER",
      picked: "PICKED",
      in_transit: "IN TRANSIT",
      out_for_delivery: "OUT FOR DELIVERY",
      delivered: "DELIVERED",
      rto: "RTO",
    }

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {displayNames[status as keyof typeof displayNames] || status.toUpperCase()}
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

  // Filter orders based on active tab and search/status filters
  const getFilteredOrdersForTab = (tab: string) => {
    let baseOrders = mockOrders

    // Filter by tab first
    switch (tab) {
      case "all-orders":
        baseOrders = mockOrders.filter((order) => order.status === "unclaimed")
        break
      case "my-orders":
        baseOrders = mockOrders.filter((order) => order.status === "in_pack")
        break
      case "handover":
        baseOrders = mockOrders.filter((order) => order.status === "handover")
        break
      default:
        baseOrders = mockOrders
    }

    // Then apply search and status filters
    return baseOrders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.product.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const handleClaimRevenue = async () => {
    if (!upiId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid UPI ID",
        variant: "destructive",
      });
      return;
    }

    setSettlementLoading(true);
    try {
      const response = await apiClient.createSettlementRequest(upiId.trim());
      if (response.success) {
        toast({
          title: "Settlement Request Created",
          description: "Your settlement request has been submitted to admin",
        });
        setUpiId("");
        setShowRevenueModal(false);
        // Refresh settlements
        const settlementsResponse = await apiClient.getVendorSettlements();
        if (settlementsResponse.success) {
          setSettlements(settlementsResponse.data);
        }
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to create settlement request",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create settlement request",
        variant: "destructive",
      });
    } finally {
      setSettlementLoading(false);
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

  const handleViewRequest = (settlement: any) => {
    setSelectedSettlementForView(settlement);
    setShowViewRequestDialog(true);
  };

  const handleRequestReverse = (orderId: string) => {
    toast({
      title: "Reverse Requested",
      description: `Order ${orderId} has been moved back to available orders`,
    })
  }

  const handleDownloadLabel = (orderId: string, format: string) => {
    toast({
      title: "Label Downloaded",
      description: `${format} label for order ${orderId} downloaded successfully`,
    })
  }

  const handleBulkDownloadLabels = (tab: string) => {
    let selectedOrders
    if (tab === "my-orders") {
      selectedOrders = selectedMyOrders
    } else {
      selectedOrders = selectedOrdersForDownload
    }

    if (selectedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to download labels",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Bulk Download Started",
      description: `Downloading ${labelFormat} labels for ${selectedOrders.length} orders`,
    })

    if (tab === "my-orders") {
      setSelectedMyOrders([])
    } else {
      setSelectedOrdersForDownload([])
    }
  }

  const handleBulkClaimOrders = () => {
    if (selectedUnclaimedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to claim",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Orders Claimed",
      description: `Successfully claimed ${selectedUnclaimedOrders.length} orders`,
    })
    setSelectedUnclaimedOrders([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Single Row Layout */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-4">
            {/* Dashboard Name and Welcome */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <BinaryIcon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 truncate">Vendor Dashboard v4</h1>
                <p className="text-sm text-gray-500 truncate">
                  Welcome back, {user?.name} ({user?.role})
                </p>
              </div>
            </div>
            {/* Vendor Address */}
            <div className="flex-1 flex flex-col items-end min-w-0">
              {addressLoading ? (
                <span className="text-xs text-gray-400">Loading address...</span>
              ) : addressError ? (
                <span className="text-xs text-red-500">{addressError}</span>
              ) : vendorAddress ? (
                <div className="text-right truncate">
                  <div className="text-xs text-gray-900 font-semibold truncate">Vendor ID: <span className="font-mono">{vendorAddress.warehouseId}</span></div>
                  <div className="text-xs text-gray-700 truncate">{vendorAddress.address}</div>
                  <div className="text-xs text-gray-700 truncate">{vendorAddress.city}</div>
                  <div className="text-xs text-gray-700 truncate">Pincode: {vendorAddress.pincode}</div>
                </div>
              ) : null}
            </div>
            {/* Logout Button */}
            <div className="flex-shrink-0">
              <Button variant="outline" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
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
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unclaimed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mockOrders.filter((o) => o.status === "unclaimed").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">My Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mockOrders.filter((o) => o.status === "in_pack").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowRevenueModal(true)}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <IndianRupee className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Revenue (Click to Claim)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {paymentsLoading ? "Loading..." : payments ? `₹${payments.currentPayment.toFixed(2)}` : "₹0.00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Order Management</CardTitle>
            <CardDescription>Manage your Shopify orders across different stages</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Fixed Controls Section */}
              <div className="sticky top-20 bg-white z-40 pb-4 border-b mb-4">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="all-orders">
                    All Orders ({mockOrders.filter((o) => o.status === "unclaimed").length})
                  </TabsTrigger>
                  <TabsTrigger value="my-orders">
                    My Orders ({mockOrders.filter((o) => o.status === "in_pack").length})
                  </TabsTrigger>
                  <TabsTrigger value="handover">
                    Handover ({mockOrders.filter((o) => o.status === "handover").length})
                  </TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search orders..."
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
                      <SelectItem value="unclaimed">Unclaimed</SelectItem>
                      <SelectItem value="in_pack">In Pack</SelectItem>
                      <SelectItem value="handover">Handover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tab-specific Bulk Actions */}
                {activeTab === "all-orders" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Bulk Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => handleBulkClaimOrders()} disabled={selectedUnclaimedOrders.length === 0}>
                        <Package className="w-4 h-4 mr-2" />
                        Claim Selected ({selectedUnclaimedOrders.length})
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "my-orders" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Bulk Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1">
                          <Label>Label Format</Label>
                          <Select value={labelFormat} onValueChange={setLabelFormat}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="thermal">Thermal (4x6)</SelectItem>
                              <SelectItem value="a4">A4 Format</SelectItem>
                              <SelectItem value="four-in-one">Four in One</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => handleBulkDownloadLabels("my-orders")}
                          disabled={selectedMyOrders.length === 0}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Selected ({selectedMyOrders.length})
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "handover" && null}
              </div>

              {/* Scrollable Content Section */}
              <div className="max-h-[600px] overflow-y-auto">
                <TabsContent value="all-orders" className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const unclaimedOrders = getFilteredOrdersForTab("all-orders")
                                if (e.target.checked) {
                                  setSelectedUnclaimedOrders(unclaimedOrders.map((o) => o.id))
                                } else {
                                  setSelectedUnclaimedOrders([])
                                }
                              }}
                              checked={
                                selectedUnclaimedOrders.length > 0 &&
                                selectedUnclaimedOrders.length === getFilteredOrdersForTab("all-orders").length
                              }
                            />
                          </TableHead>
                          <TableHead>Image</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>SLA</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredOrdersForTab("all-orders").map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedUnclaimedOrders.includes(order.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUnclaimedOrders([...selectedUnclaimedOrders, order.id])
                                  } else {
                                    setSelectedUnclaimedOrders(selectedUnclaimedOrders.filter((id) => id !== order.id))
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
                            <TableCell>{order.product}</TableCell>
                            <TableCell>{order.value}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                            <TableCell>{order.sla}</TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => handleClaimOrder(order.id)}>
                                Claim
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="my-orders" className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const myOrders = getFilteredOrdersForTab("my-orders")
                                if (e.target.checked) {
                                  setSelectedMyOrders(myOrders.map((o) => o.id))
                                } else {
                                  setSelectedMyOrders([])
                                }
                              }}
                              checked={
                                selectedMyOrders.length > 0 &&
                                selectedMyOrders.length === getFilteredOrdersForTab("my-orders").length
                              }
                            />
                          </TableHead>
                          <TableHead>Image</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>SLA</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredOrdersForTab("my-orders").map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedMyOrders.includes(order.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMyOrders([...selectedMyOrders, order.id])
                                  } else {
                                    setSelectedMyOrders(selectedMyOrders.filter((id) => id !== order.id))
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
                            <TableCell>{order.product}</TableCell>
                            <TableCell>{order.value}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                            <TableCell>{order.sla}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadLabel(order.id, "single")}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Label
                                </Button>
                                <Button size="sm" onClick={() => handleMarkReady(order.id)}>
                                  Ready
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleRequestReverse(order.id)}>
                                  Reverse
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="handover" className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead>Image</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Handover Date</TableHead>
                          <TableHead>Pickup Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredOrdersForTab("handover").map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <img
                                src={order.image || "/placeholder.svg"}
                                alt={order.product}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{order.id}</TableCell>
                            <TableCell>{order.customer}</TableCell>
                            <TableCell>{order.product}</TableCell>
                            <TableCell>{order.value}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                            <TableCell>{order.handoverDate || "N/A"}</TableCell>
                            <TableCell>{order.pickupDate || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">Ready for Pickup</Badge>
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

      <Dialog open={showRevenueModal} onOpenChange={setShowRevenueModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revenue Management</DialogTitle>
            <DialogDescription>Claim your revenue and view settlement history</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Payment Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-green-600">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Current Payment (Eligible)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {paymentsLoading ? "Loading..." : payments ? `₹${payments.currentPayment.toFixed(2)}` : "₹0.00"}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">From handover orders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-600">
                    <Clock className="w-5 h-5 mr-2" />
                    Future Payment (Pending)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {paymentsLoading ? "Loading..." : payments ? `₹${payments.futurePayment.toFixed(2)}` : "₹0.00"}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">From packed orders</p>
                </CardContent>
              </Card>
            </div>

            {/* Settlement Request */}
            <Card>
              <CardHeader>
                <CardTitle>Request Settlement</CardTitle>
                <CardDescription>Only current payment amount is eligible for settlement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="upi-id">UPI ID for Settlement</Label>
                  <Input
                    id="upi-id"
                    placeholder="Enter your UPI ID (e.g., user@paytm)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleClaimRevenue} 
                  className="w-full" 
                  disabled={!upiId.trim() || settlementLoading || !payments || payments.currentPayment <= 0}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  {settlementLoading ? "Processing..." : `Request Settlement (₹${payments ? payments.currentPayment.toFixed(2) : '0.00'})`}
                </Button>
              </CardContent>
            </Card>

            {/* Settlement History */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Settlement History</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                  >
                    <History className="w-4 h-4 mr-2" />
                    {showTransactionHistory ? "Hide Transactions" : "Show Transactions"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {settlements.length > 0 ? (
                    settlements.map((settlement: any) => (
                      <div key={settlement.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">₹{settlement.amount}</p>
                            {settlement.status === "approved" && (
                              <Badge 
                                variant="secondary"
                                className={
                                  settlement.amountPaid && parseFloat(settlement.amountPaid) === parseFloat(settlement.amount)
                                    ? "bg-green-100 text-green-800"
                                    : "bg-orange-100 text-orange-800"
                                }
                              >
                                {settlement.amountPaid && parseFloat(settlement.amountPaid) === parseFloat(settlement.amount) ? "Full" : "Partial"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(settlement.createdAt).toLocaleDateString('en-IN')}
                          </p>
                          {settlement.status === "approved" && settlement.amountPaid && (
                            <p className="text-sm text-green-600">Settled: ₹{settlement.amountPaid}</p>
                          )}
                          {settlement.rejectionReason && (
                            <p className="text-xs text-red-600">Reason: {settlement.rejectionReason}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
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
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewRequest(settlement)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Request
                          </Button>
                          {settlement.paymentProofPath && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleViewProof(settlement.paymentProofPath)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View Proof
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No settlement requests yet</p>
                  )}
                </div>

                {/* Transaction History */}
                {showTransactionHistory && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-medium mb-3">Transaction History</h4>
                    <div className="space-y-2">
                      {transactions.length > 0 ? (
                        transactions.map((transaction: any) => (
                          <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-green-600">₹{transaction.amount}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(transaction.createdAt).toLocaleDateString('en-IN')}
                              </p>
                              <p className="text-xs text-blue-600">TXN: {transaction.transactionId}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className="bg-green-100 text-green-800">
                                {transaction.status.toUpperCase()}
                              </Badge>
                              {transaction.paymentProofPath && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleViewProof(transaction.paymentProofPath)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Proof
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-4">No completed transactions yet</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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

      {/* View Settlement Request Dialog */}
      <Dialog open={showViewRequestDialog} onOpenChange={setShowViewRequestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Settlement Request Details</DialogTitle>
            <DialogDescription>Complete details of the settlement request</DialogDescription>
          </DialogHeader>
          
          {selectedSettlementForView && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Settlement ID</Label>
                  <p className="font-mono">{selectedSettlementForView.id}</p>
                </div>
                <div>
                  <Label className="font-semibold">Amount (₹)</Label>
                  <p className="text-xl font-bold text-green-600">₹{selectedSettlementForView.amount}</p>
                </div>
                <div>
                  <Label className="font-semibold">Request Date</Label>
                  <p>{new Date(selectedSettlementForView.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <Label className="font-semibold">Status</Label>
                  <Badge
                    className={
                      selectedSettlementForView.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : selectedSettlementForView.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {selectedSettlementForView.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <Label className="font-semibold">UPI ID</Label>
                  <p className="font-mono">{selectedSettlementForView.upiId}</p>
                </div>
                <div>
                  <Label className="font-semibold">Number of Orders</Label>
                  <p>{selectedSettlementForView.numberOfOrders}</p>
                </div>
                {selectedSettlementForView.status === "approved" && (
                  <>
                    <div>
                      <Label className="font-semibold">Payment Status</Label>
                      <Badge 
                        className={
                          selectedSettlementForView.amountPaid && parseFloat(selectedSettlementForView.amountPaid) === parseFloat(selectedSettlementForView.amount)
                            ? "bg-green-100 text-green-800"
                            : "bg-orange-100 text-orange-800"
                        }
                      >
                        {selectedSettlementForView.amountPaid && parseFloat(selectedSettlementForView.amountPaid) === parseFloat(selectedSettlementForView.amount) ? "Fully Settled" : "Partially Settled"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="font-semibold">Paid Amount</Label>
                      <p className="text-xl font-bold text-green-600">₹{selectedSettlementForView.amountPaid}</p>
                    </div>
                    <div>
                      <Label className="font-semibold">Transaction ID</Label>
                      <p className="font-mono">{selectedSettlementForView.transactionId}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Order IDs */}
              <div>
                <Label className="font-semibold">Order IDs</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSettlementForView.orderIds && selectedSettlementForView.orderIds.split(',').map((orderId: string) => (
                    <Badge key={orderId.trim()} variant="outline">
                      {orderId.trim()}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedSettlementForView.rejectionReason && (
                <div>
                  <Label className="font-semibold">Rejection Reason</Label>
                  <p className="text-red-600 bg-red-50 p-3 rounded-lg">{selectedSettlementForView.rejectionReason}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowViewRequestDialog(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

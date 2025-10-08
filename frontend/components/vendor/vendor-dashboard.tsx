"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  Calendar,
  Settings,
  RefreshCw,
  Menu,
  X,
  ChevronUp,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { useDeviceType } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { apiClient } from "@/lib/api"

// Mock data - Version 4
// const mockOrders = [
//   {
//     id: "ORD-001",
//     customer: "John Doe",
//     product: "Wireless Headphones",
//     value: "$299.99",
//     status: "unclaimed",
//     sla: "2 days",
//     priority: "high",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 1,
//     lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
//   },
//   {
//     id: "ORD-002",
//     customer: "Jane Smith",
//     product: "Smart Watch",
//     value: "$199.99",
//     status: "unclaimed",
//     sla: "1 day",
//     priority: "urgent",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 2,
//     lastUpdated: new Date(Date.now() - 10 * 60 * 60 * 1000),
//   },
//   {
//     id: "ORD-003",
//     customer: "Bob Johnson",
//     product: "Bluetooth Speaker",
//     value: "$89.99",
//     status: "in_pack",
//     sla: "3 days",
//     priority: "medium",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 1,
//     lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000),
//   },
//   {
//     id: "ORD-004",
//     customer: "Alice Brown",
//     product: "Phone Case",
//     value: "$29.99",
//     status: "handover",
//     sla: "2 days",
//     priority: "low",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 0,
//     lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
//     handoverDate: "2024-01-15",
//     pickupDate: "2024-01-16",
//   },
//   {
//     id: "ORD-005",
//     customer: "Charlie Wilson",
//     product: "Tablet Stand",
//     value: "$49.99",
//     status: "in_pack",
//     sla: "1 day",
//     priority: "high",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 0,
//     lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000),
//   },
//   {
//     id: "ORD-006",
//     customer: "David Lee",
//     product: "Gaming Mouse",
//     value: "$79.99",
//     status: "handover",
//     sla: "2 days",
//     priority: "medium",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 1,
//     lastUpdated: new Date(Date.now() - 8 * 60 * 60 * 1000),
//     handoverDate: "2024-01-14",
//     pickupDate: "2024-01-15",
//   },
//   {
//     id: "ORD-007",
//     customer: "Emma Davis",
//     product: "USB Cable",
//     value: "$19.99",
//     status: "unclaimed",
//     sla: "3 days",
//     priority: "low",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 0,
//     lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000),
//   },
//   {
//     id: "ORD-008",
//     customer: "Frank Miller",
//     product: "Laptop Charger",
//     value: "$59.99",
//     status: "in_pack",
//     sla: "1 day",
//     priority: "urgent",
//     image: "/placeholder.svg?height=60&width=60",
//     daysOld: 1,
//     lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000),
//   },
// ]

export function VendorDashboard() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const { isMobile, isTablet, isDesktop, deviceType } = useDeviceType()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all-orders")
  
  // Separate filters for each tab
  const [tabFilters, setTabFilters] = useState({
    "all-orders": {
      searchTerm: "",
      dateFrom: undefined as Date | undefined,
      dateTo: undefined as Date | undefined,
    },
    "my-orders": {
      searchTerm: "",
      dateFrom: undefined as Date | undefined,
      dateTo: undefined as Date | undefined,
    },
    "handover": {
      searchTerm: "",
      dateFrom: undefined as Date | undefined,
      dateTo: undefined as Date | undefined,
    },
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [labelFormat, setLabelFormat] = useState("thermal")
  const [selectedOrdersForDownload, setSelectedOrdersForDownload] = useState<string[]>([])
  const [upiId, setUpiId] = useState("")
  const [selectedMyOrders, setSelectedMyOrders] = useState<string[]>([])
  const [selectedUnclaimedOrders, setSelectedUnclaimedOrders] = useState<string[]>([])
  const [bulkMarkReadyLoading, setBulkMarkReadyLoading] = useState(false)
  const [vendorAddress, setVendorAddress] = useState<null | {
    warehouseId: string
    address: string
    city: string
    pincode: string
  }>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState("")
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);

  // Ref for scrollable content area
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  // Grouped orders for My Orders tab
  const [groupedOrders, setGroupedOrders] = useState<any[]>([]);
  const [groupedOrdersLoading, setGroupedOrdersLoading] = useState(true);
  const [groupedOrdersError, setGroupedOrdersError] = useState("");

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
  const [selectedImageProduct, setSelectedImageProduct] = useState<{url: string, title: string} | null>(null)
  
  // Loading states for label downloads
  const [labelDownloadLoading, setLabelDownloadLoading] = useState<{[key: string]: boolean}>({})
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false)
  
  // Loading states for reverse operations
  const [reverseLoading, setReverseLoading] = useState<{[key: string]: boolean}>({})

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

  // Reusable function to refresh orders data
  const refreshOrders = async () => {
    try {
      console.log('🔄 Refreshing orders data...');
      const response = await apiClient.getOrders();
      if (response.success && response.data && Array.isArray(response.data.orders)) {
        console.log('📊 Raw orders data:', response.data.orders.length, 'orders');
        // Check for duplicates in raw data
        const uniqueIds = new Set<string>();
        const duplicates: Array<{index: number, unique_id: string, order: any}> = [];
        response.data.orders.forEach((order: any, index: number) => {
          if (uniqueIds.has(order.unique_id)) {
            duplicates.push({ index, unique_id: order.unique_id, order });
          } else {
            uniqueIds.add(order.unique_id);
          }
        });
        if (duplicates.length > 0) {
          console.warn('🚨 Duplicate unique_ids found in raw API data:', duplicates);
        }
        
        // Filter out duplicates and ensure uniqueness
        const uniqueOrders = response.data.orders.filter((order: any, index: number, self: any[]) => 
          index === self.findIndex((o: any) => o.unique_id === order.unique_id)
        );
        
        setOrders(uniqueOrders);
        console.log('✅ Orders refreshed successfully');
      } else if (response.success && response.data && response.data.orders) {
        setOrders([response.data.orders]);
        console.log('✅ Orders refreshed successfully');
      } else {
        setOrders([]);
        setOrdersError("No orders found");
      }

      // Also refresh grouped orders for My Orders tab
      console.log('🔄 Refreshing grouped orders data...');
      const groupedResponse = await apiClient.getGroupedOrders();
      if (groupedResponse.success && groupedResponse.data && Array.isArray(groupedResponse.data.groupedOrders)) {
        setGroupedOrders(groupedResponse.data.groupedOrders);
        console.log('✅ Grouped orders refreshed successfully');
      } else {
        console.log('⚠️ Failed to refresh grouped orders');
      }
    } catch (err: any) {
      console.error("Error refreshing orders:", err);
      setOrdersError(err.message || "Failed to refresh orders");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const response = await apiClient.getOrders();
      if (response.success && response.data && Array.isArray(response.data.orders)) {
        setOrders(response.data.orders);
      } else if (response.success && response.data && response.data.orders) {
        setOrders([response.data.orders]);
      } else {
        setOrders([]);
        setOrdersError("No orders found");
      }
      
      // Get initial last updated timestamp
      const lastUpdatedResponse = await apiClient.getOrdersLastUpdated();
      if (lastUpdatedResponse.success && lastUpdatedResponse.data) {
        setLastUpdated(lastUpdatedResponse.data.lastUpdated);
      }
    } catch (err: any) {
      setOrdersError(err.message || "Failed to fetch orders");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  const fetchGroupedOrders = async () => {
    setGroupedOrdersLoading(true);
    setGroupedOrdersError("");
    try {
      const response = await apiClient.getGroupedOrders();
      if (response.success && response.data && Array.isArray(response.data.groupedOrders)) {
        setGroupedOrders(response.data.groupedOrders);
      } else {
        setGroupedOrders([]);
        setGroupedOrdersError("No grouped orders found");
      }
    } catch (err: any) {
      setGroupedOrdersError(err.message || "Failed to fetch grouped orders");
      setGroupedOrders([]);
    } finally {
      setGroupedOrdersLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchGroupedOrders();
  }, []);

  // Real-time polling for order updates
  useEffect(() => {
    if (!user?.role || user.role !== "vendor") return;

    const pollForUpdates = async () => {
      try {
        const response = await apiClient.getOrdersLastUpdated();
        if (response.success && response.data && response.data.lastUpdated !== lastUpdated && lastUpdated !== null) {
          console.log('🔄 Orders updated by another vendor, refreshing...');
          
          // Refresh orders
          const ordersResponse = await apiClient.getOrders();
          if (ordersResponse.success && ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
            setOrders(ordersResponse.data.orders);
            console.log('✅ FRONTEND: Orders refreshed due to external update');
          }
          
          setLastUpdated(response.data.lastUpdated);
        } else if (response.success && response.data && lastUpdated === null) {
          setLastUpdated(response.data.lastUpdated);
        }
      } catch (error) {
        console.error('Error polling for updates:', error);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollForUpdates, 5000);
    
    return () => clearInterval(interval);
  }, [user, lastUpdated]);

  const handleClaimOrder = async (unique_id: string) => {
    console.log('🔵 FRONTEND: Starting claim process');
    console.log('  - unique_id:', unique_id);
    console.log('  - vendorToken from localStorage:', localStorage.getItem('vendorToken')?.substring(0, 8) + '...');
    
    try {
      console.log('📤 FRONTEND: Calling apiClient.claimOrder...');
      const response = await apiClient.claimOrder(unique_id);
      
      console.log('📥 FRONTEND: Response received');
      console.log('  - success:', response.success);
      console.log('  - message:', response.message);
      console.log('  - data:', response.data);
      
      if (response.success && response.data) {
        console.log('✅ FRONTEND: Claim successful, updating UI');
        
        // Update the order in the orders array with the new data
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.unique_id === unique_id ? { ...order, ...response.data } : order
          )
        );
        
        // Show success message with order_id
        const claimedOrderId = response.data.order_id || unique_id;
        toast({
          title: 'Order Claimed',
          description: `Claimed order id ${claimedOrderId}`,
        });
        
                // Refresh orders to ensure tabs are updated correctly
        console.log('🔄 FRONTEND: Refreshing orders to update tab filtering...');
        try {
          await refreshOrders();
          console.log('✅ FRONTEND: Orders and grouped orders refreshed successfully');
        } catch (refreshError) {
          console.log('⚠️ FRONTEND: Failed to refresh orders, but claim was successful');
        }
        
      } else {
        console.log('❌ FRONTEND: Claim failed');
        console.log('  - Error message:', response.message);
        toast({
          title: 'Claim Failed',
          description: response.message || 'Could not claim order',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.log('💥 FRONTEND: Exception occurred');
      console.log('  - Error:', err);
      console.log('  - Error message:', err.message);
      console.log('  - Error stack:', err.stack);
      
      toast({
        title: 'Claim Failed',
        description: err.message || 'Network error occurred',
        variant: 'destructive',
      });
    }
  }

  const handleMarkReady = async (orderId: string) => {
    try {
      const vendorToken = localStorage.getItem('vendorToken');
      if (!vendorToken) {
        toast({
          title: "Authentication Error",
          description: "Vendor token not found. Please login again.",
          variant: "destructive",
        });
        return;
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/orders/mark-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': vendorToken,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Order Marked Ready",
          description: `Order ${orderId} is now ready for handover`,
        });
        // Refresh orders to show updated status
        fetchGroupedOrders();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to mark order as ready",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error marking order as ready:', error);
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  }

  const handleBulkMarkReady = async () => {
    if (selectedMyOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to mark as ready",
        variant: "destructive",
      });
      return;
    }

    const vendorToken = localStorage.getItem('vendorToken');
    if (!vendorToken) {
      toast({
        title: "Authentication Error",
        description: "Vendor token not found. Please login again.",
        variant: "destructive",
      });
      return;
    }

    setBulkMarkReadyLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/orders/bulk-mark-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': vendorToken,
        },
        body: JSON.stringify({ order_ids: selectedMyOrders }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Orders Marked Ready",
          description: `Successfully marked ${data.data.total_successful} out of ${data.data.total_requested} orders as ready for handover`,
        });
        
        // Show details if some orders failed
        if (data.data.total_failed > 0) {
          toast({
            title: "Some Orders Failed",
            description: `${data.data.total_failed} orders could not be marked as ready. Check console for details.`,
            variant: "destructive",
          });
          console.log('Failed orders:', data.data.failed_orders);
        }
        
        // Clear selection and refresh orders
        setSelectedMyOrders([]);
        fetchGroupedOrders();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to mark orders as ready",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error marking orders as ready:', error);
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setBulkMarkReadyLoading(false);
    }
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

    return <Badge className={colors[priority as keyof typeof colors] || colors.low}>{priority?.toUpperCase() || 'N/A'}</Badge>
  }

  // Helper functions to get current tab's filters
  const getCurrentTabFilters = () => tabFilters[activeTab as keyof typeof tabFilters];
  
  const updateCurrentTabFilter = (filterName: string, value: any) => {
    setTabFilters(prev => {
      const currentTabFilters = prev[activeTab as keyof typeof prev];
      let updatedFilters = { ...currentTabFilters, [filterName]: value };
      
      // Date validation logic
      if (filterName === 'dateFrom' && value) {
        // If setting from date and to date exists, ensure from date is not after to date
        if (currentTabFilters.dateTo && new Date(value) > new Date(currentTabFilters.dateTo)) {
          // Clear to date if from date is after it
          updatedFilters.dateTo = undefined;
          // Defer toast to avoid render cycle issue
          setTimeout(() => {
            toast({
              title: "Date Range Adjusted",
              description: "To date was cleared because it was before the selected from date",
              variant: "default",
            });
          }, 0);
        }
      } else if (filterName === 'dateTo' && value) {
        // If setting to date and from date exists, ensure to date is not before from date
        if (currentTabFilters.dateFrom && new Date(value) < new Date(currentTabFilters.dateFrom)) {
          // Clear from date if to date is before it
          updatedFilters.dateFrom = undefined;
          // Defer toast to avoid render cycle issue
          setTimeout(() => {
            toast({
              title: "Date Range Adjusted", 
              description: "From date was cleared because it was after the selected to date",
              variant: "default",
            });
          }, 0);
        }
      }
      
      return {
        ...prev,
        [activeTab]: updatedFilters
      };
    });
  };

  // Helper function to ensure unique orders and log duplicates
  const ensureUniqueOrders = (orders: any[], keyField: string = 'unique_id') => {
    const seen = new Set();
    const uniqueOrders = [];
    const duplicates = [];
    
    for (const order of orders) {
      const key = order[keyField];
      if (seen.has(key)) {
        duplicates.push({ key, order });
        console.warn(`Duplicate ${keyField} found:`, key, order);
      } else {
        seen.add(key);
        uniqueOrders.push(order);
      }
    }
    
    if (duplicates.length > 0) {
      console.warn(`Found ${duplicates.length} duplicate orders with ${keyField}:`, duplicates);
    }
    
    return uniqueOrders;
  };

  // Filter orders based on active tab and search/date filters
  const getFilteredOrdersForTab = (tab: string) => {
    if (tab === "my-orders") {
      return getFilteredGroupedOrdersForTab(tab);
    }
    
    let baseOrders = orders;
    const tabFilter = tabFilters[tab as keyof typeof tabFilters];
    
    // Get current vendor's warehouseId
    const currentVendorId = user?.warehouseId;
    
    switch (tab) {
      case "all-orders":
        // Show only unclaimed orders
        baseOrders = orders.filter(order => order.status === 'unclaimed');
        break;
      case "handover":
        // Show orders ready for handover by current vendor with is_manifest = 1
        baseOrders = orders.filter(order => 
          order.status === 'ready_for_handover' && 
          order.claimed_by === currentVendorId &&
          order.is_manifest === 1
        );
        break;
      default:
        baseOrders = orders;
    }
    
    // Apply search filter across order id, product name, SKU, and customer name
    if (tabFilter.searchTerm.trim()) {
      const term = tabFilter.searchTerm.toLowerCase();
      baseOrders = baseOrders.filter(order => {
        const orderId = String(order.order_id || order.id || '').toLowerCase();
        const productName = String(order.product_name || order.product || '').toLowerCase();
        const sku = String(order.product_code || order.sku || '').toLowerCase();
        const customer = String(order.customer_name || order.customer || '').toLowerCase();
        return (
          orderId.includes(term) ||
          productName.includes(term) ||
          sku.includes(term) ||
          customer.includes(term)
        );
      });
    }
    
    // Apply date range filter
    if (tabFilter.dateFrom && tabFilter.dateTo) {
      baseOrders = baseOrders.filter(order => {
        const orderDate = order.order_date || order.created_at || order.date;
        if (!orderDate) return true; // Show orders without dates if no date filter
        
        try {
          const orderDateObj = new Date(orderDate);
          const fromDateObj = new Date(tabFilter.dateFrom!);
          const toDateObj = new Date(tabFilter.dateTo!);
          toDateObj.setHours(23, 59, 59, 999); // Include the entire end date
          
          return orderDateObj >= fromDateObj && orderDateObj <= toDateObj;
        } catch (error) {
          return true; // Show orders with invalid dates
        }
      });
    } else if (tabFilter.dateFrom) {
      baseOrders = baseOrders.filter(order => {
        const orderDate = order.order_date || order.created_at || order.date;
        if (!orderDate) return true;
        
        try {
          const orderDateObj = new Date(orderDate);
          const fromDateObj = new Date(tabFilter.dateFrom!);
          return orderDateObj >= fromDateObj;
        } catch (error) {
          return true;
        }
      });
    } else if (tabFilter.dateTo) {
      baseOrders = baseOrders.filter(order => {
        const orderDate = order.order_date || order.created_at || order.date;
        if (!orderDate) return true;
        
        try {
          const orderDateObj = new Date(orderDate);
          const toDateObj = new Date(tabFilter.dateTo!);
          toDateObj.setHours(23, 59, 59, 999);
          return orderDateObj <= toDateObj;
        } catch (error) {
          return true;
        }
      });
    }
    
    // Ensure unique orders before returning
    return ensureUniqueOrders(baseOrders, 'unique_id');
  }

  // Filter grouped orders for My Orders tab
  const getFilteredGroupedOrdersForTab = (tab: string) => {
    let baseOrders = groupedOrders;
    const tabFilter = tabFilters[tab as keyof typeof tabFilters];
    
    // Apply search filter (search across order id, customer, and all products in each order)
    if (tabFilter.searchTerm.trim()) {
      const term = tabFilter.searchTerm.toLowerCase();
      baseOrders = baseOrders.filter(order => {
        const orderId = String(order.order_id || order.id || '').toLowerCase();
        const customer = String(order.customer_name || order.customer || '').toLowerCase();
        const productMatch = Array.isArray(order.products) && order.products.some((product: any) => {
          const name = String(product.product_name || '').toLowerCase();
          const sku = String(product.product_code || product.sku || '').toLowerCase();
          return name.includes(term) || sku.includes(term);
        });
        return orderId.includes(term) || customer.includes(term) || productMatch;
      });
    }
    
    // Apply date range filter
    if (tabFilter.dateFrom && tabFilter.dateTo) {
      baseOrders = baseOrders.filter(order => {
        const orderDate = order.order_date;
        if (!orderDate) return true;
        
        try {
          const orderDateObj = new Date(orderDate);
          const fromDateObj = new Date(tabFilter.dateFrom!);
          const toDateObj = new Date(tabFilter.dateTo!);
          toDateObj.setHours(23, 59, 59, 999);
          
          return orderDateObj >= fromDateObj && orderDateObj <= toDateObj;
        } catch (error) {
          return true;
        }
      });
    } else if (tabFilter.dateFrom) {
      baseOrders = baseOrders.filter(order => {
        const orderDate = order.order_date;
        if (!orderDate) return true;
        
        try {
          const orderDateObj = new Date(orderDate);
          const fromDateObj = new Date(tabFilter.dateFrom!);
          return orderDateObj >= fromDateObj;
        } catch (error) {
          return true;
        }
      });
    } else if (tabFilter.dateTo) {
      baseOrders = baseOrders.filter(order => {
        const orderDate = order.order_date;
        if (!orderDate) return true;
        
        try {
          const orderDateObj = new Date(orderDate);
          const toDateObj = new Date(tabFilter.dateTo!);
          toDateObj.setHours(23, 59, 59, 999);
          return orderDateObj <= toDateObj;
        } catch (error) {
          return true;
        }
      });
    }
    
    // Ensure unique orders before returning
    return ensureUniqueOrders(baseOrders, 'order_id');
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

  const handleRequestReverse = async (orderId: string, uniqueIds?: string[]) => {
    console.log('🔵 FRONTEND: Starting reverse process');
    console.log('  - orderId:', orderId);
    console.log('  - uniqueIds:', uniqueIds);
    
    // Set loading state for this order
    setReverseLoading(prev => ({ ...prev, [orderId]: true }));
    
    try {
      // If uniqueIds are provided (for grouped orders), use the grouped reverse endpoint
      if (uniqueIds && uniqueIds.length > 0) {
        console.log('🔄 FRONTEND: Reversing grouped order with shared AWB');
        console.log('  - Order ID:', orderId);
        console.log('  - Product count:', uniqueIds.length);
        
        try {
          console.log('📤 FRONTEND: Calling apiClient.reverseGroupedOrder...');
          const response = await apiClient.reverseGroupedOrder(orderId, uniqueIds);
          
          console.log('📥 FRONTEND: Grouped reverse response received');
          console.log('  - success:', response.success);
          console.log('  - message:', response.message);
          console.log('  - data:', response.data);
          
          if (response.success && response.data) {
            console.log('✅ FRONTEND: Grouped reverse successful');
            console.log('  - Products processed:', response.data.products_processed);
            console.log('  - Skipped products:', response.data.skipped_products);
            console.log('  - Total requested:', response.data.total_requested);
            
            // Show success message with details about skipped products
            let description = response.message || `Successfully reversed ${response.data.products_processed} products in order ${orderId}`;
            
            if (response.data.skipped_products > 0) {
              description += ` (${response.data.skipped_products} products were claimed by other vendors and were not affected)`;
            }
            
            toast({
              title: 'Order Reversed',
              description: description,
              variant: response.data.skipped_products > 0 ? 'default' : 'default'
            });
          } else {
            console.log('❌ FRONTEND: Grouped reverse failed');
            console.log('  - Error message:', response.message);
            toast({
              title: 'Reverse Failed',
              description: response.message || 'Could not reverse grouped order',
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          console.log('💥 FRONTEND: Exception in grouped reverse:', err.message);
          toast({
            title: 'Reverse Failed',
            description: err.message || 'Failed to reverse grouped order',
            variant: 'destructive',
          });
        }
        
      } else {
        // Single order reverse (fallback)
        console.log('📤 FRONTEND: Calling apiClient.reverseOrder for single order...');
        const response = await apiClient.reverseOrder(orderId);
        
        console.log('📥 FRONTEND: Reverse response received');
        console.log('  - success:', response.success);
        console.log('  - message:', response.message);
        console.log('  - data:', response.data);
        
        if (response.success && response.data) {
          console.log('✅ FRONTEND: Reverse successful, updating UI');
          
          // Show success message
          toast({
            title: 'Order Reversed',
            description: response.message || `Order ${orderId} has been reversed successfully`,
          });
        } else {
          console.log('❌ FRONTEND: Reverse failed');
          console.log('  - Error message:', response.message);
          toast({
            title: 'Reverse Failed',
            description: response.message || 'Could not reverse order',
            variant: 'destructive',
          });
        }
      }
      
      // Refresh orders to ensure tabs are updated correctly
      console.log('🔄 FRONTEND: Refreshing orders to update tab filtering...');
      try {
        await refreshOrders();
        console.log('✅ FRONTEND: Orders and grouped orders refreshed successfully');
      } catch (refreshError) {
        console.log('⚠️ FRONTEND: Failed to refresh orders, but reverse was successful');
      }
      
    } catch (err: any) {
      console.log('💥 FRONTEND: Exception occurred');
      console.log('  - Error:', err);
      console.log('  - Error message:', err.message);
      console.log('  - Error stack:', err.stack);
      
      toast({
        title: 'Reverse Failed',
        description: err.message || 'Network error occurred',
        variant: 'destructive',
      });
    } finally {
      // Clear loading state
      setReverseLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  const handleDownloadLabel = async (orderId: string, format: string) => {
    // Set loading state for this specific order
    setLabelDownloadLoading(prev => ({ ...prev, [orderId]: true }));
    
    try {
      console.log('🔵 FRONTEND: Starting download label process');
      console.log('  - order_id:', orderId);
      console.log('  - order_id type:', typeof orderId);
      console.log('  - format:', format);

      // Debug: Check auth header and vendor token
      const authHeader = localStorage.getItem('authHeader');
      const vendorToken = localStorage.getItem('vendorToken');
      console.log('🔍 FRONTEND: Auth header:', authHeader ? authHeader.substring(0, 20) + '...' : 'null');
      console.log('🔍 FRONTEND: Vendor token:', vendorToken ? vendorToken.substring(0, 20) + '...' : 'null');

      // Call the download label API with format parameter
      const response = await apiClient.downloadLabel(orderId, format);
      
      console.log('📥 FRONTEND: Download label response received');
      console.log('  - success:', response.success);
      console.log('  - data:', response.data);
      
      if (response.success && response.data) {
        const { shipping_url, awb, original_order_id, clone_order_id, formatted_pdf, format: responseFormat } = response.data;
        
        console.log('✅ FRONTEND: Label generated successfully');
        console.log('  - Shipping URL:', shipping_url);
        console.log('  - AWB:', awb);
        console.log('  - Format:', responseFormat);
        console.log('  - Has formatted PDF:', !!formatted_pdf);
        
        // Handle different formats
        if (formatted_pdf && (responseFormat === 'a4' || responseFormat === 'four-in-one')) {
          // Handle A4 and four-in-one formats with base64 PDF
          try {
            console.log('🔄 FRONTEND: Processing formatted PDF...');
            
            // Convert base64 to blob
            const binaryString = atob(formatted_pdf);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}_{format}
            const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
            const vendorId = user?.warehouseId || 'unknown';
            const vendorCity = vendorAddress?.city || 'unknown';
            const filename = `${vendorId}_${vendorCity}_${currentDate}_${responseFormat}.pdf`;
            
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            console.log('✅ FRONTEND: Formatted PDF downloaded successfully');
            
            // Show success message
            const orderDisplayId = clone_order_id || original_order_id || orderId;
            toast({
              title: "Label Downloaded",
              description: `${responseFormat} label for order ${orderDisplayId} downloaded successfully`,
            });
            
            // Refresh orders to update the UI
            await refreshOrders();
            
          } catch (pdfError) {
            console.error('❌ FRONTEND: Formatted PDF download failed:', pdfError);
            
            // Fallback: open original URL in new tab
            window.open(shipping_url, '_blank');
            
            toast({
              title: "Label Generated",
              description: `Label generated successfully. Opening in new tab.`,
            });
          }
        } else {
          // Handle thermal format (original behavior)
          try {
            const blob = await apiClient.downloadLabelFile(shipping_url);
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}
            const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
            const vendorId = user?.warehouseId || 'unknown';
            const vendorCity = vendorAddress?.city || 'unknown';
            const filename = `${vendorId}_${vendorCity}_${currentDate}.pdf`;
            
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            console.log('✅ FRONTEND: Label file downloaded successfully');
            
            // Show success message
            const orderDisplayId = clone_order_id || original_order_id || orderId;
            toast({
              title: "Label Downloaded",
              description: `${format} label for order ${orderDisplayId} downloaded successfully`,
            });
            
            // Refresh orders to update the UI
            await refreshOrders();
            
          } catch (downloadError) {
            console.error('❌ FRONTEND: Label file download failed:', downloadError);
            
            // Fallback: open in new tab
            window.open(shipping_url, '_blank');
            
            toast({
              title: "Label Generated",
              description: `Label generated successfully. Opening in new tab.`,
            });
          }
        }
        
      } else {
        console.log('❌ FRONTEND: Download label failed');
        console.log('  - Error message:', response.message);
        console.log('  - Warning flag:', response.warning);
        console.log('  - User message:', response.userMessage);
        
        // Show warning toast with yellowish color for non-blocking errors
        if (response.warning) {
          toast({
            title: '⚠️ Label Generation Issue',
            description: response.userMessage || response.message || 'Could not generate label',
            className: 'bg-yellow-50 border-yellow-400 text-yellow-800',
          });
        } else {
          toast({
            title: 'Download Label Failed',
            description: response.message || 'Could not generate label',
            variant: 'destructive',
          });
        }
      }
      
    } catch (error) {
      console.error('❌ FRONTEND: Download label error:', error);
      toast({
        title: 'Download Label Failed',
        description: 'An error occurred while generating the label',
        variant: 'destructive',
      });
    } finally {
      // Clear loading state for this specific order
      setLabelDownloadLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  const handleBulkDownloadLabels = async (tab: string) => {
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

    // Set bulk download loading state
    setBulkDownloadLoading(true);

    try {
      toast({
        title: "Bulk Download Started",
        description: `Generating ${labelFormat} labels for ${selectedOrders.length} orders...`,
      })

      console.log('🔵 FRONTEND: Starting bulk download labels process');
      console.log('  - selected orders:', selectedOrders);
      console.log('  - tab:', tab);

      // Call the bulk download labels API with format parameter
      const blob = await apiClient.bulkDownloadLabels(selectedOrders, labelFormat);
      
      console.log('📥 FRONTEND: Bulk download labels response received');
      console.log('  - blob size:', blob.size);
      console.log('  - blob type:', blob.type);
      
      // Create download link for the combined PDF
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bulk-labels-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ FRONTEND: Bulk labels PDF downloaded successfully');
      
      // Check if there are warnings
      const warnings = (blob as any)._warnings;
      const failedOrders = (blob as any)._failedOrders;
      
      if (warnings && failedOrders && failedOrders.length > 0) {
        console.log('⚠️ FRONTEND: Some orders failed during bulk download');
        console.log('  - Failed orders:', failedOrders);
        
        // Show warning toast
        toast({
          title: "⚠️ Bulk Download Completed with Warnings",
          description: `Downloaded labels successfully, but ${failedOrders.length} order(s) failed. Please contact admin for: ${failedOrders.join(', ')}`,
          className: 'bg-yellow-50 border-yellow-400 text-yellow-800',
        });
      } else {
        toast({
          title: "Bulk Download Complete",
          description: `Successfully downloaded labels for ${selectedOrders.length} orders`,
        });
      }

      // Refresh orders to update the UI
      await refreshOrders();

      // Clear selected orders
      if (tab === "my-orders") {
        setSelectedMyOrders([])
      } else {
        setSelectedOrdersForDownload([])
      }
      
    } catch (error) {
      console.error('❌ FRONTEND: Bulk download labels error:', error);
      toast({
        title: 'Bulk Download Failed',
        description: error instanceof Error ? error.message : 'An error occurred while downloading labels',
        variant: 'destructive',
      })
    } finally {
      // Clear bulk download loading state
      setBulkDownloadLoading(false);
    }
  }

  const handleBulkClaimOrders = async () => {
    if (selectedUnclaimedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to claim",
        variant: "destructive",
      })
      return
    }

    console.log('🔵 FRONTEND: Starting bulk claim process');
    console.log('  - selected orders:', selectedUnclaimedOrders);

    try {
      console.log('📤 FRONTEND: Calling apiClient.bulkClaimOrders...');
      const response = await apiClient.bulkClaimOrders(selectedUnclaimedOrders);
      
      console.log('📥 FRONTEND: Bulk claim response received');
      console.log('  - success:', response.success);
      console.log('  - data:', response.data);
      
      if (response.success && response.data) {
        const { successful_claims, failed_claims, total_successful, total_failed } = response.data;
        
        console.log('✅ FRONTEND: Bulk claim successful');
        console.log('  - Successful:', total_successful);
        console.log('  - Failed:', total_failed);
        
        // Show success message
        toast({
          title: "Bulk Claim Complete",
          description: `Successfully claimed ${total_successful} orders${total_failed > 0 ? `. ${total_failed} orders failed to claim.` : ''}`,
        });
        
        // Clear selected orders
        setSelectedUnclaimedOrders([]);
        
        // Refresh orders to update the UI
        console.log('🔄 FRONTEND: Refreshing orders after bulk claim...');
        try {
          await refreshOrders();
          console.log('✅ FRONTEND: Orders and grouped orders refreshed successfully');
        } catch (refreshError) {
          console.log('⚠️ FRONTEND: Failed to refresh orders, but bulk claim was successful');
        }
        
      } else {
        console.log('❌ FRONTEND: Bulk claim failed');
        console.log('  - Error message:', response.message);
        toast({
          title: 'Bulk Claim Failed',
          description: response.message || 'Could not claim selected orders',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.log('💥 FRONTEND: Exception occurred during bulk claim');
      console.log('  - Error:', err);
      console.log('  - Error message:', err.message);
      
      toast({
        title: 'Bulk Claim Failed',
        description: err.message || 'Network error occurred',
        variant: 'destructive',
      });
    }
  }

  const scrollToTop = () => {
    if (scrollableContentRef.current) {
      scrollableContentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const handleRefreshOrders = async () => {
    setOrdersRefreshing(true);
    try {
      const response = await apiClient.refreshOrders();
      if (response.success) {
        toast({
          title: "Orders Refreshed",
          description: "Your orders have been refreshed from Shipway.",
        });
        
        // Clear filters and refresh all orders
        setActiveTab("all-orders");
        setTabFilters({
          "all-orders": { searchTerm: "", dateFrom: undefined, dateTo: undefined },
          "my-orders": { searchTerm: "", dateFrom: undefined, dateTo: undefined },
          "handover": { searchTerm: "", dateFrom: undefined, dateTo: undefined },
        });
        
        // Re-fetch all orders and grouped orders
        try {
          const ordersResponse = await apiClient.getOrders();
          if (ordersResponse.success && ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
            setOrders(ordersResponse.data.orders);
            console.log('✅ FRONTEND: Orders refreshed successfully');
          }
          
          const groupedResponse = await apiClient.getGroupedOrders();
          if (groupedResponse.success && groupedResponse.data && Array.isArray(groupedResponse.data.groupedOrders)) {
            setGroupedOrders(groupedResponse.data.groupedOrders);
            console.log('✅ FRONTEND: Grouped orders refreshed successfully');
          }
        } catch (refreshError) {
          console.log('⚠️ FRONTEND: Failed to refresh orders data, but Shipway sync was successful');
        }
        
        console.log('✅ FRONTEND: Orders refreshed successfully via API');
      } else {
        toast({
          title: "Refresh Failed",
          description: response.message || "Failed to refresh orders.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ FRONTEND: Error refreshing orders:', error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "An error occurred while refreshing orders.",
        variant: "destructive",
      });
    } finally {
      setOrdersRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Responsive Layout */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-4">
            {/* Dashboard Name and Welcome */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className={`font-bold text-gray-900 truncate ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {isMobile ? 'Clamio - Vendor' : 'Clamio - Vendor'}
                </h1>
                {!isMobile && (
                  <p className="text-sm text-gray-600 truncate">
                    Welcome back, {user?.name}
                  </p>
                )}
              </div>
            </div>

            {/* Desktop/Tablet - Vendor Address and Logout */}
            {!isMobile && (
              <>
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
                      <div className="text-xs text-gray-700 truncate">{vendorAddress.city}, {vendorAddress.pincode}</div>
                    </div>
                  ) : null}
                </div>
                {/* Logout Button */}
                <div className="flex-shrink-0">
                  <Button variant="outline" onClick={logout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    {isDesktop && 'Logout'}
                  </Button>
                </div>
              </>
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
                
                {/* Vendor Address in Mobile Menu */}
                {addressLoading ? (
                  <div className="px-2">
                    <span className="text-xs text-gray-400">Loading address...</span>
                  </div>
                ) : addressError ? (
                  <div className="px-2">
                    <span className="text-xs text-red-500">{addressError}</span>
                  </div>
                ) : vendorAddress ? (
                  <div className="px-2 border-t pt-3">
                    <div className="text-xs text-gray-900 font-semibold">Vendor ID: <span className="font-mono">{vendorAddress.warehouseId}</span></div>
                    <div className="text-xs text-gray-700">{vendorAddress.address}</div>
                    <div className="text-xs text-gray-700">{vendorAddress.city}, {vendorAddress.pincode}</div>
                  </div>
                ) : null}

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
          isMobile ? 'grid-cols-2' : 
          isTablet ? 'grid-cols-2' : 
          'grid-cols-4'
        }`}>
          <Card 
            className={`bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "all-orders" ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("all-orders")}
          >
            <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-blue-100 opacity-90 ${isMobile ? 'text-xs' : 'text-sm'}`}>All Orders</p>
                  <p className={`font-bold mt-1 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                    {orders.filter((o) => o.status === "unclaimed").length}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                  <Package className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "my-orders" ? 'ring-2 ring-green-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("my-orders")}
          >
            <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-green-100 opacity-90 ${isMobile ? 'text-xs' : 'text-sm'}`}>My Orders</p>
                  <p className={`font-bold mt-1 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                    {orders.filter((o) => o.status === "claimed" && o.claimed_by === user?.warehouseId).length}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                  <CheckCircle className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "handover" ? 'ring-2 ring-orange-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("handover")}
          >
            <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-orange-100 opacity-90 ${isMobile ? 'text-xs' : 'text-sm'}`}>Handover</p>
                  <p className={`font-bold mt-1 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                    {orders.filter((o) => o.status === "ready_for_handover" && o.claimed_by === user?.warehouseId && o.is_manifest === 1).length}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                  <Upload className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Card - Placeholder */}
          <Card className="bg-gradient-to-br from-gray-300 to-gray-400 text-gray-600 border-0 shadow-lg opacity-50">
            <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium text-gray-500 opacity-90 ${isMobile ? 'text-xs' : 'text-sm'}`}>Coming Soon</p>
                  <p className={`font-bold mt-1 ${isMobile ? 'text-xl' : 'text-2xl'}`}>--</p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                  <Settings className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className={`${isMobile ? 'text-lg' : 'text-xl'}`}>Order Management</CardTitle>
                {!isMobile && <CardDescription>Manage your orders across different stages</CardDescription>}
              </div>
              <Button
                onClick={handleRefreshOrders}
                disabled={ordersRefreshing}
                variant="outline"
                className="h-10 bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:from-blue-600 hover:to-blue-700"
                size="default"
              >
                {ordersRefreshing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Fixed Controls Section */}
              <div className={`sticky ${isMobile ? 'top-16' : 'top-20'} bg-white z-40 pb-4 border-b mb-4`}>
                <TabsList className={`grid w-full grid-cols-3 ${isMobile ? 'h-auto mb-4' : 'mb-6'}`}>
                  <TabsTrigger value="all-orders" className={`${isMobile ? 'text-xs px-2 py-3' : ''}`}>
                    All ({getFilteredOrdersForTab("all-orders").length})
                  </TabsTrigger>
                  <TabsTrigger value="my-orders" className={`${isMobile ? 'text-xs px-2 py-3' : ''}`}>
                    My Orders ({getFilteredOrdersForTab("my-orders").length})
                  </TabsTrigger>
                  <TabsTrigger value="handover" className={`${isMobile ? 'text-xs px-2 py-3' : ''}`}>
                    Handover ({getFilteredOrdersForTab("handover").length})
                  </TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className={`flex flex-col gap-3 mb-4 md:mb-6 ${!isMobile && 'sm:flex-row sm:items-center'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search"
                        value={getCurrentTabFilters().searchTerm}
                        onChange={(e) => updateCurrentTabFilter('searchTerm', e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {getCurrentTabFilters().searchTerm && (
                        <button
                          onClick={() => updateCurrentTabFilter('searchTerm', '')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          type="button"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`flex gap-2 items-center ${isMobile ? 'flex-wrap' : ''}`}>
                    <DatePicker
                      date={getCurrentTabFilters().dateFrom}
                      onDateChange={(date) => updateCurrentTabFilter('dateFrom', date)}
                      placeholder={isMobile ? "From" : "From date"}
                      className={`${isMobile ? 'flex-1 min-w-[120px]' : 'w-40'}`}
                    />
                    <span className="text-gray-500 text-sm px-1">to</span>
                    <DatePicker
                      date={getCurrentTabFilters().dateTo}
                      onDateChange={(date) => updateCurrentTabFilter('dateTo', date)}
                      placeholder={isMobile ? "To" : "To date"}
                      className={`${isMobile ? 'flex-1 min-w-[120px]' : 'w-40'}`}
                    />
                  </div>
                  
                  {/* Tab-specific Actions */}
                  {activeTab === "all-orders" && !isMobile && (
                    <Button 
                      onClick={() => handleBulkClaimOrders()} 
                      disabled={selectedUnclaimedOrders.length === 0} 
                      className="h-10 text-sm whitespace-nowrap px-6 min-w-fit"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Claim Selected ({selectedUnclaimedOrders.length})
                    </Button>
                  )}
                  
                  {activeTab === "my-orders" && (
                    <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'items-center'}`}>
                      <Select value={labelFormat} onValueChange={setLabelFormat}>
                        <SelectTrigger className={`h-10 text-sm ${isMobile ? 'w-full' : 'w-36'}`}>
                          <SelectValue placeholder="Label Format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thermal">Thermal (4x6)</SelectItem>
                          <SelectItem value="a4">A4 Format</SelectItem>
                          <SelectItem value="four-in-one">Four in One</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => handleBulkDownloadLabels("my-orders")}
                        disabled={selectedMyOrders.length === 0 || bulkDownloadLoading}
                        className={`h-10 text-sm ${isMobile ? 'w-full' : 'whitespace-nowrap px-6 min-w-fit'}`}
                      >
                        {bulkDownloadLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {isMobile ? 'Generating...' : 'Generating...'}
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            {isMobile ? `Download (${selectedMyOrders.length})` : `Download (${selectedMyOrders.length})`}
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleBulkMarkReady()}
                        disabled={
                          selectedMyOrders.length === 0 || 
                          bulkMarkReadyLoading ||
                          getFilteredOrdersForTab("my-orders")
                            .filter(order => selectedMyOrders.includes(order.order_id))
                            .some(order => !order.label_downloaded || order.label_downloaded === 0 || order.label_downloaded === '0' || order.label_downloaded === false)
                        }
                        variant="outline"
                        className={`h-10 text-sm ${isMobile ? 'w-full' : 'whitespace-nowrap px-6 min-w-fit'}`}
                        title={
                          getFilteredOrdersForTab("my-orders")
                            .filter(order => selectedMyOrders.includes(order.order_id))
                            .some(order => order.label_downloaded !== 1)
                            ? "All selected orders must have labels downloaded first"
                            : "Mark selected orders as ready for handover"
                        }
                      >
                        {bulkMarkReadyLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            {isMobile ? 'Processing...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {isMobile ? `Mark Ready (${selectedMyOrders.length})` : `Mark Ready (${selectedMyOrders.length})`}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>


              </div>

              {/* Scrollable Content Section */}
              <div 
                ref={scrollableContentRef}
                className={`${isMobile ? 'max-h-[calc(100vh-280px)] pb-20' : 'max-h-[600px]'} overflow-y-auto relative`}
              >
                <TabsContent value="all-orders" className="mt-0">
                  {/* Mobile Card Layout */}
                  {isMobile ? (
                    <div className="space-y-3">
                      {getFilteredOrdersForTab("all-orders").map((order, index) => (
                        <Card 
                          key={`${order.unique_id}-${index}`} 
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            if (selectedUnclaimedOrders.includes(order.unique_id)) {
                              setSelectedUnclaimedOrders(selectedUnclaimedOrders.filter((id) => id !== order.unique_id))
                            } else {
                              setSelectedUnclaimedOrders([...selectedUnclaimedOrders, order.unique_id])
                            }
                          }}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedUnclaimedOrders.includes(order.unique_id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) {
                                    setSelectedUnclaimedOrders([...selectedUnclaimedOrders, order.unique_id])
                                  } else {
                                    setSelectedUnclaimedOrders(selectedUnclaimedOrders.filter((id) => id !== order.unique_id))
                                  }
                                }}
                                className="mt-1"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <img
                                src={order.product_image || "/placeholder.svg"}
                                alt={order.product_name}
                                className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  order.product_image && setSelectedImageProduct({url: order.product_image, title: order.product_name || "Product Image"})
                                }}
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{order.order_id}</h4>
                                <p className="text-xs text-gray-600 break-words leading-relaxed">{order.product_name}</p>
                                <p className="text-xs text-gray-500 break-words leading-relaxed">Code: {order.product_code}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <p className="font-medium">
                                  {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Size:</span>
                                <p className="font-medium text-red-600">{order.size || "-"}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Quantity:</span>
                                <p className="font-medium">{order.quantity || "-"}</p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClaimOrder(order.unique_id);
                              }}
                              className="w-full"
                            >
                              Claim Order
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* Desktop/Tablet Table Layout */
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-30">
                          <TableRow>
                            <TableHead className="w-12">Select</TableHead>
                            <TableHead>Image</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Product Code</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredOrdersForTab("all-orders").map((order, index) => (
                            <TableRow key={`${order.unique_id}-${index}`}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedUnclaimedOrders.includes(order.unique_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUnclaimedOrders([...selectedUnclaimedOrders, order.unique_id])
                                    } else {
                                      setSelectedUnclaimedOrders(selectedUnclaimedOrders.filter((id) => id !== order.unique_id))
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <img
                                        src={order.product_image || "/placeholder.svg"}
                                        alt={order.product_name}
                                        className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => order.product_image && setSelectedImageProduct({url: order.product_image, title: order.product_name || "Product Image"})}
                                        onError={(e) => {
                                          e.currentTarget.src = "/placeholder.svg";
                                        }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Click to view full image</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="font-medium">{order.order_id}</TableCell>
                              <TableCell>
                                {order.order_date ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                      {new Date(order.order_date).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(order.order_date).toLocaleTimeString()}
                                    </span>
                                  </div>
                                ) : "N/A"}
                              </TableCell>
                              <TableCell>{order.product_name}</TableCell>
                              <TableCell>
                                <span className="text-red-600 font-medium">
                                  {order.size || "-"}
                                </span>
                              </TableCell>
                              <TableCell>{order.product_code}</TableCell>
                              <TableCell>{order.quantity || "-"}</TableCell>
                              <TableCell>
                                <Button size="sm" onClick={() => handleClaimOrder(order.unique_id)}>
                                  Claim
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="my-orders" className="mt-0">
                  {groupedOrdersLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading orders...</p>
                      </div>
                    </div>
                  ) : groupedOrdersError ? (
                    <div className="flex items-center justify-center p-8">
                      <p className="text-red-500">{groupedOrdersError}</p>
                    </div>
                  ) : isMobile ? (
                    /* Mobile Card Layout */
                    <div className="space-y-3">
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg sticky top-0 z-30">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            const myOrders = getFilteredOrdersForTab("my-orders")
                            if (e.target.checked) {
                              setSelectedMyOrders(myOrders.map((o) => o.order_id))
                            } else {
                              setSelectedMyOrders([])
                            }
                          }}
                          checked={
                            selectedMyOrders.length > 0 &&
                            selectedMyOrders.length === getFilteredOrdersForTab("my-orders").length
                          }
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">Select All</span>
                      </div>
                      {getFilteredOrdersForTab("my-orders").map((order, index) => (
                        <Card 
                          key={`${order.order_id}-${index}`} 
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            if (selectedMyOrders.includes(order.order_id)) {
                              setSelectedMyOrders(selectedMyOrders.filter((id) => id !== order.order_id))
                            } else {
                              setSelectedMyOrders([...selectedMyOrders, order.order_id])
                            }
                          }}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedMyOrders.includes(order.order_id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.checked) {
                                      setSelectedMyOrders([...selectedMyOrders, order.order_id])
                                    } else {
                                      setSelectedMyOrders(selectedMyOrders.filter((id) => id !== order.order_id))
                                    }
                                  }}
                                  className="mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div>
                                  <h4 className="font-medium text-sm">{order.order_id}</h4>
                                  <p className="text-xs text-gray-500">
                                    {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                  </p>
                                  {getStatusBadge(order.status)}
                                </div>
                              </div>
                                   <div className="text-right">
                                     <div className="text-xs text-gray-500">Total</div>
                                     <div className="font-medium text-green-600">{order.total_quantity || 0}</div>
                                     <div className="text-xs text-blue-600 font-semibold">{order.total_quantity || 0} items</div>
                                   </div>
                            </div>
                            
                            <div className="space-y-2">
                              {order.products.map((product: any) => (
                                <div key={product.unique_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                  <img
                                    src={product.image || "/placeholder.svg"}
                                    alt={product.product_name}
                                    className="w-10 h-10 rounded-md object-cover cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      product.image && setSelectedImageProduct({url: product.image, title: product.product_name || "Product Image"})
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium break-words leading-relaxed">{product.product_name}</p>
                                    <p className="text-xs text-gray-500 break-words leading-relaxed">Code: {product.product_code || "N/A"}</p>
                                    {product.size && (
                                      <p className="text-xs font-medium text-red-600">Size: {product.size}</p>
                                    )}
                                  </div>
                                   <div className="text-xs font-medium">{product.quantity || 0}</div>
                                </div>
                              ))}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadLabel(order.order_id, labelFormat);
                                }}
                                disabled={labelDownloadLoading[order.order_id] || bulkDownloadLoading}
                                className="w-full text-xs"
                              >
                                {labelDownloadLoading[order.order_id] ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3 mr-1" />
                                    Download Label
                                  </>
                                )}
                              </Button>
                              <div className="grid grid-cols-2 gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkReady(order.order_id);
                                  }}
                                  disabled={!order.label_downloaded || order.label_downloaded === 0 || order.label_downloaded === '0' || order.label_downloaded === false}
                                  className="text-xs"
                                >
                                  Mark Ready
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestReverse(order.order_id, order.products?.map((p: any) => p.unique_id));
                                  }}
                                  disabled={reverseLoading[order.order_id]}
                                  className="text-xs"
                                >
                                  {reverseLoading[order.order_id] ? 'Reversing...' : 'Reverse'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* Desktop/Tablet Table Layout */
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
                                    setSelectedMyOrders(myOrders.map((o) => o.order_id))
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
                            <TableHead>Order ID</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Products</TableHead>
                            <TableHead className="w-16 text-center">Count</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredOrdersForTab("my-orders").map((order, index) => (
                            <TableRow key={`${order.order_id}-${index}`} className="group">
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedMyOrders.includes(order.order_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMyOrders([...selectedMyOrders, order.order_id])
                                    } else {
                                      setSelectedMyOrders(selectedMyOrders.filter((id) => id !== order.order_id))
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {order.order_id}
                              </TableCell>
                              <TableCell>
                                {order.order_date ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                      {new Date(order.order_date).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(order.order_date).toLocaleTimeString()}
                                    </span>
                                  </div>
                                ) : "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-2 max-w-md">
                                  {order.products.map((product: any, index: number) => (
                                    <div key={product.unique_id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <img
                                              src={product.image || "/placeholder.svg"}
                                              alt={product.product_name}
                                              className="w-10 h-10 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                              onClick={() => product.image && setSelectedImageProduct({url: product.image, title: product.product_name || "Product Image"})}
                                              onError={(e) => {
                                                e.currentTarget.src = "/placeholder.svg";
                                              }}
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Click to view full image</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 break-words">
                                          {product.product_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          Code: {product.product_code || "N/A"}
                                        </p>
                                        {product.size && (
                                          <p className="text-xs font-medium text-red-600">
                                            Size: {product.size}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-medium">
                                           {product.quantity || 0}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-center align-middle">
                                <div className="text-lg font-semibold text-blue-600">
                                  {order.total_quantity || 0}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 min-w-fit">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadLabel(order.order_id, labelFormat)}
                                    disabled={labelDownloadLoading[order.order_id] || bulkDownloadLoading}
                                    className="text-xs px-2 py-1 h-8"
                                  >
                                    {labelDownloadLoading[order.order_id] ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                                        Loading...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-3 h-3 mr-1" />
                                        Label
                                      </>
                                    )}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleMarkReady(order.order_id)}
                                    disabled={!order.label_downloaded || order.label_downloaded === 0 || order.label_downloaded === '0' || order.label_downloaded === false}
                                    className="text-xs px-2 py-1 h-8"
                                    title={!order.label_downloaded || order.label_downloaded === 0 || order.label_downloaded === '0' || order.label_downloaded === false ? "Label must be downloaded first" : "Mark order as ready for handover"}
                                  >
                                    Ready
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    onClick={() => handleRequestReverse(order.order_id, order.products?.map((p: any) => p.unique_id))}
                                    disabled={reverseLoading[order.order_id]}
                                    className="text-xs px-2 py-1 h-8"
                                  >
                                    {reverseLoading[order.order_id] ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                        Reversing...
                                      </>
                                    ) : (
                                      'Reverse'
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="handover" className="mt-0">
                  {/* Mobile Card Layout */}
                  {isMobile ? (
                    <div className="space-y-3">
                      {getFilteredOrdersForTab("handover").map((order, index) => (
                        <Card key={`${order.order_id}-${index}`} className="p-3">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <img
                                src={order.product_image || "/placeholder.svg"}
                                alt={order.product_name || order.product}
                                className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                                onClick={() => order.product_image && setSelectedImageProduct({url: order.product_image, title: order.product_name || order.product || "Product Image"})}
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{order.order_id}</h4>
                                <p className="text-xs text-gray-600 break-words leading-relaxed">{order.product_name || order.product}</p>
                                <div className="mt-1">
                                  {getStatusBadge(order.status)}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <p className="font-medium">
                                  {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Status:</span>
                                <Badge variant="outline" className="text-xs mt-1">Ready for Pickup</Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* Desktop/Tablet Table Layout */
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-30">
                          <TableRow>
                            <TableHead>Image</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredOrdersForTab("handover").map((order, index) => (
                            <TableRow key={`${order.order_id}-${index}`}>
                              <TableCell>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <img
                                        src={order.product_image || "/placeholder.svg"}
                                        alt={order.product_name || order.product}
                                        className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => order.product_image && setSelectedImageProduct({url: order.product_image, title: order.product_name || order.product || "Product Image"})}
                                        onError={(e) => {
                                          e.currentTarget.src = "/placeholder.svg";
                                        }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Click to view full image</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="font-medium">{order.order_id}</TableCell>
                              <TableCell>
                                {order.order_date ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                      {new Date(order.order_date).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(order.order_date).toLocaleTimeString()}
                                    </span>
                                  </div>
                                ) : "N/A"}
                              </TableCell>
                              <TableCell>{order.product_name || order.product}</TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">Ready for Pickup</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </div>

              {/* Fixed Bottom Bulk Claim Button for Mobile All Orders */}
              {isMobile && activeTab === "all-orders" && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                  <div className="flex items-center gap-3">
                    {/* Move to Top Button */}
                    <Button
                      onClick={scrollToTop}
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0 rounded-full border-gray-300 hover:bg-gray-50"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    
                    {/* Bulk Claim Button */}
                    <Button 
                      onClick={() => handleBulkClaimOrders()} 
                      disabled={selectedUnclaimedOrders.length === 0} 
                      className="flex-1 h-12 text-base font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg"
                    >
                      <Package className="w-5 h-5 mr-2" />
                      Claim Selected ({selectedUnclaimedOrders.length})
                    </Button>
                  </div>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showRevenueModal} onOpenChange={setShowRevenueModal}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh]' : 'max-w-4xl max-h-[90vh]'} overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-lg' : 'text-xl'}`}>Revenue Management</DialogTitle>
            {!isMobile && <DialogDescription>Claim your revenue and view settlement history</DialogDescription>}
          </DialogHeader>
          <div className={`${isMobile ? 'space-y-4' : 'space-y-6'}`}>
            {/* Payment Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className={`${isMobile ? 'p-4' : 'p-6'}`}>
                  <CardTitle className={`flex items-center text-green-600 ${isMobile ? 'text-base' : 'text-lg'}`}>
                    <CreditCard className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                    {isMobile ? 'Current' : 'Current Payment (Eligible)'}
                  </CardTitle>
                </CardHeader>
                <CardContent className={`${isMobile ? 'p-4 pt-0' : 'p-6 pt-0'}`}>
                  <div className={`font-bold text-green-600 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                    {paymentsLoading ? "Loading..." : payments ? `₹${payments.currentPayment.toFixed(2)}` : "₹0.00"}
                  </div>
                  <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>From handover orders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className={`${isMobile ? 'p-4' : 'p-6'}`}>
                  <CardTitle className={`flex items-center text-blue-600 ${isMobile ? 'text-base' : 'text-lg'}`}>
                    <Clock className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                    {isMobile ? 'Future' : 'Future Payment (Pending)'}
                  </CardTitle>
                </CardHeader>
                <CardContent className={`${isMobile ? 'p-4 pt-0' : 'p-6 pt-0'}`}>
                  <div className={`font-bold text-blue-600 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                    {paymentsLoading ? "Loading..." : payments ? `₹${payments.futurePayment.toFixed(2)}` : "₹0.00"}
                  </div>
                  <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>From packed orders</p>
                </CardContent>
              </Card>
            </div>

            {/* Settlement Request */}
            <Card>
              <CardHeader className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Request Settlement</CardTitle>
                {!isMobile && <CardDescription>Only current payment amount is eligible for settlement</CardDescription>}
              </CardHeader>
              <CardContent className={`${isMobile ? 'p-4 pt-0 space-y-3' : 'space-y-4'}`}>
                <div>
                  <Label htmlFor="upi-id" className={`${isMobile ? 'text-sm' : ''}`}>UPI ID for Settlement</Label>
                  <div className="relative">
                    <Input
                      id="upi-id"
                      placeholder={isMobile ? "Enter UPI ID" : "Enter your UPI ID (e.g., user@paytm)"}
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className={`${isMobile ? 'text-sm' : ''} pr-10`}
                    />
                    {upiId && (
                      <button
                        onClick={() => setUpiId('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={handleClaimRevenue} 
                  className="w-full" 
                  size={isMobile ? 'default' : 'default'}
                  disabled={!upiId.trim() || settlementLoading || !payments || payments.currentPayment <= 0}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  {settlementLoading ? "Processing..." : isMobile ? `Request (₹${payments ? payments.currentPayment.toFixed(2) : '0.00'})` : `Request Settlement (₹${payments ? payments.currentPayment.toFixed(2) : '0.00'})`}
                </Button>
              </CardContent>
            </Card>

            {/* Settlement History */}
            <Card>
              <CardHeader className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'}`}>
                  <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Settlement History</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                    className={`${isMobile ? 'w-full text-xs' : ''}`}
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
        <DialogContent className={`${isMobile ? 'max-w-[95vw]' : 'max-w-3xl'}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Payment Proof</DialogTitle>
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
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto' : 'max-w-2xl'}`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Settlement Details</DialogTitle>
            {!isMobile && <DialogDescription>Complete details of the settlement request</DialogDescription>}
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

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageProduct} onOpenChange={() => setSelectedImageProduct(null)}>
        <DialogContent className={`${isMobile ? 'max-w-[90vw] w-[90vw] p-0 gap-0' : 'max-w-4xl'}`} >
          {isMobile ? (
            // Mobile view with full control
            <>
              <div className="flex flex-col h-[80vh] w-full">
                <DialogHeader className="flex items-center justify-between p-3 pr-10 border-b shrink-0 space-y-0">
                  <DialogTitle className="text-sm font-semibold flex-1 pr-2 break-words">
                    {selectedImageProduct ? selectedImageProduct.title : "Image Preview"}
                  </DialogTitle>
                  
                </DialogHeader>
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-gray-50">
                  {selectedImageProduct ? (
                    <div className="w-full h-full flex items-center justify-center max-w-[75vw] max-h-[65vh]">
                      <img
                        src={selectedImageProduct.url}
                        alt={selectedImageProduct.title}
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-md"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-gray-500">No image available</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Desktop view
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedImageProduct ? selectedImageProduct.title : "Image Preview"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                {selectedImageProduct ? (
                  <img
                    src={selectedImageProduct.url}
                    alt={selectedImageProduct.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[60vh] text-gray-500">
                    No image available
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
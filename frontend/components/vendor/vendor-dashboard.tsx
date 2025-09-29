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
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
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
        setOrders(response.data.orders);
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
        
        // Show success message
        toast({
          title: 'Order Claimed',
          description: `Successfully claimed order row ${unique_id}`,
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
        const msg = (response.message || '').toLowerCase();
        if (msg.includes('not unclaimed') || msg.includes('already claimed')) {
          toast({
            title: 'No Longer Available',
            description: 'This order is no longer available for claim.',
          });
          // Refresh to reflect latest availability
          try { await refreshOrders(); } catch {}
        } else {
          toast({
            title: 'Claim Failed',
            description: response.message || 'Could not claim order',
            variant: 'destructive',
          });
        }
      }
  } catch (err: any) {
      console.log('💥 FRONTEND: Exception occurred');
      console.log('  - Error:', err);
      console.log('  - Error message:', err.message);
      console.log('  - Error stack:', err.stack);
      
      const message = String(err?.message || '').toLowerCase();
      if (message.includes('not unclaimed') || message.includes('already claimed')) {
        toast({
          title: 'No Longer Available',
          description: 'This order is no longer available for claim.',
        });
        try { await refreshOrders(); } catch {}
      } else {
        toast({
          title: 'Claim Failed',
          description: err.message || 'Network error occurred',
          variant: 'destructive',
        });
      }
    }
  }

  const handleMarkReady = async (orderId: string) => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/orders/mark-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.token || '',
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

    setBulkMarkReadyLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/orders/bulk-mark-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.token || '',
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
    
    return baseOrders;
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
    
    return baseOrders;
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

      // Call the download label API
      const response = await apiClient.downloadLabel(orderId);
      
      console.log('📥 FRONTEND: Download label response received');
      console.log('  - success:', response.success);
      console.log('  - data:', response.data);
      
      if (response.success && response.data) {
        const { shipping_url, awb, original_order_id, clone_order_id } = response.data;
        
        console.log('✅ FRONTEND: Label generated successfully');
        console.log('  - Shipping URL:', shipping_url);
        console.log('  - AWB:', awb);
        
        // Download the label file
        try {
          const blob = await apiClient.downloadLabelFile(shipping_url);
          
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `label_${orderId}_${awb}.pdf`;
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
        
      } else {
        console.log('❌ FRONTEND: Download label failed');
        console.log('  - Error message:', response.message);
        toast({
          title: 'Download Label Failed',
          description: response.message || 'Could not generate label',
          variant: 'destructive',
        });
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

      // Call the bulk download labels API
      const blob = await apiClient.bulkDownloadLabels(selectedOrders);
      
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
      
      toast({
        title: "Bulk Download Complete",
        description: `Successfully downloaded labels for ${selectedOrders.length} orders`,
      })

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
        
        console.log('✅ FRONTEND: Bulk claim processed');
        console.log('  - Successful:', total_successful);
        console.log('  - Failed:', total_failed);
        
        // Summary toast
        toast({
          title: "Bulk Claim Complete",
          description: `Successfully claimed ${total_successful} orders${total_failed > 0 ? `, ${total_failed} could not be claimed` : ''}.`,
        });
        
        // Friendly notice for items no longer available
        if (Array.isArray(failed_claims) && failed_claims.length > 0) {
          const alreadyClaimed = failed_claims.filter((f: any) => {
            const reason = String(f?.reason || '').toLowerCase();
            return reason.includes('not unclaimed') || reason.includes('already claimed');
          });
          if (alreadyClaimed.length > 0) {
            toast({
              title: 'Some Orders No Longer Available',
              description: `${alreadyClaimed.length} order(s) are no longer available for claim.`,
            });
          }
        }
        
        // Clear selection and refresh
        setSelectedUnclaimedOrders([]);
        console.log('🔄 FRONTEND: Refreshing orders after bulk claim...');
        try {
          await refreshOrders();
          console.log('✅ FRONTEND: Orders and grouped orders refreshed successfully');
        } catch (refreshError) {
          console.log('⚠️ FRONTEND: Failed to refresh orders, but bulk claim request completed');
        }
        
      } else {
        console.log('❌ FRONTEND: Bulk claim failed');
        console.log('  - Error message:', response.message);
        const msg = (response.message || '').toLowerCase();
        if (msg.includes('not unclaimed') || msg.includes('already claimed')) {
          toast({
            title: 'No Longer Available',
            description: 'Some selected orders are no longer available for claim.',
          });
          try { await refreshOrders(); } catch {}
        } else {
          toast({
            title: 'Bulk Claim Failed',
            description: response.message || 'Could not claim selected orders',
            variant: 'destructive',
          });
        }
      }
    } catch (err: any) {
      console.log('💥 FRONTEND: Exception occurred during bulk claim');
      console.log('  - Error:', err);
      console.log('  - Error message:', err.message);
      
      const message = String(err?.message || '').toLowerCase();
      if (message.includes('not unclaimed') || message.includes('already claimed')) {
        toast({
          title: 'No Longer Available',
          description: 'Some selected orders are no longer available for claim.',
        });
        try { await refreshOrders(); } catch {}
      } else {
        toast({
          title: 'Bulk Claim Failed',
          description: err.message || 'Network error occurred',
          variant: 'destructive',
        });
      }
    }
  }

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
      {/* Header - Single Row Layout */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-4">
            {/* Dashboard Name and Welcome */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 truncate">Vendor Dashboard</h1>
                <p className="text-sm text-gray-500 truncate">
                  Welcome back, {user?.name}
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
                  <div className="text-xs text-gray-700 truncate">{vendorAddress.city}, {vendorAddress.pincode}</div>
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
                  <p className="text-sm font-medium text-gray-600">All Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {orders.filter((o) => o.status === "unclaimed").length}
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
                    {orders.filter((o) => o.status === "claimed" && o.claimed_by === user?.warehouseId).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Upload className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Handover</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {orders.filter((o) => o.status === "ready_for_handover" && o.claimed_by === user?.warehouseId && o.is_manifest === 1).length}
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order Management</CardTitle>
                <CardDescription>Manage your orders across different stages</CardDescription>
              </div>
              <Button
                onClick={handleRefreshOrders}
                disabled={ordersRefreshing}
                variant="outline"
                className="h-10"
              >
                {ordersRefreshing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Orders
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Fixed Controls Section */}
              <div className="sticky top-20 bg-white z-40 pb-4 border-b mb-4">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="all-orders">
                    All Orders ({getFilteredOrdersForTab("all-orders").length})
                  </TabsTrigger>
                  <TabsTrigger value="my-orders">
                    My Orders ({getFilteredOrdersForTab("my-orders").length})
                  </TabsTrigger>
                  <TabsTrigger value="handover">
                    Handover ({getFilteredOrdersForTab("handover").length})
                  </TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search"
                        value={getCurrentTabFilters().searchTerm}
                        onChange={(e) => updateCurrentTabFilter('searchTerm', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <DatePicker
                      date={getCurrentTabFilters().dateFrom}
                      onDateChange={(date) => updateCurrentTabFilter('dateFrom', date)}
                      placeholder="From date"
                      className="w-40"
                    />
                    <span className="text-gray-500 text-sm px-1">to</span>
                    <DatePicker
                      date={getCurrentTabFilters().dateTo}
                      onDateChange={(date) => updateCurrentTabFilter('dateTo', date)}
                      placeholder="To date"
                      className="w-40"
                    />
                  </div>
                  
                  {/* Tab-specific Actions */}
                  {activeTab === "all-orders" && (
                    <Button 
                      onClick={() => handleBulkClaimOrders()} 
                      disabled={selectedUnclaimedOrders.length === 0} 
                      className="h-10 whitespace-nowrap px-6 text-sm min-w-fit"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Claim Selected ({selectedUnclaimedOrders.length})
                    </Button>
                  )}
                  
                  {activeTab === "my-orders" && (
                    <div className="flex gap-3 items-center">
                      <Select value={labelFormat} onValueChange={setLabelFormat}>
                        <SelectTrigger className="w-36 h-10 text-sm">
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
                        className="h-10 whitespace-nowrap px-6 text-sm min-w-fit"
                      >
                        {bulkDownloadLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download ({selectedMyOrders.length})
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
                        className="h-10 whitespace-nowrap px-6 text-sm min-w-fit"
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
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Ready ({selectedMyOrders.length})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>


              </div>

              {/* Scrollable Content Section */}
              <div className="max-h-[600px] overflow-y-auto relative">
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
                                  setSelectedUnclaimedOrders(unclaimedOrders.map((o) => o.unique_id))
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
                          <TableHead>Order Date</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Product Code</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredOrdersForTab("all-orders").map((order) => (
                          <TableRow key={order.unique_id}>
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
                            <TableCell>{order.product_code}</TableCell>
                            <TableCell>{order.value || "-"}</TableCell>
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
                  ) : (
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
                            <TableHead>Total Value</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredOrdersForTab("my-orders").map((order) => (
                            <TableRow key={order.order_id} className="group">
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
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-medium">
                                          ₹{product.value || 0}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-center align-middle">
                                <div className="text-lg font-semibold text-blue-600">
                                  {order.total_products}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-green-600">
                                  ₹{order.total_value.toFixed(2)}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 min-w-fit">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadLabel(order.order_id, "single")}
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
                                    onClick={() => handleRequestReverse(order.order_id)}
                                    className="text-xs px-2 py-1 h-8"
                                  >
                                    Reverse
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
                        {getFilteredOrdersForTab("handover").map((order) => (
                          <TableRow key={order.order_id}>
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

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageProduct} onOpenChange={() => setSelectedImageProduct(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedImageProduct ? selectedImageProduct.title : "Image Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
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
              <div className="flex items-center justify-center h-[70vh] text-gray-500">
                No image available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
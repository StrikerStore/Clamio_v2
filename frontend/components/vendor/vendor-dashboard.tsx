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
  Loader2,
  Truck,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { useDeviceType } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { apiClient } from "@/lib/api"
import { vendorErrorTracker } from "@/lib/vendorErrorTracker"

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
    "order-tracking": {
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
  const [selectedHandoverOrders, setSelectedHandoverOrders] = useState<string[]>([])
  const [selectedTrackingOrders, setSelectedTrackingOrders] = useState<string[]>([])
  const [bulkMarkReadyLoading, setBulkMarkReadyLoading] = useState(false)
  const [manifestDownloadLoading, setManifestDownloadLoading] = useState<string | null>(null)
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
  
  // Use ref to store latest lastUpdated value to avoid stale closure in polling
  const lastUpdatedRef = useRef<string | null>(null);

  // Ref for scrollable content area
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  // Grouped orders for My Orders tab
  const [groupedOrders, setGroupedOrders] = useState<any[]>([]);
  const [groupedOrdersLoading, setGroupedOrdersLoading] = useState(true);
  const [groupedOrdersError, setGroupedOrdersError] = useState("");
  const [groupedOrdersPage, setGroupedOrdersPage] = useState(1);
  const [groupedOrdersHasMore, setGroupedOrdersHasMore] = useState(true);
  const [groupedOrdersTotalCount, setGroupedOrdersTotalCount] = useState(0);
  const [groupedOrdersTotalQuantity, setGroupedOrdersTotalQuantity] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Store all grouped orders (all pages) for filtered count calculation
  const [allGroupedOrders, setAllGroupedOrders] = useState<any[]>([]);
  const [isLoadingAllOrders, setIsLoadingAllOrders] = useState(false);

  // Handover orders state
  const [handoverOrders, setHandoverOrders] = useState<any[]>([]);
  const [handoverOrdersLoading, setHandoverOrdersLoading] = useState(true);
  const [handoverOrdersError, setHandoverOrdersError] = useState("");
  const [handoverOrdersPage, setHandoverOrdersPage] = useState(1);
  const [handoverOrdersHasMore, setHandoverOrdersHasMore] = useState(true);
  const [handoverOrdersTotalCount, setHandoverOrdersTotalCount] = useState(0);
  const [handoverOrdersTotalQuantity, setHandoverOrdersTotalQuantity] = useState(0);
  const [isLoadingMoreHandover, setIsLoadingMoreHandover] = useState(false);

  // Order Tracking orders state (no pagination - loads all orders at once)
  const [trackingOrders, setTrackingOrders] = useState<any[]>([]);
  const [trackingOrdersLoading, setTrackingOrdersLoading] = useState(true);
  const [trackingOrdersError, setTrackingOrdersError] = useState("");
  const [trackingOrdersTotalCount, setTrackingOrdersTotalCount] = useState(0);
  const [trackingOrdersTotalQuantity, setTrackingOrdersTotalQuantity] = useState(0);

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

  // Tab highlight animation state
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null)
  
  // Status filter state for handover tab
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  
  // Status filter state for order tracking tab
  const [selectedTrackingStatuses, setSelectedTrackingStatuses] = useState<string[]>([])
  
  // Label download filter state for my orders tab
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>('all')

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

      // Also refresh grouped orders for My Orders tab (reset pagination)
      console.log('🔄 Refreshing grouped orders data...');
      setGroupedOrdersPage(1);
      const groupedResponse = await apiClient.getGroupedOrders(1, 50);
      if (groupedResponse.success && groupedResponse.data && Array.isArray(groupedResponse.data.groupedOrders)) {
        setGroupedOrders(groupedResponse.data.groupedOrders);
        
        // Update pagination metadata
        if (groupedResponse.data.pagination) {
          setGroupedOrdersHasMore(groupedResponse.data.pagination.hasMore);
          setGroupedOrdersTotalCount(groupedResponse.data.pagination.total);
        }
        
        // Ensure My Orders card/tab counts reflect the latest absolute total
        if (typeof groupedResponse.data.totalQuantity === 'number') {
          setGroupedOrdersTotalQuantity(groupedResponse.data.totalQuantity);
        }
        
        console.log('✅ Grouped orders refreshed successfully');
      } else {
        console.log('⚠️ Failed to refresh grouped orders');
      }

      // Refresh Handover orders
      console.log('🔄 Refreshing handover orders data...');
      await fetchHandoverOrders();

      // Refresh Order Tracking orders
      console.log('🔄 Refreshing order tracking orders data...');
      await fetchOrderTrackingOrders();
    } catch (err: any) {
      console.error("Error refreshing orders:", err);
      setOrdersError(err.message || "Failed to refresh orders");
    }
  };

  // Commented out - fetchOrders() is already called in the useEffect at line 629
  // useEffect(() => {
  //   fetchOrders();
  // }, []);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      // Run both API calls in parallel for better performance
      const [ordersResponse, lastUpdatedResponse] = await Promise.all([
        apiClient.getOrders(),
        apiClient.getOrdersLastUpdated()
      ]);
      
      // Process orders response
      if (ordersResponse.success && ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
        setOrders(ordersResponse.data.orders);
      } else if (ordersResponse.success && ordersResponse.data && ordersResponse.data.orders) {
        setOrders([ordersResponse.data.orders]);
      } else {
        setOrders([]);
        setOrdersError("No orders found");
      }
      
      // Process last updated response
      if (lastUpdatedResponse.success && lastUpdatedResponse.data) {
        const timestamp = lastUpdatedResponse.data.lastUpdated;
        setLastUpdated(timestamp);
        lastUpdatedRef.current = timestamp; // Keep ref in sync
      }
    } catch (err: any) {
      setOrdersError(err.message || "Failed to fetch orders");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  // Fetch all grouped orders (all pages) for filtered count calculation
  const fetchAllGroupedOrders = async () => {
    setIsLoadingAllOrders(true);
    try {
      let allOrders: any[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await apiClient.getGroupedOrders(page, 50);
        
        if (response.success && response.data && Array.isArray(response.data.groupedOrders)) {
          allOrders = [...allOrders, ...response.data.groupedOrders];
          
          if (response.data.pagination) {
            hasMore = response.data.pagination.hasMore;
            page++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log('✅ Fetched all grouped orders:', allOrders.length);
      setAllGroupedOrders(allOrders);
    } catch (err: any) {
      console.error('❌ Error fetching all grouped orders:', err);
      setAllGroupedOrders([]);
    } finally {
      setIsLoadingAllOrders(false);
    }
  };

  const fetchGroupedOrders = async (resetPagination: boolean = true) => {
    if (resetPagination) {
      setGroupedOrdersLoading(true);
      setGroupedOrdersPage(1);
    } else {
      setIsLoadingMore(true);
    }
    
    setGroupedOrdersError("");
    
    try {
      const pageToFetch = resetPagination ? 1 : groupedOrdersPage;
      const response = await apiClient.getGroupedOrders(pageToFetch, 50);
      
      if (response.success && response.data && Array.isArray(response.data.groupedOrders)) {
        if (resetPagination) {
          // Replace orders on reset (initial load or refresh)
          setGroupedOrders(response.data.groupedOrders);
        } else {
          // Append orders for infinite scroll
          setGroupedOrders(prev => [...prev, ...response.data.groupedOrders]);
        }
        
        // Update pagination metadata
        if (response.data.pagination) {
          setGroupedOrdersHasMore(response.data.pagination.hasMore);
          setGroupedOrdersTotalCount(response.data.pagination.total);
          // Increment page number for next load
          if (resetPagination) {
            setGroupedOrdersPage(2); // Set to 2 after initial load
          } else {
            setGroupedOrdersPage(prev => prev + 1);
          }
        }
        
        // Update total quantity (only on reset to avoid overwriting with partial data)
        if (resetPagination && response.data.totalQuantity !== undefined) {
          console.log('🔢 Setting groupedOrdersTotalQuantity:', response.data.totalQuantity);
          setGroupedOrdersTotalQuantity(response.data.totalQuantity);
        } else if (resetPagination) {
          console.log('⚠️ totalQuantity not found in response data:', response.data);
        }
      } else {
        if (resetPagination) {
          setGroupedOrders([]);
        }
        setGroupedOrdersError("No grouped orders found");
      }
    } catch (err: any) {
      setGroupedOrdersError(err.message || "Failed to fetch grouped orders");
      if (resetPagination) {
        setGroupedOrders([]);
      }
    } finally {
      setGroupedOrdersLoading(false);
      setIsLoadingMore(false);
    }
  }

  const fetchHandoverOrders = async (resetPagination: boolean = true) => {
    if (resetPagination) {
      setHandoverOrdersLoading(true);
      setHandoverOrdersPage(1);
    } else {
      setIsLoadingMoreHandover(true);
    }
    
    setHandoverOrdersError("");
    
    try {
      const page = resetPagination ? 1 : handoverOrdersPage;
      const response = await apiClient.getHandoverOrders(page, 50);
      
      if (response.success && response.data) {
        const newOrders = response.data.handoverOrders || [];
        
        if (resetPagination) {
          setHandoverOrders(newOrders);
        } else {
          setHandoverOrders(prev => [...prev, ...newOrders]);
        }
        
        // Update pagination metadata
        setHandoverOrdersHasMore(response.data.pagination?.has_next || false);
        
        // Always update total count from API (even if page is not fully loaded)
        if (response.data.summary?.total_orders !== undefined) {
          setHandoverOrdersTotalCount(response.data.summary.total_orders);
        }
        if (response.data.summary?.total_quantity !== undefined) {
          setHandoverOrdersTotalQuantity(response.data.summary.total_quantity);
        }
        
        // Increment page number for next load
        if (resetPagination) {
          setHandoverOrdersPage(2); // Set to 2 after initial load
        } else {
          setHandoverOrdersPage(prev => prev + 1);
        }
      }
    } catch (err: any) {
      setHandoverOrdersError(err.message || "Failed to fetch handover orders");
      if (resetPagination) {
        setHandoverOrders([]);
      }
    } finally {
      setHandoverOrdersLoading(false);
      setIsLoadingMoreHandover(false);
    }
  };

  const fetchOrderTrackingOrders = async () => {
    setTrackingOrdersLoading(true);
    setTrackingOrdersError("");
    
    try {
      const response = await apiClient.getOrderTrackingOrders();
      
      if (response.success && response.data) {
        const allOrders = response.data.trackingOrders || [];
        setTrackingOrders(allOrders);
        
        // Update summary data
        if (response.data.summary?.total_orders !== undefined) {
          setTrackingOrdersTotalCount(response.data.summary.total_orders);
        }
        if (response.data.summary?.total_quantity !== undefined) {
          setTrackingOrdersTotalQuantity(response.data.summary.total_quantity);
        }
      }
    } catch (err: any) {
      setTrackingOrdersError(err.message || "Failed to fetch order tracking orders");
      setTrackingOrders([]);
    } finally {
      setTrackingOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchGroupedOrders();
    fetchHandoverOrders();
    fetchOrderTrackingOrders();
  }, []);

  // Fetch all orders when filters are applied on My Orders tab
  useEffect(() => {
    if (activeTab !== "my-orders") {
      // Clear all orders when not on my-orders tab to save memory
      setAllGroupedOrders([]);
      return;
    }

    const tabFilter = tabFilters["my-orders"];
    const hasSearchFilter = tabFilter.searchTerm.trim().length > 0;
    const hasDateFilter = tabFilter.dateFrom || tabFilter.dateTo;
    const hasLabelFilter = selectedLabelFilter !== 'all';
    const hasFilters = hasSearchFilter || hasDateFilter || hasLabelFilter;

    if (hasFilters && !isLoadingAllOrders && allGroupedOrders.length === 0) {
      // Fetch all orders when filters are applied and we don't have them yet
      console.log('🔍 Filters applied - fetching all grouped orders for filtered count');
      fetchAllGroupedOrders();
    } else if (!hasFilters && allGroupedOrders.length > 0) {
      // Clear all orders when filters are removed to save memory
      setAllGroupedOrders([]);
    }
  }, [activeTab, tabFilters["my-orders"].searchTerm, tabFilters["my-orders"].dateFrom, tabFilters["my-orders"].dateTo, selectedLabelFilter]);

  // Real-time polling for order updates (only when tab is visible)
  useEffect(() => {
    if (!user?.role || user.role !== "vendor") return;

    let interval: NodeJS.Timeout | null = null;

    const pollForUpdates = async () => {
      // Skip polling if tab is hidden
      if (document.hidden) {
        return;
      }

      try {
        const response = await apiClient.getOrdersLastUpdated();
        if (response.success && response.data) {
          const newLastUpdated = response.data.lastUpdated;
          const currentLastUpdated = lastUpdatedRef.current; // Use ref to get latest value
          
          // Debug logging
          if (currentLastUpdated !== null && newLastUpdated !== currentLastUpdated) {
            console.log('🔄 Orders updated by another vendor, refreshing...');
            console.log('  - Old timestamp:', currentLastUpdated);
            console.log('  - New timestamp:', newLastUpdated);
            
            // Refresh orders
            const ordersResponse = await apiClient.getOrders();
            if (ordersResponse.success && ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
              setOrders(ordersResponse.data.orders);
              console.log('✅ FRONTEND: Orders refreshed due to external update');
            }
            
            // Update both state and ref
            setLastUpdated(newLastUpdated);
            lastUpdatedRef.current = newLastUpdated;
          } else if (currentLastUpdated === null) {
            // First time - just set the timestamp
            setLastUpdated(newLastUpdated);
            lastUpdatedRef.current = newLastUpdated;
          } else {
            // Timestamp hasn't changed - no need to refresh
            // console.log('ℹ️ No changes detected, skipping refresh');
          }
        }
      } catch (error) {
        console.error('Error polling for updates:', error);
      }
    };

    const startPolling = () => {
      // Clear existing interval if any
      if (interval) {
        clearInterval(interval);
      }
      
      // Only start polling if tab is visible
      if (!document.hidden) {
        // Poll immediately on visibility
        pollForUpdates();
        
        // Then poll every 15 seconds
        interval = setInterval(pollForUpdates, 10000);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - stop polling
        stopPolling();
        console.log('⏸️ Polling paused (tab hidden)');
      } else {
        // Tab is visible - start polling
        startPolling();
        console.log('▶️ Polling resumed (tab visible)');
      }
    };

    // Start polling initially if tab is visible
    startPolling();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also handle page focus/blur for mobile web apps
    const handleFocus = () => {
      if (!document.hidden) {
        startPolling();
        console.log('▶️ Polling resumed (window focused)');
      }
    };

    const handleBlur = () => {
      stopPolling();
      console.log('⏸️ Polling paused (window blurred)');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [user]); // Removed lastUpdated from dependencies to prevent re-creating interval on every timestamp change

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

  const downloadManifestSummary = async (manifestIds: string[]) => {
    const manifestKey = manifestIds.join(',');
    try {
      setManifestDownloadLoading(manifestKey);
      
      const vendorToken = localStorage.getItem('vendorToken');
      if (!vendorToken) {
        console.error('No vendor token found');
        return;
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/orders/download-manifest-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': vendorToken,
        },
        body: JSON.stringify({ manifest_ids: manifestIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to download manifest summary');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `manifest-summary-${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Manifest Downloaded",
        description: "Manifest summary PDF has been downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading manifest summary:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download manifest summary PDF",
        variant: "destructive",
      });
    } finally {
      setManifestDownloadLoading(null);
    }
  };

  const handleBulkManifestDownload = async () => {
    if (selectedHandoverOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select at least one order to download manifests",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get filtered orders for handover tab
      const handoverOrders = getFilteredHandoverOrders();
      
      // Extract unique manifest_ids from selected orders
      const uniqueManifestIds = new Set<string>();
      
      selectedHandoverOrders.forEach(orderId => {
        const order = handoverOrders.find((o: any) => o.order_id === orderId);
        if (order && order.manifest_id) {
          uniqueManifestIds.add(order.manifest_id);
        }
      });

      const manifestIdsArray = Array.from(uniqueManifestIds);

      if (manifestIdsArray.length === 0) {
        toast({
          title: "No Manifest IDs Found",
          description: "Selected orders do not have manifest IDs",
          variant: "destructive",
        });
        return;
      }

      console.log('📥 Bulk downloading manifests:', manifestIdsArray);
      
      // Download all manifests in single PDF
      await downloadManifestSummary(manifestIdsArray);
      
      // Clear selection after successful download
      setSelectedHandoverOrders([]);
      
    } catch (error) {
      console.error('Bulk manifest download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download manifests",
        variant: "destructive",
      });
    }
  };

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
        
        // Auto-download manifest summary PDF
        if (data.data.manifest_ids && data.data.manifest_ids.length > 0) {
          console.log('📥 Auto-downloading manifest summary PDF...', data.data.manifest_ids);
          await downloadManifestSummary(data.data.manifest_ids);
        }
        
        // Clear selection and refresh orders
        setSelectedMyOrders([]);
        
        // Highlight Handover tab to show the change
        highlightTab("handover");
        
        fetchGroupedOrders();
        fetchHandoverOrders();
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
      // Legacy status values for backward compatibility
      claimed: "bg-blue-100 text-blue-800",
      ready_for_handover: "bg-purple-100 text-purple-800",
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
      // Legacy status values for backward compatibility
      claimed: "CLAIMED",
      ready_for_handover: "READY FOR HANDOVER",
    }

    return (
      <Badge className={`${colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"} text-xs sm:text-sm truncate max-w-full`}>
        {displayNames[status as keyof typeof displayNames] || status.toUpperCase()}
      </Badge>
    )
  }

  // Maps shipment status to colored badge classes per UI requirement
  const getShipmentBadgeClasses = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'in transit' || s === 'in_transit' || s.includes('transit')) {
      return 'text-orange-800 bg-orange-100 border border-orange-200';
    }
    if (s === 'out for delivery' || s === 'out_for_delivery') {
      return 'text-yellow-800 bg-yellow-100 border border-yellow-200';
    }
    if (s === 'delivered') {
      return 'text-green-800 bg-green-100 border border-green-200';
    }
    if (s === 'pickup failed' || s === 'failed pickup' || s === 'failed delivery') {
      return 'text-red-800 bg-red-100 border border-red-200';
    }
    return 'text-blue-800 bg-blue-100 border border-blue-200';
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
        // Use claims_status for filtering since the main status now shows enhanced status
        let handoverOrders = orders.filter(order => 
          order.claims_status === 'ready_for_handover' && 
          order.claimed_by === currentVendorId &&
          order.is_manifest === 1
        );
        
        // Apply status filter if any statuses are selected
        if (selectedStatuses.length > 0) {
          handoverOrders = handoverOrders.filter(order => 
            selectedStatuses.includes(order.status)
          );
        }
        
        // Group orders by order_id for handover tab
        const handoverGrouped = handoverOrders.reduce((acc: any, order) => {
          const orderId = order.order_id;
          if (!acc[orderId]) {
            acc[orderId] = {
              order_id: orderId,
              order_date: order.order_date,
              claimed_by: order.claimed_by,
              status: order.status,
              claims_status: order.claims_status,
              current_shipment_status: order.current_shipment_status,
              is_handover: order.is_handover,
              is_manifest: order.is_manifest,
              manifest_id: order.manifest_id,
              total_quantity: 0,
              products: []
            };
          }
          acc[orderId].products.push(order);
          acc[orderId].total_quantity += order.quantity || 0;
          return acc;
        }, {});
        
        baseOrders = Object.values(handoverGrouped);
        break;
      case "my-orders":
        // For My Orders, use groupedOrders directly and apply label download filter
        let filteredGroupedOrders = [...groupedOrders];
        
        // Debug: Log the first order to see data structure
        if (groupedOrders.length > 0) {
          console.log('🔍 First Order Data Structure:', groupedOrders[0]);
        }
        
        // Apply label download filter to grouped orders
        if (selectedLabelFilter === 'downloaded') {
          filteredGroupedOrders = groupedOrders.filter(order => 
            order.label_downloaded === 1
          );
          console.log('🔍 Label Downloaded Filter:', {
            totalOrders: groupedOrders.length,
            filteredOrders: filteredGroupedOrders.length,
            selectedFilter: selectedLabelFilter
          });
        } else if (selectedLabelFilter === 'not_downloaded') {
          filteredGroupedOrders = groupedOrders.filter(order => 
            order.label_downloaded === 0
          );
          console.log('🔍 Label Not Downloaded Filter:', {
            totalOrders: groupedOrders.length,
            filteredOrders: filteredGroupedOrders.length,
            selectedFilter: selectedLabelFilter
          });
        }
        
        baseOrders = filteredGroupedOrders;
        break;
      default:
        baseOrders = orders;
    }
    
    // Apply search filter across order id, product name, SKU, and customer name
    if (tabFilter.searchTerm.trim()) {
      const term = tabFilter.searchTerm.toLowerCase();
      baseOrders = baseOrders.filter(order => {
        const orderId = String(order.order_id || order.id || '').toLowerCase();
        const customer = String(order.customer_name || order.customer || '').toLowerCase();
        
        // For grouped orders (handover tab), search through products array
        if (Array.isArray(order.products) && order.products.length > 0) {
          const productMatch = order.products.some((product: any) => {
            const name = String(product.product_name || '').toLowerCase();
            const sku = String(product.product_code || product.sku || '').toLowerCase();
            return name.includes(term) || sku.includes(term);
          });
          return orderId.includes(term) || customer.includes(term) || productMatch;
        }
        
        // For individual orders (all-orders tab), search direct fields
        const productName = String(order.product_name || order.product || '').toLowerCase();
        const sku = String(order.product_code || order.sku || '').toLowerCase();
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
    // Use 'order_id' for handover tab (grouped orders) and 'unique_id' for all-orders tab (individual orders)
    const deduplicationKey = tab === "handover" ? 'order_id' : 'unique_id';
    return ensureUniqueOrders(baseOrders, deduplicationKey);
  }

  // Filter handover orders based on search/date/status filters
  const getFilteredHandoverOrders = () => {
    let filtered = [...handoverOrders];
    const tabFilter = tabFilters["handover"];
    
    // Apply status filter if any statuses are selected
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(order => 
        selectedStatuses.includes(order.current_shipment_status || order.status)
      );
    }
    
    // Apply search filter
    if (tabFilter.searchTerm.trim()) {
      const term = tabFilter.searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const orderId = String(order.order_id || '').toLowerCase();
        const customer = String(order.customer_name || '').toLowerCase();
        const manifestId = String(order.manifest_id || '').toLowerCase();
        const awb = String(order.products?.[0]?.awb || '').toLowerCase();
        
        // Search through products array
        if (Array.isArray(order.products) && order.products.length > 0) {
          const productMatch = order.products.some((product: any) => {
            const name = String(product.product_name || '').toLowerCase();
            const sku = String(product.product_code || '').toLowerCase();
            return name.includes(term) || sku.includes(term);
          });
          return orderId.includes(term) || customer.includes(term) || manifestId.includes(term) || awb.includes(term) || productMatch;
        }
        return orderId.includes(term) || customer.includes(term) || manifestId.includes(term) || awb.includes(term);
      });
    }
    
    // Apply date range filter
    if (tabFilter.dateFrom && tabFilter.dateTo) {
      filtered = filtered.filter(order => {
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
      filtered = filtered.filter(order => {
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
      filtered = filtered.filter(order => {
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
    
    return filtered;
  };

  // Filter tracking orders based on search/date/status filters
  const getFilteredTrackingOrders = () => {
    let filtered = [...trackingOrders];
    const tabFilter = tabFilters["order-tracking"];
    
    // Apply status filter if any statuses are selected
    if (selectedTrackingStatuses.length > 0) {
      filtered = filtered.filter(order => 
        selectedTrackingStatuses.includes(order.current_shipment_status || order.status)
      );
    }
    
    // Apply search filter
    if (tabFilter.searchTerm.trim()) {
      const term = tabFilter.searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const orderId = String(order.order_id || '').toLowerCase();
        const awb = String(order.products?.[0]?.awb || '').toLowerCase();
        
        // Search through products array
        if (Array.isArray(order.products) && order.products.length > 0) {
          const productMatch = order.products.some((product: any) => {
            const name = String(product.product_name || '').toLowerCase();
            const sku = String(product.product_code || '').toLowerCase();
            return name.includes(term) || sku.includes(term);
          });
          return orderId.includes(term) || awb.includes(term) || productMatch;
        }
        return orderId.includes(term) || awb.includes(term);
      });
    }
    
    // Apply date range filter
    if (tabFilter.dateFrom && tabFilter.dateTo) {
      filtered = filtered.filter(order => {
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
      filtered = filtered.filter(order => {
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
      filtered = filtered.filter(order => {
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
    
    return filtered;
  };

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

  // Get unique shipment status values from tracking orders
  const getUniqueTrackingStatuses = () => {
    const uniqueStatuses = new Set<string>();
    trackingOrders.forEach(order => {
      const status = order.current_shipment_status || order.status;
      if (status && status.trim() !== '') {
        uniqueStatuses.add(status);
      }
    });
    return Array.from(uniqueStatuses).sort();
  }

  // Filter grouped orders for My Orders tab (with option to use all orders)
  const getFilteredGroupedOrdersForTab = (tab: string, useAllOrders: boolean = false) => {
    let baseOrders = useAllOrders && allGroupedOrders.length > 0 ? allGroupedOrders : groupedOrders;
    const tabFilter = tabFilters[tab as keyof typeof tabFilters];
    
    // Apply label download filter for my orders tab
    if (tab === "my-orders" && selectedLabelFilter !== 'all') {
      if (selectedLabelFilter === 'downloaded') {
        baseOrders = baseOrders.filter(order => 
          order.label_downloaded === 1
        );
      } else if (selectedLabelFilter === 'not_downloaded') {
        baseOrders = baseOrders.filter(order => 
          order.label_downloaded === 0
        );
      }
    }
    
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

  // Helper function to check if unclaim should be disabled
  const isUnclaimDisabled = (order: any): boolean => {
    // Disable if order is handed over (is_handover = 1)
    const isHandedOver = order.is_handover === 1 || order.is_handover === '1' || order.is_handover === true;
    
    // Disable if status is "Out for Pickup"
    const isOutForPickup = order.current_shipment_status && 
      String(order.current_shipment_status).toLowerCase() === 'out for pickup';
    
    return isHandedOver || isOutForPickup;
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
            let description = response.message || `Successfully unclaimed ${response.data.products_processed} product${response.data.products_processed > 1 ? 's' : ''} in order ${orderId}`;
            
            if (response.data.skipped_products > 0) {
              description += ` (${response.data.skipped_products} products were claimed by other vendors and were not affected)`;
            }
            
            toast({
              title: 'Order Unclaimed',
              description: description,
              variant: response.data.skipped_products > 0 ? 'default' : 'default'
            });
          } else {
            console.log('❌ FRONTEND: Grouped reverse failed');
            console.log('  - Error message:', response.message);
            toast({
              title: 'Unclaim Failed',
              description: response.message || 'Could not unclaim grouped order',
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          console.log('💥 FRONTEND: Exception in grouped reverse:', err.message);
          toast({
            title: 'Unclaim Failed',
            description: err.message || 'Failed to unclaim grouped order',
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
            title: 'Order Unclaimed',
            description: response.message || `Order ${orderId} has been unclaimed successfully`,
          });
        } else {
          console.log('❌ FRONTEND: Reverse failed');
          console.log('  - Error message:', response.message);
          toast({
            title: 'Unclaim Failed',
            description: response.message || 'Could not unclaim order',
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
        title: 'Unclaim Failed',
        description: err.message || 'Network error occurred',
        variant: 'destructive',
      });
    } finally {
      // Clear loading state
      setReverseLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  // Helper function to detect iOS devices
  const isIOSDevice = (): boolean => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    // Check for iPhone, iPad, or iPod
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    // Also check for iPad on iOS 13+ (which reports as Mac)
    const isIPadOS13 = /Macintosh/i.test(userAgent) && 
                       navigator.maxTouchPoints && 
                       navigator.maxTouchPoints > 1;
    return isIOS || isIPadOS13;
  };

  // Helper function to download file with iOS compatibility
  const downloadFile = async (url: string, filename: string): Promise<void> => {
    const isIOS = isIOSDevice();
    
    if (isIOS) {
      // iOS: Use iframe approach (doesn't block JavaScript execution)
      console.log('🍎 iOS detected: Using iframe download method');
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      // Clean up after delay
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        window.URL.revokeObjectURL(url);
      }, 2000);
    } else {
      // Non-iOS: Use link.click() approach
      console.log('📱 Non-iOS device: Using link.click() download method');
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

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
            
            // Create download URL
            const url = window.URL.createObjectURL(blob);
            
            // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}_{format}
            const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
            const vendorId = user?.warehouseId || 'unknown';
            const vendorCity = vendorAddress?.city || 'unknown';
            const filename = `${vendorId}_${vendorCity}_${currentDate}_${responseFormat}.pdf`;
            
            // Download using iOS-compatible method
            await downloadFile(url, filename);
            
            console.log('✅ FRONTEND: Formatted PDF downloaded successfully');
            
            // Show success message
            const orderDisplayId = clone_order_id || original_order_id || orderId;
            toast({
              title: "Label Downloaded",
              description: `${responseFormat} label for order ${orderDisplayId} downloaded successfully`,
            });
            
            // Refresh orders to update the UI (works immediately on iOS with iframe approach)
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
            
            // Create download URL
            const url = window.URL.createObjectURL(blob);
            
            // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}
            const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
            const vendorId = user?.warehouseId || 'unknown';
            const vendorCity = vendorAddress?.city || 'unknown';
            const filename = `${vendorId}_${vendorCity}_${currentDate}.pdf`;
            
            // Download using iOS-compatible method
            await downloadFile(url, filename);
            
            console.log('✅ FRONTEND: Label file downloaded successfully');
            
            // Show success message
            const orderDisplayId = clone_order_id || original_order_id || orderId;
            toast({
              title: "Label Downloaded",
              description: `${format} label for order ${orderDisplayId} downloaded successfully`,
            });
            
            // Refresh orders to update the UI (works immediately on iOS with iframe approach)
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
      
      // Create download URL for the combined PDF
      const url = window.URL.createObjectURL(blob);
      
      // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}_{format}
      const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
      const vendorId = user?.warehouseId || 'unknown';
      const vendorCity = vendorAddress?.city || 'unknown';
      const filename = `${vendorId}_${vendorCity}_${currentDate}_${labelFormat}.pdf`;
      
      // Download using iOS-compatible method
      await downloadFile(url, filename);
      
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

      // Refresh orders to update the UI (works immediately on iOS with iframe approach)
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
        
        // OPTIMIZATION: Update UI state directly instead of fetching all orders
        // Remove successfully claimed orders from "All Orders" tab
        if (successful_claims && successful_claims.length > 0) {
          const claimedUniqueIds = successful_claims.map((claim: any) => claim.unique_id);
          
          console.log('🔍 FRONTEND: Verifying order statuses in database before removing from UI...');
          console.log('  - Unique IDs to verify:', claimedUniqueIds);
          
          // STEP 1: Verify orders are actually marked as "claimed" in database
          try {
            const verifyResponse = await apiClient.verifyOrderStatuses(claimedUniqueIds);
            
            if (verifyResponse.success && verifyResponse.data && verifyResponse.data.statuses) {
              const statuses = verifyResponse.data.statuses;
              const verifiedClaimedIds = new Set<string>();
              const notClaimedIds: string[] = [];
              
              // STEP 2: Check each order's status and collect only verified "claimed" orders
              claimedUniqueIds.forEach((unique_id: string) => {
                const orderStatus = statuses[unique_id];
                if (orderStatus && orderStatus.status === 'claimed') {
                  verifiedClaimedIds.add(unique_id);
                  console.log(`✅ Verified: ${unique_id} is marked as "claimed" in database`);
                } else {
                  notClaimedIds.push(unique_id);
                  console.log(`⚠️ Warning: ${unique_id} is NOT marked as "claimed" in database (status: ${orderStatus?.status || 'unknown'})`);
                }
              });
              
              if (notClaimedIds.length > 0) {
                console.log(`⚠️ FRONTEND: ${notClaimedIds.length} orders were not verified as claimed - will NOT remove from UI`);
                console.log('  - Not claimed unique_ids:', notClaimedIds);
              }
              
              // STEP 3: Remove ONLY verified claimed orders from "All Orders" tab
              if (verifiedClaimedIds.size > 0) {
                console.log('🔄 FRONTEND: Removing verified claimed orders from All Orders tab...');
                console.log('  - Verified unique IDs to remove:', Array.from(verifiedClaimedIds));
                
                setOrders((prevOrders) => {
                  const filteredOrders = prevOrders.filter(
                    (order) => !verifiedClaimedIds.has(order.unique_id)
                  );
                  const removedCount = prevOrders.length - filteredOrders.length;
                  console.log(`✅ Removed ${removedCount} verified claimed orders from All Orders tab`);
                  return filteredOrders;
                });
              } else {
                console.log('⚠️ FRONTEND: No orders verified as claimed - skipping UI update');
              }
            } else {
              console.log('⚠️ FRONTEND: Verification response invalid - will not remove orders from UI');
              console.log('  - Response:', verifyResponse);
            }
          } catch (verifyError: any) {
            console.log('⚠️ FRONTEND: Error verifying order statuses:', verifyError.message);
            console.log('  - Will not remove orders from UI to prevent data inconsistency');
            // Don't remove orders if verification fails - keep UI in sync with actual DB state
          }
        }
        
        // Refresh grouped orders for "My Orders" tab (this is fast - paginated)
        console.log('🔄 FRONTEND: Refreshing grouped orders for My Orders tab...');
        try {
          setGroupedOrdersPage(1);
          const groupedResponse = await apiClient.getGroupedOrders(1, 50);
          if (groupedResponse.success && groupedResponse.data && Array.isArray(groupedResponse.data.groupedOrders)) {
            setGroupedOrders(groupedResponse.data.groupedOrders);
            if (groupedResponse.data.pagination) {
              setGroupedOrdersHasMore(groupedResponse.data.pagination.hasMore);
              setGroupedOrdersTotalCount(groupedResponse.data.pagination.total);
            }
            if (typeof groupedResponse.data.totalQuantity === 'number') {
              setGroupedOrdersTotalQuantity(groupedResponse.data.totalQuantity);
            }
            console.log('✅ Grouped orders refreshed successfully');
          }
        } catch (groupedError) {
          console.log('⚠️ FRONTEND: Failed to refresh grouped orders, but bulk claim was successful');
        }
        
        // Highlight My Orders tab to show the change
        highlightTab("my-orders");
        
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

  // Infinite scroll handler for all tabs
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrolledToBottom = 
      element.scrollHeight - element.scrollTop <= element.clientHeight + 200;
    
    // Handle My Orders tab
    if (activeTab === 'my-orders' && scrolledToBottom && groupedOrdersHasMore && !groupedOrdersLoading && !isLoadingMore) {
      console.log('📜 Infinite scroll triggered - loading more My Orders...');
      fetchGroupedOrders(false); // false = don't reset pagination
    }
    
    // Handle Handover tab
    if (activeTab === 'handover' && scrolledToBottom && handoverOrdersHasMore && !handoverOrdersLoading && !isLoadingMoreHandover) {
      console.log('📜 Infinite scroll triggered - loading more Handover orders...');
      fetchHandoverOrders(false); // false = don't reset pagination
    }
    
    // Order Tracking tab loads all orders at once, no infinite scroll needed
  };

  // Helper function to trigger tab highlight animation
  const highlightTab = (tabName: string) => {
    setHighlightedTab(tabName);
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedTab(null);
    }, 2000);
  };

  // Helper functions to calculate quantity sums for each tab (WITHOUT filters - for cards)
  // IMPORTANT: 
  // - All counts show PRODUCT totals (sum of quantities), not order counts
  // - Cards ALWAYS show TOTAL (unfiltered) counts, regardless of any active filters
  // - Example: 3 orders with one order having 3 products = 5 total products displayed
  const getTotalQuantitySumForTab = (tabName: string) => {
    if (tabName === "my-orders") {
      // For My Orders card, use the absolute total (no filtering applied)
      console.log('🔍 CARD DEBUG: Using absolute total for card (no filters)');
      console.log('🔍 CARD DEBUG: groupedOrdersTotalQuantity:', groupedOrdersTotalQuantity);
      console.log('🔍 CARD DEBUG: groupedOrders.length:', groupedOrders.length);
      
      // If API total is 0 or seems incorrect, calculate from all visible orders
      if ((groupedOrdersTotalQuantity === 0 || groupedOrdersTotalQuantity < groupedOrders.length) && groupedOrders.length > 0) {
        const calculatedTotal = groupedOrders.reduce((sum, order) => {
          return sum + (order.total_quantity || 0);
        }, 0);
        console.log('🔍 CARD DEBUG: Calculated absolute total from all orders:', calculatedTotal);
        return calculatedTotal;
      }
      
      return groupedOrdersTotalQuantity;
    } else if (tabName === "handover") {
      // For Handover card, use the API total quantity
      return handoverOrdersTotalQuantity;
    } else if (tabName === "order-tracking") {
      // For Order Tracking card, use the API total quantity
      return trackingOrdersTotalQuantity;
    } else {
      // For All Orders card, show absolute total of unclaimed orders (no additional filters)
      const unclaimedOrders = orders.filter(order => order.status === 'unclaimed');
      const uniqueUnclaimedOrders = ensureUniqueOrders(unclaimedOrders, 'unique_id');
      console.log('🔍 ALL ORDERS CARD DEBUG:');
      console.log('  - Total orders:', orders.length);
      console.log('  - Unclaimed orders (before deduplication):', unclaimedOrders.length);
      console.log('  - Unclaimed orders (after deduplication):', uniqueUnclaimedOrders.length);
      console.log('  - Duplicates removed:', unclaimedOrders.length - uniqueUnclaimedOrders.length);
      console.log('  - Card total quantity:', uniqueUnclaimedOrders.reduce((sum, order) => {
        return sum + (order.quantity || 0);
      }, 0));
      return uniqueUnclaimedOrders.reduce((sum, order) => {
        return sum + (order.quantity || 0);
      }, 0);
    }
  };

  // Helper functions to calculate quantity sums for each tab (WITH filters - for tab headers)
  // IMPORTANT:
  // - All counts show PRODUCT totals (sum of quantities), not order counts
  // - When NO filters: Shows same total as card (synchronized)
  // - When filters ARE applied: Shows FILTERED product count (different from card)
  const getQuantitySumForTab = (tabName: string) => {
    if (tabName === "my-orders") {
      const tabFilter = tabFilters[tabName as keyof typeof tabFilters];
      
      // Check if any filters are applied
      const hasSearchFilter = tabFilter.searchTerm.trim().length > 0;
      const hasDateFilter = tabFilter.dateFrom || tabFilter.dateTo;
      const hasLabelFilter = selectedLabelFilter !== 'all';
      const hasFilters = hasSearchFilter || hasDateFilter || hasLabelFilter;
      
      if (!hasFilters) {
        // No filters applied - use absolute total from API (all pages) - this matches the card
        console.log('🔢 TAB COUNT: No filters - using absolute total from API');
        return groupedOrdersTotalQuantity;
      } else {
        // Filters applied - use all orders if available, otherwise use loaded pages
        const useAllOrders = allGroupedOrders.length > 0;
        const filteredOrders = getFilteredGroupedOrdersForTab(tabName, useAllOrders);
        console.log('🔢 TAB COUNT: Filters applied - calculating from filtered orders');
        console.log('🔢 TAB COUNT: Using all orders:', useAllOrders);
        console.log('🔢 TAB COUNT: filteredOrders.length:', filteredOrders.length);
        console.log('🔢 TAB COUNT: allGroupedOrders.length:', allGroupedOrders.length);
        console.log('🔢 TAB COUNT: groupedOrders.length:', groupedOrders.length);
        
        // Calculate total quantity (product count) from filtered orders
        const filteredTotal = filteredOrders.reduce((sum, order) => {
          return sum + (order.total_quantity || 0);
        }, 0);
        
        console.log('🔢 TAB COUNT: Filtered total quantity:', filteredTotal);
        return filteredTotal;
      }
    } else if (tabName === "handover") {
      const tabFilter = tabFilters["handover"];
      
      // Check if any filters are applied
      const hasSearchFilter = tabFilter.searchTerm.trim().length > 0;
      const hasDateFilter = tabFilter.dateFrom || tabFilter.dateTo;
      const hasStatusFilter = selectedStatuses.length > 0;
      const hasFilters = hasSearchFilter || hasDateFilter || hasStatusFilter;
      
      if (!hasFilters) {
        // No filters applied - use absolute total from API (matches the card)
        return handoverOrdersTotalQuantity;
      } else {
        // Filters applied - calculate from filtered orders
        const filteredOrders = getFilteredHandoverOrders();
        
        // Calculate total quantity (product count) from filtered orders
        const filteredTotal = filteredOrders.reduce((sum, order) => {
          return sum + (order.total_quantity || 0);
        }, 0);
        
        return filteredTotal;
      }
    } else if (tabName === "order-tracking") {
      const tabFilter = tabFilters["order-tracking"];
      
      // Check if any filters are applied
      const hasSearchFilter = tabFilter.searchTerm.trim().length > 0;
      const hasDateFilter = tabFilter.dateFrom || tabFilter.dateTo;
      const hasStatusFilter = selectedTrackingStatuses.length > 0;
      const hasFilters = hasSearchFilter || hasDateFilter || hasStatusFilter;
      
      if (!hasFilters) {
        // No filters applied - use absolute total from API (matches the card)
        return trackingOrdersTotalQuantity;
      } else {
        // Filters applied - calculate from filtered orders
        const filteredOrders = getFilteredTrackingOrders();
        
        // Calculate total quantity (product count) from filtered orders
        const filteredTotal = filteredOrders.reduce((sum, order) => {
          return sum + (order.total_quantity || 0);
        }, 0);
        
        return filteredTotal;
      }
    } else {
      // For All Orders tab, show filtered results (applies search, date filters)
      const filteredOrders = getFilteredOrdersForTab(tabName);
      const tabFilter = tabFilters[tabName as keyof typeof tabFilters];
      
      // Check if any filters are applied
      const hasSearchFilter = tabFilter.searchTerm.trim().length > 0;
      const hasDateFilter = tabFilter.dateFrom || tabFilter.dateTo;
      const hasFilters = hasSearchFilter || hasDateFilter;
      
      if (!hasFilters) {
        // No filters applied - use the same calculation as the card
        const unclaimedOrders = orders.filter(order => order.status === 'unclaimed');
        const uniqueUnclaimedOrders = ensureUniqueOrders(unclaimedOrders, 'unique_id');
        return uniqueUnclaimedOrders.reduce((sum, order) => {
          return sum + (order.quantity || 0);
        }, 0);
      } else {
        // Filters applied - calculate from filtered orders
        // Calculate total quantity (product count) from filtered orders
        return filteredOrders.reduce((sum, order) => {
          return sum + (order.quantity || 0);
        }, 0);
      }
    }
  };

  // Helper function to get quantity sum for selected orders with labels downloaded
  const getReadyOrdersQuantitySum = () => {
    const myOrders = getFilteredOrdersForTab("my-orders");
    const selectedReadyOrders = myOrders.filter(order => 
      selectedMyOrders.includes(order.order_id) &&
      (order.label_downloaded === 1 || 
       order.label_downloaded === '1' || 
       order.label_downloaded === true)
    );
    return selectedReadyOrders.reduce((sum, order) => {
      return sum + (order.total_quantity || 0);
    }, 0);
  };

  // Helper function to get count of selected orders that are visible in current filtered view
  const getVisibleSelectedOrdersCount = () => {
    if (activeTab !== "my-orders") return 0;
    const visibleOrders = getFilteredOrdersForTab("my-orders");
    return visibleOrders.filter(order => selectedMyOrders.includes(order.order_id)).length;
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
          "order-tracking": { searchTerm: "", dateFrom: undefined, dateTo: undefined },
        });
        
        // Re-fetch all orders and grouped orders
        try {
          const ordersResponse = await apiClient.getOrders();
          if (ordersResponse.success && ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
            setOrders(ordersResponse.data.orders);
            console.log('✅ FRONTEND: Orders refreshed successfully');
          }
          
          // Reset pagination and fetch first page
          setGroupedOrdersPage(1);
          const groupedResponse = await apiClient.getGroupedOrders(1, 50);
          if (groupedResponse.success && groupedResponse.data && Array.isArray(groupedResponse.data.groupedOrders)) {
            setGroupedOrders(groupedResponse.data.groupedOrders);
            
            // Update pagination metadata
            if (groupedResponse.data.pagination) {
              setGroupedOrdersHasMore(groupedResponse.data.pagination.hasMore);
              setGroupedOrdersTotalCount(groupedResponse.data.pagination.total);
            }
            
            console.log('✅ FRONTEND: Grouped orders refreshed successfully');
          }

          // Refresh Handover orders
          await fetchHandoverOrders();

          // Refresh Order Tracking orders
          await fetchOrderTrackingOrders();
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:py-4 gap-2 sm:gap-4">
            {/* Dashboard Name and Welcome */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="CLAIMIO Logo" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className={`font-bold text-gray-900 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                  {isMobile ? 'CLAIMIO - Vendor' : 'CLAIMIO - Vendor'}
                </h1>
                {!isMobile && (
                <p className="text-sm sm:text-base text-gray-600 truncate">
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

            {/* Mobile Icons - Tracking and Menu */}
            {isMobile && (
              <div className="flex items-center gap-2">
                {/* Tracking Icon Button */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setActiveTab("order-tracking")}
                  className="p-2"
                  title="Order Tracking"
                >
                  <Truck className="w-5 h-5" />
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
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Welcome, {user?.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 truncate break-all">{user?.email}</p>
                </div>
                
                {/* Vendor Address in Mobile Menu */}
                {addressLoading ? (
                  <div className="px-2">
                    <span className="text-[10px] sm:text-xs text-gray-400">Loading address...</span>
                  </div>
                ) : addressError ? (
                  <div className="px-2">
                    <span className="text-[10px] sm:text-xs text-red-500 break-all">{addressError}</span>
                  </div>
                ) : vendorAddress ? (
                  <div className="px-2 border-t pt-2">
                    <div className="text-[10px] sm:text-xs text-gray-900 font-semibold truncate">Vendor ID: <span className="font-mono">{vendorAddress.warehouseId}</span></div>
                    <div className="text-[10px] sm:text-xs text-gray-700 truncate">{vendorAddress.address}</div>
                    <div className="text-[10px] sm:text-xs text-gray-700 truncate">{vendorAddress.city}, {vendorAddress.pincode}</div>
                  </div>
                ) : null}

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
        <div className={`grid gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8 ${
          isMobile ? 'grid-cols-2' : 
          isTablet ? 'grid-cols-2' : 
          'grid-cols-4'
        }`}>
          <Card 
            className={`bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "all-orders" ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("all-orders")}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-blue-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>All Orders</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {getTotalQuantitySumForTab("all-orders")}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Package className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "my-orders" ? 'ring-2 ring-green-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("my-orders")}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-green-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>My Orders</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {getTotalQuantitySumForTab("my-orders")}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <CheckCircle className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "handover" ? 'ring-2 ring-orange-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("handover")}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-orange-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Handover</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {getTotalQuantitySumForTab("handover")}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Upload className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Tracking Card */}
          <Card 
            className={`bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${activeTab === "order-tracking" ? 'ring-2 ring-purple-300 ring-offset-2' : ''}`}
            onClick={() => setActiveTab("order-tracking")}
          >
            <CardContent className={`${isMobile ? 'p-2.5 sm:p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-purple-100 opacity-90 truncate ${isMobile ? 'text-[10px] sm:text-xs' : 'text-sm'}`}>Order Tracking</p>
                  <p className={`font-bold mt-0.5 sm:mt-1 truncate ${isMobile ? 'text-base sm:text-xl' : 'text-2xl'}`}>
                    {getTotalQuantitySumForTab("order-tracking")}
                  </p>
                </div>
                <div className={`bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-12 h-12'}`}>
                  <Truck className={`${isMobile ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-6 h-6'}`} />
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
                      Order<br />
                      Management
                    </>
                  ) : (
                    'Order Management'
                  )}
                </CardTitle>
                {!isMobile && <CardDescription className="text-sm sm:text-base truncate">Manage your orders across different stages</CardDescription>}
              </div>
              <Button
                onClick={handleRefreshOrders}
                disabled={ordersRefreshing}
                variant="outline"
                className={`${isMobile ? 'h-8 sm:h-10 text-sm sm:text-base px-2 sm:px-4' : 'h-10'} bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:from-blue-600 hover:to-blue-700 flex-shrink-0`}
                size="default"
              >
                {ordersRefreshing ? (
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Fixed Controls Section */}
              <div className={`sticky ${isMobile ? 'top-16' : 'top-20'} bg-white z-40 pb-3 sm:pb-4 border-b mb-3 sm:mb-4`}>
                <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3' : 'grid-cols-4'} ${isMobile ? 'h-auto mb-3 sm:mb-4' : 'mb-6'}`}>
                  <TabsTrigger value="all-orders" className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''}`}>
                    All ({getQuantitySumForTab("all-orders")})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="my-orders" 
                    className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''} ${
                      highlightedTab === "my-orders" 
                        ? 'bg-green-100 text-green-700 border-green-300 shadow-lg scale-105 transition-all duration-300' 
                        : ''
                    }`}
                  >
                    My Orders ({getQuantitySumForTab("my-orders")})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="handover" 
                    className={`${isMobile ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-2.5 sm:py-3' : ''} ${
                      highlightedTab === "handover" 
                        ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-lg scale-105 transition-all duration-300' 
                        : ''
                    }`}
                  >
                    Handover ({getQuantitySumForTab("handover")})
                  </TabsTrigger>
                  {/* Order Tracking Tab - Desktop Only (Mobile users use the tracking icon in header) */}
                  {!isMobile && (
                    <TabsTrigger 
                      value="order-tracking"
                      className={`${
                        highlightedTab === "order-tracking" 
                          ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-lg scale-105 transition-all duration-300' 
                          : ''
                      }`}
                    >
                      Order Tracking ({getQuantitySumForTab("order-tracking")})
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Filters */}
                <div className={`flex flex-col gap-2 mb-2 md:mb-3 ${!isMobile && 'sm:flex-row sm:items-center'}`}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search"
                        value={getCurrentTabFilters().searchTerm}
                        onChange={(e) => updateCurrentTabFilter('searchTerm', e.target.value)}
                        className={`pl-10 ${getCurrentTabFilters().searchTerm && isMobile ? 'pr-20' : 'pr-10'}`}
                        id="vendor-search-input"
                      />
                      {getCurrentTabFilters().searchTerm && isMobile && (
                        <button
                          onClick={() => {
                            document.getElementById('vendor-search-input')?.blur();
                          }}
                          className="absolute right-11 top-1/2 transform -translate-y-1/2 text-green-500 hover:text-green-700 transition-colors"
                          type="button"
                          title="Done"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {getCurrentTabFilters().searchTerm && (
                        <button
                          onClick={() => updateCurrentTabFilter('searchTerm', '')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          type="button"
                          title="Clear"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Status Filter - Desktop Only for Handover Tab */}
                  {!isMobile && activeTab === "handover" && (
                    <div className="w-[180px] flex-shrink-0">
                      <Select value={selectedStatuses.length > 0 ? selectedStatuses.join(',') : 'all'} onValueChange={(value) => {
                        if (value === 'all') {
                          setSelectedStatuses([]);
                        } else {
                          setSelectedStatuses(value.split(','));
                        }
                      }}>
                        <SelectTrigger className="w-full px-3 py-2">
                          <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {getUniqueStatuses().map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Status Filter - Desktop Only for Order Tracking Tab */}
                  {!isMobile && activeTab === "order-tracking" && (
                    <div className="w-[280px] flex-shrink-0">
                      <Select value={selectedTrackingStatuses.length > 0 ? selectedTrackingStatuses.join(',') : 'all'} onValueChange={(value) => {
                        if (value === 'all') {
                          setSelectedTrackingStatuses([]);
                        } else {
                          setSelectedTrackingStatuses(value.split(','));
                        }
                      }}>
                        <SelectTrigger className="w-full px-4 py-2">
                          <SelectValue placeholder="Filter by Shipment Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {getUniqueTrackingStatuses().map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  
                  <div className={`flex gap-2 items-center ${isMobile ? 'w-full' : ''}`}>
                    {/* Date Range Container - Responsive width */}
                    <div className={`flex gap-2 items-center ${isMobile ? 'flex-1' : ''}`}>
                      <DatePicker
                        date={getCurrentTabFilters().dateFrom}
                        onDateChange={(date) => updateCurrentTabFilter('dateFrom', date)}
                        placeholder={isMobile ? "From" : "From date"}
                        className={`${isMobile ? 'flex-1 min-w-0' : 'w-36'}`}
                      />
                      <span className="text-gray-500 text-sm px-1 flex-shrink-0">to</span>
                      <DatePicker
                        date={getCurrentTabFilters().dateTo}
                        onDateChange={(date) => updateCurrentTabFilter('dateTo', date)}
                        placeholder={isMobile ? "To" : "To date"}
                        className={`${isMobile ? 'flex-1 min-w-0' : 'w-36'}`}
                      />
                    </div>
                    
                    {/* Filter Icons - Mobile View - Fixed width on right */}
                    {isMobile && (
                      <div className="flex items-center flex-shrink-0">
                        {/* Status Filter for Handover */}
                        {activeTab === "handover" && (
                          <div className="relative">
                            <Select value={selectedStatuses.length > 0 ? selectedStatuses.join(',') : 'all'} onValueChange={(value) => {
                              if (value === 'all') {
                                setSelectedStatuses([]);
                              } else {
                                setSelectedStatuses(value.split(','));
                              }
                            }}>
                              <SelectTrigger className="w-12 h-10 px-2 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-center">
                                <SelectValue>
                                  <Filter className="w-5 h-5 text-gray-600" />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {getUniqueStatuses().map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* Status Filter for Order Tracking */}
                        {activeTab === "order-tracking" && (
                          <div className="relative">
                            <Select value={selectedTrackingStatuses.length > 0 ? selectedTrackingStatuses.join(',') : 'all'} onValueChange={(value) => {
                              if (value === 'all') {
                                setSelectedTrackingStatuses([]);
                              } else {
                                setSelectedTrackingStatuses(value.split(','));
                              }
                            }}>
                              <SelectTrigger className="w-12 h-10 px-2 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-center">
                                <SelectValue>
                                  <Filter className="w-5 h-5 text-gray-600" />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {getUniqueTrackingStatuses().map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Blue dot indicator when filter is active */}
                            {selectedTrackingStatuses.length > 0 && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                        )}
                        
                        {/* Label Download Filter for My Orders */}
                        {activeTab === "my-orders" && (
                          <div className="relative">
                            <Select value={selectedLabelFilter} onValueChange={setSelectedLabelFilter}>
                              <SelectTrigger className="w-12 h-10 px-2 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-center">
                                <SelectValue>
                                  <Filter className="w-5 h-5 text-gray-600" />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Orders</SelectItem>
                                <SelectItem value="downloaded">Label Downloaded</SelectItem>
                                <SelectItem value="not_downloaded">Label Not Downloaded</SelectItem>
                              </SelectContent>
                            </Select>
                            {/* Blue dot indicator when filter is active */}
                            {selectedLabelFilter !== 'all' && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Bulk Manifest Download Button - Desktop Only for Handover Tab */}
                  {!isMobile && activeTab === "handover" && (
                    <Button
                      onClick={handleBulkManifestDownload}
                      disabled={selectedHandoverOrders.length === 0 || manifestDownloadLoading !== null}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 h-10"
                    >
                      {manifestDownloadLoading !== null ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Manifest Download ({selectedHandoverOrders.length})
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Tab-specific Actions */}
                  {activeTab === "all-orders" && !isMobile && (
                    <Button 
                      onClick={() => handleBulkClaimOrders()} 
                      disabled={selectedUnclaimedOrders.length === 0} 
                      className="h-10 text-sm whitespace-nowrap px-4 min-w-fit bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg text-white"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Claim Selected ({selectedUnclaimedOrders.length})
                    </Button>
                  )}
                  
                  {activeTab === "my-orders" && !isMobile && (
                    <div className="flex gap-2 items-center">
                      <Select value={labelFormat} onValueChange={setLabelFormat}>
                        <SelectTrigger className="h-10 text-sm w-36">
                          <SelectValue placeholder="Label Format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thermal">Thermal (4x6)</SelectItem>
                          <SelectItem value="a4">A4 Format</SelectItem>
                          <SelectItem value="four-in-one">Four in One</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Label Download Filter - Desktop Only for My Orders Tab */}
                      <div className="relative">
                        <Select value={selectedLabelFilter} onValueChange={setSelectedLabelFilter}>
                          <SelectTrigger className="w-12 h-10 px-2 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-center">
                            <SelectValue>
                              <Filter className="w-5 h-5 text-gray-600" />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Orders</SelectItem>
                            <SelectItem value="downloaded">Label Downloaded</SelectItem>
                            <SelectItem value="not_downloaded">Label Not Downloaded</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Blue dot indicator when filter is active */}
                        {selectedLabelFilter !== 'all' && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <Button
                        onClick={() => handleBulkDownloadLabels("my-orders")}
                        disabled={getVisibleSelectedOrdersCount() === 0 || bulkDownloadLoading}
                        className="h-10 text-sm whitespace-nowrap px-4 min-w-fit bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg text-white"
                      >
                        {bulkDownloadLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download ({getVisibleSelectedOrdersCount()})
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleBulkMarkReady()}
                        disabled={
                          getVisibleSelectedOrdersCount() === 0 || 
                          bulkMarkReadyLoading ||
                          getFilteredOrdersForTab("my-orders")
                            .filter(order => selectedMyOrders.includes(order.order_id))
                            .some(order => !order.label_downloaded || order.label_downloaded === 0 || order.label_downloaded === '0' || order.label_downloaded === false)
                        }
                        className="h-10 text-sm whitespace-nowrap px-4 min-w-fit bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-0 shadow-lg text-white"
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Ready ({getVisibleSelectedOrdersCount()})
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
                onScroll={handleScroll}
                className={`${isMobile ? `max-h-[calc(100vh-280px)] ${activeTab === 'my-orders' ? 'pb-32' : activeTab === 'order-tracking' ? 'pb-1' : 'pb-20'}` : 'max-h-[600px]'} overflow-y-auto relative`}
              >
                <TabsContent value="all-orders" className="mt-0">
                  {/* Mobile Card Layout */}
                  {isMobile ? (
                    <div className="space-y-2.5 sm:space-y-3">
                      {getFilteredOrdersForTab("all-orders").map((order, index) => (
                        <Card 
                          key={`${order.unique_id}-${index}`} 
                          className="p-2.5 sm:p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            if (selectedUnclaimedOrders.includes(order.unique_id)) {
                              setSelectedUnclaimedOrders(selectedUnclaimedOrders.filter((id) => id !== order.unique_id))
                            } else {
                              setSelectedUnclaimedOrders([...selectedUnclaimedOrders, order.unique_id])
                            }
                          }}
                        >
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-start gap-2 sm:gap-3">
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
                                className="mt-1 w-3.5 h-3.5 sm:w-4 sm:h-4"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <img
                                src={order.product_image || "/placeholder.svg"}
                                alt={order.product_name}
                                className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover cursor-pointer flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  order.product_image && setSelectedImageProduct({url: order.product_image, title: order.product_name || "Product Image"})
                                }}
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm sm:text-base truncate">{order.order_id}</h4>
                                <p className="text-xs sm:text-sm text-gray-600 break-words leading-relaxed">{order.product_name}</p>
                                <p className="text-xs sm:text-sm text-gray-500 break-words leading-relaxed">Code: {order.product_code}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <p className="font-medium truncate">
                                  {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Size:</span>
                                <p className="font-medium text-red-600 truncate">{order.size || "-"}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Qty:</span>
                                <p className="font-medium truncate">{order.quantity || "-"}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* Desktop/Tablet Table Layout */
                    <div className="rounded-md border overflow-y-auto max-h-[600px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                          <TableRow>
                            <TableHead className="w-12">Select</TableHead>
                          <TableHead>Image</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Order Date</TableHead>
                          <TableHead>Product</TableHead>
                            <TableHead className="w-24">Size</TableHead>
                          <TableHead>Product Code</TableHead>
                            <TableHead>Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredOrdersForTab("all-orders").map((order, index) => (
                            <TableRow 
                              key={`${order.unique_id}-${index}`}
                              className="cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => {
                                if (selectedUnclaimedOrders.includes(order.unique_id)) {
                                  setSelectedUnclaimedOrders(selectedUnclaimedOrders.filter((id) => id !== order.unique_id))
                                } else {
                                  setSelectedUnclaimedOrders([...selectedUnclaimedOrders, order.unique_id])
                                }
                              }}
                            >
                            <TableCell>
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
                                  onClick={(e) => e.stopPropagation()}
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          order.product_image && setSelectedImageProduct({url: order.product_image, title: order.product_name || "Product Image"})
                                        }}
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
                    <div className="space-y-2.5 sm:space-y-3">
                      {getFilteredOrdersForTab("my-orders").map((order, index) => {
                        const hasLabelDownloaded = order.label_downloaded === 1 || order.label_downloaded === '1' || order.label_downloaded === true;
                        return (
                        <Card 
                          key={`${order.order_id}-${index}`} 
                          className={`p-2.5 sm:p-3 cursor-pointer transition-colors ${
                            hasLabelDownloaded 
                              ? 'bg-green-50 hover:bg-green-100 border-green-200' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            if (selectedMyOrders.includes(order.order_id)) {
                              setSelectedMyOrders(selectedMyOrders.filter((id) => id !== order.order_id))
                            } else {
                              setSelectedMyOrders([...selectedMyOrders, order.order_id])
                            }
                          }}
                        >
                        
                          <div className="space-y-1.5 sm:space-y-2">
                            {/* Top Row: Checkbox | Order Info | Total */}
                            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
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
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                
                                {/* Order Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium text-sm sm:text-base truncate">{order.order_id}</h4>
                                    {(order.current_shipment_status || order.status) && (
                                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${getShipmentBadgeClasses(order.current_shipment_status || order.status)}`}>
                                        {order.current_shipment_status || order.status}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                                    {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Total Count - Right aligned */}
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm text-gray-500">Total</div>
                                <div className="text-xl font-bold text-green-600">{order.total_quantity || 0}</div>
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
                            
                            {/* Unclaim Button Row - Full Width at Bottom */}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestReverse(order.order_id, order.products?.map((p: any) => p.unique_id));
                              }}
                              disabled={reverseLoading[order.order_id] || isUnclaimDisabled(order)}
                              className="w-full text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {reverseLoading[order.order_id] ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                                  Unclaiming...
                                </>
                              ) : (
                                'Unclaim Order'
                              )}
                            </Button>
                          </div>
                        </Card>
                        );
                      })}
                      
                      {/* Loading More Indicator */}
                      {isLoadingMore && (
                        <div className="flex items-center justify-center p-4">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-xs text-gray-500">Loading more orders...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* End of List Indicator */}
                      {!groupedOrdersHasMore && groupedOrders.length > 0 && (
                        <div className="flex items-center justify-center p-4">
                          <p className="text-xs text-gray-400">All orders loaded ({groupedOrdersTotalCount} total)</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Desktop/Tablet Table Layout */
                    <div className="rounded-md border overflow-y-auto max-h-[600px]" onScroll={handleScroll}>
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
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
                          {getFilteredOrdersForTab("my-orders").map((order, index) => {
                            const hasLabelDownloaded = order.label_downloaded === 1 || order.label_downloaded === '1' || order.label_downloaded === true;
                            return (
                            <TableRow 
                              key={`${order.order_id}-${index}`} 
                              className={`group cursor-pointer transition-colors ${
                                hasLabelDownloaded 
                                  ? 'bg-green-50 hover:bg-green-100' 
                                  : 'hover:bg-gray-50'
                              }`}
                              onClick={() => {
                                if (selectedMyOrders.includes(order.order_id)) {
                                  setSelectedMyOrders(selectedMyOrders.filter((id) => id !== order.order_id))
                                } else {
                                  setSelectedMyOrders([...selectedMyOrders, order.order_id])
                                }
                              }}
                            >
                              <TableCell>
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
                                  onClick={(e) => e.stopPropagation()}
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
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                product.image && setSelectedImageProduct({url: product.image, title: product.product_name || "Product Image"})
                                              }}
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
                              <TableCell>
                                {(order.current_shipment_status || order.status) ? (
                                  <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${getShipmentBadgeClasses(order.current_shipment_status || order.status)}`}>
                                    {order.current_shipment_status || order.status}
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium text-gray-800">N/A</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestReverse(order.order_id, order.products?.map((p: any) => p.unique_id));
                                  }}
                                  disabled={reverseLoading[order.order_id] || isUnclaimDisabled(order)}
                                  className="text-xs px-3 py-1 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {reverseLoading[order.order_id] ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                      Loading...
                                    </>
                                  ) : (
                                    'Unclaim'
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      
                      {/* Loading More Indicator for Desktop */}
                      {isLoadingMore && (
                        <div className="flex items-center justify-center p-6 border-t">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-500">Loading more orders...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* End of List Indicator for Desktop */}
                      {!groupedOrdersHasMore && groupedOrders.length > 0 && (
                        <div className="flex items-center justify-center p-4 border-t bg-gray-50">
                          <p className="text-sm text-gray-500">All orders loaded ({groupedOrdersTotalCount} total)</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="handover" className="mt-0">
                  {/* Mobile Card Layout */}
                  {isMobile ? (
                    <div className="space-y-2.5 sm:space-y-3 pb-32">
                      {getFilteredHandoverOrders().map((order, index) => (
                        <Card 
                          key={`${order.order_id}-${index}`} 
                          className="p-2.5 sm:p-3 cursor-pointer transition-colors hover:bg-gray-50"
                          onClick={() => {
                            if (selectedHandoverOrders.includes(order.order_id)) {
                              setSelectedHandoverOrders(selectedHandoverOrders.filter((id) => id !== order.order_id))
                            } else {
                              setSelectedHandoverOrders([...selectedHandoverOrders, order.order_id])
                            }
                          }}
                        >
                          <div className="space-y-1.5 sm:space-y-2">
                            {/* Top Row: Checkbox | Order Info | Total */}
                            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={selectedHandoverOrders.includes(order.order_id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.checked) {
                                      setSelectedHandoverOrders([...selectedHandoverOrders, order.order_id]);
                                    } else {
                                      setSelectedHandoverOrders(selectedHandoverOrders.filter(id => id !== order.order_id));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                                />
                                {/* Order Info (with inline status badge) */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium text-sm sm:text-base truncate">{order.order_id}</h4>
                                    {(order.current_shipment_status || order.status) && (
                                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${getShipmentBadgeClasses(order.current_shipment_status || order.status)}`}>
                                        {order.current_shipment_status || order.status}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                                    {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                  </p>
                                </div>
                              </div>
                              {/* Total Count - Right aligned */}
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm text-gray-500">Total</div>
                                <div className="text-xl font-bold text-green-600">{order.total_quantity || 0}</div>
                              </div>
                            </div>
                            
                            {/* Products List */}
                            <div className="space-y-2">
                              {order.products && order.products.map((product: any) => (
                                <div key={product.unique_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                  <img
                                    src={product.image || product.product_image || "/placeholder.svg"}
                                    alt={product.product_name}
                                    className="w-10 h-10 rounded-md object-cover cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (product.image || product.product_image) && setSelectedImageProduct({url: product.image || product.product_image, title: product.product_name || "Product Image"})
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium break-words leading-relaxed">{product.product_name}</p>
                                    <p className="text-xs text-gray-500 break-words leading-relaxed">Code: {product.product_code}</p>
                                  </div>
                                  <div className="text-xs font-medium">
                                    {product.quantity || 0}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Action Buttons Row - Full Width at Bottom */}
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const manifestId = order.manifest_id;
                                  if (manifestId) {
                                    downloadManifestSummary([manifestId]);
                                  } else {
                                    toast({
                                      title: "Error",
                                      description: "Manifest ID not found",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                disabled={order.is_handover === 1 || manifestDownloadLoading === order.manifest_id}
                                className="flex-1 text-xs h-8 border-green-300 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                {manifestDownloadLoading === order.manifest_id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3 mr-1" />
                                    Manifest
                                  </>
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestReverse(order.order_id, order.products?.map((p: any) => p.unique_id));
                                }}
                                disabled={reverseLoading[order.order_id] || isUnclaimDisabled(order)}
                                className="flex-1 text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {reverseLoading[order.order_id] ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                                    Unclaiming...
                                  </>
                                ) : (
                                  'Unclaim Order'
                                )}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                      
                      {/* Loading More Indicator for Mobile Handover */}
                      {isLoadingMoreHandover && (
                        <div className="flex items-center justify-center p-4">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                            <p className="text-xs text-gray-500">Loading more orders...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* End of List Indicator for Mobile Handover */}
                      {!handoverOrdersHasMore && handoverOrders.length > 0 && (
                        <div className="flex items-center justify-center p-4">
                          <p className="text-xs text-gray-400">All orders loaded ({handoverOrdersTotalCount} total)</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Desktop/Tablet Table Layout */
                  <div className="rounded-md border overflow-y-auto max-h-[600px]" onScroll={handleScroll}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              checked={selectedHandoverOrders.length === getFilteredHandoverOrders().length && getFilteredHandoverOrders().length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedHandoverOrders(getFilteredHandoverOrders().map((o: any) => o.order_id));
                                } else {
                                  setSelectedHandoverOrders([]);
                                }
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Order Date</TableHead>
                          <TableHead>Products</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredHandoverOrders().map((order, index) => (
                          <TableRow key={`${order.order_id}-${index}`}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedHandoverOrders.includes(order.order_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedHandoverOrders([...selectedHandoverOrders, order.order_id]);
                                  } else {
                                    setSelectedHandoverOrders(selectedHandoverOrders.filter(id => id !== order.order_id));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 cursor-pointer"
                              />
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
                            <TableCell>
                              <div className="space-y-2">
                                {order.products && order.products.map((product: any, productIndex: number) => (
                                  <div key={product.unique_id} className="flex items-center gap-3">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <img
                                            src={product.image || product.product_image || "/placeholder.svg"}
                                            alt={product.product_name}
                                            className="w-10 h-10 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => (product.image || product.product_image) && setSelectedImageProduct({url: product.image || product.product_image, title: product.product_name || "Product Image"})}
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
                                      <div className="font-medium text-sm break-words leading-relaxed">{product.product_name}</div>
                                      <div className="text-xs text-gray-500 break-words">Code: {product.product_code}</div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-700">
                                      {product.quantity || 0}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-base font-bold text-blue-600">
                                {order.total_quantity || 0}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(order.current_shipment_status || order.status) && (
                                <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${getShipmentBadgeClasses(order.current_shipment_status || order.status)}`}>
                                  {order.current_shipment_status || order.status}
                                </div>
                              )}
                              {!(order.current_shipment_status || order.status) && (
                                <span className="text-sm font-medium text-gray-800">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Get manifest_id from order (should be available in handover tab)
                                    const manifestId = order.manifest_id;
                                    if (manifestId) {
                                      downloadManifestSummary([manifestId]);
                                    } else {
                                      toast({
                                        title: "Error",
                                        description: "Manifest ID not found for this order",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  disabled={order.is_handover === 1 || manifestDownloadLoading === order.manifest_id}
                                  className="text-xs px-3 py-1 h-8 border-green-300 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                >
                                  {manifestDownloadLoading === order.manifest_id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Downloading...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3 h-3 mr-1" />
                                      Manifest
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestReverse(order.order_id, order.products?.map((p: any) => p.unique_id));
                                  }}
                                  disabled={reverseLoading[order.order_id] || isUnclaimDisabled(order)}
                                  className="text-xs px-3 py-1 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {reverseLoading[order.order_id] ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                      Loading...
                                    </>
                                  ) : (
                                    'Unclaim'
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Loading More Indicator for Desktop Handover */}
                    {isLoadingMoreHandover && (
                      <div className="flex items-center justify-center p-6 border-t">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-500">Loading more orders...</p>
                        </div>
                      </div>
                    )}
                    
                    {/* End of List Indicator for Desktop Handover */}
                    {!handoverOrdersHasMore && handoverOrders.length > 0 && (
                      <div className="flex items-center justify-center p-4 border-t bg-gray-50">
                        <p className="text-sm text-gray-500">All orders loaded ({handoverOrdersTotalCount} total)</p>
                      </div>
                    )}
                  </div>
                  )}
                </TabsContent>
              </div>

              {/* Fixed Bottom Bulk Claim Button for Mobile All Orders */}
              {isMobile && activeTab === "all-orders" && (
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
                    
                    {/* Bulk Claim Button */}
                    <Button 
                      onClick={() => handleBulkClaimOrders()} 
                      disabled={selectedUnclaimedOrders.length === 0} 
                      className="flex-1 h-10 sm:h-12 text-base sm:text-lg font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg min-w-0"
                    >
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Claim ({selectedUnclaimedOrders.length})</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Fixed Bottom Buttons for Mobile My Orders */}
              {isMobile && activeTab === "my-orders" && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:p-4 shadow-lg z-50">
                  <div className="flex flex-col gap-2 sm:gap-3">
                    {/* Label Format Selector and Select All */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Select value={labelFormat} onValueChange={setLabelFormat}>
                        <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base flex-1">
                          <SelectValue placeholder="Label Format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thermal">Thermal (4x6)</SelectItem>
                          <SelectItem value="a4">A4 Format</SelectItem>
                          <SelectItem value="four-in-one">Four in One</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Select All Checkbox */}
                      <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0">
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
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                        />
                        <span className="text-sm sm:text-base font-medium">All</span>
                      </div>
                    </div>
                    
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
                      
                      {/* Download Label Button */}
                      <Button 
                        onClick={() => handleBulkDownloadLabels("my-orders")}
                        disabled={getVisibleSelectedOrdersCount() === 0 || bulkDownloadLoading}
                        className="flex-1 h-10 sm:h-12 text-xs sm:text-sm md:text-base font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg min-w-0 px-2 sm:px-3"
                      >
                        {bulkDownloadLoading ? (
                          <>
                            <div className={`animate-spin rounded-full border-b-2 border-white ${isMobile ? 'h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2' : 'h-4 w-4 mr-2'}`}></div>
                            <span className="whitespace-nowrap">{isMobile ? 'Loading' : 'Generating...'}</span>
                          </>
                        ) : (
                          <div className="flex items-center justify-center w-full">
                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-1 sm:mr-1.5 flex-shrink-0" />
                            <span className="whitespace-nowrap flex items-center">
                              <span className="hidden min-[360px]:inline">Download</span>
                              <span className="inline min-[360px]:hidden">DL</span>
                              <span className="ml-1">({getVisibleSelectedOrdersCount()})</span>
                            </span>
                          </div>
                        )}
                      </Button>
                      
                      {/* Mark Ready Button */}
                      <Button 
                        onClick={() => handleBulkMarkReady()}
                        disabled={
                          getVisibleSelectedOrdersCount() === 0 || 
                          bulkMarkReadyLoading ||
                          getFilteredOrdersForTab("my-orders")
                            .filter(order => selectedMyOrders.includes(order.order_id))
                            .some(order => !order.label_downloaded || order.label_downloaded === 0 || order.label_downloaded === '0' || order.label_downloaded === false)
                        }
                        className="flex-1 h-10 sm:h-12 text-xs sm:text-sm md:text-base font-medium bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-0 shadow-lg min-w-0 px-2 sm:px-3"
                      >
                        {bulkMarkReadyLoading ? (
                          <>
                            <div className={`animate-spin rounded-full border-b-2 border-white ${isMobile ? 'h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2' : 'h-4 w-4 mr-2'}`}></div>
                            <span className="whitespace-nowrap">{isMobile ? 'Loading' : 'Processing...'}</span>
                          </>
                        ) : (
                          <div className="flex items-center justify-center w-full">
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-1 sm:mr-1.5 flex-shrink-0" />
                            <span className="whitespace-nowrap flex items-center">
                              <span>Ready</span>
                              <span className="ml-1">({getVisibleSelectedOrdersCount()})</span>
                            </span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixed Bottom Buttons for Mobile Handover */}
              {isMobile && activeTab === "handover" && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:p-4 shadow-lg z-50">
                  <div className="flex flex-col gap-2 sm:gap-3">
                    {/* Select All Checkbox */}
                    <div className="flex items-center gap-2 sm:gap-3 justify-end">
                      <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            const handoverOrders = getFilteredHandoverOrders()
                            if (e.target.checked) {
                              setSelectedHandoverOrders(handoverOrders.map((o) => o.order_id))
                            } else {
                              setSelectedHandoverOrders([])
                            }
                          }}
                          checked={
                            selectedHandoverOrders.length > 0 &&
                            selectedHandoverOrders.length === getFilteredHandoverOrders().length
                          }
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                        />
                        <span className="text-sm sm:text-base font-medium">Select All</span>
                      </div>
                    </div>
                    
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
                      
                      {/* Bulk Manifest Download Button */}
                      <Button 
                        onClick={handleBulkManifestDownload}
                        disabled={selectedHandoverOrders.length === 0 || manifestDownloadLoading !== null}
                        className="flex-1 h-10 sm:h-12 text-sm sm:text-lg font-medium bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-0 shadow-lg min-w-0"
                      >
                        {manifestDownloadLoading !== null ? (
                          <>
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0 animate-spin" />
                            <span className="truncate">{isMobile ? 'Loading' : 'Downloading...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="truncate">Manifest Download ({selectedHandoverOrders.length})</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixed Move to Top Button for Desktop All Orders, My Orders, Handover, and Order Tracking */}
              {!isMobile && (activeTab === "all-orders" || activeTab === "my-orders" || activeTab === "handover" || activeTab === "order-tracking") && (
                <Button
                  onClick={scrollToTop}
                  variant="outline"
                  size="sm"
                  className="fixed bottom-6 right-6 h-12 w-12 p-0 rounded-full border-gray-300 hover:bg-gray-50 shadow-lg z-50"
                >
                  <ChevronUp className="w-5 h-5" />
                </Button>
              )}
              
              {/* Order Tracking Tab Content - Shows orders that have been in handover for 24+ hours */}
              <TabsContent value="order-tracking" className="mt-0">
                {trackingOrdersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading order tracking data...</p>
                    </div>
                  </div>
                ) : trackingOrdersError ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <p className="text-red-600">{trackingOrdersError}</p>
                      <Button onClick={() => fetchOrderTrackingOrders()} className="mt-4">
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : isMobile ? (
                  /* Mobile Card Layout */
                  <div className="space-y-2.5 sm:space-y-3 pb-32 mt-4">
                    {getFilteredTrackingOrders().length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Truck className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-600 font-medium">No orders in tracking yet</p>
                        <p className="text-sm text-gray-500 mt-2">Orders will appear here 24 hours after handover</p>
                      </div>
                    ) : (
                      getFilteredTrackingOrders().map((order, index) => (
                        <Card 
                          key={`${order.order_id}-${index}`} 
                          className="p-2.5 sm:p-3 transition-colors"
                        >
                          <div className="space-y-1.5 sm:space-y-2">
                            {/* Top Row: Order Info | Total */}
                            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium text-sm sm:text-base truncate">{order.order_id}</h4>
                                  {(order.current_shipment_status || order.status) && (
                                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${getShipmentBadgeClasses(order.current_shipment_status || order.status)}`}>
                                      {order.current_shipment_status || order.status}
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-gray-500 truncate">
                                  {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                                </p>
                                {order.products?.[0]?.awb && (
                                  <p className="text-xs font-mono text-purple-600 truncate">
                                    AWB: {order.products[0].awb}
                                  </p>
                                )}
                              </div>
                              {/* Total Count - Right aligned */}
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm text-gray-500">Total</div>
                                <div className="text-xl font-bold text-purple-600">{order.total_quantity || 0}</div>
                              </div>
                            </div>
                            
                            {/* Products List */}
                            <div className="space-y-2">
                              {order.products && order.products.map((product: any) => (
                                <div key={product.unique_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                  <img
                                    src={product.image || product.product_image || "/placeholder.svg"}
                                    alt={product.product_name}
                                    className="w-10 h-10 rounded-md object-cover cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (product.image || product.product_image) && setSelectedImageProduct({url: product.image || product.product_image, title: product.product_name || "Product Image"})
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium break-words leading-relaxed">{product.product_name}</p>
                                    <p className="text-xs text-gray-500 break-words leading-relaxed">Code: {product.product_code}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-medium">{product.quantity || 0}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                    
                    {/* Total count indicator for Order Tracking */}
                    {trackingOrders.length > 0 && (
                      <div className="flex items-center justify-center p-4">
                        <p className="text-xs text-gray-400">Showing all {trackingOrdersTotalCount} orders</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Desktop Table Layout */
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                        <TableRow>
                          <TableHead className="font-semibold">Order ID</TableHead>
                          <TableHead className="font-semibold">Order Date</TableHead>
                          <TableHead className="font-semibold">Products</TableHead>
                          <TableHead className="font-semibold">AWB Number</TableHead>
                          <TableHead className="font-semibold text-center">Count</TableHead>
                          <TableHead className="font-semibold">Shipment Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredTrackingOrders().length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-64 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <Truck className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-600 font-medium">No orders in tracking yet</p>
                                <p className="text-sm text-gray-500 mt-2">Orders will appear here 24 hours after handover</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          getFilteredTrackingOrders().map((order, index) => (
                            <TableRow key={`${order.order_id}-${index}`} className="hover:bg-gray-50">
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
                              <TableCell>
                                <div className="space-y-2">
                                  {order.products && order.products.map((product: any, productIndex: number) => (
                                    <div key={product.unique_id || productIndex} className="flex items-center gap-3">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <img
                                              src={product.image || product.product_image || "/placeholder.svg"}
                                              alt={product.product_name}
                                              className="w-10 h-10 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                              onClick={() => (product.image || product.product_image) && setSelectedImageProduct({url: product.image || product.product_image, title: product.product_name || "Product Image"})}
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
                                        <div className="font-medium text-sm break-words leading-relaxed">{product.product_name}</div>
                                        <div className="text-xs text-gray-500 break-words">Code: {product.product_code}</div>
                                      </div>
                                      <div className="text-sm font-medium text-gray-700">
                                        {product.quantity || 0}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-sm text-purple-600">
                                  {order.products?.[0]?.awb || 'N/A'}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="text-base font-bold text-purple-600">
                                  {order.total_quantity || 0}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(order.current_shipment_status || order.status) ? (
                                  <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${getShipmentBadgeClasses(order.current_shipment_status || order.status)}`}>
                                    {order.current_shipment_status || order.status}
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium text-gray-800">N/A</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    
                    {/* Total count indicator for Desktop Order Tracking */}
                    {trackingOrders.length > 0 && (
                      <div className="flex items-center justify-center p-4 border-t bg-gray-50">
                        <p className="text-sm text-gray-500">Showing all {trackingOrdersTotalCount} orders</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
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
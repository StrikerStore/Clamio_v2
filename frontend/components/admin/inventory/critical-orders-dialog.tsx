"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    AlertTriangle,
    X,
    Filter,
    Search,
    RefreshCw,
    CheckCircle,
    Clock,
    Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { format } from "date-fns";
import { useDeviceType } from "@/hooks/use-mobile";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface CriticalOrder {
    order_id: string;
    unique_id: string;
    customer_name: string | null;
    product_name: string | null;
    product_code: string | null;
    quantity: number;
    selling_price: number | null;
    order_date: string;
    account_code: string;
    claims_status: string | null;
    claimed_by: string | null;
    claimed_at: string | null;
    is_critical: number;
    awb: string | null;
    carrier_name: string | null;
    current_shipment_status: string | null;
    store_name: string | null;
    vendor_name: string | null;
    product_image: string | null;
    image: string | null;
    status: string;
    value?: string | number;
    priority?: string;
    created_at?: string;
    store_status?: string;
}

interface CriticalOrdersDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CriticalOrdersDialog({ isOpen, onClose }: CriticalOrdersDialogProps) {
    const { toast } = useToast();
    const { isMobile } = useDeviceType();

    // State
    const [orders, setOrders] = useState<CriticalOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [accountCodeFilter, setAccountCodeFilter] = useState<string[]>([]);
    const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
    const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

    // Fetch orders
    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const accountCode = accountCodeFilter !== "all" ? accountCodeFilter : undefined;
            const response = await apiClient.getCriticalOrders(accountCode);

            if (response.success && response.data) {
                const ordersData = response.data.orders || [];
                // Debug: Log first order to check image field
                if (ordersData.length > 0) {
                    console.log('🔍 Frontend received order image data:', {
                        image: ordersData[0].image,
                        product_image: ordersData[0].product_image,
                        product_code: ordersData[0].product_code,
                        order_id: ordersData[0].order_id
                    });
                }
                setOrders(ordersData);
            }
        } catch (error) {
            console.error("Error fetching critical orders:", error);
            toast({
                title: "Error",
                description: "Failed to fetch critical orders",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [accountCodeFilter, toast]);

    // Load orders when dialog opens
    useEffect(() => {
        if (isOpen) {
            fetchOrders();
        }
    }, [isOpen, fetchOrders]);

    // Get unique account codes for filter
    const accountCodes = useMemo(() => {
        const codes = new Set(orders.map((o) => o.account_code));
        return Array.from(codes).sort();
    }, [orders]);

    // Filter orders
    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            // Search filter (order_id, customer_name, product_name, product_code, awb)
            const matchesSearch =
                !searchTerm ||
                order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.product_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.awb?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.carrier_name?.toLowerCase().includes(searchTerm.toLowerCase());

            // Account code filter
            const matchesAccountCode =
                accountCodeFilter.length === 0 || accountCodeFilter.includes(order.account_code || "");

            // Date range filter
            let matchesDate = true;
            if (order.order_date) {
                const orderDate = new Date(order.order_date);
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

            return matchesSearch && matchesAccountCode && matchesDate;
        }).sort((a, b) => {
            // Sort by order_date ascending, then by order_id
            const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
            const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
            if (dateA !== dateB) {
                return dateA - dateB;
            }
            return (a.order_id || '').localeCompare(b.order_id || '');
        });
    }, [orders, searchTerm, accountCodeFilter, dateFrom, dateTo]);



    // Format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return "-";
        try {
            return format(new Date(dateString), "dd MMM yyyy");
        } catch {
            return "-";
        }
    };

    // Calculate days since order date
    const getDaysToOrder = (orderDate: string | null) => {
        if (!orderDate) return "-";
        try {
            const order = new Date(orderDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            order.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - order.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch {
            return "-";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[98vh] w-[98vw] sm:w-full p-0 flex flex-col [&>button]:hidden min-h-[600px]">
                <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Critical Orders
                            <Badge variant="destructive" className="ml-2">
                                {filteredOrders.length}
                            </Badge>
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={fetchOrders}
                                disabled={loading}
                                className="h-8 w-8 p-0"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="h-8 w-8 p-0"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Filters */}
                <div className="px-4 py-2 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 h-9"
                            />
                        </div>

                        {/* Filter Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 px-3">
                                    <Filter className="w-4 h-4 mr-2" />
                                    Filters
                                    {accountCodeFilter.length > 0 && (
                                        <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                            {accountCodeFilter.length}
                                        </Badge>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="end">
                                <div className="flex flex-col gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Date Range</label>
                                        <div className="flex flex-col gap-2">
                                            <DatePicker
                                                date={dateFrom}
                                                onDateChange={setDateFrom}
                                                placeholder="From Date"
                                                className="w-full h-9"
                                            />
                                            <DatePicker
                                                date={dateTo}
                                                onDateChange={setDateTo}
                                                placeholder="To Date"
                                                className="w-full h-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Account</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full h-9 justify-between text-left font-normal"
                                                >
                                                    <span className="truncate">
                                                        {accountCodeFilter.length === 0
                                                            ? "All Accounts"
                                                            : accountCodeFilter.length === 1
                                                            ? accountCodeFilter[0]
                                                            : `${accountCodeFilter.length} accounts selected`}
                                                    </span>
                                                    <svg
                                                        className="ml-2 h-4 w-4 shrink-0 opacity-50"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="m6 9 6 6 6-6" />
                                                    </svg>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[280px] p-0" align="start">
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <div className="p-2">
                                                        <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-sm cursor-pointer">
                                                            <Checkbox
                                                                id="account-all"
                                                                checked={accountCodeFilter.length === 0}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) {
                                                                        setAccountCodeFilter([]);
                                                                    }
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor="account-all"
                                                                className="text-sm font-medium leading-none cursor-pointer flex-1"
                                                            >
                                                                All Accounts
                                                            </label>
                                                        </div>
                                                        {accountCodes.map((code) => (
                                                            <div
                                                                key={code}
                                                                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-sm cursor-pointer"
                                                            >
                                                                <Checkbox
                                                                    id={`account-${code}`}
                                                                    checked={accountCodeFilter.includes(code)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setAccountCodeFilter([...accountCodeFilter, code]);
                                                                        } else {
                                                                            setAccountCodeFilter(
                                                                                accountCodeFilter.filter((c) => c !== code)
                                                                            );
                                                                        }
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`account-${code}`}
                                                                    className="text-sm font-medium leading-none cursor-pointer flex-1"
                                                                >
                                                                    {code}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>


                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <CheckCircle className="w-12 h-12 mb-2 text-green-500" />
                            <p className="font-medium">No Critical Orders</p>
                            <p className="text-sm">All orders are being handled properly</p>
                        </div>
                    ) : isMobile ? (
                        /* Mobile Card View */
                        <ScrollArea className="h-[calc(100vh-300px)]">
                            <div className="p-4 space-y-3">
                                {filteredOrders.map((order) => (
                                    <Card key={order.unique_id} className="p-2.5 sm:p-3">
                                        <div className="space-y-2 sm:space-y-3">
                                            {/* Order ID and Image Row */}
                                            <div className="flex items-start gap-2 sm:gap-3">
                                                <img
                                                    src={order.image || "/placeholder.svg"}
                                                    alt={order.product_name || "Product"}
                                                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover cursor-pointer flex-shrink-0"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = "/placeholder.svg";
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h4 className="font-medium text-sm sm:text-base text-gray-900 truncate">{order.order_id}</h4>
                                                        {order.store_name && (
                                                            <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto bg-blue-50 text-blue-700 border-blue-200">
                                                                {order.store_name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-gray-600 break-words leading-relaxed">
                                                        {order.product_name || "N/A"}
                                                    </p>
                                                    {order.product_code && (
                                                        <p className="text-xs sm:text-sm text-gray-500 break-words leading-relaxed">
                                                            Code: {order.product_code || 'N/A'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Details Row - Date, Days, Customer in 3 columns */}
                                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                                <div>
                                                    <span className="text-gray-500">Date:</span>
                                                    <p className="font-medium truncate">
                                                        {order.order_date ? formatDate(order.order_date) : 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Days:</span>
                                                    <p className={`font-medium truncate ${getDaysToOrder(order.order_date) > 25 ? 'text-red-600' : ''}`}>
                                                        {getDaysToOrder(order.order_date)}
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
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        /* Desktop Table View */
                        <div className="rounded-md border overflow-y-auto max-h-[600px]">
                            <Table className="text-xs">
                                <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b">
                                    <TableRow className="[&>th]:py-2">
                                        <TableHead className="text-xs">Image</TableHead>
                                        <TableHead className="text-xs">Order ID</TableHead>
                                        <TableHead className="text-xs">Order Date</TableHead>
                                        <TableHead className="text-xs">Customer</TableHead>
                                        <TableHead className="text-xs">Product</TableHead>
                                        <TableHead className="text-xs">Store</TableHead>
                                        <TableHead className="text-xs">Days to Order</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow 
                                            key={order.unique_id}
                                            className="[&>td]:py-2 cursor-pointer hover:bg-gray-50"
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()} className="py-2">
                                                <img
                                                    src={order.image || "/placeholder.svg"}
                                                    alt={order.product_name || "Product"}
                                                    className="w-10 h-10 rounded object-cover cursor-pointer"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = "/placeholder.svg";
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium text-xs">{order.order_id}</TableCell>
                                            <TableCell className="text-xs">{formatDate(order.order_date)}</TableCell>
                                            <TableCell className="text-xs">{order.customer_name ? order.customer_name.split(' ')[0] : "N/A"}</TableCell>
                                            <TableCell className="text-xs">{order.product_name || "N/A"}</TableCell>
                                            <TableCell className="text-xs">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{order.store_name || 'N/A'}</span>
                                                    <span className="text-[10px] text-gray-500">{order.account_code || ''}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                <span className={`font-medium ${getDaysToOrder(order.order_date) > 25 ? 'text-red-600' : ''}`}>
                                                    {getDaysToOrder(order.order_date)}
                                                </span>
                                                <span className="text-[10px] text-gray-500 ml-1">days</span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

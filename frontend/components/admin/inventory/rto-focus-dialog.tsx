"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Target,
    X,
    Filter,
    Search,
    RefreshCw,
    Copy,
    CheckCircle,
    Clock,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { format } from "date-fns";
import { useDeviceType } from "@/hooks/use-mobile";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface RTOFocusOrder {
    order_id: string;
    order_status: string;
    instance_number: number;
    days_since_initiated: number;
    rto_wh: string | null;
    account_code: string;
    activity_date: string | null;
    created_at: string;
    updated_at: string;
    awb: string | null;
    carrier_name: string | null;
}

interface RTOFocusDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const RTO_STATUS_OPTIONS = [
    "RTO Delivered",
    "RTO In Transit",
    "RTO Lost",
    "RTO Undelivered",
    "RTO Initiated",
    "RTO Settled",
];

export function RTOFocusDialog({ isOpen, onClose }: RTOFocusDialogProps) {
    const { toast } = useToast();
    const { isMobile } = useDeviceType();

    // State
    const [orders, setOrders] = useState<RTOFocusOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [accountCodeFilter, setAccountCodeFilter] = useState<string>("all");
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [showStatusDialog, setShowStatusDialog] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch orders
    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const accountCode = accountCodeFilter !== "all" ? accountCodeFilter : undefined;
            const response = await apiClient.getRTOFocusOrders(accountCode);

            if (response.success && response.data) {
                setOrders(response.data.orders || []);
            }
        } catch (error) {
            console.error("Error fetching RTO focus orders:", error);
            toast({
                title: "Error",
                description: "Failed to fetch RTO focus orders",
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
            setSelectedOrders([]);
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
            // Search filter (order_id, awb, carrier)
            const matchesSearch =
                !searchTerm ||
                order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.awb?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.carrier_name?.toLowerCase().includes(searchTerm.toLowerCase());

            // Account code filter (already applied on backend if set, but double-check)
            const matchesAccountCode =
                accountCodeFilter === "all" || order.account_code === accountCodeFilter;

            return matchesSearch && matchesAccountCode;
        });
    }, [orders, searchTerm, accountCodeFilter]);

    // Handle select all
    const handleSelectAll = () => {
        if (selectedOrders.length === filteredOrders.length) {
            setSelectedOrders([]);
        } else {
            setSelectedOrders(filteredOrders.map((o) => o.order_id));
        }
    };

    // Handle individual selection
    const handleSelectOrder = (orderId: string) => {
        setSelectedOrders((prev) =>
            prev.includes(orderId)
                ? prev.filter((id) => id !== orderId)
                : [...prev, orderId]
        );
    };

    // Handle status change
    const handleStatusChange = async () => {
        if (!selectedStatus || selectedOrders.length === 0) return;

        try {
            setUpdatingStatus(true);
            const response = await apiClient.updateRTOFocusStatus(
                selectedOrders,
                selectedStatus,
                accountCodeFilter !== "all" ? accountCodeFilter : undefined
            );

            if (response.success) {
                toast({
                    title: "Status Updated",
                    description: `Updated ${response.data?.affectedRows || selectedOrders.length} orders to ${selectedStatus}`,
                });
                setShowStatusDialog(false);
                setSelectedStatus("");
                setSelectedOrders([]);
                fetchOrders(); // Refresh the list
            }
        } catch (error) {
            console.error("Error updating status:", error);
            toast({
                title: "Error",
                description: "Failed to update order status",
                variant: "destructive",
            });
        } finally {
            setUpdatingStatus(false);
        }
    };

    // Copy AWBs grouped by carrier
    const handleCopyAWB = () => {
        const ordersToProcess = selectedOrders.length > 0
            ? filteredOrders.filter((o) => selectedOrders.includes(o.order_id))
            : filteredOrders;

        // Group by carrier
        const grouped: Record<string, string[]> = {};
        ordersToProcess.forEach((order) => {
            if (order.awb) {
                const carrier = order.carrier_name || "Unknown";
                if (!grouped[carrier]) grouped[carrier] = [];
                grouped[carrier].push(order.awb);
            }
        });

        // Format output
        const output = Object.entries(grouped)
            .map(([carrier, awbs]) => `${carrier}: ${awbs.join(", ")}`)
            .join("\n");

        navigator.clipboard.writeText(output);
        toast({
            title: "Copied",
            description: `AWBs copied to clipboard (${ordersToProcess.filter(o => o.awb).length} AWBs)`,
        });
    };

    // Copy Order IDs grouped by carrier
    const handleCopyOrderIds = () => {
        const ordersToProcess = selectedOrders.length > 0
            ? filteredOrders.filter((o) => selectedOrders.includes(o.order_id))
            : filteredOrders;

        // Group by carrier
        const grouped: Record<string, string[]> = {};
        ordersToProcess.forEach((order) => {
            const carrier = order.carrier_name || "Unknown";
            if (!grouped[carrier]) grouped[carrier] = [];
            grouped[carrier].push(order.order_id);
        });

        // Format output
        const output = Object.entries(grouped)
            .map(([carrier, ids]) => `${carrier}: ${ids.join(", ")}`)
            .join("\n");

        navigator.clipboard.writeText(output);
        toast({
            title: "Copied",
            description: `Order IDs copied to clipboard (${ordersToProcess.length} orders)`,
        });
    };

    // Format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return "-";
        try {
            return format(new Date(dateString), "dd MMM yyyy");
        } catch {
            return "-";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[98vh] w-[98vw] sm:w-full p-0 flex flex-col [&>button]:hidden">
                <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-orange-500" />
                            RTO Focus Orders
                            <Badge variant="secondary" className="ml-2">
                                {filteredOrders.length}
                            </Badge>
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            {isMobile && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="h-8 w-8 p-0"
                                >
                                    <Filter className="w-4 h-4" />
                                </Button>
                            )}
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
                <div className={`px-4 py-2 border-b bg-gray-50 ${isMobile && !showFilters ? "hidden" : ""}`}>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search by Order ID, AWB, Carrier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 h-9"
                            />
                        </div>

                        {/* Account Code Filter */}
                        <Select value={accountCodeFilter} onValueChange={setAccountCodeFilter}>
                            <SelectTrigger className="w-full sm:w-48 h-9">
                                <SelectValue placeholder="All Accounts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Accounts</SelectItem>
                                {accountCodes.map((code) => (
                                    <SelectItem key={code} value={code}>
                                        {code}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            <p className="font-medium">No RTO Focus Orders</p>
                            <p className="text-sm">All RTO orders are being tracked properly</p>
                        </div>
                    ) : isMobile ? (
                        /* Mobile Card View */
                        <ScrollArea className="h-[calc(100vh-300px)]">
                            <div className="p-2 space-y-2">
                                {filteredOrders.map((order) => (
                                    <Card
                                        key={order.order_id}
                                        className={`cursor-pointer transition-all ${selectedOrders.includes(order.order_id)
                                            ? "ring-2 ring-orange-500 bg-orange-50"
                                            : "hover:bg-gray-50"
                                            }`}
                                        onClick={() => handleSelectOrder(order.order_id)}
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex items-start gap-2">
                                                <Checkbox
                                                    checked={selectedOrders.includes(order.order_id)}
                                                    onCheckedChange={() => handleSelectOrder(order.order_id)}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm truncate">
                                                            {order.order_id}
                                                        </span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {order.account_code}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>{order.awb || "No AWB"}</span>
                                                        <span>•</span>
                                                        <span>{order.carrier_name || "Unknown"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        <span>{formatDate(order.activity_date)}</span>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {order.days_since_initiated} days
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        /* Desktop Table View */
                        <ScrollArea className="h-[calc(100vh-300px)]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Order ID</TableHead>
                                        <TableHead>AWB</TableHead>
                                        <TableHead>Carrier</TableHead>
                                        <TableHead>Activity Date</TableHead>
                                        <TableHead>Days</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow
                                            key={order.order_id}
                                            className={`cursor-pointer ${selectedOrders.includes(order.order_id) ? "bg-orange-50" : ""
                                                }`}
                                            onClick={() => handleSelectOrder(order.order_id)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedOrders.includes(order.order_id)}
                                                    onCheckedChange={() => handleSelectOrder(order.order_id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{order.account_code}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{order.order_id}</TableCell>
                                            <TableCell>{order.awb || "-"}</TableCell>
                                            <TableCell>{order.carrier_name || "-"}</TableCell>
                                            <TableCell>{formatDate(order.activity_date)}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={order.days_since_initiated > 14 ? "destructive" : "secondary"}
                                                >
                                                    {order.days_since_initiated}d
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {order.order_status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>

                {/* Fixed Action Bar */}
                <div className="px-2 sm:px-4 py-2 sm:py-3 border-t bg-white">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs sm:text-sm text-gray-500 flex-shrink-0">
                            {selectedOrders.length > 0 ? (
                                <span>{selectedOrders.length} sel</span>
                            ) : (
                                <span>{filteredOrders.length}</span>
                            )}
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowStatusDialog(true)}
                                disabled={selectedOrders.length === 0}
                                className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                            >
                                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                                Status
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyAWB}
                                className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                            >
                                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                                AWB
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyOrderIds}
                                className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                            >
                                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                                <span className="hidden sm:inline">Order </span>ID
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Status Change Dialog */}
                <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                                Change Status
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Update status for {selectedOrders.length} selected order(s).
                                This will remove them from the focus list.
                            </p>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select new status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RTO_STATUS_OPTIONS.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowStatusDialog(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleStatusChange}
                                    disabled={!selectedStatus || updatingStatus}
                                >
                                    {updatingStatus ? (
                                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                    )}
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
}

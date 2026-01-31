"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
    LabelList,
} from "recharts"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {
    Download,
    Filter,
    Loader2,
    TrendingUp,
    Package,
    CheckCircle,
    Clock,
    BarChart3,
    RefreshCw,
    ChevronDown,
} from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format, subDays, startOfMonth } from "date-fns"
import * as XLSX from "xlsx"
import { useDeviceType } from "@/hooks/use-mobile"

interface AnalyticsDialogProps {
    vendorId?: string
    isAdmin?: boolean
    vendors?: any[]
    stores?: any[]
    trigger?: React.ReactNode
}

export function AnalyticsDialog({
    vendorId,
    isAdmin = true,
    vendors: initialVendors = [],
    stores: initialStores = [],
    trigger,
}: AnalyticsDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)

    // Filter Data (for lazy loading)
    const [vendors, setVendors] = useState<any[]>(initialVendors)
    const [stores, setStores] = useState<any[]>(initialStores)
    const [vendorsLoading, setVendorsLoading] = useState(false)
    const [storesLoading, setStoresLoading] = useState(false)

    // Filters
    const [selectedVendorFilters, setSelectedVendorFilters] = useState<string[]>(vendorId ? [vendorId] : [])
    const [selectedStoreFilters, setSelectedStoreFilters] = useState<string[]>([])
    const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30))
    const [dateTo, setDateTo] = useState<Date | undefined>(new Date())

    // UI States
    const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false)
    const [storePopoverOpen, setStorePopoverOpen] = useState(false)
    const [vendorMobileScrollOpen, setVendorMobileScrollOpen] = useState(false)
    const [storeMobileScrollOpen, setStoreMobileScrollOpen] = useState(false)
    const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
        claimed_count: true,
        count: true
    })

    const { toast } = useToast()
    const { isMobile } = useDeviceType()

    // Lazy load vendors if needed
    const fetchVendors = async () => {
        if (vendors.length > 0 || vendorsLoading) return
        setVendorsLoading(true)
        try {
            const response = await apiClient.getAdminVendors()
            if (response.success) {
                setVendors(response.data.vendors || [])
            }
        } catch (error) {
            console.error("Error fetching vendors for analytics:", error)
        } finally {
            setVendorsLoading(false)
        }
    }

    // Lazy load stores if needed
    const fetchStores = async () => {
        if (stores.length > 0 || storesLoading) return
        setStoresLoading(true)
        try {
            const response = await apiClient.getStoresForFilter()
            if (response.success) {
                setStores(response.data || [])
            }
        } catch (error) {
            console.error("Error fetching stores for analytics:", error)
        } finally {
            setStoresLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            if (isAdmin && vendors.length === 0) fetchVendors()
            if (stores.length === 0) fetchStores()
        }
    }, [open])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            const params = {
                vendorId: selectedVendorFilters.length > 0 ? selectedVendorFilters : undefined,
                dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
                dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
                store: selectedStoreFilters.length > 0 ? selectedStoreFilters : undefined,
            }

            let response;
            if (isAdmin && selectedVendorFilters.length === 0) {
                response = await apiClient.getAdminAnalyticsOverview(params)
            } else {
                response = await apiClient.getVendorAnalytics(params)
            }

            if (response.success) {
                setData(response.data)
            } else {
                toast({
                    title: "Error",
                    description: response.message || "Failed to fetch analytics",
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Error fetching analytics:", error)
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchAnalytics()
        }
    }, [open, selectedVendorFilters, selectedStoreFilters, dateFrom, dateTo])

    const STATUS_COLORS: Record<string, string> = {
        "Claimed": "#6366f1", // Indigo
        "In Transit": "#3b82f6", // Blue
        "Delivered": "#10b981", // Green
        "RTO Delivered": "#f59e0b", // Amber
        "Pickup Failed": "#ef4444", // Red
        "Others": "#94a3b8"  // Slate
    }

    const processedDistribution = useMemo(() => {
        if (!data?.distribution) return []
        const total = data.distribution.reduce((acc: number, curr: any) => acc + curr.count, 0)
        return data.distribution.map((item: any) => ({
            ...item,
            percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) + "%" : "0%"
        }))
    }, [data?.distribution])

    const handleLegendClick = (dataKey: string) => {
        setVisibleLines(prev => ({
            ...prev,
            [dataKey]: !prev[dataKey]
        }))
    }

    const exportToExcel = () => {
        if (!data) return
        try {
            const workbook = XLSX.utils.book_new()
            const kpis = [
                ["Metric", "Value"],
                ["Total Claimed", data.stats.total_claimed],
                ["Total Handed Over", data.stats.total_handed_over],
                ["Fulfillment Rate", `${data.stats.fulfillment_rate}%`],
                ["Avg Handover Time (Hours)", data.stats.avg_handover_hours?.toFixed(2) || "N/A"],
            ]
            const wsKpis = XLSX.utils.aoa_to_sheet(kpis)
            XLSX.utils.book_append_sheet(workbook, wsKpis, "KPIs")
            const statusData = processedDistribution.map((item: any) => ({
                Status: item.status,
                Count: item.count,
                Percentage: item.percentage
            }))
            const wsStatus = XLSX.utils.json_to_sheet(statusData)
            XLSX.utils.book_append_sheet(workbook, wsStatus, "Status Distribution")
            const trendData = data.trend.map((item: any) => ({
                Date: format(new Date(item.date), "yyyy-MM-dd"),
                "Claimed Count": item.claimed_count || 0,
                "Handover Count": item.count || 0,
            }))
            const wsTrend = XLSX.utils.json_to_sheet(trendData)
            XLSX.utils.book_append_sheet(workbook, wsTrend, "Performance Trend")
            const filename = `Analytics_Report_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`
            XLSX.writeFile(workbook, filename)
            toast({ title: "Success", description: "Report downloaded successfully" })
        } catch (error) {
            console.error("Excel export error:", error)
            toast({ title: "Export Failed", description: "Failed to generate Excel report", variant: "destructive" })
        }
    }

    const handleQuickDateFilter = (type: "today" | "week" | "month") => {
        const today = new Date()
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        setDateTo(end)
        if (type === "today") {
            const start = new Date()
            start.setHours(0, 0, 0, 0)
            setDateFrom(start)
        } else if (type === "week") {
            setDateFrom(subDays(today, 7))
        } else if (type === "month") {
            setDateFrom(startOfMonth(today))
        }
    }

    const chartConfig = {
        count: { label: "Handover", color: "#10b981" },
        claimed_count: { label: "Claimed", color: "#3b82f6" }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={`${isMobile ? 'w-full h-full max-w-none m-0 rounded-none p-0 overflow-hidden flex flex-col' : 'max-w-6xl max-h-[90vh]'} overflow-y-auto`}>
                <div className={`${isMobile ? 'p-4 overflow-y-auto flex-1' : ''}`}>
                    <DialogHeader className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between pr-8'} mb-6`}>
                        <div className="flex-1">
                            <DialogTitle className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold flex items-center gap-2`}>
                                <BarChart3 className="w-6 h-6 text-blue-600" />
                                Service Performance
                            </DialogTitle>
                            <DialogDescription className={isMobile ? 'text-xs' : ''}>
                                Monitor fulfillment rates, distributions, and trends.
                            </DialogDescription>
                        </div>
                        <Button
                            onClick={exportToExcel}
                            disabled={!data || loading}
                            variant="default"
                            className={`bg-green-600 hover:bg-green-700 text-white gap-2 ${isMobile ? 'w-full h-10' : ''}`}
                        >
                            <Download className="w-4 h-4" />
                            Download Report
                        </Button>
                    </DialogHeader>

                    {/* Filters Section */}
                    {isMobile ? (
                        <div className="space-y-4 mb-6">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="filters" className="border rounded-xl bg-slate-50 overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-4 h-4 text-blue-600" />
                                            Analytics Filters
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 space-y-4 pt-2">
                                        {isAdmin && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendors</label>
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-10 justify-between bg-white text-left font-normal"
                                                    onClick={() => setVendorMobileScrollOpen(!vendorMobileScrollOpen)}
                                                >
                                                    <span className="truncate">
                                                        {selectedVendorFilters.length === 0 ? "All Vendors" : `${selectedVendorFilters.length} selected`}
                                                    </span>
                                                    <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${vendorMobileScrollOpen ? 'rotate-180' : ''}`} />
                                                </Button>

                                                {vendorMobileScrollOpen && (
                                                    <div className="mt-2 border rounded-lg bg-white overflow-hidden shadow-inner touch-pan-y" onTouchMove={(e) => e.stopPropagation()}>
                                                        <div className="p-2 border-b bg-slate-50 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold uppercase text-slate-500">Pick Vendors</span>
                                                            {selectedVendorFilters.length > 0 && (
                                                                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setSelectedVendorFilters([])}>Clear</Button>
                                                            )}
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto p-1 bg-white">
                                                            {vendorsLoading ? (
                                                                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                                                            ) : (
                                                                vendors.map((v) => (
                                                                    <div key={v.warehouseId} className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded border-b border-slate-50" onClick={() => {
                                                                        if (selectedVendorFilters.includes(v.warehouseId)) setSelectedVendorFilters(selectedVendorFilters.filter(id => id !== v.warehouseId))
                                                                        else setSelectedVendorFilters([...selectedVendorFilters, v.warehouseId])
                                                                    }}>
                                                                        <input type="checkbox" checked={selectedVendorFilters.includes(v.warehouseId)} readOnly className="w-4 h-4 rounded border-slate-300" />
                                                                        <span className="text-sm font-medium">{v.name}</span>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Stores</label>
                                            <Button
                                                variant="outline"
                                                className="w-full h-10 justify-between bg-white text-left font-normal"
                                                onClick={() => setStoreMobileScrollOpen(!storeMobileScrollOpen)}
                                            >
                                                <span className="truncate">
                                                    {selectedStoreFilters.length === 0 ? "All Stores" : `${selectedStoreFilters.length} selected`}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${storeMobileScrollOpen ? 'rotate-180' : ''}`} />
                                            </Button>

                                            {storeMobileScrollOpen && (
                                                <div className="mt-2 border rounded-lg bg-white overflow-hidden shadow-inner touch-pan-y" onTouchMove={(e) => e.stopPropagation()}>
                                                    <div className="p-2 border-b bg-slate-50 flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase text-slate-500">Pick Stores</span>
                                                        {selectedStoreFilters.length > 0 && (
                                                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setSelectedStoreFilters([])}>Clear</Button>
                                                        )}
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto p-1 bg-white">
                                                        {storesLoading ? (
                                                            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                                                        ) : (
                                                            stores.map((s) => (
                                                                <div key={s.account_code} className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded border-b border-slate-50" onClick={() => {
                                                                    if (selectedStoreFilters.includes(s.account_code)) setSelectedStoreFilters(selectedStoreFilters.filter(id => id !== s.account_code))
                                                                    else setSelectedStoreFilters([...selectedStoreFilters, s.account_code])
                                                                }}>
                                                                    <input type="checkbox" checked={selectedStoreFilters.includes(s.account_code)} readOnly className="w-4 h-4 rounded border-slate-300" />
                                                                    <span className="text-sm font-medium">{s.store_name}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Date Range</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <DatePicker date={dateFrom} onDateChange={setDateFrom} className="bg-white" />
                                                <DatePicker date={dateTo} onDateChange={setDateTo} className="bg-white" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 pb-2">
                                            <Button variant="outline" size="sm" onClick={() => handleQuickDateFilter("today")}>Today</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleQuickDateFilter("week")}>7 Days</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleQuickDateFilter("month")}>Month</Button>
                                        </div>
                                        <Button onClick={fetchAnalytics} className="w-full bg-blue-600" disabled={loading}>
                                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                            Update Analytics
                                        </Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    ) : (
                        <Card className="mb-6 bg-slate-50/50 border-none shadow-none">
                            <CardContent className="p-4">
                                <div className="flex flex-wrap gap-4 items-end">
                                    {isAdmin && (
                                        <div className="flex-1 min-w-[200px] space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendors</label>
                                            <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full h-9 justify-between text-left font-normal bg-white">
                                                        <span className="truncate">
                                                            {selectedVendorFilters.length === 0
                                                                ? "All Vendors"
                                                                : selectedVendorFilters.length === 1
                                                                    ? vendors.find(v => v.warehouseId === selectedVendorFilters[0])?.name || selectedVendorFilters[0]
                                                                    : `${selectedVendorFilters.length} Vendors selected`}
                                                        </span>
                                                        <ChevronDown className="w-4 h-4 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-0" align="start">
                                                    <div className="p-2 border-b bg-slate-50 flex items-center justify-between" onWheel={(e) => e.stopPropagation()}>
                                                        <span className="text-xs font-bold uppercase text-slate-500">Select Vendors</span>
                                                        {selectedVendorFilters.length > 0 && (
                                                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setSelectedVendorFilters([])}>Clear</Button>
                                                        )}
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                                                        {vendorsLoading ? (
                                                            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                                                        ) : (
                                                            <>
                                                                <div
                                                                    className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedVendorFilters([])
                                                                    }}
                                                                >
                                                                    <input type="checkbox" checked={selectedVendorFilters.length === 0} readOnly className="w-4 h-4 rounded border-slate-300" />
                                                                    <span className="text-sm">All Vendors</span>
                                                                </div>
                                                                {vendors.map((v) => (
                                                                    <div
                                                                        key={v.warehouseId}
                                                                        className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            if (selectedVendorFilters.includes(v.warehouseId)) {
                                                                                setSelectedVendorFilters(selectedVendorFilters.filter(id => id !== v.warehouseId))
                                                                            } else {
                                                                                setSelectedVendorFilters([...selectedVendorFilters, v.warehouseId])
                                                                            }
                                                                        }}
                                                                    >
                                                                        <input type="checkbox" checked={selectedVendorFilters.includes(v.warehouseId)} readOnly className="w-4 h-4 rounded border-slate-300" />
                                                                        <span className="text-sm">{v.name}</span>
                                                                    </div>
                                                                ))}
                                                            </>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-[200px] space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stores</label>
                                        <Popover open={storePopoverOpen} onOpenChange={setStorePopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full h-9 justify-between text-left font-normal bg-white">
                                                    <span className="truncate">
                                                        {selectedStoreFilters.length === 0
                                                            ? "All Stores"
                                                            : selectedStoreFilters.length === 1
                                                                ? stores.find(s => s.account_code === selectedStoreFilters[0])?.store_name || selectedStoreFilters[0]
                                                                : `${selectedStoreFilters.length} Stores selected`}
                                                    </span>
                                                    <ChevronDown className="w-4 h-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-0" align="start">
                                                <div className="p-2 border-b bg-slate-50 flex items-center justify-between" onWheel={(e) => e.stopPropagation()}>
                                                    <span className="text-xs font-bold uppercase text-slate-500">Select Stores</span>
                                                    {selectedStoreFilters.length > 0 && (
                                                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setSelectedStoreFilters([])}>Clear</Button>
                                                    )}
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                                                    {storesLoading ? (
                                                        <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setSelectedStoreFilters([])
                                                                }}
                                                            >
                                                                <input type="checkbox" checked={selectedStoreFilters.length === 0} readOnly className="w-4 h-4 rounded border-slate-300" />
                                                                <span className="text-sm">All Stores</span>
                                                            </div>
                                                            {stores.map((s) => (
                                                                <div
                                                                    key={s.account_code}
                                                                    className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        if (selectedStoreFilters.includes(s.account_code)) {
                                                                            setSelectedStoreFilters(selectedStoreFilters.filter(id => id !== s.account_code))
                                                                        } else {
                                                                            setSelectedStoreFilters([...selectedStoreFilters, s.account_code])
                                                                        }
                                                                    }}
                                                                >
                                                                    <input type="checkbox" checked={selectedStoreFilters.includes(s.account_code)} readOnly className="w-4 h-4 rounded border-slate-300" />
                                                                    <span className="text-sm">{s.store_name}</span>
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="flex-[2] min-w-[380px] space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Period</label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2 flex-grow">
                                                <DatePicker date={dateFrom} onDateChange={setDateFrom} />
                                                <span className="text-slate-400 text-xs font-medium">to</span>
                                                <DatePicker date={dateTo} onDateChange={setDateTo} />
                                            </div>
                                            <div className="flex h-9 items-center gap-1 bg-slate-100 p-1 rounded-md flex-shrink-0">
                                                <Button variant="ghost" size="sm" onClick={() => handleQuickDateFilter("today")} className={`text-[10px] h-7 px-2 hover:bg-white`}>Today</Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleQuickDateFilter("week")} className="text-[10px] h-7 px-2 hover:bg-white text-slate-600">7d</Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleQuickDateFilter("month")} className="text-[10px] h-7 px-2 hover:bg-white text-slate-600 font-medium">Month</Button>
                                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                                <Button variant="outline" size="icon" onClick={fetchAnalytics} className="h-7 w-7 bg-white" disabled={loading}>
                                                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {loading ? (
                        <div className="h-[400px] flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                <p className="text-slate-500 font-medium">Loading analytics data...</p>
                            </div>
                        </div>
                    ) : data ? (
                        <div className="space-y-6 pb-20">
                            {/* KPI Grid */}
                            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-4`}>
                                <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3`}>
                                        <div className={`${isMobile ? 'p-2' : 'p-3'} bg-indigo-100 rounded-xl flex-shrink-0`}>
                                            <Package className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-indigo-600`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`${isMobile ? 'text-[9px]' : 'text-sm'} text-slate-500 font-medium uppercase`}>Claimed</p>
                                            <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>{data.stats.total_claimed}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-l-4 border-l-green-500 shadow-sm">
                                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3`}>
                                        <div className={`${isMobile ? 'p-2' : 'p-3'} bg-green-100 rounded-xl flex-shrink-0`}>
                                            <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-green-600`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`${isMobile ? 'text-[9px]' : 'text-sm'} text-slate-500 font-medium uppercase`}>Handover</p>
                                            <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>{data.stats.total_handed_over}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3`}>
                                        <div className={`${isMobile ? 'p-2' : 'p-3'} bg-amber-100 rounded-xl flex-shrink-0`}>
                                            <TrendingUp className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-amber-600`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`${isMobile ? 'text-[9px]' : 'text-sm'} text-slate-500 font-medium uppercase`}>Rate</p>
                                            <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>{data.stats.fulfillment_rate}%</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3`}>
                                        <div className={`${isMobile ? 'p-2' : 'p-3'} bg-purple-100 rounded-xl flex-shrink-0`}>
                                            <Clock className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-purple-600`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`${isMobile ? 'text-[9px]' : 'text-sm'} text-slate-500 font-medium uppercase`}>Avg Time</p>
                                            <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>{data.stats.avg_handover_hours > 0 ? `${data.stats.avg_handover_hours}h` : "N/A"}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6`}>
                                {/* Distribution Chart */}
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className={isMobile ? 'p-4 pb-0' : ''}>
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            <Package className="w-5 h-5 text-blue-600" />
                                            Shipment Status
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className={`${isMobile ? 'h-[300px] p-2' : 'h-[350px]'}`}>
                                        {processedDistribution.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={processedDistribution} layout="vertical" margin={{ left: -20, right: 60, top: 10, bottom: 10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="status" type="category" width={85} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const entry = payload[0].payload;
                                                            return (
                                                                <div className="bg-white border shadow-lg rounded-lg p-3 text-xs">
                                                                    <p className="font-bold text-slate-900 mb-1">{entry.status}</p>
                                                                    <div className="flex items-center gap-4">
                                                                        <span>Count: <b>{entry.count}</b></span>
                                                                        <span>Share: <b className="text-blue-600">{entry.percentage}</b></span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }} />
                                                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={isMobile ? 24 : 32}>
                                                        {processedDistribution.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || STATUS_COLORS['Others']} />
                                                        ))}
                                                        <LabelList dataKey="percentage" position="right" style={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} offset={10} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="h-full flex items-center justify-center text-slate-400 italic">No data</div>}
                                    </CardContent>
                                </Card>

                                {/* Trend Chart */}
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className={isMobile ? 'p-4 pb-0' : ''}>
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                            Performance Trend
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className={`${isMobile ? 'h-[300px] p-2' : 'h-[350px]'}`}>
                                        {data.trend.length > 0 ? (
                                            <ChartContainer config={chartConfig} className="h-full w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), "MMM d")} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-white border shadow-lg rounded-lg p-3 text-xs space-y-2">
                                                                        {payload.map((p: any) => (
                                                                            <div key={p.dataKey} className="flex items-center justify-between gap-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                                                    <span>{p.name === 'count' ? 'Handover' : 'Claimed'}:</span>
                                                                                </div>
                                                                                <span className="font-bold">{p.value}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }} />
                                                        <Legend
                                                            verticalAlign="top"
                                                            height={40}
                                                            onClick={(e) => handleLegendClick(e.dataKey as string)}
                                                            content={({ payload }) => (
                                                                <div className="flex justify-center gap-6 text-[10px] font-medium text-slate-600 mb-2 cursor-pointer">
                                                                    {payload?.map((entry: any) => (
                                                                        <div
                                                                            key={entry.value}
                                                                            className={`flex items-center gap-2 transition-opacity ${!visibleLines[entry.dataKey] ? 'opacity-30' : 'opacity-100'}`}
                                                                            onClick={() => handleLegendClick(entry.dataKey)}
                                                                        >
                                                                            <div className="w-3 h-1 rounded" style={{ backgroundColor: entry.color }} />
                                                                            <span>{entry.value === 'count' ? 'Handover' : 'Claimed'}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )} />
                                                        <Line
                                                            type="monotone"
                                                            name="claimed_count"
                                                            dataKey="claimed_count"
                                                            stroke="#3b82f6"
                                                            strokeWidth={2}
                                                            dot={{ fill: '#3b82f6', r: isMobile ? 2 : 3 }}
                                                            hide={!visibleLines.claimed_count}
                                                            animationDuration={500}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            name="count"
                                                            dataKey="count"
                                                            stroke="#10b981"
                                                            strokeWidth={2}
                                                            dot={{ fill: '#10b981', r: isMobile ? 2 : 3 }}
                                                            hide={!visibleLines.count}
                                                            animationDuration={500}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <div className="h-full flex items-center justify-center text-slate-400 italic">No data</div>}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center text-slate-400 italic">
                            No data found. Try adjusting your filters.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

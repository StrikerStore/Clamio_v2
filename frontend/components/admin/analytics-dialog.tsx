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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
} from "recharts"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
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
    Calendar as CalendarIcon,
    RefreshCw,
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
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
    vendors = [],
    stores = [],
    trigger,
}: AnalyticsDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)

    // Filters
    const [selectedVendor, setSelectedVendor] = useState<string>(vendorId || "all")
    const [selectedStore, setSelectedStore] = useState<string>("all")
    const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30))
    const [dateTo, setDateTo] = useState<Date | undefined>(new Date())

    const { toast } = useToast()

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            const params = {
                vendorId: selectedVendor === "all" ? undefined : selectedVendor,
                dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
                dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
                store: selectedStore === "all" ? undefined : selectedStore,
            }

            let response;
            if (isAdmin && (selectedVendor === "all" || !selectedVendor)) {
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
    }, [open, selectedVendor, selectedStore, dateFrom, dateTo])

    const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

    const chartConfig = {
        count: {
            label: "Count",
            color: "hsl(var(--chart-1))",
        },
        status: {
            label: "Status",
            color: "hsl(var(--chart-2))",
        },
    }

    const exportToExcel = () => {
        if (!data) return

        try {
            const workbook = XLSX.utils.book_new()

            // Sheet 1: KPIs
            const kpis = [
                ["Metric", "Value"],
                ["Total Claimed", data.stats.total_claimed],
                ["Total Handed Over", data.stats.total_handed_over],
                ["Fulfillment Rate", `${data.stats.fulfillment_rate}%`],
                ["Avg Handover Time (Hours)", data.stats.avg_handover_hours?.toFixed(2) || "N/A"],
            ]
            const wsKpis = XLSX.utils.aoa_to_sheet(kpis)
            XLSX.utils.book_append_sheet(workbook, wsKpis, "KPIs")

            // Sheet 2: Status Distribution
            const statusData = data.distribution.map((item: any) => ({
                Status: item.status,
                Count: item.count,
            }))
            const wsStatus = XLSX.utils.json_to_sheet(statusData)
            XLSX.utils.book_append_sheet(workbook, wsStatus, "Status Distribution")

            // Sheet 3: Handover Trend
            const trendData = data.trend.map((item: any) => ({
                Date: format(new Date(item.date), "yyyy-MM-dd"),
                "Handovers Count": item.count,
            }))
            const wsTrend = XLSX.utils.json_to_sheet(trendData)
            XLSX.utils.book_append_sheet(workbook, wsTrend, "Handover Trend")

            // Generate filename
            const filename = `Analytics_Report_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`
            XLSX.writeFile(workbook, filename)

            toast({
                title: "Success",
                description: "Report downloaded successfully",
            })
        } catch (error) {
            console.error("Excel export error:", error)
            toast({
                title: "Export Failed",
                description: "Failed to generate Excel report",
                variant: "destructive",
            })
        }
    }

    const handleQuickDateFilter = (type: "today" | "week" | "month") => {
        const today = new Date()
        setDateTo(today)
        if (type === "today") {
            setDateFrom(today)
        } else if (type === "week") {
            setDateFrom(subDays(today, 7))
        } else if (type === "month") {
            setDateFrom(startOfMonth(today))
        }
    }

    const { isMobile } = useDeviceType()

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
            <DialogContent className={`${isMobile ? 'w-screen h-screen max-w-none m-0 rounded-none p-4' : 'max-w-6xl max-h-[90vh]'} overflow-y-auto`}>
                <DialogHeader className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between pr-8'} mb-4`}>
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
                        className={`bg-green-600 hover:bg-green-700 text-white gap-2 ${isMobile ? 'h-9 px-3 text-xs' : ''}`}
                    >
                        <Download className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
                        {isMobile ? 'Report' : 'Download Report'}
                    </Button>
                </DialogHeader>

                {isMobile ? (
                    <div className="space-y-4 mb-6">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="filters" className="border border-slate-200 shadow-sm rounded-xl bg-white overflow-hidden">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline text-xs font-bold text-slate-700 uppercase tracking-widest bg-slate-50/50">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-blue-600" />
                                        Advanced Filters
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-4 border-t border-slate-100">
                                    <div className="space-y-4">
                                        {isAdmin && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendor</label>
                                                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-10">
                                                        <SelectValue placeholder="All Vendors" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Vendors</SelectItem>
                                                        {vendors.map((v) => (
                                                            <SelectItem key={v.warehouseId} value={v.warehouseId}>
                                                                {v.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Store</label>
                                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                                <SelectTrigger className="bg-slate-50 border-slate-200 h-10">
                                                    <SelectValue placeholder="All Stores" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Stores</SelectItem>
                                                    {stores.map((s) => (
                                                        <SelectItem key={s.account_code || s.id} value={s.account_code || s.id}>
                                                            {s.store_name || s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Period</label>
                                            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                                                <DatePicker date={dateFrom} onDateChange={setDateFrom} className="bg-slate-50" />
                                                <span className="text-slate-400 text-xs font-medium">to</span>
                                                <DatePicker date={dateTo} onDateChange={setDateTo} className="bg-slate-50" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-2">
                                            <Button variant="outline" size="sm" onClick={() => handleQuickDateFilter("today")} className="text-[10px] h-8 bg-white border-slate-200">Today</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleQuickDateFilter("week")} className="text-[10px] h-8 bg-white border-slate-200">Last 7d</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleQuickDateFilter("month")} className="text-[10px] h-8 bg-white border-slate-200">Month</Button>
                                        </div>

                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => {
                                                fetchAnalytics()
                                                // We don't have easy access to set the accordion state here without more refs, 
                                                // but typically users want it to stay open until they are done.
                                            }}
                                            className="w-full text-xs h-10 bg-blue-600 hover:bg-blue-700 shadow-sm"
                                            disabled={loading}
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                            Update Analytics
                                        </Button>
                                    </div>
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
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</label>
                                        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                                            <SelectTrigger className="bg-white border-slate-200 h-9">
                                                <SelectValue placeholder="All Vendors" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Vendors</SelectItem>
                                                {vendors.map((v) => (
                                                    <SelectItem key={v.warehouseId} value={v.warehouseId}>
                                                        {v.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="flex-1 min-w-[150px] space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Store</label>
                                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                                        <SelectTrigger className="bg-white border-slate-200 h-9">
                                            <SelectValue placeholder="All Stores" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Stores</SelectItem>
                                            {stores.map((s) => (
                                                <SelectItem key={s.account_code || s.id} value={s.account_code || s.id}>
                                                    {s.store_name || s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                            <Button variant="ghost" size="sm" onClick={() => handleQuickDateFilter("today")} className={`text-[10px] h-7 px-2 hover:bg-white ${dateFrom && format(dateFrom, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-white shadow-sm' : ''}`}>Today</Button>
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
                    <div className="space-y-6">
                        {/* KPI Grid */}
                        <div className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4`}>
                            <Card className="border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow-md">
                                <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3 md:gap-4`}>
                                    <div className={`${isMobile ? 'p-2' : 'p-3'} bg-blue-100 rounded-xl flex-shrink-0`}>
                                        <Package className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-blue-600`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-slate-500 font-medium truncate uppercase tracking-tight`}>Total Claimed</p>
                                        <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-slate-900`}>{data.stats.total_claimed}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-green-500 shadow-sm transition-all hover:shadow-md">
                                <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3 md:gap-4`}>
                                    <div className={`${isMobile ? 'p-2' : 'p-3'} bg-green-100 rounded-xl flex-shrink-0`}>
                                        <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-green-600`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-slate-500 font-medium truncate uppercase tracking-tight`}>Handed Over</p>
                                        <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-slate-900`}>{data.stats.total_handed_over}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-amber-500 shadow-sm transition-all hover:shadow-md">
                                <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3 md:gap-4`}>
                                    <div className={`${isMobile ? 'p-2' : 'p-3'} bg-amber-100 rounded-xl flex-shrink-0`}>
                                        <TrendingUp className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-amber-600`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-slate-500 font-medium truncate uppercase tracking-tight`}>Fulfill Rate</p>
                                        <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-slate-900`}>{data.stats.fulfillment_rate}%</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-purple-500 shadow-sm transition-all hover:shadow-md">
                                <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3 md:gap-4`}>
                                    <div className={`${isMobile ? 'p-2' : 'p-3'} bg-purple-100 rounded-xl flex-shrink-0`}>
                                        <Clock className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-purple-600`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-slate-500 font-medium truncate uppercase tracking-tight`}>Avg Handover</p>
                                        <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-slate-900`}>
                                            {data.stats.avg_handover_hours ? `${data.stats.avg_handover_hours.toFixed(1)}h` : "N/A"}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Status Distribution */}
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className={isMobile ? 'p-4 pb-0' : ''}>
                                    <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold flex items-center gap-2`}>
                                        <Filter className="w-4 h-4 text-blue-600" />
                                        Shipment Status
                                    </CardTitle>
                                    <CardDescription className={isMobile ? 'text-[10px]' : ''}>Current state of all orders</CardDescription>
                                </CardHeader>
                                <CardContent className={isMobile ? 'h-[250px] p-2' : 'h-[300px]'}>
                                    {data.distribution.length > 0 ? (
                                        <ChartContainer config={chartConfig} className="h-full w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.distribution} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                    <XAxis type="number" hide />
                                                    <YAxis
                                                        dataKey="status"
                                                        type="category"
                                                        width={100}
                                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar
                                                        dataKey="count"
                                                        fill="#3b82f6"
                                                        radius={[0, 4, 4, 0]}
                                                        barSize={24}
                                                    >
                                                        {data.distribution.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ChartContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 italic">
                                            No data available for the selected period
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Handover Trend */}
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className={isMobile ? 'p-4 pb-0' : ''}>
                                    <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold flex items-center gap-2`}>
                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                        Handover Trend
                                    </CardTitle>
                                    <CardDescription className={isMobile ? 'text-[10px]' : ''}>Daily successful handovers</CardDescription>
                                </CardHeader>
                                <CardContent className={isMobile ? 'h-[250px] p-2' : 'h-[300px]'}>
                                    {data.trend.length > 0 ? (
                                        <ChartContainer config={chartConfig} className="h-full w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="date"
                                                        tickFormatter={(str) => format(new Date(str), "MMM d")}
                                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="count"
                                                        stroke="#10b981"
                                                        strokeWidth={3}
                                                        dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#fff' }}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </ChartContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 italic">
                                            No data available for the selected period
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <div className="h-[400px] flex items-center justify-center text-slate-400 italic">
                        No data found. Try adjusting your filters.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

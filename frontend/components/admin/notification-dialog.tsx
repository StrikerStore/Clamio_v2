/**
 * Notification Dialog Component
 * Replaces the tab-based notification system with a faster dialog
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Filter, Search, RefreshCw, Settings, Volume2, VolumeX, CheckCircle, Clock, AlertTriangle, Info, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { simpleNotificationService } from '@/lib/simpleNotificationService';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';

interface Notification {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  order_id?: string;
  vendor_name?: string;
  vendor_warehouse_id?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  metadata?: any;
  error_details?: string;
}

interface NotificationStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  last_24h: number;
  last_7days: number;
}

interface PushNotificationStats {
  total_admins: number;
  enabled_admins: number;
  subscribed_admins: number;
  active_admins: number;
}

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notificationStats?: NotificationStats;
  onNotificationUpdate?: () => void;
}

export function NotificationDialog({ 
  isOpen, 
  onClose, 
  notificationStats, 
  onNotificationUpdate 
}: NotificationDialogProps) {
  const { toast } = useToast();
  
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    severity: 'all',
    search: ''
  });
  
  // Simple notification state
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Load notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20
      };

      if (filters.status !== 'all') params.status = filters.status;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.severity !== 'all') params.severity = filters.severity;
      if (filters.search) params.search = filters.search;

      const response = await apiClient.getNotifications(params);
      
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setPagination({
          totalPages: response.data.pagination?.pages || 1,
          totalItems: response.data.pagination?.total || 0
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [page, filters, toast]);

  // Load push notification status

  // Enable notifications (simple approach)
  const handleNotificationEnable = async () => {
    try {
      console.log('🔔 Attempting to enable notifications...');
      
      const enabled = await simpleNotificationService.enable();
      
      if (enabled) {
        setNotificationEnabled(true);
        setNotificationPermission(simpleNotificationService.currentPermission);
        toast({
          title: "Success",
          description: "Notifications enabled successfully",
        });
        console.log('✅ Notifications enabled successfully');
      } else {
        throw new Error('Failed to enable notifications');
      }
      
    } catch (error: any) {
      console.error('❌ Error enabling notifications:', error);
      
      // Reset state on error
      setNotificationEnabled(false);
      
      let errorMessage = error.message || "Failed to enable notifications";
      
      // Provide more helpful error messages
      if (error.message.includes('denied')) {
        errorMessage = "Notification permission was denied. Please enable notifications in your browser settings.";
      } else if (error.message.includes('not supported')) {
        errorMessage = "Your browser does not support notifications. Please use a modern browser like Chrome, Firefox, or Safari.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Disable notifications (simple approach)
  const handleNotificationDisable = async () => {
    try {
      await simpleNotificationService.disable();
      setNotificationEnabled(false);
      setNotificationPermission(simpleNotificationService.currentPermission);
      toast({
        title: "Success",
        description: "Notifications disabled successfully",
      });
      console.log('✅ Notifications disabled successfully');
    } catch (error: any) {
      console.error('Error disabling notifications:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to disable notifications",
        variant: "destructive"
      });
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    try {
      console.log('🧪 Sending test notification...');
      
      // Check if notifications are enabled
      if (!notificationEnabled) {
        throw new Error('Notifications are not enabled. Please enable notifications first.');
      }

      // Check browser permission first
      if (Notification.permission !== 'granted') {
        throw new Error('Notification permission is not granted. Please enable notifications first.');
      }

      // Send test notification
      await simpleNotificationService.showTestNotification();
      toast({
        title: "Success",
        description: "Test notification sent successfully!",
      });
      console.log('✅ Test notification sent successfully');
      
    } catch (error: any) {
      console.error('❌ Error sending test notification:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test notification",
        variant: "destructive"
      });
    }
  };

  // Resolve notification
  const handleResolveNotification = async (notificationId: number) => {
    try {
      await apiClient.resolveNotification(notificationId, resolutionNotes);
      toast({
        title: "Success",
        description: "Notification resolved successfully",
      });
      setResolutionNotes('');
      setSelectedNotification(null);
      fetchNotifications();
      onNotificationUpdate?.();
    } catch (error) {
      console.error('Error resolving notification:', error);
      toast({
        title: "Error",
        description: "Failed to resolve notification",
        variant: "destructive"
      });
    }
  };

  // Dismiss notification
  const handleDismissNotification = async (notificationId: number) => {
    try {
      await apiClient.dismissNotification(notificationId, 'Dismissed by admin');
      toast({
        title: "Success",
        description: "Notification dismissed successfully",
      });
      fetchNotifications();
      onNotificationUpdate?.();
    } catch (error) {
      console.error('Error dismissing notification:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss notification",
        variant: "destructive"
      });
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'dismissed': return <X className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status color for row background
  const getStatusRowColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 border-l-4 border-l-yellow-400 hover:bg-yellow-100';
      case 'in_progress': return 'bg-blue-50 border-l-4 border-l-blue-400 hover:bg-blue-100';
      case 'resolved': return 'bg-green-50 border-l-4 border-l-green-400 hover:bg-green-100';
      case 'dismissed': return 'bg-gray-50 border-l-4 border-l-gray-400 hover:bg-gray-100';
      default: return 'bg-white border-l-4 border-l-gray-300 hover:bg-gray-50';
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (notifications: Notification[]) => {
    const grouped: { [key: string]: Notification[] } = {};
    
    notifications.forEach(notification => {
      const date = new Date(notification.created_at);
      let dateKey: string;
      
      if (isToday(date)) {
        dateKey = 'Today';
      } else if (isYesterday(date)) {
        dateKey = 'Yesterday';
      } else {
        dateKey = format(date, 'MMM dd, yyyy');
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(notification);
    });
    
    // Sort dates with Today first, then Yesterday, then chronological order
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      
      // For other dates, sort chronologically (newest first)
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
    
    return { grouped, sortedKeys };
  };

  // Format time for notification rows (time only)
  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  };

  // Format full date for resolution dialog
  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy \'at\' HH:mm');
  };

  // Load notification status
  const loadNotificationStatus = useCallback(async () => {
    try {
      console.log('🔔 Loading notification status...');
      
      // Get status from simple notification service
      const status = simpleNotificationService.getStatus();
      
      setNotificationSupported(status.supported);
      setNotificationEnabled(status.enabled);
      setNotificationPermission(status.permission);
      
      console.log('🔔 Notification status:', {
        supported: status.supported,
        enabled: status.enabled,
        permission: status.permission,
        canShow: status.canShow
      });
    } catch (error) {
      console.error('❌ Error loading notification status:', error);
      setNotificationEnabled(false);
      setNotificationSupported(false);
      setNotificationPermission('denied');
    }
  }, []);

  // Load data on mount and when filters change
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      loadNotificationStatus();
    } else {
      // Reset state when dialog is closed to prevent stale state
      setNotificationEnabled(false);
      setNotificationPermission('default');
    }
  }, [isOpen, fetchNotifications, loadNotificationStatus]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[98vh] w-[98vw] sm:w-full p-0 flex flex-col [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {notificationStats && notificationStats.pending > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {notificationStats.pending}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="h-8 w-8 p-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8 w-8 p-0"
              >
                <Filter className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchNotifications}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

        <div className="flex-1 overflow-hidden">
          {showSettings ? (
            /* Real-time Notification Settings View */
            <div className="h-full px-3 sm:px-6 pb-6 overflow-y-auto min-h-[500px]">
              <div className="mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                  className="flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Back to Notifications
                </Button>
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {notificationSupported ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      Real-time Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!notificationSupported ? (
                      <div className="text-center py-6">
                        <VolumeX className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600">Real-time notifications are not supported in this browser</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">Enable Notifications</h4>
                            <p className="text-xs text-gray-600 mt-1">
                              Show notifications when new issues occur
                            </p>
                          </div>
                          <Switch
                            checked={notificationEnabled}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleNotificationEnable();
                              } else {
                                handleNotificationDisable();
                              }
                            }}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs">Permission Status:</span>
                            <Badge variant={notificationPermission === 'granted' ? 'default' : 'secondary'} className="text-xs">
                              {notificationPermission}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs">Notification Status:</span>
                            <Badge variant={notificationEnabled ? 'default' : 'secondary'} className="text-xs">
                              {notificationEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-2 rounded text-xs text-gray-600">
                          <strong>Note:</strong> Notifications will appear in your browser when new vendor errors occur.
                        </div>

                        {notificationEnabled && (
                          <>
                            <Separator />
                            <Button
                              variant="outline"
                              onClick={handleTestNotification}
                              className="w-full text-sm h-8"
                            >
                              Send Test Notification
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Notifications View */
            <div className="h-full px-3 pb-4">
              {/* Filters */}
              {showFilters && (
                <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  {/* Status and Severity in same row for mobile */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Status</label>
                      <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Severity</label>
                      <Select value={filters.severity} onValueChange={(value) => setFilters({...filters, severity: value})}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Severity</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Search</label>
                    <Input
                      placeholder="Search notifications..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => setFilters({ status: 'all', type: 'all', severity: 'all', search: '' })}
                      className="w-full h-9"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}

              {/* Notifications List */}
              <ScrollArea className="h-[400px] sm:h-[500px] md:h-[600px] lg:h-[650px]">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    No notifications found
                  </div>
                ) : (
                  (() => {
                    const { grouped, sortedKeys } = groupNotificationsByDate(notifications);
                    return (
                      <div className="space-y-3">
                        {sortedKeys.map((dateKey) => (
                          <div key={dateKey}>
                            <div className="sticky top-0 bg-white py-2 border-b border-gray-200">
                              <h3 className="text-sm font-semibold text-gray-700">{dateKey}</h3>
                            </div>
                            <div className="space-y-0.5 mt-2">
                              {grouped[dateKey].map((notification) => (
                                <Card 
                                  key={notification.id} 
                                  className={`cursor-pointer hover:shadow-md transition-all duration-200 ${getStatusRowColor(notification.status)}`}
                                  onClick={() => {
                                    if (notification.status === 'pending') {
                                      setSelectedNotification(notification);
                                    }
                                  }}
                                >
                                  <CardContent className="p-1.5">
                                    <div className="space-y-1.5">
                                      <div className="flex items-start gap-2">
                                        <div className="flex-shrink-0 mt-0.5">
                                          {getSeverityIcon(notification.severity)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-medium text-sm break-words leading-tight">{notification.title}</h4>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className={`text-xs px-1.5 py-0.5 ${getSeverityColor(notification.severity)}`}>
                                            {notification.severity}
                                          </Badge>
                                          <div className="flex items-center gap-1">
                                            {getStatusIcon(notification.status)}
                                            <span className="text-xs text-gray-500 capitalize">
                                              {notification.status.replace('_', ' ')}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-gray-400" />
                                            <span className="text-xs text-gray-500">
                                              {formatNotificationTime(notification.created_at)}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                          {notification.status === 'pending' && (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedNotification(notification);
                                                }}
                                                className="text-blue-600 hover:text-blue-700 p-1 h-5 w-5"
                                              >
                                                <Eye className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDismissNotification(notification.id);
                                                }}
                                                className="text-red-600 hover:text-red-700 p-1 h-5 w-5"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </ScrollArea>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 pt-3 border-t">
                  <div className="text-sm text-gray-500 text-center sm:text-left">
                    Showing {notifications.length} of {pagination.totalItems} notifications
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="h-8 px-3"
                    >
                      Previous
                    </Button>
                    <span className="text-sm px-2">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                      className="h-8 px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notification Detail Modal - Mobile Friendly */}
        {selectedNotification && (
          <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
            <DialogContent className="w-[98vw] max-w-md max-h-[98vh] p-0 overflow-hidden flex flex-col [&>button]:hidden">
              <DialogHeader className="px-3 py-2 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-1 text-xs font-medium pr-1 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {React.cloneElement(getSeverityIcon(selectedNotification.severity), { className: "w-3 h-3" })}
                    </div>
                    <span className="truncate text-xs">{selectedNotification.title}</span>
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNotification(null)}
                    className="p-1 flex-shrink-0 h-6 w-6"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="px-3 py-2 space-y-3 flex-1 overflow-y-auto min-h-[400px]">
                <div>
                  <h4 className="font-medium mb-1 text-xs">Description</h4>
                  <p className="text-xs text-gray-600 leading-relaxed break-words">{selectedNotification.message}</p>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <span className={`capitalize ${selectedNotification.status === 'pending' ? 'text-yellow-600' : selectedNotification.status === 'resolved' ? 'text-green-600' : 'text-gray-600'}`}>
                      {selectedNotification.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Severity:</span>
                    <span className={`capitalize ${selectedNotification.severity === 'critical' ? 'text-red-600' : selectedNotification.severity === 'high' ? 'text-orange-600' : 'text-gray-600'}`}>
                      {selectedNotification.severity}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Created:</span>
                    <span className="text-gray-600">
                      {formatFullDate(selectedNotification.created_at)}
                    </span>
                  </div>
                  {selectedNotification.vendor_name && (
                    <div className="flex justify-between">
                      <span className="font-medium">Vendor:</span>
                      <span className="truncate ml-1 max-w-[60%]">{selectedNotification.vendor_name}</span>
                    </div>
                  )}
                  {selectedNotification.order_id && (
                    <div className="flex justify-between">
                      <span className="font-medium">Order ID:</span>
                      <span className="truncate ml-1 max-w-[60%]">{selectedNotification.order_id}</span>
                    </div>
                  )}
                </div>
                
                {selectedNotification.error_details && (
                  <div>
                    <h4 className="font-medium mb-1 text-xs">Error Details</h4>
                    <div className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-24">
                      <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {selectedNotification.error_details}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNotification.metadata && (
                  <div>
                    <h4 className="font-medium mb-1 text-xs">Additional Information</h4>
                    <div className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-24">
                      <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {JSON.stringify(selectedNotification.metadata, null, 2)}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-1 text-xs">Resolution Notes</h4>
                  <textarea
                    className="w-full p-2 border rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={4}
                    placeholder="Add resolution notes..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-3 py-2 border-t bg-gray-50 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedNotification(null)}
                    className="flex-1 h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleResolveNotification(selectedNotification.id)}
                    disabled={!resolutionNotes.trim()}
                    className="flex-1 h-8 text-xs"
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

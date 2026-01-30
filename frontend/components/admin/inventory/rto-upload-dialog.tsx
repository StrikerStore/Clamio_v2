"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Search, Filter, Plus, Minus, Loader2, Package, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RTOManualEntryDialog } from "./rto-manual-entry-dialog";

interface RTOInventoryItem {
  id: number;
  Location: string;
  Product_Name: string;
  Size: string;
  Quantity: number;
  product_code: string;
  base_sku: string;
}

interface RTOUploadDialogProps {
  onRTODataUploaded: (rtoData?: any[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RTOUploadDialog({ onRTODataUploaded, open: controlledOpen, onOpenChange }: RTOUploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [items, setItems] = useState<RTOInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [modifiedItems, setModifiedItems] = useState<Map<number, number>>(new Map());
  const [showManualEntryDialog, setShowManualEntryDialog] = useState(false);
  const { toast } = useToast();

  // Fetch RTO inventory when dialog opens
  useEffect(() => {
    if (open) {
      fetchRTOInventory();
    }
  }, [open]);

  const fetchRTOInventory = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const authHeader = localStorage.getItem("authHeader");
      const response = await fetch(
        `${API_BASE_URL}/admin/inventory/rto`,
        {
          headers: {
            Authorization: authHeader || "",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setItems(data.data.rtoData);
        setModifiedItems(new Map());
      } else {
        throw new Error(data.error || "Failed to fetch RTO inventory");
      }
    } catch (error) {
      console.error("Error fetching RTO inventory:", error);
      toast({
        title: "Fetch Failed",
        description: "Failed to load RTO inventory data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get unique locations from items
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    items.forEach((item) => {
      if (item.Location && item.Location.trim()) {
        locations.add(item.Location.trim());
      }
    });
    return Array.from(locations).sort();
  }, [items]);

  // Filter items based on search and location
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Location filter
      if (selectedLocation !== "all" && item.Location !== selectedLocation) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesProductName = item.Product_Name?.toLowerCase().includes(query);
        const matchesProductCode = item.product_code?.toLowerCase().includes(query);
        const matchesSize = item.Size?.toLowerCase().includes(query);
        if (!matchesProductName && !matchesProductCode && !matchesSize) {
          return false;
        }
      }

      return true;
    });
  }, [items, searchQuery, selectedLocation]);

  // Group filtered items by location and product name
  const groupedItems = useMemo(() => {
    const groups = new Map<string, RTOInventoryItem[]>();

    filteredItems.forEach((item) => {
      const key = `${item.Location}|||${item.Product_Name}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    // Sort groups by location then product name
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
      const [keyA] = a;
      const [keyB] = b;
      return keyA.localeCompare(keyB);
    });

    return sortedEntries;
  }, [filteredItems]);

  // Get current quantity (modified or original)
  const getCurrentQuantity = (item: RTOInventoryItem): number => {
    if (modifiedItems.has(item.id)) {
      return modifiedItems.get(item.id)!;
    }
    return item.Quantity;
  };

  // Handle quantity increment
  const handleIncrement = (item: RTOInventoryItem) => {
    const currentQty = getCurrentQuantity(item);
    const newQty = currentQty + 1;
    setModifiedItems(new Map(modifiedItems.set(item.id, newQty)));
  };

  // Handle quantity decrement
  const handleDecrement = (item: RTOInventoryItem) => {
    const currentQty = getCurrentQuantity(item);
    if (currentQty > 0) {
      const newQty = currentQty - 1;
      setModifiedItems(new Map(modifiedItems.set(item.id, newQty)));
    }
  };

  // Check if an item has been modified
  const isModified = (item: RTOInventoryItem): boolean => {
    if (!modifiedItems.has(item.id)) return false;
    return modifiedItems.get(item.id) !== item.Quantity;
  };

  // Get count of actual changes
  const changesCount = useMemo(() => {
    let count = 0;
    modifiedItems.forEach((newQty, id) => {
      const originalItem = items.find(item => item.id === id);
      if (originalItem && originalItem.Quantity !== newQty) {
        count++;
      }
    });
    return count;
  }, [modifiedItems, items]);

  // Save changes to database
  const handleSaveChanges = async () => {
    if (changesCount === 0) {
      toast({
        title: "No Changes",
        description: "No changes to save.",
      });
      return;
    }

    setSaving(true);
    try {
      // Build updates array with only actual changes
      const updates: { id: number; quantity: number }[] = [];
      modifiedItems.forEach((newQty, id) => {
        const originalItem = items.find(item => item.id === id);
        if (originalItem && originalItem.Quantity !== newQty) {
          updates.push({ id, quantity: newQty });
        }
      });

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const authHeader = localStorage.getItem("authHeader");

      const response = await fetch(`${API_BASE_URL}/admin/inventory/rto`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader || "",
        },
        body: JSON.stringify({ updates }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Changes Saved",
          description: `Updated ${data.data.updatedCount} items successfully.`,
        });
        // Refresh local data
        await fetchRTOInventory();
        // Notify parent to refresh its inventory display
        onRTODataUploaded();
        // Close dialog
        setOpen(false);
      } else {
        throw new Error(data.error || "Failed to save changes");
      }
    } catch (error) {
      console.error("Error saving RTO inventory:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-10 text-xs flex items-center justify-center sm:w-auto sm:h-auto sm:text-sm" data-rto-upload-trigger>
          <Upload className="w-3.5 h-3.5 mr-1.5 sm:w-4 sm:h-4 sm:mr-2" />
          <span className="sm:hidden">Update</span>
          <span className="hidden sm:inline">Update RTO</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl h-[90vh] sm:h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 border-b flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            RTO Inventory Manager
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Manage RTO inventory quantities. Use +/- to adjust, then click Update.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filter Row */}
        <div className="px-4 py-3 sm:px-6 border-b flex-shrink-0">
          <div className="flex gap-2">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search product, code, size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Location Filter - Icon only */}
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-10 h-9 px-0 justify-center [&>svg:last-child]:hidden">
                <Filter className={`w-4 h-4 ${selectedLocation !== 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {availableLocations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Add RTO Button */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setShowManualEntryDialog(true)}
              title="Add RTO Entry"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Manual Entry Dialog */}
        <RTOManualEntryDialog
          open={showManualEntryDialog}
          onOpenChange={setShowManualEntryDialog}
          onEntryAdded={() => {
            fetchRTOInventory();
            onRTODataUploaded();
          }}
        />

        {/* Cards Container - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <Package className="w-12 h-12 mb-2 text-gray-300" />
              <p className="text-sm">No RTO inventory items found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedItems.map(([groupKey, groupItems]) => {
                const [location, productName] = groupKey.split('|||');
                return (
                  <div key={groupKey} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    {/* Group Header */}
                    <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="font-medium">{location}</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5 break-words whitespace-normal">
                        {productName}
                      </div>
                    </div>

                    {/* Size Items */}
                    <div className="divide-y divide-gray-100">
                      {groupItems.map((item) => {
                        const currentQty = getCurrentQuantity(item);
                        const modified = isModified(item);

                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between px-3 py-2 ${modified ? 'bg-blue-50' : 'bg-white'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-700 min-w-[40px]">
                                {item.Size || 'N/A'}
                              </span>
                              {modified && (
                                <span className="text-xs text-blue-600 font-medium">
                                  (was {item.Quantity})
                                </span>
                              )}
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => handleDecrement(item)}
                                disabled={currentQty <= 0}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </Button>
                              <span className={`w-10 text-center text-sm font-semibold ${modified ? 'text-blue-600' : 'text-gray-900'}`}>
                                {currentQty}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => handleIncrement(item)}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="px-4 py-3 sm:px-6 border-t bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500">
              {filteredItems.length} items · {changesCount} pending change{changesCount !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveChanges}
                disabled={changesCount === 0 || saving}
                className="h-9 min-w-[100px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Update{changesCount > 0 && ` (${changesCount})`}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

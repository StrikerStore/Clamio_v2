"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProductInventoryCard } from "./product-inventory-card";
import { InventoryMetrics } from "./inventory-metrics";
import { RTOUploadDialog } from "./rto-upload-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Share2, RefreshCw, Filter, X, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  productName: string;
  baseProductName: string;
  imageUrl: string | null;
  baseSku: string;
  sizeQuantity: string;
  prefix: string;
}

interface RTOEntry {
  Product_Name: string;
  Location: string;
  Size: string;
  Quantity: string;
}

export function InventoryAggregation() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [rtoData, setRTOData] = useState<RTOEntry[]>([]);
  const { toast } = useToast();

  // Filter states (multi-select)
  const [typeFilters, setTypeFilters] = useState<string[]>([]); // e.g., ["player", "fan"]
  const [seasonFilters, setSeasonFilters] = useState<string[]>([]); // e.g., ["2024-25", "2025-26"]
  const [locationFilters, setLocationFilters] = useState<string[]>([]); // e.g., ["Warehouse A", "Warehouse B"]
  const [searchFilter, setSearchFilter] = useState<string>(""); // text search (includes)
  const [searchExcludeFilter, setSearchExcludeFilter] = useState<string>(""); // text search (excludes)
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  /**
   * Fetch inventory from API
   */
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const authHeader = localStorage.getItem("authHeader");
      const response = await fetch(
        `${API_BASE_URL}/admin/inventory/aggregate`,
        {
          headers: {
            Authorization: authHeader || "",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setProducts(data.data.products);
      } else {
        throw new Error(data.error || "Failed to fetch inventory");
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast({
        title: "Fetch Failed",
        description: "Failed to load inventory data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle RTO data upload
   */
  const handleRTODataUploaded = (data: RTOEntry[]) => {
    setRTOData(data);
    toast({
      title: "RTO Data Loaded",
      description: `${data.length} RTO entries loaded successfully.`,
    });
  };

  /**
   * Match RTO data with product
   */
  const getRTOInfoForProduct = (productName: string) => {
    const cleanProductName = productName.trim().toLowerCase();
    const matches = rtoData.filter(
      (rto) => rto.Product_Name.trim().toLowerCase() === cleanProductName
    );

    if (matches.length === 0) return undefined;

    // Group by location
    const locationMap = new Map<string, string[]>();
    matches.forEach((rto) => {
      const location = rto.Location || 'Unknown';
      if (!locationMap.has(location)) {
        locationMap.set(location, []);
      }
      const sizeStr = rto.Quantity
        ? `${rto.Size}-${rto.Quantity}`
        : rto.Size;
      locationMap.get(location)!.push(sizeStr);
    });

    return Array.from(locationMap.entries()).map(([location, sizes]) => ({
      location,
      sizes,
    }));
  };

  /**
   * Extract season from product name (e.g., "2024-25" or "2025-26")
   */
  const extractSeason = (productName: string): string | null => {
    const seasonMatch = productName.match(/(\d{4})-(\d{2})/);
    return seasonMatch ? seasonMatch[0] : null;
  };

  /**
   * Get unique seasons from all products
   */
  const availableSeasons = useMemo(() => {
    const seasons = new Set<string>();
    products.forEach((product) => {
      const season = extractSeason(product.productName);
      if (season) {
        seasons.add(season);
      }
    });
    return Array.from(seasons).sort();
  }, [products]);

  /**
   * Get unique locations from RTO data
   */
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    rtoData.forEach((rto) => {
      if (rto.Location && rto.Location.trim()) {
        locations.add(rto.Location.trim());
      }
    });
    return Array.from(locations).sort();
  }, [rtoData]);

  /**
   * Apply filters to products (multi-select with OR within filter, AND between filters)
   */
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Type filter (Player/Fan) - OR logic within types
      if (typeFilters.length > 0) {
        const hasAnyType = typeFilters.some((type) =>
          product.productName.toLowerCase().includes(type.toLowerCase())
        );
        if (!hasAnyType) return false;
      }

      // Season filter - OR logic within seasons
      if (seasonFilters.length > 0) {
        const productSeason = extractSeason(product.productName);
        const hasAnySeason = productSeason && seasonFilters.includes(productSeason);
        if (!hasAnySeason) return false;
      }

      // Location filter - OR logic within locations (only if RTO data exists)
      if (locationFilters.length > 0 && rtoData.length > 0) {
        const productRTOInfo = getRTOInfoForProduct(product.productName);
        if (!productRTOInfo || productRTOInfo.length === 0) {
          // If no RTO data for this product, exclude it when location filters are active
          return false;
        }
        
        const hasAnyLocation = productRTOInfo.some((rto) =>
          locationFilters.includes(rto.location)
        );
        if (!hasAnyLocation) return false;
      }

      // Search filter (product name or SKU) - comma separated includes
      if (searchFilter.trim()) {
        const searchTerms = searchFilter.toLowerCase().split(',').map(term => term.trim()).filter(term => term);
        const productNameLower = product.productName.toLowerCase();
        const skuLower = product.baseSku.toLowerCase();
        
        // At least one search term must match
        const hasMatch = searchTerms.some(term => 
          productNameLower.includes(term) || skuLower.includes(term)
        );
        if (!hasMatch) return false;
      }

      // Search exclude filter (product name or SKU) - comma separated excludes
      if (searchExcludeFilter.trim()) {
        const excludeTerms = searchExcludeFilter.toLowerCase().split(',').map(term => term.trim()).filter(term => term);
        const productNameLower = product.productName.toLowerCase();
        const skuLower = product.baseSku.toLowerCase();
        
        // If any exclude term matches, exclude this product
        const hasExcludeMatch = excludeTerms.some(term => 
          productNameLower.includes(term) || skuLower.includes(term)
        );
        if (hasExcludeMatch) return false;
      }

      return true;
    });
  }, [products, typeFilters, seasonFilters, locationFilters, searchFilter, searchExcludeFilter, rtoData]);

  /**
   * Toggle type filter
   */
  const toggleTypeFilter = (type: string) => {
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  /**
   * Toggle season filter
   */
  const toggleSeasonFilter = (season: string) => {
    setSeasonFilters((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season]
    );
  };

  /**
   * Toggle location filter
   */
  const toggleLocationFilter = (location: string) => {
    setLocationFilters((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setTypeFilters([]);
    setSeasonFilters([]);
    setLocationFilters([]);
    setSearchFilter("");
    setSearchExcludeFilter("");
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = typeFilters.length > 0 || seasonFilters.length > 0 || locationFilters.length > 0 || searchFilter.trim() !== "" || searchExcludeFilter.trim() !== "";

  /**
   * Format size-quantity for bulk WhatsApp message
   */
  const formatSizeQuantityForBulkMessage = (sizeQty: string): string => {
    const withoutPrefix = sizeQty.replace(/^(Player|Fan)\s+/, "");
    const pairs = withoutPrefix.split(",").map((p) => p.trim());
    return pairs.join(", ");
  };

  /**
   * Share all products to WhatsApp (works on filtered products)
   */
  const shareAllToWhatsApp = () => {
    if (filteredProducts.length === 0) {
      toast({
        title: "No Products",
        description: "No products available to share.",
        variant: "destructive",
      });
      return;
    }

    // Generate bulk message (using filtered products)
    let message = `📦 *Inventory Order Summary*\n`;
    
    // Add filter info if filters are active
    if (hasActiveFilters) {
      message += `*Filters Applied:*\n`;
      if (typeFilters.length > 0) {
        const types = typeFilters.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
        message += `- Type: ${types}\n`;
      }
      if (seasonFilters.length > 0) {
        message += `- Season: ${seasonFilters.join(", ")}\n`;
      }
      if (locationFilters.length > 0) {
        message += `- Location: ${locationFilters.join(", ")}\n`;
      }
      if (searchFilter.trim()) message += `- Include: "${searchFilter}"\n`;
      if (searchExcludeFilter.trim()) message += `- Exclude: "${searchExcludeFilter}"\n`;
      message += `\n`;
    } else {
      message += `\n`;
    }

    filteredProducts.forEach((product, index) => {
      message += `${index + 1}. *${product.productName}*\n`;
      message += `   ${formatSizeQuantityForBulkMessage(product.sizeQuantity)}\n`;
      
      // Add RTO info if available
      const rtoInfo = getRTOInfoForProduct(product.productName);
      if (rtoInfo && rtoInfo.length > 0) {
        message += `   🔄 RTO: `;
        const rtoStrs = rtoInfo.map((rto) => `${rto.location} (${rto.sizes.join(", ")})`);
        message += rtoStrs.join(", ");
        message += "\n";
      }
      
      message += "\n";
    });

    message += `---\n_Sent from Claimio Inventory System_`;

    // Encode and open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const whatsappUrl = isMobile
      ? `whatsapp://send?text=${encodedMessage}`
      : `https://web.whatsapp.com/send?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");

    toast({
      title: "WhatsApp Opened",
      description: hasActiveFilters 
        ? `Bulk message with ${filteredProducts.length} filtered products is ready to send.`
        : "Bulk inventory message is ready to send.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
        Inventory Aggregation
      </h2>

      {/* Mobile Layout: Metrics + Actions */}
      <div className="block sm:hidden">
        <div className="flex gap-3">
          {/* Left: Total Products Card (half width) */}
          <div className="w-1/2">
            <InventoryMetrics 
              totalProducts={filteredProducts.length} 
              totalUnfilteredProducts={products.length}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
          
          {/* Right: Action Buttons (half width, stacked) */}
          <div className="w-1/2 flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={fetchInventory}
              disabled={loading}
              size="sm"
              className="h-1/2 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <span className="text-xs">Inventory</span>
            </Button>
            <div className="h-1/2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-full flex items-center justify-center"
                onClick={() => {
                  // Trigger the RTO upload dialog
                  const uploadButton = document.querySelector('[data-rto-upload-trigger]') as HTMLButtonElement;
                  if (uploadButton) {
                    uploadButton.click();
                  }
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="text-xs">RTO</span>
              </Button>
              <div className="hidden" data-rto-upload-trigger>
                <RTOUploadDialog onRTODataUploaded={handleRTODataUploaded} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout: Original */}
      <div className="hidden sm:block">
        {/* Header with Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchInventory}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div data-rto-upload-trigger>
              <RTOUploadDialog onRTODataUploaded={handleRTODataUploaded} />
            </div>
            <Button
              onClick={shareAllToWhatsApp}
              disabled={filteredProducts.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base"
              size="sm"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share All {hasActiveFilters && `(${filteredProducts.length})`}
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <InventoryMetrics 
          totalProducts={filteredProducts.length} 
          totalUnfilteredProducts={products.length}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Mobile Layout: Filters + Share All */}
      <div className="block sm:hidden">
        {/* Filters Section - Full Width */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          {/* Filter Header (Accordion on Mobile) */}
          <div 
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            </div>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFilters();
                  }}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear All
                </Button>
              )}
              <X className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showFilters ? 'rotate-45' : ''}`} />
            </div>
          </div>

          {/* Filter Controls */}
          <div className={`${showFilters ? "block" : "hidden"}`}>
            <div className="space-y-3">
              {/* Type Filter (Multi-select) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Type (Multi-select)</Label>
                <div className="border border-gray-200 rounded-md p-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="type-player"
                        checked={typeFilters.includes("player")}
                        onCheckedChange={() => toggleTypeFilter("player")}
                      />
                      <label
                        htmlFor="type-player"
                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer break-words"
                      >
                        Player
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="type-fan"
                        checked={typeFilters.includes("fan")}
                        onCheckedChange={() => toggleTypeFilter("fan")}
                      />
                      <label
                        htmlFor="type-fan"
                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer break-words"
                      >
                        Fan
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Season Filter (Multi-select) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Season (Multi-select)</Label>
                <div className="border border-gray-200 rounded-md p-2.5 max-h-24 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {availableSeasons.length === 0 ? (
                      <p className="text-xs text-gray-500 col-span-2">No seasons found</p>
                    ) : (
                      availableSeasons.map((season) => (
                        <div key={season} className="flex items-center space-x-2">
                          <Checkbox
                            id={`season-${season}`}
                            checked={seasonFilters.includes(season)}
                            onCheckedChange={() => toggleSeasonFilter(season)}
                          />
                          <label
                            htmlFor={`season-${season}`}
                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer break-words"
                          >
                            {season}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Location Filter (Multi-select) - Only show if RTO data exists */}
              {availableLocations.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Location (Multi-select)</Label>
                  <div className="border border-gray-200 rounded-md p-2.5 max-h-24 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {availableLocations.map((location) => (
                        <div key={location} className="flex items-center space-x-2">
                          <Checkbox
                            id={`location-${location}`}
                            checked={locationFilters.includes(location)}
                            onCheckedChange={() => toggleLocationFilter(location)}
                          />
                          <label
                            htmlFor={`location-${location}`}
                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer break-words"
                          >
                            {location}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Search Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="search-filter" className="text-xs">Search (includes)</Label>
                <div className="relative">
                  <Input
                    id="search-filter"
                    type="text"
                    placeholder="Name or SKU (comma separated)..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-9 text-xs pr-8"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Exclude Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="search-exclude-filter" className="text-xs">Search (exclude)</Label>
                <div className="relative">
                  <Input
                    id="search-exclude-filter"
                    type="text"
                    placeholder="Name or SKU (comma separated)..."
                    value={searchExcludeFilter}
                    onChange={(e) => setSearchExcludeFilter(e.target.value)}
                    className="h-9 text-xs pr-8"
                  />
                  {searchExcludeFilter && (
                    <button
                      onClick={() => setSearchExcludeFilter("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-600">Active filters:</span>
                  {typeFilters.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                      <button
                        onClick={() => toggleTypeFilter(type)}
                        className="ml-1 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {seasonFilters.map((season) => (
                    <Badge key={season} variant="secondary" className="text-xs">
                      {season}
                      <button
                        onClick={() => toggleSeasonFilter(season)}
                        className="ml-1 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {locationFilters.map((location) => (
                    <Badge key={location} variant="secondary" className="text-xs">
                      {location}
                      <button
                        onClick={() => toggleLocationFilter(location)}
                        className="ml-1 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {searchFilter.trim() && (
                    <Badge variant="secondary" className="text-xs">
                      Include: "{searchFilter}"
                      <button
                        onClick={() => setSearchFilter("")}
                        className="ml-1 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                  {searchExcludeFilter.trim() && (
                    <Badge variant="secondary" className="text-xs">
                      Exclude: "{searchExcludeFilter}"
                      <button
                        onClick={() => setSearchExcludeFilter("")}
                        className="ml-1 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share All Button - Full Width */}
        <Button
          onClick={shareAllToWhatsApp}
          disabled={filteredProducts.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white w-full h-12 text-sm flex items-center justify-center"
        >
          <Share2 className="w-4 h-4 mr-2" />
          <span>Share All {hasActiveFilters && `(${filteredProducts.length})`}</span>
        </Button>
      </div>

      {/* Desktop Filters Section */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-lg p-4">
        {/* Filter Header (Desktop) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <h3 className="text-base font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-sm"
              >
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="block">
          <div className={`grid grid-cols-1 gap-4 ${availableLocations.length > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {/* Type Filter (Multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm">Type (Multi-select)</Label>
              <div className="border border-gray-200 rounded-md p-3">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="type-player-desktop"
                      checked={typeFilters.includes("player")}
                      onCheckedChange={() => toggleTypeFilter("player")}
                    />
                    <label
                      htmlFor="type-player-desktop"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Player
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="type-fan-desktop"
                      checked={typeFilters.includes("fan")}
                      onCheckedChange={() => toggleTypeFilter("fan")}
                    />
                    <label
                      htmlFor="type-fan-desktop"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Fan
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Season Filter (Multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm">Season (Multi-select)</Label>
              <div className="border border-gray-200 rounded-md p-3 max-h-32 overflow-y-auto">
                {availableSeasons.length === 0 ? (
                  <p className="text-sm text-gray-500">No seasons found</p>
                ) : (
                  <div className="space-y-2">
                    {availableSeasons.map((season) => (
                      <div key={season} className="flex items-center space-x-2">
                        <Checkbox
                          id={`season-${season}-desktop`}
                          checked={seasonFilters.includes(season)}
                          onCheckedChange={() => toggleSeasonFilter(season)}
                        />
                        <label
                          htmlFor={`season-${season}-desktop`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {season}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Location Filter (Multi-select) - Only show if RTO data exists */}
            {availableLocations.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Location (Multi-select)</Label>
                <div className="border border-gray-200 rounded-md p-3 max-h-32 overflow-y-auto">
                  <div className="space-y-2">
                    {availableLocations.map((location) => (
                      <div key={location} className="flex items-center space-x-2">
                        <Checkbox
                          id={`location-${location}-desktop`}
                          checked={locationFilters.includes(location)}
                          onCheckedChange={() => toggleLocationFilter(location)}
                        />
                        <label
                          htmlFor={`location-${location}-desktop`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {location}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Search Filter */}
            <div className="space-y-2">
              <Label htmlFor="search-filter-desktop" className="text-sm">Search (includes)</Label>
              <div className="relative">
                <Input
                  id="search-filter-desktop"
                  type="text"
                  placeholder="Name or SKU (comma separated)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-10 text-sm pr-8"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Exclude Filter */}
            <div className="space-y-2">
              <Label htmlFor="search-exclude-filter-desktop" className="text-sm">Search (exclude)</Label>
              <div className="relative">
                <Input
                  id="search-exclude-filter-desktop"
                  type="text"
                  placeholder="Keywords to exclude (comma separated)..."
                  value={searchExcludeFilter}
                  onChange={(e) => setSearchExcludeFilter(e.target.value)}
                  className="h-10 text-sm pr-8"
                />
                {searchExcludeFilter && (
                  <button
                    onClick={() => setSearchExcludeFilter("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {typeFilters.map((type) => (
                <Badge key={type} variant="secondary" className="text-sm">
                  Type: {type.charAt(0).toUpperCase() + type.slice(1)}
                  <button
                    onClick={() => toggleTypeFilter(type)}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {seasonFilters.map((season) => (
                <Badge key={season} variant="secondary" className="text-sm">
                  Season: {season}
                  <button
                    onClick={() => toggleSeasonFilter(season)}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {locationFilters.map((location) => (
                <Badge key={location} variant="secondary" className="text-sm">
                  Location: {location}
                  <button
                    onClick={() => toggleLocationFilter(location)}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {searchFilter.trim() && (
                <Badge variant="secondary" className="text-sm">
                  Include: &quot;{searchFilter}&quot;
                  <button
                    onClick={() => setSearchFilter("")}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {searchExcludeFilter.trim() && (
                <Badge variant="secondary" className="text-sm">
                  Exclude: &quot;{searchExcludeFilter}&quot;
                  <button
                    onClick={() => setSearchExcludeFilter("")}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RTO Status Indicator */}
      {rtoData.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 sm:p-3">
          <p className="text-xs sm:text-sm text-blue-900">
            🔄 RTO data loaded: {rtoData.length} entries
          </p>
        </div>
      )}

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-sm sm:text-base text-gray-500">No unclaimed orders found.</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-sm sm:text-base text-gray-500 mb-2">No products match the current filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredProducts.map((product) => (
            <ProductInventoryCard
              key={product.baseSku}
              productName={product.productName}
              imageUrl={product.imageUrl}
              sizeQuantity={product.sizeQuantity}
              baseSku={product.baseSku}
              rtoData={getRTOInfoForProduct(product.productName)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


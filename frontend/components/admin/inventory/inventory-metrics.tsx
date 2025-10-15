"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

interface InventoryMetricsProps {
  totalProducts: number;
  totalUnfilteredProducts: number;
  hasActiveFilters: boolean;
}

export function InventoryMetrics({ 
  totalProducts, 
  totalUnfilteredProducts,
  hasActiveFilters 
}: InventoryMetricsProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-gray-600">
              {hasActiveFilters ? "Filtered Products" : "Total Products"}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalProducts}</p>
              {hasActiveFilters && totalProducts !== totalUnfilteredProducts && (
                <p className="text-xs sm:text-sm text-gray-500">
                  of {totalUnfilteredProducts}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


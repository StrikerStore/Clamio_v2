"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2, Check, ChevronsUpDown, MapPin, Package, Ruler } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";

interface Product {
    name: string;
    sku_id: string;
}

interface RTOManualEntryDialogProps {
    onEntryAdded: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function RTOManualEntryDialog({
    onEntryAdded,
    open: controlledOpen,
    onOpenChange
}: RTOManualEntryDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;

    // Form state
    const [location, setLocation] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedSize, setSelectedSize] = useState("");
    const [quantity, setQuantity] = useState<number>(1);

    // Dropdown data
    const [locations, setLocations] = useState<string[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Loading states
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Dropdown open states
    const [locationOpen, setLocationOpen] = useState(false);
    const [productOpen, setProductOpen] = useState(false);

    const { toast } = useToast();

    // Fetch locations and products when dialog opens
    useEffect(() => {
        if (open) {
            fetchLocations();
            fetchProducts();
            // Reset form
            setLocation("");
            setSelectedProduct(null);
            setSelectedSize("");
            setQuantity(1);
        }
    }, [open]);

    // Reset size when product changes
    useEffect(() => {
        if (selectedProduct) {
            setSelectedSize("");
        }
    }, [selectedProduct]);

    const fetchLocations = async () => {
        setLoadingLocations(true);
        try {
            const response = await apiClient.getRTOLocations();
            if (response.success) {
                setLocations(response.data.locations || []);
            }
        } catch (error) {
            console.error("Error fetching locations:", error);
        } finally {
            setLoadingLocations(false);
        }
    };

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const response = await apiClient.getRTOProducts();
            if (response.success) {
                setProducts(response.data.products || []);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setLoadingProducts(false);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!location.trim()) {
            toast({
                title: "Validation Error",
                description: "Please enter or select a location",
                variant: "destructive",
            });
            return;
        }

        if (!selectedProduct) {
            toast({
                title: "Validation Error",
                description: "Please select a product",
                variant: "destructive",
            });
            return;
        }

        if (!selectedSize) {
            toast({
                title: "Validation Error",
                description: "Please select a size",
                variant: "destructive",
            });
            return;
        }

        if (!quantity || quantity <= 0) {
            toast({
                title: "Validation Error",
                description: "Please enter a valid quantity (must be greater than 0)",
                variant: "destructive",
            });
            return;
        }

        setSubmitting(true);
        try {
            const response = await apiClient.addManualRTOEntry({
                location: location.trim(),
                sku_id: selectedProduct.sku_id,
                size: selectedSize,
                quantity: quantity,
            });

            if (response.success) {
                toast({
                    title: "Success",
                    description: "RTO inventory entry added successfully",
                });
                setOpen(false);
                onEntryAdded();
            } else {
                throw new Error((response.errors && response.errors.length > 0) ? response.errors[0] : "Failed to add entry");
            }
        } catch (error: any) {
            console.error("Error adding RTO entry:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to add RTO entry",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        return products;
    }, [products]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-green-600" />
                        Add RTO Entry
                    </DialogTitle>
                    <DialogDescription>
                        Manually add inventory to RTO. If an entry with the same location, product, and size exists, the quantity will be added.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Location Field */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            Location
                        </Label>
                        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={locationOpen}
                                    className="w-full justify-between h-10"
                                    disabled={loadingLocations}
                                >
                                    {loadingLocations ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading...
                                        </span>
                                    ) : location ? (
                                        <span className="truncate">{location}</span>
                                    ) : (
                                        "Select or type location..."
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0">
                                <Command>
                                    <CommandInput
                                        placeholder="Search or type new location..."
                                        value={location}
                                        onValueChange={setLocation}
                                    />
                                    <CommandList>
                                        <CommandEmpty>
                                            {location ? (
                                                <div className="py-3 px-2 text-center">
                                                    <p className="text-sm text-gray-600">Press Enter or click to use:</p>
                                                    <p className="font-medium text-gray-900">&quot;{location}&quot;</p>
                                                </div>
                                            ) : (
                                                "No locations found."
                                            )}
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {locations.map((loc) => (
                                                <CommandItem
                                                    key={loc}
                                                    value={loc}
                                                    onSelect={() => {
                                                        setLocation(loc);
                                                        setLocationOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            location === loc ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {loc}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Product Field */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-500" />
                            Product
                        </Label>
                        <Popover open={productOpen} onOpenChange={setProductOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={productOpen}
                                    className="w-full justify-between min-h-10 h-auto py-2"
                                    disabled={loadingProducts}
                                >
                                    {loadingProducts ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading...
                                        </span>
                                    ) : selectedProduct ? (
                                        <span className="text-left break-words whitespace-normal line-clamp-2">{selectedProduct.name}</span>
                                    ) : (
                                        "Select product..."
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search products..." />
                                    <CommandList>
                                        <CommandEmpty>No products found.</CommandEmpty>
                                        <CommandGroup>
                                            {filteredProducts.map((product) => (
                                                <CommandItem
                                                    key={product.sku_id}
                                                    value={product.name}
                                                    onSelect={() => {
                                                        setSelectedProduct(product);
                                                        setProductOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedProduct?.sku_id === product.sku_id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span className="truncate">{product.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Size Field */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-gray-500" />
                            Size
                        </Label>
                        <Input
                            type="text"
                            value={selectedSize}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className="h-10"
                            placeholder="Enter size (e.g., M, XL, 28-30, 7, 8)"
                        />
                    </div>

                    {/* Quantity Field */}
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-10"
                            placeholder="Enter quantity"
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !location || !selectedProduct || !selectedSize || !quantity}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entry
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

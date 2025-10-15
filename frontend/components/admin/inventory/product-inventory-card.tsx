"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share2, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProductInventoryCardProps {
  productName: string;
  imageUrl: string | null;
  sizeQuantity: string;
  baseSku: string;
  rtoData?: Array<{ location: string; sizes: string[] }>;
}

export function ProductInventoryCard({
  productName,
  imageUrl,
  sizeQuantity,
  baseSku,
  rtoData,
}: ProductInventoryCardProps) {
  const { toast } = useToast();
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [sizeQuantityCopied, setSizeQuantityCopied] = useState(false);
  const isMobile = useIsMobile();

  /**
   * Format size-quantity for WhatsApp message
   * Example: "S-4, M-7, L-3" → "• S - 4 units\n• M - 7 units\n• L - 3 units"
   */
  const formatSizeQuantityForMessage = (sizeQty: string): string => {
    // Remove prefix (Player/Fan) if exists
    const withoutPrefix = sizeQty.replace(/^(Player|Fan)\s+/, "");
    
    const pairs = withoutPrefix.split(",").map((p) => p.trim());
    const formatted = pairs.map((pair) => {
      const [size, qty] = pair.split("-").map((s) => s.trim());
      return `• ${size} - ${qty} units`;
    });
    
    return formatted.join("\n");
  };

  /**
   * Generate WhatsApp message text
   */
  const generateWhatsAppMessage = (): string => {
    let message = `📦 *${productName}*\n\n`;
    message += `📏 *Size Breakdown:*\n`;
    message += formatSizeQuantityForMessage(sizeQuantity);
    
    // Add RTO info if available
    if (rtoData && rtoData.length > 0) {
      message += `\n\n🔄 *RTO Details:*\n`;
      rtoData.forEach((rto) => {
        message += `• ${rto.location}: ${rto.sizes.join(", ")}\n`;
      });
    }
    
    // Add image URL if available
    if (imageUrl) {
      message += `\n\n📸 *Product Image:*\n${imageUrl}`;
    }
    
    message += `\n\n---\n_Sent from Claimio Inventory System_`;
    
    return message;
  };

  /**
   * Copy image data to clipboard (like Chrome's "Copy image" feature)
   */
  const copyImageData = async () => {
    if (!imageUrl) {
      toast({
        title: "No Image",
        description: "This product doesn't have an image.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Check if the Clipboard API supports writing images
      if (navigator.clipboard && navigator.clipboard.write) {
        // Create a ClipboardItem with the image blob
        const clipboardItem = new ClipboardItem({
          [blob.type]: blob
        });
        
        await navigator.clipboard.write([clipboardItem]);
        
        // Show visual feedback
        setImageCopied(true);
        setTimeout(() => setImageCopied(false), 2000);
      } else {
        // Fallback: copy the image URL if clipboard API doesn't support images
        await navigator.clipboard.writeText(imageUrl);
        setImageCopied(true);
        setTimeout(() => setImageCopied(false), 2000);
      }
    } catch (error) {
      console.error("Error copying image:", error);
      
      // Fallback: try to copy the URL
      try {
        await navigator.clipboard.writeText(imageUrl);
        setImageCopied(true);
        setTimeout(() => setImageCopied(false), 2000);
      } catch (urlError) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy image or URL. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  /**
   * Copy size-quantity to clipboard
   */
  const copySizeQuantity = async () => {
    try {
      await navigator.clipboard.writeText(sizeQuantity);
      
      // Show visual feedback
      setSizeQuantityCopied(true);
      setTimeout(() => setSizeQuantityCopied(false), 2000);
    } catch (error) {
      console.error("Error copying size-quantity:", error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy size-quantity. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Download product image
   */
  const downloadImage = async () => {
    if (!imageUrl) {
      toast({
        title: "No Image",
        description: "This product doesn't have an image.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${productName.replace(/\s+/g, "_")}_Inventory.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Image Downloaded",
        description: "Product image downloaded successfully.",
      });
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download image. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Share to WhatsApp with automatic image download
   * This is the primary "least manual effort" action
   */
  const shareToWhatsApp = async () => {
    try {
      // Step 1: Download image if available
      if (imageUrl) {
        await downloadImage();
      }

      // Step 2: Generate and open WhatsApp with message
      const message = generateWhatsAppMessage();
      const encodedMessage = encodeURIComponent(message);

      // Detect if mobile or desktop
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const whatsappUrl = isMobile
        ? `whatsapp://send?text=${encodedMessage}`
        : `https://web.whatsapp.com/send?text=${encodedMessage}`;

      // Open WhatsApp
      window.open(whatsappUrl, "_blank");

      toast({
        title: "WhatsApp Opened",
        description: imageUrl 
          ? "Image downloaded. Attach it in WhatsApp and send the message."
          : "Message ready. Send it in WhatsApp.",
      });
    } catch (error) {
      console.error("Error sharing to WhatsApp:", error);
      toast({
        title: "Share Failed",
        description: "Failed to share to WhatsApp. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="minimal-card h-full">
      <CardContent className="p-3 sm:p-4">
        {/* Product Name */}
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-gray-800 line-clamp-2">
          {productName}
        </h3>

        {/* Product Image */}
        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt={productName}
              className="w-24 h-24 sm:w-32 sm:h-32 object-contain mx-auto mb-2 sm:mb-3 rounded-md bg-gray-50 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowImageModal(true)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/placeholder.svg";
              }}
            />
            {/* Mobile Copy Image Button */}
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyImageData}
                className={`absolute top-1 right-1 w-6 h-6 p-0 bg-white/90 hover:bg-white border-gray-300 transition-colors duration-200 ${
                  imageCopied ? 'bg-green-100 border-green-300' : ''
                }`}
              >
                <Copy className={`w-3 h-3 transition-colors duration-200 ${
                  imageCopied ? 'text-green-600' : ''
                }`} />
              </Button>
            )}
          </div>
        ) : (
          <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-2 sm:mb-3 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs sm:text-sm">
            No Image
          </div>
        )}

        {/* Size-Quantity */}
        <div className="mb-2 sm:mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Size & Quantity</p>
            {/* Mobile Copy Size-Quantity Button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copySizeQuantity}
                className={`h-6 w-6 p-0 transition-colors duration-200 ${
                  sizeQuantityCopied ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
          <div className="bg-gray-50 rounded-md px-2 sm:px-3 py-1.5 sm:py-2">
            <p className="text-xs sm:text-sm font-medium text-gray-800 break-words">
              {sizeQuantity}
            </p>
          </div>
        </div>

        {/* RTO Tags (if available) */}
        {rtoData && rtoData.length > 0 && (
          <div className="mb-2 sm:mb-3">
            <p className="text-xs text-gray-500 mb-1">RTO Details</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {rtoData.map((rto, idx) => (
                <span
                  key={idx}
                  className="bg-blue-50 text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs font-medium"
                >
                  RTO-{rto.location}: {rto.sizes.join(", ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={shareToWhatsApp}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm h-9 sm:h-10"
        >
          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
          Share to WhatsApp
        </Button>
      </CardContent>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-lg font-semibold">
              {productName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-6 pt-2" style={{ maxHeight: 'calc(95vh - 80px)' }}>
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt={productName} 
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: 'calc(95vh - 120px)' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


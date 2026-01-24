"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RTOUploadDialogProps {
  onRTODataUploaded: (rtoData: any[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RTOUploadDialog({ onRTODataUploaded, open: controlledOpen, onOpenChange }: RTOUploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate CSV file
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("rto_file", selectedFile);

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const authHeader = localStorage.getItem("authHeader");
      const response = await fetch(
        `${API_BASE_URL}/admin/inventory/rto-upload`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader || "",
            // Don't set Content-Type - let browser set it automatically with boundary for FormData
          },
          body: formData,
        }
      );

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, read as text to get the actual error
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Upload failed: ${response.status}`);
      }

      if (data.success) {
        toast({
          title: "RTO Data Uploaded",
          description: `Successfully processed ${data.data.totalEntries} RTO entries.`,
        });

        // Pass RTO data to parent component
        onRTODataUploaded(data.data.rtoData);
        
        // Close dialog
        setOpen(false);
        setSelectedFile(null);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading RTO data:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload RTO data.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-10 text-xs flex items-center justify-center sm:w-auto sm:h-auto sm:text-sm" data-rto-upload-trigger>
          <Upload className="w-3.5 h-3.5 mr-1.5 sm:w-4 sm:h-4 sm:mr-2" />
          <span className="sm:hidden">RTO</span>
          <span className="hidden sm:inline">Upload RTO</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md p-4 sm:p-6">
        <DialogHeader className="pr-8 sm:pr-0">
          <DialogTitle className="text-base sm:text-lg">Upload RTO Details</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Upload a CSV file with RTO (Return to Origin) details. Expected
            format: Product_N, Variant_SK, Size, Quantity, Location
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 sm:py-4">
          {/* File Input */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="rto-file"
              className="text-xs sm:text-sm font-medium text-gray-700"
            >
              Select CSV File
            </label>
            
            {selectedFile ? (
              <div className="flex items-center gap-2 p-2 sm:p-3 bg-gray-50 rounded-md border">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-800 flex-1 min-w-0 break-words">
                  {selectedFile.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={uploading}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="rto-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-xs sm:text-sm text-gray-500
                    file:mr-2 sm:file:mr-4 
                    file:py-1.5 sm:file:py-2 
                    file:px-2 sm:file:px-4
                    file:rounded-md file:border-0
                    file:text-xs sm:file:text-sm 
                    file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* CSV Format Example */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 sm:p-3">
            <p className="text-xs font-medium text-blue-900 mb-2">
              CSV Format Example:
            </p>
            <pre className="text-xs text-blue-800 font-mono overflow-x-auto whitespace-pre-wrap break-words">
              Product_N, Variant_SK, Size, Quantity, Location{"\n"}
              India Blue Jersey, SKU123, M, 5, Warehouse A{"\n"}
              India Red Jersey, SKU456, L, 3, Warehouse B
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={uploading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || uploading}
            className="w-full sm:w-auto"
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


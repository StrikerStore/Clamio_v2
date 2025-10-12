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
}

export function RTOUploadDialog({ onRTODataUploaded }: RTOUploadDialogProps) {
  const [open, setOpen] = useState(false);
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

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const authHeader = localStorage.getItem("authHeader");
      const response = await fetch(
        `${API_BASE_URL}/api/admin/inventory/rto-upload`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader || "",
          },
          body: formData,
        }
      );

      const data = await response.json();

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
        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" data-rto-upload-trigger>
          <Upload className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Upload RTO</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload RTO Details</DialogTitle>
          <DialogDescription>
            Upload a CSV file with RTO (Return to Origin) details. Expected
            format: Product_N, Variant_SK, Size, Quantity, Location
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="rto-file"
              className="text-sm font-medium text-gray-700"
            >
              Select CSV File
            </label>
            
            {selectedFile ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border">
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-800 flex-1">
                  {selectedFile.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={uploading}
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
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* CSV Format Example */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs font-medium text-blue-900 mb-2">
              CSV Format Example:
            </p>
            <pre className="text-xs text-blue-800 font-mono">
              Product_N, Variant_SK, Size, Quantity, Location{"\n"}
              India Blue Jersey, SKU123, M, 5, Warehouse A{"\n"}
              India Red Jersey, SKU456, L, 3, Warehouse B
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


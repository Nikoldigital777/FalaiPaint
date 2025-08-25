import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Download, Search, Cog, Clock, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  variantNumber: number;
  status: string;
  seed: number;
  generationTime?: number;
  imageUrl?: string;
  ssimScore?: number;
  poseAccuracy?: number;
  colorDelta?: number;
}

interface VariantGridProps {
  variants: Variant[];
  onDownload?: (variant: Variant) => void;
  onDownloadAll?: () => void;
}

const statusConfig = {
  completed: { 
    icon: CheckCircle, 
    color: "bg-green-500", 
    label: "Ready",
    bgColor: "bg-green-50 border-green-200"
  },
  generating: { 
    icon: Cog, 
    color: "bg-blue-500", 
    label: "Processing",
    bgColor: "bg-blue-50 border-blue-200"
  },
  pending: { 
    icon: Clock, 
    color: "bg-gray-400", 
    label: "Pending",
    bgColor: "bg-gray-50 border-gray-200"
  },
  failed: { 
    icon: AlertCircle, 
    color: "bg-red-500", 
    label: "Failed",
    bgColor: "bg-red-50 border-red-200"
  }
};

const variantDescriptions = {
  1: "Ideal for family-friendly content and conservative compositions",
  2: "Great for social media with dynamic composition", 
  3: "Perfect for portfolio showcase with artistic angle"
};

const variantStyles = {
  1: "Conservative",
  2: "Dynamic", 
  3: "Artistic"
};

function VariantCard({ variant, onDownload }: { variant: Variant; onDownload?: (variant: Variant) => void }) {
  const config = statusConfig[variant.status as keyof typeof statusConfig];
  const Icon = config.icon;
  const style = variantStyles[variant.variantNumber as keyof typeof variantStyles] || "Standard";
  const description = variantDescriptions[variant.variantNumber as keyof typeof variantDescriptions] || "";

  const downloadImage = async () => {
    if (!variant.imageUrl) return;
    
    try {
      const response = await fetch(variant.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `variant-${variant.variantNumber}-seed-${variant.seed}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      onDownload?.(variant);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="group" data-testid={`card-variant-${variant.variantNumber}`}>
      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square">
        {variant.status === "completed" && variant.imageUrl ? (
          <>
            <img 
              src={variant.imageUrl}
              alt={`Generated lifestyle photo variant ${variant.variantNumber}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              data-testid={`img-variant-${variant.variantNumber}`}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="secondary"
                      size="sm"
                      className="shadow-lg"
                      data-testid={`button-view-${variant.variantNumber}`}
                    >
                      <Search className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <div className="space-y-4">
                      <img 
                        src={variant.imageUrl}
                        alt={`Variant ${variant.variantNumber} - ${style}`}
                        className="w-full rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-2">Generation Details</h4>
                          <p>Seed: {variant.seed}</p>
                          <p>Time: {variant.generationTime?.toFixed(1)}s</p>
                          <p>Style: {style}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Quality Metrics</h4>
                          <p>SSIM: {variant.ssimScore?.toFixed(3)}</p>
                          <p>Pose: {variant.poseAccuracy ? Math.round(variant.poseAccuracy * 100) : 0}%</p>
                          <p>ΔE00: {variant.colorDelta?.toFixed(1)}</p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  size="sm"
                  onClick={downloadImage}
                  className="shadow-lg"
                  data-testid={`button-save-${variant.variantNumber}`}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </>
        ) : variant.status === "generating" ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Cog className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 font-medium">Generating...</p>
              <div className="w-32 bg-gray-200 rounded-full h-2 mt-3 mx-auto">
                <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: "78%" }}></div>
              </div>
            </div>
          </div>
        ) : variant.status === "failed" ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-medium">Generation Failed</p>
              <p className="text-xs text-gray-400 mt-2">Please try again</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Queued</p>
              <p className="text-xs text-gray-400 mt-2">Waiting for resources</p>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <Badge 
            className={cn(
              "text-white text-xs font-medium",
              config.color,
              variant.status === "generating" && "animate-pulse"
            )}
            data-testid={`badge-status-${variant.variantNumber}`}
          >
            <Icon className={cn("w-3 h-3 mr-1", variant.status === "generating" && "animate-spin")} />
            {config.label}
          </Badge>
        </div>
      </div>
      
      {/* Variant Info */}
      <div className="mt-3">
        <h3 className="font-medium text-primary" data-testid={`heading-variant-${variant.variantNumber}`}>
          Variant {variant.variantNumber} - {style}
        </h3>
        <p className="text-sm text-gray-500 mb-2" data-testid={`text-seed-${variant.variantNumber}`}>
          Seed: {variant.seed} • {variant.generationTime ? `${variant.generationTime.toFixed(1)}s generation` : 'Estimated 15s'}
        </p>
        <p className="text-xs text-gray-600" data-testid={`text-description-${variant.variantNumber}`}>
          {description}
        </p>
        
        {/* Quality Metrics */}
        {variant.status === "completed" && (
          <div className="flex space-x-4 mt-3 text-xs">
            <div className="flex items-center" data-testid={`metric-ssim-${variant.variantNumber}`}>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span>SSIM: {variant.ssimScore?.toFixed(2)}</span>
            </div>
            <div className="flex items-center" data-testid={`metric-pose-${variant.variantNumber}`}>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span>Pose: {variant.poseAccuracy ? Math.round(variant.poseAccuracy * 100) : 0}%</span>
            </div>
            <div className="flex items-center" data-testid={`metric-color-${variant.variantNumber}`}>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span>ΔE00: {variant.colorDelta?.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VariantGrid({ variants, onDownload, onDownloadAll }: VariantGridProps) {
  const completedVariants = variants.filter(v => v.status === "completed");
  
  const downloadAllVariants = async () => {
    for (const variant of completedVariants) {
      if (variant.imageUrl) {
        try {
          const response = await fetch(variant.imageUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `variant-${variant.variantNumber}-seed-${variant.seed}.jpg`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to download variant ${variant.variantNumber}:`, error);
        }
      }
    }
    
    onDownloadAll?.();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-primary flex items-center" data-testid="heading-generated-variants">
          <img className="w-5 h-5 mr-2" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJsLTQgLTRsNCA0bC00IDR6IiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE1IDEybDQgLTRsLTQgNGw0IDR6IiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+" alt="Images" />
          Generated Variants
        </h2>
        {completedVariants.length > 0 && (
          <Button 
            variant="outline"
            onClick={downloadAllVariants}
            data-testid="button-download-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Download All
          </Button>
        )}
      </div>
      
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {variants.map((variant) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            onDownload={onDownload}
          />
        ))}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Cog, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressTrackerProps {
  projectId: string;
}

interface ProgressData {
  total: number;
  completed: number;
  failed: number;
  generating: number;
  pending: number;
  percentage: number;
  variants: Array<{
    id: string;
    variantNumber: number;
    status: string;
    seed: number;
    generationTime?: number;
    imageUrl?: string;
  }>;
}

const statusConfig = {
  completed: { icon: CheckCircle, color: "bg-green-500", textColor: "text-green-800" },
  generating: { icon: Cog, color: "bg-blue-500", textColor: "text-blue-800" },
  pending: { icon: Clock, color: "bg-gray-400", textColor: "text-gray-600" },
  failed: { icon: AlertCircle, color: "bg-red-500", textColor: "text-red-800" }
};

export function ProgressTracker({ projectId }: ProgressTrackerProps) {
  const { data: progress, isLoading } = useQuery<ProgressData>({
    queryKey: ["/api/projects", projectId, "progress"],
    refetchInterval: 2000, // Poll every 2 seconds
    enabled: !!projectId,
  });

  if (isLoading || !progress) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-lg font-semibold text-primary mb-4 flex items-center" data-testid="heading-generation-progress">
        <Cog className="mr-2" />
        Generation Progress
      </h2>
      
      <div className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700" data-testid="text-overall-progress">
              Overall Progress
            </span>
            <span className="text-sm text-gray-500" data-testid="text-progress-count">
              {progress.completed} of {progress.total} completed
            </span>
          </div>
          <Progress 
            value={progress.percentage} 
            className="w-full"
            data-testid="progress-overall"
          />
        </div>
        
        {/* Individual Variants */}
        <div className="grid grid-cols-3 gap-4">
          {progress.variants.map((variant) => {
            const config = statusConfig[variant.status as keyof typeof statusConfig];
            const Icon = config.icon;
            
            return (
              <div
                key={variant.id}
                className={cn(
                  "border rounded-lg p-4",
                  variant.status === "completed" && "bg-green-50 border-green-200",
                  variant.status === "generating" && "bg-blue-50 border-blue-200",
                  variant.status === "failed" && "bg-red-50 border-red-200",
                  variant.status === "pending" && "bg-gray-50 border-gray-200"
                )}
                data-testid={`card-variant-${variant.variantNumber}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-sm font-medium", config.textColor)}>
                    Variant {variant.variantNumber}
                  </span>
                  <Icon 
                    className={cn(
                      "w-4 h-4",
                      variant.status === "generating" && "animate-spin",
                      variant.status === "completed" && "text-green-600",
                      variant.status === "generating" && "text-blue-600",
                      variant.status === "pending" && "text-gray-400",
                      variant.status === "failed" && "text-red-600"
                    )} 
                  />
                </div>
                <div className="text-xs space-y-1">
                  <p className="text-gray-600" data-testid={`text-seed-${variant.variantNumber}`}>
                    Seed: {variant.seed}
                  </p>
                  <p className={config.textColor} data-testid={`text-status-${variant.variantNumber}`}>
                    {variant.status === "completed" && variant.generationTime 
                      ? `Time: ${variant.generationTime.toFixed(1)}s`
                      : variant.status === "generating" 
                      ? "Processing..."
                      : variant.status === "failed"
                      ? "Failed"
                      : "Queued"
                    }
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Live Logs */}
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-32 overflow-y-auto">
          <div className="space-y-1">
            <div className="text-green-400" data-testid="log-files-uploaded">
              ✅ Files uploaded successfully to storage
            </div>
            {progress.variants.map((variant) => (
              <div
                key={variant.id}
                className={cn(
                  variant.status === "completed" && "text-green-400",
                  variant.status === "generating" && "text-yellow-400",
                  variant.status === "pending" && "text-gray-400",
                  variant.status === "failed" && "text-red-400"
                )}
                data-testid={`log-variant-${variant.variantNumber}`}
              >
                {variant.status === "completed" 
                  ? `✅ Variant ${variant.variantNumber} generation completed (${variant.generationTime?.toFixed(1)}s)`
                  : variant.status === "generating"
                  ? `🔄 Variant ${variant.variantNumber}: Applying ControlNet pose guidance...`
                  : variant.status === "failed"
                  ? `❌ Variant ${variant.variantNumber}: Generation failed`
                  : `⏳ Variant ${variant.variantNumber}: Waiting in queue`
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

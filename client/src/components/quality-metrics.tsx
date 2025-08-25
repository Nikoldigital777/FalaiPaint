import { Search, User, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualityMetricsProps {
  ssimScore?: number;
  poseAccuracy?: number;
  colorDelta?: number;
  averageGenerationTime?: number;
  totalApiCalls?: number;
  successRate?: number;
  totalCost?: number;
  recommendations?: string[];
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number | React.ReactNode;
  subtitle: string;
  color: string;
}

function MetricCard({ icon: Icon, title, value, subtitle, color }: MetricCardProps) {
  return (
    <div className="text-center">
      <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3", color)}>
        <Icon className="text-2xl" />
      </div>
      <h3 className="font-semibold text-primary mb-1" data-testid={`heading-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        {title}
      </h3>
      <p className="text-2xl font-bold mb-1" data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

export function QualityMetrics({
  ssimScore = 0,
  poseAccuracy = 0,
  colorDelta = 0,
  averageGenerationTime = 0,
  totalApiCalls = 0,
  successRate = 0,
  totalCost = 0,
  recommendations = []
}: QualityMetricsProps) {
  
  const getScoreColor = (score: number, thresholds: { good: number; excellent: number }) => {
    if (score >= thresholds.excellent) return "text-green-600";
    if (score >= thresholds.good) return "text-blue-600";
    return "text-amber-600";
  };

  const getColorDeltaColor = (delta: number) => {
    if (delta <= 2.0) return "text-green-600";
    if (delta <= 3.0) return "text-blue-600";
    return "text-amber-600";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-lg font-semibold text-primary mb-4 flex items-center" data-testid="heading-quality-assessment">
        <Search className="mr-2" />
        Quality Assessment
      </h2>
      
      <div className="grid md:grid-cols-3 gap-6">
        {/* SSIM Score */}
        <MetricCard
          icon={Search}
          title="SSIM Score"
          value={
            <span className={getScoreColor(ssimScore, { good: 0.90, excellent: 0.95 })}>
              {ssimScore.toFixed(2)}
            </span>
          }
          subtitle="Structural similarity to original"
          color="bg-green-100"
        />
        
        {/* Pose Accuracy */}
        <MetricCard
          icon={User}
          title="Pose Accuracy"
          value={
            <span className={getScoreColor(poseAccuracy, { good: 0.90, excellent: 0.95 })}>
              {Math.round(poseAccuracy * 100)}%
            </span>
          }
          subtitle="ControlNet pose alignment"
          color="bg-blue-100"
        />
        
        {/* Color Match */}
        <MetricCard
          icon={Palette}
          title="Color Match"
          value={
            <span className={getColorDeltaColor(colorDelta)}>
              ΔE00: {colorDelta.toFixed(1)}
            </span>
          }
          subtitle="Color difference from target"
          color="bg-purple-100"
        />
      </div>
      
      {/* Detailed Metrics */}
      <div className="mt-6 border-t pt-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-primary mb-3" data-testid="heading-technical-metrics">
              Technical Metrics
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Average Generation Time</span>
                <span className="font-medium" data-testid="text-avg-generation-time">
                  {averageGenerationTime.toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total API Calls</span>
                <span className="font-medium" data-testid="text-total-api-calls">
                  {totalApiCalls}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-medium text-green-600" data-testid="text-success-rate">
                  {Math.round(successRate * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Cost</span>
                <span className="font-medium" data-testid="text-total-cost">
                  ${totalCost.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-primary mb-3" data-testid="heading-recommendations">
              Recommendations
            </h4>
            <div className="space-y-2 text-sm text-gray-600">
              {recommendations.length > 0 ? (
                recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start" data-testid={`recommendation-${index}`}>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                    <span>{rec}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                  <span>Quality assessment pending completion</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

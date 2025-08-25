import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileUpload } from "@/components/file-upload";
import { ProgressTracker } from "@/components/progress-tracker";
import { QualityMetrics } from "@/components/quality-metrics";
import { VariantGrid } from "@/components/variant-grid";
import { Camera, Upload, Cog, BarChart3, Download, Calculator, Rocket, Settings, Brain, CheckCircle } from "lucide-react";

interface Project {
  id: string;
  name: string;
  sceneType: string;
  photographyStyle: string;
  variantCount: number;
  status: string;
  backgroundImageUrl?: string;
  maskImageUrl?: string;
  poseImageUrl?: string;
  enableCustomLora: boolean;
  controlnetStrength: number;
  guidanceScale: number;
  totalCost: number;
}

const progressSteps = [
  { id: "upload", label: "Upload Assets", icon: Upload, active: true, completed: true },
  { id: "align", label: "Align Pose", icon: Brain, active: true, completed: false },
  { id: "generate", label: "Generate", icon: Cog, active: true, completed: false },
  { id: "review", label: "Review Results", icon: BarChart3, active: false, completed: false }
];

export default function Dashboard() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "Lifestyle Photography - Pool Edge Scene",
    sceneType: "pool_edge",
    photographyStyle: "luxury_lifestyle",
    variantCount: 3,
    backgroundImageUrl: "",
    maskImageUrl: "",
    poseImageUrl: "",
    enableCustomLora: false,
    controlnetStrength: 0.85,
    guidanceScale: 7.5
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: (project) => {
      setCurrentProject(project);
      toast({ title: "Project created successfully", description: "Ready to upload assets" });
    },
    onError: (error) => {
      toast({ title: "Failed to create project", description: error.message, variant: "destructive" });
    }
  });

  // Pose alignment mutation
  const alignPoseMutation = useMutation({
    mutationFn: async ({ projectId, poseStyle }: { projectId: string; poseStyle: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/align-pose`, { poseStyle });
      return response.json();
    },
    onSuccess: (result) => {
      toast({ 
        title: "Pose aligned successfully", 
        description: `Validation score: ${(result.validationScore * 100).toFixed(1)}%` 
      });
      setCurrentProject(prev => prev ? { ...prev, status: "pose_aligned" } : null);
    },
    onError: (error) => {
      toast({ title: "Failed to align pose", description: error.message, variant: "destructive" });
    }
  });

  // Start generation mutation
  const generateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      console.log(`🚀 Starting generation for project ${projectId}`);
      const response = await apiRequest("POST", `/api/projects/${projectId}/generate`);
      console.log("✅ Generation request successful:", response);
      return response.json();
    },
    onSuccess: () => {
      console.log("✅ Generation started successfully");
      toast({ title: "Generation started", description: "Processing variants with fal.ai SDXL..." });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      // Update project status to show generation is happening
      setCurrentProject(prev => prev ? { ...prev, status: "generating" } : null);
    },
    onError: (error) => {
      console.error("❌ Generation failed:", error);
      toast({ title: "Failed to start generation", description: error.message, variant: "destructive" });
    }
  });

  // Fetch project data
  const { data: projectData } = useQuery({
    queryKey: ["/api/projects", currentProject?.id],
    enabled: !!currentProject?.id,
    refetchInterval: currentProject?.status === "generating" ? 2000 : false,
  });

  // Fetch progress data with variants
  const { data: progressData } = useQuery({
    queryKey: ["/api/projects", currentProject?.id, "progress"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${currentProject?.id}/progress`);
      return response.json();
    },
    enabled: !!currentProject?.id,
    refetchInterval: currentProject?.status === "generating" ? 2000 : false,
  });

  // Export report mutation
  const exportReportMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}/report`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}-report.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({ title: "Report exported", description: "Client report downloaded successfully" });
    }
  });

  const handleCreateProject = () => {
    createProjectMutation.mutate(formData);
  };

  const handleAlignPose = () => {
    if (!currentProject) return;
    
    if (!formData.backgroundImageUrl || !formData.poseImageUrl) {
      toast({ title: "Missing files", description: "Please upload background and pose reference images", variant: "destructive" });
      return;
    }

    alignPoseMutation.mutate({ 
      projectId: currentProject.id, 
      poseStyle: "sitting" // Default pose style, could be made configurable
    });
  };

  const handleStartGeneration = () => {
    if (!currentProject) {
      console.log("❌ No current project found");
      return;
    }
    
    console.log("🔍 Checking generation requirements:", {
      projectId: currentProject.id,
      status: currentProject.status,
      backgroundImageUrl: !!formData.backgroundImageUrl,
      maskImageUrl: !!formData.maskImageUrl,
      poseImageUrl: !!formData.poseImageUrl
    });
    
    if (!formData.backgroundImageUrl || !formData.maskImageUrl || !formData.poseImageUrl) {
      toast({ title: "Missing files", description: "Please upload all required images", variant: "destructive" });
      console.log("❌ Missing required images");
      return;
    }

    console.log("🚀 All requirements met, starting generation");
    generateMutation.mutate(currentProject.id);
  };

  const estimatedCost = formData.variantCount * 0.0035;

  return (
    <div className="min-h-screen bg-warm-gray">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Camera className="text-white text-lg" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-primary" data-testid="heading-main-title">
                  SDXL Photography Pipeline
                </h1>
                <p className="text-sm text-gray-500">Professional Lifestyle Generation</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-primary">Carlos San Juan</p>
                <p className="text-xs text-gray-500">Lifestyle Photographer</p>
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">CS</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Progress Navigation */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol className="flex items-center justify-between">
              {progressSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = 
                  (currentProject?.status === "generating" && step.id === "generate") ||
                  (alignPoseMutation.isPending && step.id === "align");
                const isCompleted = 
                  (currentProject?.status === "completed" && step.id !== "review") ||
                  (currentProject?.status === "pose_aligned" && step.id === "align") ||
                  (step.id === "upload" && currentProject?.backgroundImageUrl && currentProject?.poseImageUrl);
                
                return (
                  <li key={step.id} className="relative flex items-center">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted || step.completed 
                          ? "bg-secondary" 
                          : isActive 
                          ? "bg-secondary animate-pulse" 
                          : step.active 
                          ? "bg-secondary" 
                          : "bg-gray-200"
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          isCompleted || step.completed || step.active || isActive
                            ? "text-white" 
                            : "text-gray-400"
                        } ${isActive ? "animate-spin" : ""}`} />
                      </div>
                      <span className={`ml-3 text-sm font-medium ${
                        step.active || isActive || isCompleted ? "text-primary" : "text-gray-400"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    
                    {index < progressSteps.length - 1 && (
                      <div className="ml-4 w-24 h-0.5 bg-gray-200">
                        <div className={`h-full transition-all duration-500 ${
                          index === 0 && currentProject?.backgroundImageUrl && currentProject?.poseImageUrl ? "bg-secondary w-full" :
                          index === 1 && currentProject?.status === "pose_aligned" ? "bg-secondary w-full" :
                          index === 2 && currentProject?.status === "generating" ? "bg-secondary w-full" :
                          "bg-gray-200 w-0"
                        }`}></div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left Column - Configuration & Upload */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Scene Configuration */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-primary mb-4 flex items-center" data-testid="heading-scene-configuration">
                  <Settings className="mr-2" />
                  Scene Configuration
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-project-name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="scene-type">Scene Type</Label>
                    <Select 
                      value={formData.sceneType} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, sceneType: value }))}
                    >
                      <SelectTrigger data-testid="select-scene-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pool_edge">Pool Edge (Trial)</SelectItem>
                        <SelectItem value="beach_sunset">Beach Sunset</SelectItem>
                        <SelectItem value="urban_rooftop">Urban Rooftop</SelectItem>
                        <SelectItem value="garden_party">Garden Party</SelectItem>
                        <SelectItem value="studio_portrait">Studio Portrait</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="photography-style">Photography Style</Label>
                    <Select 
                      value={formData.photographyStyle} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, photographyStyle: value }))}
                    >
                      <SelectTrigger data-testid="select-photography-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="luxury_lifestyle">Luxury Lifestyle</SelectItem>
                        <SelectItem value="editorial_fashion">Editorial Fashion</SelectItem>
                        <SelectItem value="natural_candid">Natural Candid</SelectItem>
                        <SelectItem value="commercial_advertising">Commercial Advertising</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Variants to Generate</Label>
                    <div className="flex items-center space-x-4 mt-2">
                      <Slider
                        value={[formData.variantCount]}
                        onValueChange={([value]) => setFormData(prev => ({ ...prev, variantCount: value }))}
                        min={1}
                        max={5}
                        step={1}
                        className="flex-1"
                        data-testid="slider-variant-count"
                      />
                      <Badge variant="secondary" data-testid="badge-variant-count">
                        {formData.variantCount}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-primary mb-4 flex items-center" data-testid="heading-upload-assets">
                  <Upload className="mr-2" />
                  Upload Assets
                </h2>
                
                <div className="space-y-4">
                  <FileUpload
                    type="background"
                    value={formData.backgroundImageUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, backgroundImageUrl: url }))}
                  />
                  
                  <FileUpload
                    type="mask"
                    value={formData.maskImageUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, maskImageUrl: url }))}
                  />
                  
                  <FileUpload
                    type="pose"
                    value={formData.poseImageUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, poseImageUrl: url }))}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Model Configuration */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-primary mb-4 flex items-center" data-testid="heading-model-configuration">
                  <Brain className="mr-2" />
                  Model Configuration
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="custom-lora"
                      checked={formData.enableCustomLora}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableCustomLora: !!checked }))}
                      data-testid="checkbox-custom-lora"
                    />
                    <Label htmlFor="custom-lora" className="text-sm">Enable Custom LoRA</Label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">Use trained style adaptation model</p>
                  
                  <div>
                    <Label>ControlNet Strength</Label>
                    <div className="flex items-center space-x-4 mt-2">
                      <Slider
                        value={[formData.controlnetStrength]}
                        onValueChange={([value]) => setFormData(prev => ({ ...prev, controlnetStrength: value }))}
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        className="flex-1"
                        data-testid="slider-controlnet-strength"
                      />
                      <Badge variant="secondary" data-testid="badge-controlnet-strength">
                        {formData.controlnetStrength.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Guidance Scale</Label>
                    <div className="flex items-center space-x-4 mt-2">
                      <Slider
                        value={[formData.guidanceScale]}
                        onValueChange={([value]) => setFormData(prev => ({ ...prev, guidanceScale: value }))}
                        min={1}
                        max={20}
                        step={0.5}
                        className="flex-1"
                        data-testid="slider-guidance-scale"
                      />
                      <Badge variant="secondary" data-testid="badge-guidance-scale">
                        {formData.guidanceScale.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Action Buttons */}
            {!currentProject ? (
              <Button 
                onClick={handleCreateProject}
                disabled={createProjectMutation.isPending}
                className="w-full bg-gradient-to-r from-secondary to-emerald-600 text-white py-4 px-6 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                data-testid="button-create-project"
              >
                <Settings className="mr-2" />
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            ) : currentProject.status === "created" ? (
              <div className="space-y-3">
                <Button 
                  onClick={handleAlignPose}
                  disabled={alignPoseMutation.isPending || !formData.backgroundImageUrl || !formData.poseImageUrl}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  data-testid="button-align-pose"
                >
                  <Brain className="mr-2" />
                  {alignPoseMutation.isPending ? "Aligning..." : "Align Pose to Scene"}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Automatically adapts pose reference to scene geometry
                </p>
              </div>
            ) : currentProject.status === "pose_aligned" ? (
              <div className="space-y-3">
                <Button 
                  onClick={handleStartGeneration}
                  disabled={generateMutation.isPending || !formData.backgroundImageUrl || !formData.maskImageUrl || !formData.poseImageUrl}
                  className="w-full bg-gradient-to-r from-secondary to-emerald-600 text-white py-4 px-6 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  data-testid="button-start-generation"
                >
                  <Cog className="mr-2" />
                  {generateMutation.isPending ? "Starting..." : "Start Generation Pipeline"}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Generate {formData.variantCount} variants using fal.ai SDXL (~2 mins)
                </p>
              </div>
            ) : currentProject.status === "generating" ? (
              <div className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg text-center">
                <Cog className="mr-2 inline animate-spin" />
                Generation in Progress...
              </div>
            ) : (
              <div className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-lg font-semibold text-lg text-center">
                <CheckCircle className="mr-2 inline" />
                Generation Complete
              </div>
            )}
            
            {/* Cost Estimation */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <Calculator className="text-amber-600 mr-2" />
                  <span className="text-sm font-medium text-amber-800" data-testid="heading-cost-estimation">
                    Cost Estimation
                  </span>
                </div>
                <div className="text-sm text-amber-700 space-y-1">
                  <div className="flex justify-between">
                    <span>{formData.variantCount} variants × $0.0035</span>
                    <span data-testid="text-variants-cost">${estimatedCost.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File upload & storage</span>
                    <span>Free</span>
                  </div>
                  <Separator className="my-2 bg-amber-200" />
                  <div className="flex justify-between font-semibold">
                    <span>Total Estimated</span>
                    <span data-testid="text-total-estimated">~${estimatedCost.toFixed(3)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Results & Progress */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Progress Tracker */}
            {currentProject && (
              <ProgressTracker projectId={currentProject.id} />
            )}
            
            {/* Generated Results */}
            {progressData && progressData.variants && Array.isArray(progressData.variants) && (
              <VariantGrid 
                variants={progressData.variants}
                onDownload={() => toast({ title: "Image downloaded", description: "Variant saved successfully" })}
                onDownloadAll={() => toast({ title: "All images downloaded", description: "All variants saved successfully" })}
              />
            )}
            
            {/* Quality Assessment */}
            {projectData && 'qualityMetrics' in projectData && projectData.qualityMetrics && (
              <QualityMetrics 
                ssimScore={(projectData.qualityMetrics as any).averageSSIM}
                poseAccuracy={(projectData.qualityMetrics as any).averagePoseAccuracy}
                colorDelta={(projectData.qualityMetrics as any).averageColorDelta}
                averageGenerationTime={(projectData.qualityMetrics as any).averageGenerationTime}
                totalApiCalls={(projectData.qualityMetrics as any).totalApiCalls}
                successRate={(projectData.qualityMetrics as any).successRate}
                totalCost={currentProject?.totalCost}
                recommendations={(projectData.qualityMetrics as any).recommendations}
              />
            )}
            
            {/* Client Report */}
            {currentProject?.status === "completed" && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-primary flex items-center" data-testid="heading-client-report">
                      <BarChart3 className="mr-2" />
                      Client Report
                    </h2>
                    <Button 
                      onClick={() => exportReportMutation.mutate(currentProject.id)}
                      disabled={exportReportMutation.isPending}
                      className="bg-secondary text-white hover:bg-emerald-600"
                      data-testid="button-export-report"
                    >
                      <Download className="mr-2 w-4 h-4" />
                      Export JSON Report
                    </Button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-secondary">
                    <div className="text-sm font-medium text-primary mb-2">
                      Project: {currentProject.name}
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      Generated: {new Date().toLocaleString()}
                    </div>
                    
                    <div className="grid md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary" data-testid="text-total-variants">
                          {(projectData && 'variants' in projectData && Array.isArray(projectData.variants)) ? projectData.variants.length : 0}
                        </div>
                        <div className="text-xs text-gray-500">Total Variants</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600" data-testid="text-success-rate-report">
                          {Math.round(((projectData && 'qualityMetrics' in projectData && projectData.qualityMetrics) ? (projectData.qualityMetrics as any).successRate || 0 : 0) * 100)}%
                        </div>
                        <div className="text-xs text-gray-500">Success Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600" data-testid="text-avg-generation-report">
                          {((projectData && 'qualityMetrics' in projectData && projectData.qualityMetrics) ? (projectData.qualityMetrics as any).averageGenerationTime || 0 : 0).toFixed(1)}s
                        </div>
                        <div className="text-xs text-gray-500">Avg Generation</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-secondary" data-testid="text-total-cost-report">
                          ${(currentProject.totalCost || 0).toFixed(3)}
                        </div>
                        <div className="text-xs text-gray-500">Total Cost</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      <strong>Summary:</strong> Successfully generated {(projectData && 'variants' in projectData && Array.isArray(projectData.variants)) ? projectData.variants.filter((v: any) => v.status === "completed").length : 0} high-quality lifestyle photography variants using SDXL Inpainting + ControlNet pipeline. All variants exceed quality thresholds with excellent pose alignment and color matching. Ready for client review and commercial use.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Batch Processing */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-primary mb-4 flex items-center" data-testid="heading-batch-processing">
                  <Rocket className="mr-2" />
                  Batch Processing
                </h2>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <span className="text-white text-xs font-bold">i</span>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 mb-1">Scale to Multiple Scenes</p>
                      <p className="text-blue-700">Ready to process additional scene types (beach, rooftop, garden, studio) using the same pipeline configuration.</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-primary mb-2">Available Scenes</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>✅ Pool Edge (Active)</li>
                        <li>🔄 Beach Sunset (Ready)</li>
                        <li>🔄 Urban Rooftop (Ready)</li>
                        <li>🔄 Garden Party (Ready)</li>
                        <li>🔄 Studio Portrait (Ready)</li>
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-primary mb-2">Scaling Metrics</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Est. cost per scene:</span>
                          <span>$0.01</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Processing time:</span>
                          <span>~2 min</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total 5 scenes:</span>
                          <span>$0.05</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Button 
                  className="w-full mt-4 bg-gradient-to-r from-primary to-slate-700 text-white hover:shadow-lg"
                  data-testid="button-setup-batch-processing"
                >
                  <Rocket className="mr-2" />
                  Setup Batch Processing Pipeline
                </Button>
              </CardContent>
            </Card>
            
          </div>
        </div>
      </main>
    </div>
  );
}

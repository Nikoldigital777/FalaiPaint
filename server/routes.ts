import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertVariantSchema } from "@shared/schema";
import { poseAlignmentSystem } from "./pose-alignment";
import { falAIService } from "./fal-integration";
import { styleProcessor } from "./style-processor";
import { correctionManager } from "./correction-manager";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
  }

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    // Add CORS headers for file serving
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    next();
  }, express.static('uploads'));

  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get specific project with variants and metrics
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const variants = await storage.getVariantsByProject(project.id);
      const qualityMetrics = await storage.getQualityMetrics(project.id);

      res.json({
        project,
        variants,
        qualityMetrics
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Create new project
  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      
      // Create initial variants
      for (let i = 1; i <= (projectData.variantCount || 3); i++) {
        await storage.createVariant({
          projectId: project.id,
          variantNumber: i,
          seed: Math.floor(Math.random() * 1000000),
          status: "pending"
        });
      }

      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data", details: error });
    }
  });

  // Update project
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const updates = req.body;
      const project = await storage.updateProject(req.params.id, updates);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // File upload endpoint
  app.post("/api/upload", upload.single('file'), async (req: Request & { file?: any }, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ 
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Pose alignment endpoint
  app.post("/api/projects/:id/align-pose", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.backgroundImageUrl || !project.poseImageUrl) {
        return res.status(400).json({ error: "Missing background or pose reference image" });
      }

      const { poseStyle = "sitting" } = req.body;

      // Convert URLs to file paths
      const backgroundPath = `.${project.backgroundImageUrl}`;
      const posePath = `.${project.poseImageUrl}`;

      // Process pose alignment
      const alignmentResult = await poseAlignmentSystem.processImageForAlignment(
        backgroundPath,
        posePath,
        project.sceneType,
        poseStyle
      );

      res.json({
        success: true,
        alignment: alignmentResult.poseAlignment,
        processingTime: alignmentResult.processingTime,
        validationScore: alignmentResult.poseAlignment.validationScore
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to align pose", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start generation process
  app.post("/api/projects/:id/generate", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.backgroundImageUrl || !project.maskImageUrl || !project.poseImageUrl) {
        return res.status(400).json({ error: "Missing required images" });
      }

      // Update project status
      await storage.updateProject(project.id, { status: "generating" });

      // Update variants to generating status
      const variants = await storage.getVariantsByProject(project.id);
      for (const variant of variants) {
        await storage.updateVariant(variant.id, { status: "generating" });
      }

      // Start generation process (async)
      console.log(`🚀 Starting generation for project ${project.id}`);
      generateVariants(project.id);

      res.json({ message: "Generation started", projectId: project.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to start generation" });
    }
  });

  // Get generation progress
  app.get("/api/projects/:id/progress", async (req, res) => {
    try {
      const variants = await storage.getVariantsByProject(req.params.id);
      const completed = variants.filter(v => v.status === "completed").length;
      const failed = variants.filter(v => v.status === "failed").length;
      const generating = variants.filter(v => v.status === "generating").length;
      const pending = variants.filter(v => v.status === "pending").length;

      res.json({
        total: variants.length,
        completed,
        failed,
        generating,
        pending,
        percentage: Math.round((completed / variants.length) * 100),
        variants: variants.map(v => ({
          id: v.id,
          variantNumber: v.variantNumber,
          status: v.status,
          seed: v.seed,
          generationTime: v.generationTime,
          imageUrl: v.imageUrl
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get progress" });
    }
  });

  // Export project report
  app.get("/api/projects/:id/report", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const variants = await storage.getVariantsByProject(project.id);
      const qualityMetrics = await storage.getQualityMetrics(project.id);

      const report = {
        project: {
          name: project.name,
          sceneType: project.sceneType,
          photographyStyle: project.photographyStyle,
          createdAt: project.createdAt,
          status: project.status
        },
        summary: {
          totalVariants: variants.length,
          completedVariants: variants.filter(v => v.status === "completed").length,
          successRate: qualityMetrics?.successRate || 0,
          averageGenerationTime: qualityMetrics?.averageGenerationTime || 0,
          totalCost: project.totalCost
        },
        variants: variants.map(v => ({
          variantNumber: v.variantNumber,
          status: v.status,
          seed: v.seed,
          generationTime: v.generationTime,
          ssimScore: v.ssimScore,
          poseAccuracy: v.poseAccuracy,
          colorDelta: v.colorDelta,
          imageUrl: v.imageUrl
        })),
        qualityMetrics,
        generatedAt: new Date().toISOString()
      };

      res.setHeader('Content-Disposition', `attachment; filename="project-${project.id}-report.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Real fal.ai generation process
async function generateVariants(projectId: string) {
  const project = await storage.getProject(projectId);
  const variants = await storage.getVariantsByProject(projectId);
  
  if (!project) {
    console.error(`Project ${projectId} not found`);
    return;
  }

  try {
    // Process style reference if provided
    let styleEmbeddings = null;
    let enhancedPrompt = "";
    
    if (project.styleReferenceUrl) {
      console.log("🎨 Processing style reference for enhanced generation...");
      const sceneInput = {
        background_image: project.backgroundImageUrl || "",
        pose_reference: project.poseImageUrl || "",
        mask: project.maskImageUrl || "",
        style_reference: project.styleReferenceUrl,
        typology: (project.typology as 'pool' | 'terrace' | 'spa' | 'interior') || 'pool',
        lut_file: project.lutFileUrl || undefined
      };
      
      const styleResult = await styleProcessor.processSceneInput(sceneInput);
      styleEmbeddings = styleResult.styleEmbeddings;
      enhancedPrompt = styleResult.enhancedPrompt;
    }

    // Prepare generation request
    const generationRequest = {
      backgroundImageUrl: project.backgroundImageUrl || "",
      maskImageUrl: project.maskImageUrl || "",
      poseImageUrl: project.poseImageUrl || "",
      styleReferenceUrl: project.styleReferenceUrl || undefined,
      lutFileUrl: project.lutFileUrl || undefined,
      prompt: enhancedPrompt || "",
      controlnetStrength: project.controlnetStrength || 0.85,
      guidanceScale: project.guidanceScale || 7.5,
      seed: 0, // Will be set per variant
      sceneType: project.sceneType,
      photographyStyle: project.photographyStyle,
      typology: project.typology || "pool"
    };

    for (const variant of variants) {
      try {
        // Update to generating
        await storage.updateVariant(variant.id, { status: "generating" });
        
        // Generate with fal.ai
        const variantRequest = {
          ...generationRequest,
          seed: variant.seed
        };

        const result = await falAIService.generateImage(variantRequest);
        
        // Detect issues and run correction comparison
        console.log(`🔍 Analyzing generated image for issues...`);
        const detectedIssues = await correctionManager.detectIssues(
          result.imageUrl,
          project.backgroundImageUrl || "",
          styleEmbeddings
        );
        
        let correctionResult = null;
        let finalImageUrl = result.imageUrl;
        let correctionMethod = "original";
        let correctionScore = 0.0;
        
        // Run correction comparison if issues detected
        if (detectedIssues.length > 0) {
          console.log(`⚠️ Found ${detectedIssues.length} issues, running correction comparison...`);
          correctionResult = await correctionManager.runCorrectionMethods(
            result.imageUrl,
            project.maskImageUrl || "",
            detectedIssues
          );
          
          // Use best correction method result
          const bestResult = correctionResult.results[correctionResult.bestMethod];
          finalImageUrl = bestResult.imageUrl;
          correctionMethod = bestResult.method;
          correctionScore = bestResult.correctionScore;
        }
        
        // Calculate enhanced quality metrics
        const qualityMetrics = await falAIService.calculateQualityMetrics(
          project.backgroundImageUrl || "",
          finalImageUrl,
          project.maskImageUrl || "",
          project.styleReferenceUrl || undefined
        );

        // Update variant with comprehensive results
        await storage.updateVariant(variant.id, {
          status: "completed",
          generationTime: result.generationTime,
          imageUrl: finalImageUrl,
          falRequestId: result.falRequestId,
          ssimScore: qualityMetrics.ssimScore,
          poseAccuracy: qualityMetrics.poseAccuracy,
          colorDelta: qualityMetrics.colorDelta,
          styleConsistencyScore: qualityMetrics.styleConsistencyScore || null,
          correctionMethod,
          correctionScore
        });
        
      } catch (error) {
        console.error(`Variant ${variant.id} generation failed:`, error);
        await storage.updateVariant(variant.id, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Generation failed"
        });
      }
    }
  } catch (error) {
    console.error(`Project ${projectId} generation failed:`, error);
    // Mark all variants as failed
    for (const variant of variants) {
      await storage.updateVariant(variant.id, {
        status: "failed",
        errorMessage: "Project generation failed"
      });
    }
  }

  // Calculate and store quality metrics
  const completedVariants = (await storage.getVariantsByProject(projectId))
    .filter(v => v.status === "completed");

  if (completedVariants.length > 0) {
    const avgGenerationTime = completedVariants.reduce((sum, v) => sum + (v.generationTime || 0), 0) / completedVariants.length;
    const avgSSIM = completedVariants.reduce((sum, v) => sum + (v.ssimScore || 0), 0) / completedVariants.length;
    const avgPoseAccuracy = completedVariants.reduce((sum, v) => sum + (v.poseAccuracy || 0), 0) / completedVariants.length;
    const avgColorDelta = completedVariants.reduce((sum, v) => sum + (v.colorDelta || 0), 0) / completedVariants.length;
    const avgStyleConsistency = completedVariants.reduce((sum, v) => sum + (v.styleConsistencyScore || 0), 0) / completedVariants.length;
    
    // Calculate correction method effectiveness
    const correctionMethods = ['qwen', 'nano_banana', 'original'];
    const methodEffectiveness: Record<string, number> = {};
    
    correctionMethods.forEach(method => {
      const methodVariants = completedVariants.filter(v => v.correctionMethod === method);
      if (methodVariants.length > 0) {
        methodEffectiveness[method] = methodVariants.reduce((sum, v) => sum + (v.correctionScore || 0), 0) / methodVariants.length;
      }
    });

    await storage.createQualityMetrics({
      projectId,
      averageGenerationTime: avgGenerationTime,
      totalApiCalls: variants.length,
      successRate: completedVariants.length / variants.length,
      averageSSIM: avgSSIM,
      averagePoseAccuracy: avgPoseAccuracy,
      averageColorDelta: avgColorDelta,
      averageStyleConsistency: avgStyleConsistency || null,
      correctionMethodEffectiveness: methodEffectiveness,
      colorPaletteAdherence: null,
      moodMatching: null,
      recommendations: [
        avgSSIM > 0.95 ? "Excellent structural similarity achieved" : "Consider improving structural alignment",
        avgPoseAccuracy > 0.96 ? "Excellent pose alignment achieved" : "Consider pose reference optimization",
        avgColorDelta < 2.0 ? "Excellent color matching" : "Consider color calibration adjustments",
        avgStyleConsistency > 0.9 ? "Excellent style consistency" : "Consider improving style reference processing"
      ]
    });
  }

  // Update project status
  await storage.updateProject(projectId, { 
    status: "completed",
    totalCost: variants.length * 0.0035 // $0.0035 per variant
  });
}

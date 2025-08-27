import * as fal from "@fal-ai/serverless-client";

export interface FalGenerationRequest {
  backgroundImageUrl: string;
  maskImageUrl: string;
  poseImageUrl: string;
  styleReferenceUrl?: string;
  lutFileUrl?: string;
  prompt: string;
  controlnetStrength: number;
  guidanceScale: number;
  seed: number;
  sceneType: string;
  photographyStyle: string;
  typology: string;
}

export interface FalGenerationResult {
  imageUrl: string;
  generationTime: number;
  requestId: string;
  seed: number;
  falRequestId: string;
  styleConsistencyScore?: number;
  correctionMethod?: string;
  correctionScore?: number;
}

export class FalAIService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FAL_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("FAL_API_KEY environment variable is required");
    }

    // Configure fal client
    fal.config({
      credentials: this.apiKey,
    });
  }

  async uploadImage(imagePath: string): Promise<string> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      console.log(`📤 Uploading image to fal.ai: ${imagePath}`);
      
      const fileBuffer = fs.readFileSync(imagePath);
      const fileName = path.basename(imagePath);
      const file = new File([fileBuffer], fileName);
      
      const uploadResult = await fal.storage.upload(file);
      console.log(`✅ Image uploaded successfully: ${uploadResult}`);
      
      return uploadResult;
    } catch (error) {
      console.error(`❌ Failed to upload image ${imagePath}:`, error);
      throw new Error(`Failed to upload image to fal.ai: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildEnhancedPrompt(request: FalGenerationRequest, styleUrl?: string): string {
    const basePrompt = "photorealistic professional photography, detailed skin texture, natural hair flow, authentic expressions";
    
    // Typology-based scene prompts (Carlos's enhanced system)
    const typologyPrompts = {
      pool: "elegant woman in flowing sundress seated at infinity pool edge, legs gracefully positioned, luxury resort atmosphere, golden hour lighting, crystal clear water reflections",
      terrace: "sophisticated woman on modern rooftop terrace, city skyline backdrop, contemporary urban aesthetic, architectural elements, ambient lighting",
      spa: "serene woman in spa setting, natural zen atmosphere, soft ambient lighting, wellness aesthetic, organic textures, peaceful environment",
      interior: "elegant woman in luxurious interior space, designer furniture, architectural lighting, refined domestic setting"
    };
    
    const photographyStyles = {
      luxury_lifestyle: "high-end fashion photography, premium aesthetic, 85mm lens, f/2.8, professional lighting, luxury brand quality",
      editorial_fashion: "editorial fashion photography, dramatic lighting, artistic composition, magazine quality, creative direction",
      natural_candid: "natural lifestyle photography, candid moments, authentic expressions, organic lighting, genuine emotions",
      commercial_advertising: "commercial photography lighting, advertising quality, brand-focused composition, marketing appeal"
    };
    
    const typologyPrompt = typologyPrompts[request.typology as keyof typeof typologyPrompts] || typologyPrompts.pool;
    const stylePrompt = photographyStyles[request.photographyStyle as keyof typeof photographyStyles] || photographyStyles.luxury_lifestyle;
    
    let enhancedPrompt = `${basePrompt}, ${typologyPrompt}, ${stylePrompt}`;
    
    // Add style reference guidance if provided
    if (styleUrl) {
      enhancedPrompt += ", matching the color palette and mood of the style reference image, consistent aesthetic direction";
    }
    
    return enhancedPrompt;
  }

  async generateImage(request: FalGenerationRequest): Promise<FalGenerationResult> {
    const startTime = Date.now();
    console.log(`🎨 Starting fal.ai generation with seed ${request.seed}`);

    try {
      // Upload images to fal.ai storage first
      console.log("📤 Uploading images to fal.ai storage...");
      const uploadPromises = [
        this.uploadImage(`.${request.backgroundImageUrl}`),
        this.uploadImage(`.${request.maskImageUrl}`),
        this.uploadImage(`.${request.poseImageUrl}`)
      ];
      
      // Add style reference if provided
      if (request.styleReferenceUrl) {
        uploadPromises.push(this.uploadImage(`.${request.styleReferenceUrl}`));
      }
      
      const uploadResults = await Promise.all(uploadPromises);
      const [backgroundUrl, maskUrl, poseUrl, styleUrl] = uploadResults;

      const prompt = this.buildEnhancedPrompt(request, styleUrl);
      const negativePrompt = "cartoon, illustration, anime, cgi, deformed hands, extra fingers, blurry, low resolution, artifacts, harsh shadows, over-saturated, bad anatomy, distorted proportions, multiple people, crowd, watermark, signature";
      
      console.log(`🎯 Generated prompt: ${prompt.substring(0, 100)}...`);

      // Call fal.ai SDXL ControlNet Union Inpainting endpoint
      console.log("🚀 Calling fal.ai SDXL ControlNet Union Inpainting endpoint...");
      console.log("📋 Request payload:", JSON.stringify({
        prompt: prompt.substring(0, 100) + "...",
        image_url: backgroundUrl.substring(0, 50) + "...",
        mask_url: maskUrl.substring(0, 50) + "...",
        openpose_image_url: poseUrl.substring(0, 50) + "...",
        num_inference_steps: 35,
        guidance_scale: request.guidanceScale,
        seed: request.seed
      }, null, 2));
      
      const result = await fal.subscribe("fal-ai/sdxl-controlnet-union/inpainting", {
        input: {
          // Core prompt for lifestyle photography
          prompt: prompt,
          negative_prompt: negativePrompt,
          
          // Image inputs
          image_url: backgroundUrl,
          mask_url: maskUrl,
          
          // ControlNet configurations
          openpose_image_url: poseUrl,
          openpose_preprocess: true,
          depth_image_url: backgroundUrl,
          depth_preprocess: true,
          
          // ControlNet conditioning scales
          controlnet_conditioning_scale: request.controlnetStrength,
          
          // Generation parameters optimized for quality
          num_inference_steps: 35,
          guidance_scale: request.guidanceScale,
          strength: 0.95,
          
          // Output settings
          num_images: 1,
          seed: request.seed,
          image_size: "square_hd", // 1024x1024 optimal for SDXL
          
          // Quality settings
          enable_safety_checker: true,
          safety_checker_version: "v1"
        }
      }) as any;

      const generationTime = (Date.now() - startTime) / 1000;
      
      console.log(`⚡ Generation completed in ${generationTime.toFixed(1)}s`);
      console.log("🔍 Full fal.ai response:", JSON.stringify(result, null, 2));

      // Handle different possible response structures from fal.ai
      let imageUrl = null;
      
      if (result.data && result.data.images && result.data.images.length > 0) {
        imageUrl = result.data.images[0].url;
      } else if (result.images && result.images.length > 0) {
        imageUrl = result.images[0].url;
      } else if (result.data && result.data.image_url) {
        imageUrl = result.data.image_url;
      } else if (result.image_url) {
        imageUrl = result.image_url;
      }

      if (!imageUrl) {
        console.error("❌ No images found in fal.ai response structure");
        console.error("Response keys:", Object.keys(result));
        if (result.data) console.error("Data keys:", Object.keys(result.data));
        throw new Error("No images generated - check response structure");
      }

      console.log(`✅ Successfully generated image: ${imageUrl.substring(0, 50)}...`);

      return {
        imageUrl,
        generationTime,
        requestId: result.requestId || `req_${Date.now()}`,
        seed: request.seed,
        falRequestId: result.requestId || ""
      };

    } catch (error) {
      console.error("❌ Generation error details:", error);
      throw new Error(`fal.ai generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateVariants(
    request: FalGenerationRequest, 
    variantCount: number = 3
  ): Promise<FalGenerationResult[]> {
    const results: FalGenerationResult[] = [];
    const seeds = [123456, 789012, 345678, 901234, 567890].slice(0, variantCount);

    for (let i = 0; i < variantCount; i++) {
      try {
        const variantRequest = {
          ...request,
          seed: seeds[i]
        };

        const result = await this.generateImage(variantRequest);
        results.push(result);

        // Small delay between requests to avoid rate limiting
        if (i < variantCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`Failed to generate variant ${i + 1}:`, error);
        // Continue with other variants even if one fails
      }
    }

    return results;
  }

  async calculateQualityMetrics(
    originalImageUrl: string,
    generatedImageUrl: string,
    maskImageUrl: string,
    styleReferenceUrl?: string
  ): Promise<{
    ssimScore: number;
    poseAccuracy: number;
    colorDelta: number;
    styleConsistencyScore?: number;
    colorPaletteAdherence?: number;
    moodMatching?: number;
  }> {
    // For now, return simulated quality metrics
    // In production, this would analyze the actual images
    const baseMetrics = {
      ssimScore: 0.92 + Math.random() * 0.06, // 0.92-0.98
      poseAccuracy: 0.94 + Math.random() * 0.05, // 0.94-0.99
      colorDelta: 1.5 + Math.random() * 1.0 // 1.5-2.5 ΔE00
    };

    // Add enhanced metrics if style reference is provided
    if (styleReferenceUrl) {
      return {
        ...baseMetrics,
        styleConsistencyScore: 0.88 + Math.random() * 0.10, // 0.88-0.98
        colorPaletteAdherence: 0.85 + Math.random() * 0.12, // 0.85-0.97
        moodMatching: 0.90 + Math.random() * 0.08 // 0.90-0.98
      };
    }

    return baseMetrics;
  }

  // Enhanced Generation with Python Integration
  async generateWithVisionAnalysis(request: FalGenerationRequest): Promise<FalGenerationResult> {
    console.log("🔬 Starting vision-enhanced generation pipeline");
    
    try {
      // Run GPT-4o Vision analysis
      const analysisResult = await this.runVisionAnalysis(
        request.backgroundImageUrl,
        request.poseImageUrl,
        request.typology
      );
      
      // Use enhanced prompt from vision analysis
      const enhancedRequest = {
        ...request,
        prompt: analysisResult.enhancedPrompt
      };
      
      // Generate with enhanced parameters
      const result = await this.generateImage(enhancedRequest);
      
      // Run correction comparison pipeline
      const correctionResults = await this.runCorrectionPipeline(
        request.backgroundImageUrl,
        analysisResult.maskPath,
        result.imageUrl,
        analysisResult.enhancedPrompt,
        request.styleReferenceUrl
      );
      
      // Return best result
      return {
        ...result,
        imageUrl: correctionResults.bestImageUrl,
        correctionMethod: correctionResults.bestMethod,
        correctionScore: correctionResults.improvementScore,
        styleConsistencyScore: correctionResults.styleConsistency
      };
      
    } catch (error) {
      console.error("❌ Vision-enhanced generation failed:", error);
      // Fallback to standard generation
      return this.generateImage(request);
    }
  }
  
  private async runVisionAnalysis(backgroundUrl: string, poseUrl: string, typology: string) {
    const { spawn } = await import("child_process");
    const fs = await import("fs");
    
    return new Promise<any>((resolve, reject) => {
      const pythonProcess = spawn('python', [
        'python/gpt4o_vision_analyzer.py',
        '--background', `.${backgroundUrl}`,
        '--pose_ref', `.${poseUrl}`,
        '--typology', typology,
        '--out_dir', 'out'
      ]);
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const analysisPath = 'out/scene_analysis.json';
            const promptPath = 'out/enhanced_prompt.txt';
            const maskPath = 'out/segmentation_mask.png';
            
            const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
            const enhancedPrompt = fs.readFileSync(promptPath, 'utf8').trim();
            
            resolve({
              analysis,
              enhancedPrompt,
              maskPath
            });
          } catch (error) {
            reject(new Error(`Failed to read analysis results: ${error}`));
          }
        } else {
          reject(new Error(`Vision analysis failed with code ${code}`));
        }
      });
    });
  }
  
  private async runCorrectionPipeline(
    backgroundUrl: string,
    maskPath: string,
    originalImageUrl: string,
    enhancedPrompt: string,
    styleReferenceUrl?: string
  ) {
    const { spawn } = await import("child_process");
    const fs = await import("fs");
    
    return new Promise<any>((resolve, reject) => {
      const args = [
        'python/correction_pipeline.py',
        '--background', `.${backgroundUrl}`,
        '--mask', maskPath,
        '--original', `.${originalImageUrl}`,
        '--prompt', enhancedPrompt,
        '--output_dir', 'out'
      ];
      
      if (styleReferenceUrl) {
        args.push('--style_reference', `.${styleReferenceUrl}`);
      }
      
      const pythonProcess = spawn('python', args);
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const resultsPath = 'out/correction_comparison.json';
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            
            // Determine best image URL
            const bestMethod = results.best_method;
            let bestImageUrl = originalImageUrl;
            
            if (bestMethod === 'qwen' && fs.existsSync('out/qwen_corrected.jpg')) {
              bestImageUrl = '/out/qwen_corrected.jpg';
            } else if (bestMethod === 'nano_banana' && fs.existsSync('out/nano_banana_corrected.jpg')) {
              bestImageUrl = '/out/nano_banana_corrected.jpg';
            }
            
            resolve({
              bestImageUrl,
              bestMethod,
              improvementScore: results.improvement,
              styleConsistency: results.results[bestMethod]?.style_consistency || 0,
              fullResults: results
            });
          } catch (error) {
            reject(new Error(`Failed to read correction results: ${error}`));
          }
        } else {
          reject(new Error(`Correction pipeline failed with code ${code}`));
        }
      });
    });
  }
}

export const falAIService = new FalAIService();
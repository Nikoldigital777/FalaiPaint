import * as fal from "@fal-ai/serverless-client";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

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

      // Call fal.ai ControlNet Union Inpainting endpoint
      console.log("🚀 Calling fal.ai ControlNet Union Inpainting endpoint...");
      
      const input = {
        prompt,
        negative_prompt: negativePrompt,
        image_url: backgroundUrl,
        mask_url: maskUrl,
        openpose_image_url: poseUrl,
        controlnet_conditioning_scale: request.controlnetStrength,
        guidance_scale: request.guidanceScale,
        num_inference_steps: 35,
        seed: request.seed,
        style_image_url: styleUrl,
        enable_safety_checker: false
      };

      const result = await fal.subscribe("fal-ai/controlnet-union/inpainting", { input });
      const imageUrl = (result as any).data?.images?.[0]?.url || (result as any).images?.[0]?.url;
      
      if (!imageUrl) {
        throw new Error("No image URL returned from fal.ai");
      }

      const generationTime = Date.now() - startTime;
      console.log(`✅ Generation completed in ${generationTime}ms`);

      return {
        imageUrl,
        generationTime,
        requestId: (result as any).requestId || "",
        seed: request.seed,
        falRequestId: (result as any).requestId || ""
      };
    } catch (error) {
      console.error("❌ fal.ai generation failed:", error);
      throw new Error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    // Use the advanced Python quality assessment pipeline
    const process = spawn("python", [
      "python/qa_metrics.py",
      "--scene", originalImageUrl,
      "--generated", generatedImageUrl, 
      "--mask", maskImageUrl,
      "--style_reference", styleReferenceUrl || "",
      "--out_json", "out/quality_metrics.json"
    ]);

    return new Promise((resolve, reject) => {
      process.on("close", (code) => {
        if (code === 0) {
          try {
            const results = JSON.parse(fs.readFileSync("out/quality_metrics.json", "utf8"));
            resolve({
              ssimScore: results.ssim_background,
              poseAccuracy: results.pose_accuracy,
              colorDelta: results.delta_e_edge,
              styleConsistencyScore: results.style_consistency,
              colorPaletteAdherence: results.color_palette_adherence,
              moodMatching: results.mood_matching
            });
          } catch (error) {
            reject(new Error(`Failed to parse quality metrics: ${error}`));
          }
        } else {
          reject(new Error(`Quality assessment failed with code ${code}`));
        }
      });
    });
  }

  // Enhanced Generation with Vision Analysis
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

  async generateVariants(
    request: FalGenerationRequest, 
    variantCount: number = 3
  ): Promise<FalGenerationResult[]> {
    const seeds = [123456, 789012, 345678]; // Use fixed seeds for consistency
    const results: FalGenerationResult[] = [];

    console.log(`🎯 Generating ${variantCount} variants for ${request.typology} scene`);

    for (let i = 0; i < variantCount; i++) {
      try {
        const variantRequest = {
          ...request,
          seed: seeds[i] || Math.floor(Math.random() * 1000000)
        };

        console.log(`🎨 Generating variant ${i + 1}/${variantCount} with seed ${variantRequest.seed}`);
        
        const result = await this.generateImage({
          backgroundImageUrl: variantRequest.backgroundImageUrl,
          maskImageUrl: variantRequest.maskImageUrl,
          poseImageUrl: variantRequest.poseImageUrl,
          prompt: variantRequest.prompt,
          guidanceScale: variantRequest.guidanceScale,
          seed: variantRequest.seed,
          controlnetStrength: variantRequest.controlnetStrength,
          styleReferenceUrl: variantRequest.styleReferenceUrl
        });

        results.push({
          ...result,
          seed: variantRequest.seed,
          falRequestId: result.requestId
        });

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
}

export const falAIService = new FalAIService();
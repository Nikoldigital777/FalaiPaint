import * as fal from "@fal-ai/serverless-client";

export interface FalGenerationRequest {
  backgroundImageUrl: string;
  maskImageUrl: string;
  poseImageUrl: string;
  prompt: string;
  controlnetStrength: number;
  guidanceScale: number;
  seed: number;
  sceneType: string;
  photographyStyle: string;
}

export interface FalGenerationResult {
  imageUrl: string;
  generationTime: number;
  requestId: string;
  seed: number;
  falRequestId: string;
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

  private buildPrompt(request: FalGenerationRequest): string {
    const basePrompt = "photorealistic lifestyle photography, natural lighting, professional quality, 85mm lens, f/2.8";
    
    const scenePrompts = {
      pool_edge: "woman in elegant sundress seated at pool edge, relaxed natural posture, soft golden hour lighting, luxury resort atmosphere",
      beach_sunset: "woman in flowing dress on sandy beach, golden sunset lighting, ocean background, serene coastal atmosphere",
      urban_rooftop: "woman in chic outfit on modern rooftop terrace, city skyline background, contemporary urban setting",
      garden_party: "woman in summer dress in lush garden setting, natural botanical background, organic natural lighting",
      studio_portrait: "woman in professional attire in studio setting, controlled lighting, clean modern background"
    };

    const stylePrompts = {
      luxury_lifestyle: "high-end fashion photography style, premium aesthetic, sophisticated composition",
      editorial_fashion: "dramatic lighting, high fashion editorial style, artistic composition",
      natural_candid: "candid lifestyle photography, authentic moments, natural expressions",
      commercial_advertising: "product photography lighting, commercial quality, advertising campaign style"
    };

    const scenePrompt = scenePrompts[request.sceneType as keyof typeof scenePrompts] || scenePrompts.pool_edge;
    const stylePrompt = stylePrompts[request.photographyStyle as keyof typeof stylePrompts] || stylePrompts.luxury_lifestyle;

    return `${basePrompt}, ${scenePrompt}, ${stylePrompt}, detailed skin texture, high-end fashion photography`;
  }

  async generateImage(request: FalGenerationRequest): Promise<FalGenerationResult> {
    const startTime = Date.now();
    console.log(`🎨 Starting fal.ai generation with seed ${request.seed}`);

    try {
      // Upload images to fal.ai storage first
      console.log("📤 Uploading images to fal.ai storage...");
      const [backgroundUrl, maskUrl, poseUrl] = await Promise.all([
        this.uploadImage(`.${request.backgroundImageUrl}`),
        this.uploadImage(`.${request.maskImageUrl}`),
        this.uploadImage(`.${request.poseImageUrl}`)
      ]);

      const prompt = this.buildPrompt(request);
      const negativePrompt = "cartoon, illustration, anime, cgi, deformed hands, extra fingers, blurry, low resolution, artifacts, harsh shadows, over-saturated, bad anatomy, distorted proportions, multiple people, crowd, watermark, signature";
      
      console.log(`🎯 Generated prompt: ${prompt.substring(0, 100)}...`);

      // Call fal.ai SDXL ControlNet Union Inpainting endpoint
      console.log("🚀 Calling fal.ai SDXL ControlNet Union Inpainting endpoint...");
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
    maskImageUrl: string
  ): Promise<{
    ssimScore: number;
    poseAccuracy: number;
    colorDelta: number;
  }> {
    // For now, return simulated quality metrics
    // In production, this would analyze the actual images
    return {
      ssimScore: 0.92 + Math.random() * 0.06, // 0.92-0.98
      poseAccuracy: 0.94 + Math.random() * 0.05, // 0.94-0.99
      colorDelta: 1.5 + Math.random() * 1.0 // 1.5-2.5 ΔE00
    };
  }
}

export const falAIService = new FalAIService();
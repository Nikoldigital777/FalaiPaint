import * as fal from "@fal-ai/serverless-client";
import { spawn } from "child_process";
import fs from "fs";

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

  async uploadImage(localPath: string) {
    // implement if you use presigned uploads in your setup
    return localPath;
  }

  async generateImage(req: {
    backgroundImageUrl: string;
    maskImageUrl: string;
    poseImageUrl?: string;
    depthImageUrl?: string;
    prompt: string;
    guidanceScale: number;
    seed: number;
    controlnetStrength: number;
    styleReferenceUrl?: string;
    loraUrl?: string;
    loraScale?: number;
    steps?: number;
  }) {
    const input: any = {
      prompt: req.prompt,
      image_url: req.backgroundImageUrl,
      mask_url: req.maskImageUrl,
      seed: req.seed,
      num_inference_steps: req.steps ?? 30,
      guidance_scale: req.guidanceScale,
      controlnet_conditioning_scale: req.controlnetStrength,
      loras: req.loraUrl ? [{ path: req.loraUrl, scale: req.loraScale ?? 0.75 }] : []
    };
    if (req.poseImageUrl) input.openpose_image_url = req.poseImageUrl;
    if (req.depthImageUrl) input.depth_image_url = req.depthImageUrl;
    // if your provider supports direct style conditioning, pass style image here
    if (req.styleReferenceUrl) input.style_image_url = req.styleReferenceUrl;

    const res = await fal.subscribe("fal-ai/controlnet-union/inpainting", { input });
    const imageUrl = (res as any).data?.image_url || (res as any).images?.[0]?.url;
    return { imageUrl, generationTime: (res as any).data?.inference_time ?? 25, requestId: (res as any).requestId ?? "" };
  }

  async calculateQualityMetrics(scene: string, gen: string, mask: string) {
    await new Promise<void>((resolve) => {
      const process = spawn("python", ["python/qa_metrics.py"]);
      process.on("close", () => resolve());
    }); // preload modules
    // lightweight call: reuse correction script with original only
    const outJson = gen.replace(/\.png$/i, "_metrics.json");
    await new Promise<void>((resolve, reject) => {
      const process = spawn("python", ["python/correction_pipeline.py", "--scene", scene, "--mask", mask, "--original", gen, "--out_json", outJson]);
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`QA failed with code ${code}`)));
    });
    const { results } = JSON.parse(fs.readFileSync(outJson, "utf8"));
    return results.original;
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
export interface FalGenerationRequest {
  backgroundImageUrl: string;
  maskImageUrl: string;
  poseImageUrl: string;
  prompt: string;
  controlnetStrength: number;
  guidanceScale: number;
  seed: number;
}

export interface FalGenerationResponse {
  requestId: string;
  imageUrl: string;
  generationTime: number;
}

export class FalClient {
  private apiKey: string;
  private baseUrl = "https://fal.run/fal-ai/controlnet-union";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(request: FalGenerationRequest): Promise<FalGenerationResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: request.backgroundImageUrl,
          mask_url: request.maskImageUrl,
          control_image_url: request.poseImageUrl,
          prompt: request.prompt,
          controlnet_conditioning_scale: request.controlnetStrength,
          guidance_scale: request.guidanceScale,
          seed: request.seed,
          num_inference_steps: 30,
          safety_checker: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        requestId: result.request_id || `req_${Date.now()}`,
        imageUrl: result.images[0]?.url || "",
        generationTime: result.inference_time || 15,
      };
    } catch (error) {
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadImage(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("https://fal.run/storage/upload", {
        method: "POST",
        headers: {
          "Authorization": `Key ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.file_url;
    } catch (error) {
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Default client instance
export const falClient = new FalClient(
  import.meta.env.VITE_FAL_API_KEY || 
  process.env.FAL_API_KEY || 
  "your-fal-api-key"
);

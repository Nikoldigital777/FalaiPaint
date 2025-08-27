import fs from "fs";
import path from "path";

export interface StyleEmbeddings {
  clipEmbeddings: number[];
  colorPalette: ColorProfile[];
  lightingProfile: LightingAnalysis;
  typology: string;
  moodDescriptors: string[];
}

export interface ColorProfile {
  hex: string;
  rgb: [number, number, number];
  dominance: number;
  warmth: number;
}

export interface LightingAnalysis {
  brightness: number;
  contrast: number;
  warmth: number;
  directionality: "soft" | "directional" | "mixed";
  timeOfDay: "golden_hour" | "midday" | "blue_hour" | "artificial";
}

export interface SceneInput {
  background_image: string;
  pose_reference: string;
  mask: string;
  style_reference: string;
  typology: 'pool' | 'terrace' | 'spa' | 'interior';
  lut_file?: string;
}

export class StyleReferenceProcessor {
  private typologyConfigs = {
    pool: {
      keywords: ["luxury", "resort", "poolside", "relaxation", "golden hour"],
      colorProfile: "warm_blues_golden",
      lightingStyle: "soft_natural",
      moodTargets: ["luxurious", "serene", "inviting"]
    },
    terrace: {
      keywords: ["modern", "urban", "sophisticated", "cityscape", "contemporary"],
      colorProfile: "cool_grays_warm_accents",
      lightingStyle: "directional_dramatic",
      moodTargets: ["sophisticated", "dynamic", "cosmopolitan"]
    },
    spa: {
      keywords: ["zen", "tranquil", "wellness", "natural", "peaceful"],
      colorProfile: "earth_tones_soft",
      lightingStyle: "soft_ambient",
      moodTargets: ["peaceful", "healing", "organic"]
    },
    interior: {
      keywords: ["elegant", "refined", "architectural", "intimate", "curated"],
      colorProfile: "balanced_neutrals",
      lightingStyle: "controlled_ambient",
      moodTargets: ["elegant", "intimate", "refined"]
    }
  };

  async extractStyleEmbeddings(
    styleRefPath: string, 
    typology: 'pool' | 'terrace' | 'spa' | 'interior'
  ): Promise<StyleEmbeddings> {
    try {
      if (!fs.existsSync(styleRefPath)) {
        throw new Error(`Style reference file not found: ${styleRefPath}`);
      }

      const config = this.typologyConfigs[typology];
      
      // Simulate CLIP embeddings extraction
      // In production, this would use actual computer vision models
      const clipEmbeddings = this.generateMockClipEmbeddings(styleRefPath, config);
      
      // Extract color palette
      const colorPalette = await this.extractDominantColors(styleRefPath, config.colorProfile);
      
      // Analyze lighting conditions
      const lightingProfile = await this.analyzeLightingConditions(styleRefPath, config.lightingStyle);
      
      console.log(`✅ Style embeddings extracted for ${typology} typology`);
      
      return {
        clipEmbeddings,
        colorPalette,
        lightingProfile,
        typology,
        moodDescriptors: config.moodTargets
      };
    } catch (error) {
      console.error(`❌ Failed to extract style embeddings:`, error);
      throw new Error(`Style processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateMockClipEmbeddings(styleRefPath: string, config: any): number[] {
    // Mock CLIP embeddings - in production would use actual model
    const baseEmbedding = new Array(512).fill(0).map(() => Math.random() * 2 - 1);
    
    // Add typology-specific bias
    const typologyBias = config.keywords.length * 0.1;
    return baseEmbedding.map(val => Math.tanh(val + typologyBias));
  }

  private async extractDominantColors(
    imagePath: string, 
    profileType: string
  ): Promise<ColorProfile[]> {
    // Mock color extraction - in production would analyze actual image
    const colorProfiles: Record<string, ColorProfile[]> = {
      warm_blues_golden: [
        { hex: "#4A90E2", rgb: [74, 144, 226], dominance: 0.35, warmth: 0.3 },
        { hex: "#F5A623", rgb: [245, 166, 35], dominance: 0.25, warmth: 0.8 },
        { hex: "#7ED321", rgb: [126, 211, 33], dominance: 0.15, warmth: 0.4 },
        { hex: "#FFFFFF", rgb: [255, 255, 255], dominance: 0.25, warmth: 0.5 }
      ],
      cool_grays_warm_accents: [
        { hex: "#9B9B9B", rgb: [155, 155, 155], dominance: 0.4, warmth: 0.2 },
        { hex: "#F5A623", rgb: [245, 166, 35], dominance: 0.2, warmth: 0.8 },
        { hex: "#4A4A4A", rgb: [74, 74, 74], dominance: 0.3, warmth: 0.1 },
        { hex: "#D0021B", rgb: [208, 2, 27], dominance: 0.1, warmth: 0.7 }
      ],
      earth_tones_soft: [
        { hex: "#8B5A3C", rgb: [139, 90, 60], dominance: 0.3, warmth: 0.7 },
        { hex: "#F5E6D3", rgb: [245, 230, 211], dominance: 0.25, warmth: 0.6 },
        { hex: "#7ED321", rgb: [126, 211, 33], dominance: 0.2, warmth: 0.4 },
        { hex: "#A0826D", rgb: [160, 130, 109], dominance: 0.25, warmth: 0.5 }
      ],
      balanced_neutrals: [
        { hex: "#F8F8F8", rgb: [248, 248, 248], dominance: 0.3, warmth: 0.5 },
        { hex: "#4A4A4A", rgb: [74, 74, 74], dominance: 0.25, warmth: 0.3 },
        { hex: "#D4A574", rgb: [212, 165, 116], dominance: 0.2, warmth: 0.6 },
        { hex: "#50E3C2", rgb: [80, 227, 194], dominance: 0.25, warmth: 0.4 }
      ]
    };

    return colorProfiles[profileType] || colorProfiles.balanced_neutrals;
  }

  private async analyzeLightingConditions(
    imagePath: string,
    lightingStyle: string
  ): Promise<LightingAnalysis> {
    // Mock lighting analysis - in production would analyze actual image
    const lightingProfiles: Record<string, LightingAnalysis> = {
      soft_natural: {
        brightness: 0.7,
        contrast: 0.4,
        warmth: 0.8,
        directionality: "soft",
        timeOfDay: "golden_hour"
      },
      directional_dramatic: {
        brightness: 0.6,
        contrast: 0.8,
        warmth: 0.5,
        directionality: "directional",
        timeOfDay: "blue_hour"
      },
      soft_ambient: {
        brightness: 0.8,
        contrast: 0.3,
        warmth: 0.6,
        directionality: "soft",
        timeOfDay: "artificial"
      },
      controlled_ambient: {
        brightness: 0.75,
        contrast: 0.5,
        warmth: 0.65,
        directionality: "mixed",
        timeOfDay: "artificial"
      }
    };

    return lightingProfiles[lightingStyle] || lightingProfiles.soft_natural;
  }

  buildStyleEnhancedPrompt(
    basePrompt: string,
    styleEmbeddings: StyleEmbeddings,
    typology: string
  ): string {
    const { colorPalette, lightingProfile, moodDescriptors } = styleEmbeddings;
    
    // Build color description
    const dominantColors = colorPalette
      .sort((a, b) => b.dominance - a.dominance)
      .slice(0, 3)
      .map(color => this.colorToDescription(color));
    
    // Build lighting description
    const lightingDesc = this.lightingToDescription(lightingProfile);
    
    // Build mood description
    const moodDesc = moodDescriptors.join(", ");
    
    // Combine with typology-specific enhancements
    const typologyEnhancement = this.getTypologyEnhancement(typology);
    
    return `${basePrompt}, ${dominantColors.join(", ")} color palette, ${lightingDesc}, ${moodDesc} mood, ${typologyEnhancement}`;
  }

  private colorToDescription(color: ColorProfile): string {
    const warmness = color.warmth > 0.6 ? "warm" : color.warmth < 0.4 ? "cool" : "balanced";
    return `${warmness} ${color.hex}`;
  }

  private lightingToDescription(lighting: LightingAnalysis): string {
    const timeDesc = lighting.timeOfDay.replace("_", " ");
    const directionDesc = lighting.directionality === "soft" ? "soft diffused" : 
                         lighting.directionality === "directional" ? "dramatic directional" : "balanced";
    
    return `${directionDesc} ${timeDesc} lighting`;
  }

  private getTypologyEnhancement(typology: string): string {
    const enhancements = {
      pool: "luxury resort atmosphere, poolside elegance, vacation lifestyle",
      terrace: "urban sophistication, modern architectural elements, cityscape integration",
      spa: "wellness sanctuary, natural tranquility, healing environment",
      interior: "refined interior design, architectural photography, curated living space"
    };
    
    return enhancements[typology as keyof typeof enhancements] || enhancements.pool;
  }

  async processSceneInput(input: SceneInput): Promise<{
    styleEmbeddings: StyleEmbeddings;
    enhancedPrompt: string;
    processingMetrics: any;
  }> {
    const startTime = Date.now();
    
    try {
      // Extract style embeddings
      const styleEmbeddings = await this.extractStyleEmbeddings(
        input.style_reference,
        input.typology
      );
      
      // Build enhanced prompt
      const basePrompt = "photorealistic lifestyle photography, natural lighting, professional quality, 85mm lens, f/2.8";
      const enhancedPrompt = this.buildStyleEnhancedPrompt(
        basePrompt,
        styleEmbeddings,
        input.typology
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        styleEmbeddings,
        enhancedPrompt,
        processingMetrics: {
          processingTime,
          typology: input.typology,
          colorCount: styleEmbeddings.colorPalette.length,
          moodTargets: styleEmbeddings.moodDescriptors.length
        }
      };
    } catch (error) {
      console.error("❌ Scene input processing failed:", error);
      throw error;
    }
  }
}

export const styleProcessor = new StyleReferenceProcessor();
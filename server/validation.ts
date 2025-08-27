import { z } from "zod";
import { insertProjectSchema } from "@shared/schema";

// Enhanced project validation schema
export const enhancedProjectSchema = insertProjectSchema.extend({
  typology: z.enum(["pool", "terrace", "spa", "interior"]).default("pool"),
  styleReferenceUrl: z.string().optional(),
  lutFileUrl: z.string().optional(),
});

export function validateProject(data: unknown) {
  try {
    const validated = enhancedProjectSchema.parse(data);
    return { success: true, data: validated, error: null };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: error instanceof z.ZodError ? error.errors : "Validation failed" 
    };
  }
}

// Enhanced variant validation
export const enhancedVariantSchema = z.object({
  projectId: z.string(),
  variantNumber: z.number().min(1).max(5),
  seed: z.number(),
  method: z.enum(["sdxl", "qwen", "nano_banana"]).default("sdxl"),
  status: z.enum(["pending", "generating", "completed", "failed"]).default("pending")
});

export function validateVariant(data: unknown) {
  try {
    const validated = enhancedVariantSchema.parse(data);
    return { success: true, data: validated, error: null };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: error instanceof z.ZodError ? error.errors : "Validation failed" 
    };
  }
}

// Quality metrics validation
export const qualityMetricsSchema = z.object({
  projectId: z.string(),
  averageGenerationTime: z.number().optional(),
  totalApiCalls: z.number().optional(),
  successRate: z.number().min(0).max(1).optional(),
  averageSSIM: z.number().min(0).max(1).optional(),
  averagePoseAccuracy: z.number().min(0).max(1).optional(),
  averageColorDelta: z.number().min(0).optional(),
  averageStyleConsistency: z.number().min(0).max(1).optional(),
  correctionMethodEffectiveness: z.record(z.number()).optional(),
  colorPaletteAdherence: z.number().min(0).max(1).optional(),
  moodMatching: z.number().min(0).max(1).optional(),
  recommendations: z.array(z.string()).optional()
});

export function validateQualityMetrics(data: unknown) {
  try {
    const validated = qualityMetricsSchema.parse(data);
    return { success: true, data: validated, error: null };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: error instanceof z.ZodError ? error.errors : "Validation failed" 
    };
  }
}
import fs from "fs";
import { spawn } from "child_process";

async function qwenEdit(src: string, mask: string, instruction: string, outPath: string) {
  // TODO: call your Qwen image edit endpoint
  // For now write-through to simulate no-op
  await fs.promises.copyFile(src, outPath);
  return outPath;
}

async function nanoBananaEdit(src: string, mask: string, instruction: string, outPath: string) {
  // TODO: call your Nano-Banana endpoint
  await fs.promises.copyFile(src, outPath);
  return outPath;
}

export async function runCorrections(scene: string, genPath: string, maskPath: string, issues: string[]) {
  const qwenOut = genPath.replace(".png", "_qwen.png");
  const nanoOut = genPath.replace(".png", "_nano.png");

  await qwenEdit(genPath, maskPath, issues.join(", "), qwenOut);
  await nanoBananaEdit(genPath, maskPath, issues.join(", "), nanoOut);

  const outJson = genPath.replace(".png", "_corrections.json");
  await new Promise<void>((resolve, reject) => {
    const process = spawn("python", ["python/correction_pipeline.py",
      "--scene", scene, "--mask", maskPath,
      "--original", genPath, "--qwen", qwenOut, "--nano", nanoOut,
      "--out_json", outJson
    ]);
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Correction failed with code ${code}`)));
  });

  return JSON.parse(fs.readFileSync(outJson, "utf8"));
}

export interface CorrectionResult {
  imageUrl: string;
  method: 'qwen' | 'nano_banana' | 'original';
  processingTime: number;
  qualityScore: number;
  correctionScore: number;
  issuesAddressed: string[];
}

export interface CorrectionComparison {
  results: Record<string, CorrectionResult>;
  bestMethod: string;
  effectiveness: Record<string, number>;
  recommendations: string[];
}

export interface DetectedIssue {
  type: 'pose_drift' | 'artifact' | 'duplicate' | 'lighting_mismatch' | 'style_inconsistency';
  severity: number; // 0-1
  location?: { x: number; y: number; width: number; height: number };
  description: string;
}

export class CorrectionManager {
  private qwenApiKey: string;
  private nanoBananaApiKey: string;

  constructor() {
    this.qwenApiKey = process.env.QWEN_API_KEY || "";
    this.nanoBananaApiKey = process.env.NANO_BANANA_API_KEY || "";
  }

  async detectIssues(
    generatedImageUrl: string,
    originalBackgroundUrl: string,
    styleEmbeddings: any
  ): Promise<DetectedIssue[]> {
    // Mock issue detection - in production would use computer vision
    const mockIssues: DetectedIssue[] = [];
    
    // Simulate random issue detection based on typical generation problems
    const issueTypes = [
      { type: 'pose_drift' as const, probability: 0.15, severity: 0.6 },
      { type: 'artifact' as const, probability: 0.20, severity: 0.4 },
      { type: 'duplicate' as const, probability: 0.10, severity: 0.8 },
      { type: 'lighting_mismatch' as const, probability: 0.25, severity: 0.5 },
      { type: 'style_inconsistency' as const, probability: 0.30, severity: 0.7 }
    ];

    for (const issueType of issueTypes) {
      if (Math.random() < issueType.probability) {
        mockIssues.push({
          type: issueType.type,
          severity: issueType.severity + (Math.random() * 0.4 - 0.2), // Add variance
          location: {
            x: Math.floor(Math.random() * 800),
            y: Math.floor(Math.random() * 800),
            width: Math.floor(Math.random() * 200 + 50),
            height: Math.floor(Math.random() * 200 + 50)
          },
          description: this.getIssueDescription(issueType.type)
        });
      }
    }

    console.log(`🔍 Detected ${mockIssues.length} potential issues in generated image`);
    return mockIssues;
  }

  private getIssueDescription(type: DetectedIssue['type']): string {
    const descriptions = {
      pose_drift: "Subject pose deviates from reference positioning",
      artifact: "Visual artifacts or unnatural elements detected",
      duplicate: "Duplicate elements or repetitive patterns found",
      lighting_mismatch: "Lighting inconsistency with background scene",
      style_inconsistency: "Style doesn't match reference aesthetic"
    };
    return descriptions[type];
  }

  async runCorrectionMethods(
    generatedImageUrl: string,
    maskUrl: string,
    issues: DetectedIssue[]
  ): Promise<CorrectionComparison> {
    const startTime = Date.now();
    const results: Record<string, CorrectionResult> = {};

    try {
      // Run all three correction methods in parallel
      const [qwenResult, nanoBananaResult, originalResult] = await Promise.all([
        this.runQwenCorrection(generatedImageUrl, maskUrl, issues),
        this.runNanoBananaCorrection(generatedImageUrl, maskUrl, issues),
        this.assessOriginal(generatedImageUrl, issues)
      ]);

      results.qwen = qwenResult;
      results.nano_banana = nanoBananaResult;
      results.original = originalResult;

      // Determine best method
      const bestMethod = this.selectBestCorrectionMethod(results);
      
      // Calculate effectiveness metrics
      const effectiveness = this.calculateMethodEffectiveness(results);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(results, issues);

      console.log(`✅ Correction comparison completed in ${Date.now() - startTime}ms`);
      console.log(`🏆 Best method: ${bestMethod} (score: ${results[bestMethod].qualityScore.toFixed(3)})`);

      return {
        results,
        bestMethod,
        effectiveness,
        recommendations
      };
    } catch (error) {
      console.error("❌ Correction comparison failed:", error);
      throw new Error(`Correction comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async runQwenCorrection(
    imageUrl: string,
    maskUrl: string,
    issues: DetectedIssue[]
  ): Promise<CorrectionResult> {
    const startTime = Date.now();
    
    try {
      // Mock Qwen-Image-Edit API call
      // In production, this would call the actual Qwen API
      console.log("🤖 Running Qwen-Image-Edit correction...");
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Mock corrected image URL
      const correctedImageUrl = imageUrl.replace('.png', '_qwen_corrected.png');
      
      // Calculate mock quality metrics
      const qualityScore = 0.85 + Math.random() * 0.1; // 0.85-0.95
      const correctionScore = this.calculateCorrectionEffectiveness(issues, 'qwen');
      
      return {
        imageUrl: correctedImageUrl,
        method: 'qwen',
        processingTime: Date.now() - startTime,
        qualityScore,
        correctionScore,
        issuesAddressed: issues.map(i => i.type)
      };
    } catch (error) {
      console.error("❌ Qwen correction failed:", error);
      return {
        imageUrl: imageUrl,
        method: 'qwen',
        processingTime: Date.now() - startTime,
        qualityScore: 0.5,
        correctionScore: 0.0,
        issuesAddressed: []
      };
    }
  }

  private async runNanoBananaCorrection(
    imageUrl: string,
    maskUrl: string,
    issues: DetectedIssue[]
  ): Promise<CorrectionResult> {
    const startTime = Date.now();
    
    try {
      // Mock Nano-Banana-Edit API call
      // In production, this would call the actual Nano-Banana API
      console.log("🍌 Running Nano-Banana-Edit correction...");
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));
      
      // Mock corrected image URL
      const correctedImageUrl = imageUrl.replace('.png', '_nano_banana_corrected.png');
      
      // Calculate mock quality metrics
      const qualityScore = 0.80 + Math.random() * 0.15; // 0.80-0.95
      const correctionScore = this.calculateCorrectionEffectiveness(issues, 'nano_banana');
      
      return {
        imageUrl: correctedImageUrl,
        method: 'nano_banana',
        processingTime: Date.now() - startTime,
        qualityScore,
        correctionScore,
        issuesAddressed: issues.map(i => i.type)
      };
    } catch (error) {
      console.error("❌ Nano-Banana correction failed:", error);
      return {
        imageUrl: imageUrl,
        method: 'nano_banana',
        processingTime: Date.now() - startTime,
        qualityScore: 0.5,
        correctionScore: 0.0,
        issuesAddressed: []
      };
    }
  }

  private async assessOriginal(
    imageUrl: string,
    issues: DetectedIssue[]
  ): Promise<CorrectionResult> {
    // Assess the original image without correction
    const qualityScore = Math.max(0.6, 0.9 - (issues.length * 0.1));
    
    return {
      imageUrl,
      method: 'original',
      processingTime: 0,
      qualityScore,
      correctionScore: 0.0, // No correction applied
      issuesAddressed: []
    };
  }

  private calculateCorrectionEffectiveness(
    issues: DetectedIssue[],
    method: 'qwen' | 'nano_banana'
  ): number {
    // Mock effectiveness calculation based on issue types and method strengths
    const methodStrengths = {
      qwen: {
        pose_drift: 0.85,
        artifact: 0.90,
        duplicate: 0.75,
        lighting_mismatch: 0.80,
        style_inconsistency: 0.70
      },
      nano_banana: {
        pose_drift: 0.80,
        artifact: 0.85,
        duplicate: 0.85,
        lighting_mismatch: 0.75,
        style_inconsistency: 0.90
      }
    };

    if (issues.length === 0) return 1.0;

    const totalWeightedScore = issues.reduce((sum, issue) => {
      const methodStrength = methodStrengths[method][issue.type] || 0.5;
      return sum + (methodStrength * issue.severity);
    }, 0);

    return totalWeightedScore / issues.length;
  }

  private selectBestCorrectionMethod(results: Record<string, CorrectionResult>): string {
    // Weighted scoring: 60% quality score + 40% correction effectiveness
    let bestMethod = 'original';
    let bestScore = 0;

    for (const [method, result] of Object.entries(results)) {
      const compositeScore = (result.qualityScore * 0.6) + (result.correctionScore * 0.4);
      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestMethod = method;
      }
    }

    return bestMethod;
  }

  private calculateMethodEffectiveness(results: Record<string, CorrectionResult>): Record<string, number> {
    const effectiveness: Record<string, number> = {};
    
    for (const [method, result] of Object.entries(results)) {
      // Composite effectiveness score
      effectiveness[method] = (result.qualityScore * 0.7) + (result.correctionScore * 0.3);
    }
    
    return effectiveness;
  }

  private generateRecommendations(
    results: Record<string, CorrectionResult>,
    issues: DetectedIssue[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Performance-based recommendations
    const qwenScore = results.qwen?.qualityScore || 0;
    const nanoBananaScore = results.nano_banana?.qualityScore || 0;
    const originalScore = results.original?.qualityScore || 0;
    
    if (qwenScore > nanoBananaScore && qwenScore > originalScore) {
      recommendations.push("Qwen-Image-Edit shows superior performance for this image type");
    } else if (nanoBananaScore > qwenScore && nanoBananaScore > originalScore) {
      recommendations.push("Nano-Banana-Edit demonstrates better correction capabilities");
    } else {
      recommendations.push("Original generation quality is sufficient - no correction needed");
    }
    
    // Issue-specific recommendations
    const criticalIssues = issues.filter(i => i.severity > 0.7);
    if (criticalIssues.length > 0) {
      recommendations.push(`Address ${criticalIssues.length} critical quality issues before production use`);
    }
    
    // Method-specific recommendations based on issue types
    const issueTypes = issues.map(i => i.type);
    if (issueTypes.includes('style_inconsistency')) {
      recommendations.push("Consider improving style reference processing for better consistency");
    }
    if (issueTypes.includes('pose_drift')) {
      recommendations.push("Strengthen pose conditioning or improve reference pose quality");
    }
    
    return recommendations;
  }
}

export const correctionManager = new CorrectionManager();
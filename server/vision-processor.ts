// server/vision-processor.ts
import { spawn } from "child_process";
import fs from "fs";

export const visionProcessor = {
  async analyzeScene(backgroundPath: string, poseJsonPath: string) {
    await fs.promises.mkdir("out", { recursive: true });

    // scene analysis
    await new Promise<void>((resolve, reject) => {
      const process = spawn("python", ["python/scene_analyzer.py", "--scene", backgroundPath, "--out_json", "out/scene_analysis.json"]);
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Scene analysis failed with code ${code}`)));
    });

    // synthesize a human-shaped mask from pose
    await new Promise<void>((resolve, reject) => {
      const process = spawn("python", ["python/mask_synth.py", "--pose_json", poseJsonPath, "--background", backgroundPath, "--out_mask", "out/segmentation_mask.png"]);
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Mask synthesis failed with code ${code}`)));
    });

    const scene = JSON.parse(fs.readFileSync("out/scene_analysis.json", "utf8"));
    return {
      segmentationMask: "out/segmentation_mask.png",
      sceneAnalysis: scene,
      autoPrompt: scene.lighting?.temperature === "warm"
        ? "golden-hour light, soft highlight rolloff"
        : "neutral soft overcast light",
      confidence: 0.8
    };
  }
};
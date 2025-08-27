#!/usr/bin/env python3
"""
GPT-4o Vision Integration for Enhanced Scene Analysis
Provides advanced scene understanding with CV fallback
"""

import cv2
import json
import numpy as np
import argparse
import os
from openai import OpenAI
import base64
from typing import Dict, List, Tuple, Optional

class GPT4oVisionAnalyzer:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    def encode_image(self, image_path: str) -> str:
        """Encode image to base64 for GPT-4o Vision"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def analyze_scene_composition(self, background_path: str, pose_ref_path: str, typology: str) -> Dict:
        """Analyze scene using GPT-4o Vision"""
        try:
            background_b64 = self.encode_image(background_path)
            pose_b64 = self.encode_image(pose_ref_path)
            
            prompt = f"""
            Analyze this {typology} scene and pose reference for AI-powered lifestyle photography generation.
            
            For the background scene, identify:
            1. Key architectural elements and their positions
            2. Lighting conditions (direction, intensity, color temperature)
            3. Optimal subject placement areas
            4. Water/edge lines (if applicable)
            5. Depth and perspective cues
            
            For the pose reference, extract:
            1. Subject positioning and orientation
            2. Limb positions and angles
            3. Contact points with surfaces
            4. Body proportions and scale
            
            Provide response as JSON with these keys:
            - scene_elements: list of objects and their locations
            - lighting_analysis: direction, intensity, temperature
            - optimal_placement: x,y coordinates for subject
            - pose_keypoints: body joint positions
            - composition_notes: styling recommendations
            """
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{background_b64}"}},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{pose_b64}"}}
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            # Parse JSON response
            analysis = json.loads(response.choices[0].message.content)
            return analysis
            
        except Exception as e:
            print(f"❌ GPT-4o Vision analysis failed: {e}")
            raise e
    
    def generate_enhanced_prompt(self, analysis: Dict, typology: str, style_palette: List[str]) -> str:
        """Generate enhanced prompt from vision analysis"""
        lighting = analysis.get("lighting_analysis", {})
        elements = analysis.get("scene_elements", [])
        composition = analysis.get("composition_notes", "")
        
        # Base prompt by typology
        base_prompts = {
            "pool": "elegant woman in flowing sundress at infinity pool edge",
            "terrace": "sophisticated woman on modern rooftop terrace",
            "spa": "serene woman in tranquil spa setting",
            "interior": "refined woman in luxurious interior space"
        }
        
        base = base_prompts.get(typology, base_prompts["pool"])
        
        # Add lighting context
        light_desc = f"{lighting.get('direction', 'natural')} {lighting.get('temperature', 'warm')} lighting"
        
        # Add style palette
        color_desc = f"color harmony with {', '.join(style_palette[:3])}"
        
        # Combine elements
        enhanced_prompt = f"{base}, {light_desc}, {color_desc}, {composition}, photorealistic lifestyle photography, professional quality"
        
        return enhanced_prompt
    
    def extract_pose_keypoints(self, analysis: Dict) -> Dict:
        """Extract pose keypoints from GPT-4o analysis"""
        keypoints = analysis.get("pose_keypoints", {})
        
        # Convert to standard format
        standard_keypoints = {
            "points": []
        }
        
        for joint, position in keypoints.items():
            if isinstance(position, dict) and "x" in position and "y" in position:
                standard_keypoints["points"].append({
                    "name": joint,
                    "x": position["x"],
                    "y": position["y"],
                    "confidence": position.get("confidence", 0.9)
                })
        
        return standard_keypoints
    
    def generate_segmentation_mask(self, background_path: str, analysis: Dict) -> np.ndarray:
        """Generate segmentation mask from analysis"""
        img = cv2.imread(background_path)
        h, w = img.shape[:2]
        
        # Create mask based on optimal placement
        mask = np.zeros((h, w), dtype=np.uint8)
        
        placement = analysis.get("optimal_placement", {"x": w//2, "y": h//2})
        
        # Create elliptical mask around optimal placement
        center = (int(placement["x"]), int(placement["y"]))
        axes = (w//8, h//4)  # Approximate human proportions
        
        cv2.ellipse(mask, center, axes, 0, 0, 360, 255, -1)
        
        return mask

def run_cv_fallback(background_path: str, pose_ref_path: str, typology: str) -> Dict:
    """Computer vision fallback when GPT-4o fails"""
    print("🔄 Running CV fallback pipeline...")
    
    # Basic scene analysis
    img = cv2.imread(background_path)
    h, w = img.shape[:2]
    
    # Simple edge detection for structural elements
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # Find horizontal lines (pool edges, terraces, etc.)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=w//4, maxLineGap=20)
    
    edge_line = None
    if lines is not None:
        # Find the most prominent horizontal line in lower half
        horizontal_lines = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if abs(y1 - y2) < 10 and min(y1, y2) > h//2:  # Near horizontal, lower half
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                horizontal_lines.append((line[0], length))
        
        if horizontal_lines:
            edge_line = max(horizontal_lines, key=lambda x: x[1])[0]
    
    # Basic lighting analysis
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    avg_brightness = np.mean(hsv[:, :, 2])
    avg_saturation = np.mean(hsv[:, :, 1])
    
    # Determine lighting temperature
    warm_pixels = np.sum((hsv[:, :, 0] < 30) | (hsv[:, :, 0] > 150))
    cool_pixels = np.sum((hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 150))
    lighting_temp = "warm" if warm_pixels > cool_pixels else "cool"
    
    return {
        "scene_elements": [{"type": "edge_line", "coordinates": edge_line}] if edge_line else [],
        "lighting_analysis": {
            "direction": "natural",
            "intensity": float(avg_brightness / 255),
            "temperature": lighting_temp,
            "saturation": float(avg_saturation / 255)
        },
        "optimal_placement": {"x": w//2, "y": int(h * 0.7)},  # Center horizontally, lower third
        "pose_keypoints": {},
        "composition_notes": f"Natural {typology} composition with {lighting_temp} lighting"
    }

def main():
    parser = argparse.ArgumentParser(description="GPT-4o Vision Scene Analysis")
    parser.add_argument("--background", required=True, help="Background scene image")
    parser.add_argument("--pose_ref", required=True, help="Pose reference image")
    parser.add_argument("--typology", required=True, choices=["pool", "terrace", "spa", "interior"])
    parser.add_argument("--style_palette", nargs='+', default=["#F5A623", "#4A90E2", "#7ED321"])
    parser.add_argument("--out_dir", default="out", help="Output directory")
    parser.add_argument("--use_fallback", action="store_true", help="Force CV fallback")
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.out_dir, exist_ok=True)
    
    try:
        if args.use_fallback:
            raise Exception("Using fallback as requested")
            
        # Try GPT-4o Vision first
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OPENAI_API_KEY not found")
            
        analyzer = GPT4oVisionAnalyzer(api_key)
        analysis = analyzer.analyze_scene_composition(args.background, args.pose_ref, args.typology)
        
        # Generate enhanced prompt
        enhanced_prompt = analyzer.generate_enhanced_prompt(analysis, args.typology, args.style_palette)
        
        # Extract pose keypoints
        pose_keypoints = analyzer.extract_pose_keypoints(analysis)
        
        # Generate segmentation mask
        mask = analyzer.generate_segmentation_mask(args.background, analysis)
        
        print("✅ GPT-4o Vision analysis completed successfully")
        
    except Exception as e:
        print(f"⚠️ GPT-4o Vision failed: {e}")
        print("🔄 Falling back to computer vision pipeline...")
        
        analysis = run_cv_fallback(args.background, args.pose_ref, args.typology)
        
        # Generate basic enhanced prompt
        enhanced_prompt = f"photorealistic {args.typology} lifestyle photography, natural lighting, professional quality"
        
        # Basic pose keypoints (would need MediaPipe integration)
        pose_keypoints = {"points": []}
        
        # Generate basic mask
        img = cv2.imread(args.background)
        h, w = img.shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.ellipse(mask, (w//2, int(h*0.7)), (w//8, h//4), 0, 0, 360, 255, -1)
    
    # Save outputs
    with open(f"{args.out_dir}/scene_analysis.json", "w") as f:
        json.dump(analysis, f, indent=2)
    
    with open(f"{args.out_dir}/enhanced_prompt.txt", "w") as f:
        f.write(enhanced_prompt)
    
    with open(f"{args.out_dir}/pose_keypoints.json", "w") as f:
        json.dump(pose_keypoints, f, indent=2)
    
    cv2.imwrite(f"{args.out_dir}/segmentation_mask.png", mask)
    
    print(f"📁 Outputs saved to {args.out_dir}/")
    print(f"🎯 Enhanced prompt: {enhanced_prompt[:100]}...")

if __name__ == "__main__":
    main()
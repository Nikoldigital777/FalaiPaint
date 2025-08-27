#!/usr/bin/env python3
import cv2, numpy as np, json, argparse

def analyze_scene(background_path):
    img = cv2.imread(background_path, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # quick waterline guess and lighting tag
    blue = ((hsv[:,:,0] > 85) & (hsv[:,:,0] < 135) & (hsv[:,:,1]>40) & (hsv[:,:,2]>80)).astype(np.uint8)*255
    wl = cv2.HoughLinesP(blue, 1, np.pi/180, threshold=120, minLineLength=w//3, maxLineGap=20)
    waterline_y = int((wl[:,0,1].mean()+wl[:,0,3].mean())/2) if wl is not None else None

    lighting_temp = "warm" if np.mean(hsv[:,:,2]) > 150 else "cool"
    return {"waterline_y": waterline_y, "lighting": {"temperature": lighting_temp}, "confidence": 0.8}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True)
    ap.add_argument("--out_json", default="out/scene_analysis.json")
    a = ap.parse_args()
    res = analyze_scene(a.scene)
    with open(a.out_json, "w") as f: json.dump(res, f, indent=2)
    print("Saved:", a.out_json)
#!/usr/bin/env python3
import cv2, json, numpy as np, argparse

def synth_mask_from_pose(pose_json_path, img_w, img_h, retreat=2, feather=3):
    pts = json.load(open(pose_json_path)).get("points", [])
    pts = {p["name"]:(int(p["x"]), int(p["y"])) for p in pts if p.get("conf",1)>0.2}
    m = np.zeros((img_h, img_w), np.uint8)
    limbs = [("left_shoulder","left_elbow"), ("left_elbow","left_wrist"),
             ("right_shoulder","right_elbow"), ("right_elbow","right_wrist"),
             ("left_hip","left_knee"), ("left_knee","left_ankle"),
             ("right_hip","right_knee"), ("right_knee","right_ankle"),
             ("left_shoulder","right_shoulder"), ("left_hip","right_hip"),
             ("left_shoulder","left_hip"), ("right_shoulder","right_hip")]
    for a,b in limbs:
        if a in pts and b in pts:
            cv2.line(m, pts[a], pts[b], 255, 18)
    torso = [k for k in ["left_shoulder","right_shoulder","left_hip","right_hip"] if k in pts]
    if len(torso) >= 3:
        hull = cv2.convexHull(np.array([pts[k] for k in torso]))
        cv2.fillConvexPoly(m, hull, 255)
    if retreat>0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*retreat+1,2*retreat+1))
        m = cv2.erode(m, k, iterations=1)
    if feather>0:
        m = cv2.GaussianBlur(m, (0,0), feather)
        _, m = cv2.threshold(m, 127, 255, cv2.THRESH_BINARY)
    return m

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pose_json", required=True)
    ap.add_argument("--background", required=True)
    ap.add_argument("--out_mask", default="out/segmentation_mask.png")
    ap.add_argument("--retreat", type=int, default=2)
    ap.add_argument("--feather", type=int, default=3)
    a = ap.parse_args()
    bg = cv2.imread(a.background)
    h,w = bg.shape[:2]
    m = synth_mask_from_pose(a.pose_json, w, h, a.retreat, a.feather)
    cv2.imwrite(a.out_mask, m)
    print("Saved:", a.out_mask)
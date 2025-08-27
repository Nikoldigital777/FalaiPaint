#!/usr/bin/env python3
import argparse, json, os
from qa_metrics import assess

def pick(results):
    def score(m):
        base = 1.5*m["ssim_bg"] - 0.2*m["deltaE_edge"] - 0.05*m["deltaE_bg"]
        if m["ssim_bg"] < 0.92: base -= (0.92-m["ssim_bg"])*10
        if m["deltaE_edge"] > 3.0: base -= (m["deltaE_edge"]-3.0)*2
        return base
    scores = {k: score(v) for k,v in results.items()}
    best = max(scores, key=scores.get)
    return best, scores

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True)
    ap.add_argument("--mask", required=True)
    ap.add_argument("--original", required=True)
    ap.add_argument("--qwen")
    ap.add_argument("--nano")
    ap.add_argument("--out_json", default="out/correction_report.json")
    a = ap.parse_args()

    out = {"original": assess(a.scene, a.original, a.mask)}
    if a.qwen and os.path.exists(a.qwen): out["qwen"] = assess(a.scene, a.qwen, a.mask)
    if a.nano and os.path.exists(a.nano): out["nano_banana"] = assess(a.scene, a.nano, a.mask)
    best, scores = pick(out)
    json.dump({"results": out, "scores": scores, "best": best}, open(a.out_json,"w"), indent=2)
    print("Saved:", a.out_json)
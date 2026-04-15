"""
Image forensics microservice.
Bound to 127.0.0.1:5051 — local only, never exposed to network.

Endpoints:
  POST /ela       — Error Level Analysis: detect JPEG resave artefacts indicating manipulation
  POST /deepfake  — Frequency-domain deepfake detection via DCT high-frequency energy analysis
"""
import io
import math
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageChops, ImageEnhance

app = FastAPI()


# ── ELA ───────────────────────────────────────────────────────────────────────

class ElaRequest(BaseModel):
    image_path: str
    quality: int = 90


class ElaResponse(BaseModel):
    score: float          # mean ELA pixel intensity (0–255 normalised to 0–1)
    max_score: float      # peak ELA intensity normalised
    verdict: str          # "likely_authentic" | "possibly_manipulated" | "likely_manipulated"
    ela_image_base64: str # JPEG of the ELA difference image, base64-encoded


def compute_ela(image_path: str, quality: int) -> tuple[float, float, bytes]:
    """Resave at lower quality, compute absolute difference, return stats + ELA image."""
    try:
        original = Image.open(image_path).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Cannot open image: {e}")

    # Resave at lower quality into a buffer
    buf = io.BytesIO()
    original.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    resaved = Image.open(buf).convert("RGB")

    ela_img = ImageChops.difference(original, resaved)
    extrema = ela_img.getextrema()
    max_diff = max(ex[1] for ex in extrema)
    if max_diff == 0:
        max_diff = 1
    scale = 255.0 / max_diff
    ela_enhanced = ImageEnhance.Brightness(ela_img).enhance(scale)

    arr = np.array(ela_img, dtype=np.float32)
    score = float(arr.mean() / 255.0)
    max_score = float(arr.max() / 255.0)

    out_buf = io.BytesIO()
    ela_enhanced.save(out_buf, format="JPEG", quality=85)
    return score, max_score, out_buf.getvalue()


@app.post("/ela", response_model=ElaResponse)
def ela_endpoint(req: ElaRequest):
    import base64
    if req.quality < 10 or req.quality > 99:
        raise HTTPException(status_code=400, detail="quality must be between 10 and 99")
    try:
        score, max_score, ela_bytes = compute_ela(req.image_path, req.quality)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Heuristic thresholds
    if score < 0.012:
        verdict = "likely_authentic"
    elif score < 0.030:
        verdict = "possibly_manipulated"
    else:
        verdict = "likely_manipulated"

    return ElaResponse(
        score=round(score, 5),
        max_score=round(max_score, 5),
        verdict=verdict,
        ela_image_base64=base64.b64encode(ela_bytes).decode(),
    )


# ── Deepfake detection ────────────────────────────────────────────────────────

class DeepfakeRequest(BaseModel):
    image_path: str


class DeepfakeResponse(BaseModel):
    score: float    # high-frequency energy ratio (0–1); higher → more likely synthetic
    verdict: str    # "likely_real" | "possibly_synthetic" | "likely_synthetic"
    detail: str     # human-readable explanation


def dct2(block: np.ndarray) -> np.ndarray:
    """2D DCT via separable 1D transforms (scipy if available, otherwise manual)."""
    try:
        from scipy.fft import dctn
        return dctn(block, norm="ortho")
    except ImportError:
        # Manual N×N DCT-II
        N = block.shape[0]
        result = np.zeros_like(block, dtype=np.float64)
        n = np.arange(N)
        for k in range(N):
            result[k] = np.sum(block * np.cos(math.pi * k * (2 * n + 1) / (2 * N)))
        return result


def high_freq_energy_ratio(gray: np.ndarray, block_size: int = 8) -> float:
    """
    Split the grayscale image into 8×8 blocks, compute DCT of each block,
    and return the fraction of energy in high-frequency coefficients.
    Synthetic/GAN images tend to have suppressed high-frequency energy.
    """
    h, w = gray.shape
    h_trim = (h // block_size) * block_size
    w_trim = (w // block_size) * block_size
    gray = gray[:h_trim, :w_trim].astype(np.float64)

    total_energy = 0.0
    hf_energy = 0.0

    for i in range(0, h_trim, block_size):
        for j in range(0, w_trim, block_size):
            block = gray[i:i+block_size, j:j+block_size]
            d = dct2(block)
            d_sq = d ** 2
            total_energy += d_sq.sum()
            # High-frequency: coefficients where (u + v) > block_size (bottom-right triangle)
            for u in range(block_size):
                for v in range(block_size):
                    if u + v > block_size:
                        hf_energy += d_sq[u, v]

    if total_energy == 0:
        return 0.0
    return hf_energy / total_energy


@app.post("/deepfake", response_model=DeepfakeResponse)
def deepfake_endpoint(req: DeepfakeRequest):
    try:
        img = Image.open(req.image_path).convert("L")  # grayscale
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Cannot open image: {e}")

    # Resize to max 512px to keep processing fast
    max_dim = 512
    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    gray = np.array(img, dtype=np.float64)
    score = high_freq_energy_ratio(gray)

    # Real photos have high HF energy; GAN/diffusion images suppress it
    # Invert: report "deepfake score" as 1 - hf_ratio (normalised)
    deepfake_score = round(max(0.0, min(1.0, 1.0 - score * 3.5)), 4)

    if deepfake_score < 0.35:
        verdict = "likely_real"
        detail = f"High-frequency energy ratio ({score:.4f}) consistent with a real photograph."
    elif deepfake_score < 0.65:
        verdict = "possibly_synthetic"
        detail = f"Moderate high-frequency suppression ({score:.4f}) — may be synthetic or heavily processed."
    else:
        verdict = "likely_synthetic"
        detail = f"Low high-frequency energy ({score:.4f}) typical of GAN or diffusion-generated images."

    return DeepfakeResponse(score=deepfake_score, verdict=verdict, detail=detail)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5051, log_level="warning")

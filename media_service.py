"""
Media analysis microservice — speaker diarization.
Bound to 127.0.0.1:5052 — local only, never exposed to network.

Endpoints:
  POST /diarize  — speaker diarization using resemblyzer embeddings + agglomerative clustering
"""
import os
import io
import tempfile
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI()


# ── Diarization ───────────────────────────────────────────────────────────────

class DiarizeRequest(BaseModel):
    audio_path: str
    num_speakers: Optional[int] = None  # None = auto-detect


class Segment(BaseModel):
    speaker: str
    start: float
    end: float
    duration: float


class DiarizeResponse(BaseModel):
    segments: list[Segment]
    num_speakers: int
    duration: float


def resample_numpy(data: np.ndarray, orig_sr: int, target_sr: int = 16000) -> np.ndarray:
    """Linear interpolation resampling — no Fortran compiler required."""
    if orig_sr == target_sr:
        return data
    target_len = int(round(len(data) * target_sr / orig_sr))
    x_orig = np.linspace(0.0, 1.0, len(data))
    x_target = np.linspace(0.0, 1.0, target_len)
    return np.interp(x_target, x_orig, data).astype(np.float32)


def load_wav_mono_16k(path: str) -> tuple[np.ndarray, float]:
    """Load any audio file as 16kHz mono float32 array. Returns (samples, duration_seconds)."""
    try:
        import soundfile as sf
        data, sr = sf.read(path, dtype='float32', always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr != 16000:
            # Prefer scipy polyphase resampler (higher quality); fall back to numpy interp
            try:
                from scipy.signal import resample_poly
                from math import gcd
                g = gcd(16000, sr)
                data = resample_poly(data, 16000 // g, sr // g).astype(np.float32)
            except ImportError:
                data = resample_numpy(data, sr)
        return data, len(data) / 16000.0
    except ImportError:
        raise HTTPException(status_code=503, detail="soundfile not installed")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Cannot read audio: {e}")


def diarize_resemblyzer(audio: np.ndarray, num_speakers: Optional[int]) -> list[dict]:
    """
    Sliding-window speaker diarization using resemblyzer d-vectors.
    Returns list of {speaker, start, end} dicts.
    """
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav
    except ImportError:
        raise HTTPException(status_code=503, detail="resemblyzer not installed")

    try:
        from sklearn.cluster import AgglomerativeClustering
        from sklearn.preprocessing import normalize
    except ImportError:
        raise HTTPException(status_code=503, detail="scikit-learn not installed")

    encoder = VoiceEncoder()
    wav = preprocess_wav(audio, source_sr=16000)

    # Sliding window: 3 s window, 1 s step
    win = 48000   # 3 s at 16kHz
    step = 16000  # 1 s
    embeddings = []
    windows = []
    for start in range(0, max(1, len(wav) - win), step):
        chunk = wav[start:start + win]
        if len(chunk) < win // 2:
            break
        emb = encoder.embed_utterance(chunk)
        embeddings.append(emb)
        windows.append((start / 16000.0, (start + len(chunk)) / 16000.0))

    if not embeddings:
        return []

    X = normalize(np.array(embeddings))

    # Determine number of clusters
    n_clusters = num_speakers if num_speakers and num_speakers >= 2 else None
    if n_clusters is None:
        # Estimate: try 2..min(8, len) and pick elbow by inertia-like metric
        best_k = 2
        best_score = float('inf')
        for k in range(2, min(9, len(embeddings))):
            from sklearn.cluster import KMeans
            km = KMeans(n_clusters=k, n_init=5, random_state=0)
            km.fit(X)
            score = km.inertia_ / k
            if score < best_score:
                best_score = score
                best_k = k
        n_clusters = best_k

    clustering = AgglomerativeClustering(n_clusters=n_clusters, metric='cosine', linkage='average')
    labels = clustering.fit_predict(X)

    # Build segments, merging consecutive windows with same label
    segments = []
    for i, (label, (t_start, t_end)) in enumerate(zip(labels, windows)):
        speaker = f"Speaker {label + 1}"
        if segments and segments[-1]['speaker'] == speaker:
            segments[-1]['end'] = t_end
        else:
            segments.append({'speaker': speaker, 'start': t_start, 'end': t_end})

    return segments


@app.post("/diarize", response_model=DiarizeResponse)
def diarize_endpoint(req: DiarizeRequest):
    if not os.path.exists(req.audio_path):
        raise HTTPException(status_code=422, detail="File not found")

    audio, duration = load_wav_mono_16k(req.audio_path)
    raw_segments = diarize_resemblyzer(audio, req.num_speakers)

    segments = [
        Segment(
            speaker=s['speaker'],
            start=round(s['start'], 2),
            end=round(s['end'], 2),
            duration=round(s['end'] - s['start'], 2),
        )
        for s in raw_segments
    ]

    speakers = set(s.speaker for s in segments)
    return DiarizeResponse(
        segments=segments,
        num_speakers=len(speakers),
        duration=round(duration, 2),
    )


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5052, log_level="warning")

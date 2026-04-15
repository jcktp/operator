"""
Facial recognition microservice using DeepFace.
Bound to 127.0.0.1:5050 — local only, never exposed to network.

Endpoints:
  POST /extract  — detect faces and return ArcFace embeddings + bounding boxes
  POST /compare  — 1:1 face verification
  POST /search   — cosine similarity search over a list of candidate embeddings
"""
import uuid
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

THRESHOLD = 0.68


# ── Request / response models ─────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    image_path: str


class CompareRequest(BaseModel):
    image_a: str
    image_b: str


class Candidate(BaseModel):
    id: str
    embedding: list[float]


class SearchRequest(BaseModel):
    probe_embedding: list[float]
    candidates: list[Candidate]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/extract")
def extract(req: ExtractRequest):
    try:
        from deepface import DeepFace
        result = DeepFace.represent(
            img_path=req.image_path,
            model_name="ArcFace",
            detector_backend="retinaface",
            enforce_detection=False,
        )
        faces = []
        for r in result:
            faces.append({
                "id": str(uuid.uuid4()),
                "bbox": [
                    r["facial_area"]["x"],
                    r["facial_area"]["y"],
                    r["facial_area"]["w"],
                    r["facial_area"]["h"],
                ],
                "embedding": r["embedding"],
            })
        return {"faces": faces}
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/compare")
def compare(req: CompareRequest):
    try:
        from deepface import DeepFace
        result = DeepFace.verify(
            img1_path=req.image_a,
            img2_path=req.image_b,
            model_name="ArcFace",
            detector_backend="retinaface",
            enforce_detection=False,
        )
        return {
            "verified": result["verified"],
            "distance": result["distance"],
            "threshold": result["threshold"],
            "model": "ArcFace",
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/search")
def search(req: SearchRequest):
    probe = np.array(req.probe_embedding, dtype=np.float32)
    probe_norm = np.linalg.norm(probe)
    if probe_norm > 0:
        probe = probe / probe_norm

    matches = []
    for candidate in req.candidates:
        vec = np.array(candidate.embedding, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        distance = float(1.0 - np.dot(probe, vec))
        if distance <= THRESHOLD:
            matches.append({"id": candidate.id, "distance": round(distance, 4)})

    matches.sort(key=lambda x: x["distance"])
    return {"matches": matches}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5050, log_level="info")

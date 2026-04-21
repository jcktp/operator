/**
 * Image forensics — TypeScript replacement for analysis_service.py.
 *
 * Two analyses, both pure image math (no ML models):
 *   1. ELA (Error Level Analysis) — resave JPEG at lower quality, diff pixels
 *   2. Deepfake detection — DCT high-frequency energy ratio per 8×8 block
 *
 * Uses sharp (bundled with Next.js) for image I/O and JPEG re-encoding.
 */

import sharp from 'sharp'

// ── ELA ──────────────────────────────────────────────────────────────────────

export interface ElaResult {
  score: number           // mean ELA intensity (0–1)
  max_score: number       // peak ELA intensity (0–1)
  verdict: string         // 'likely_authentic' | 'possibly_manipulated' | 'likely_manipulated'
  ela_image_base64: string // brightened ELA diff image as JPEG base64
}

/**
 * Error Level Analysis: resave the image as JPEG at `quality`, compute the
 * absolute pixel difference, then brighten to make edits visible.
 */
export async function computeEla(imagePath: string, quality = 90): Promise<ElaResult> {
  // Load original as raw RGB pixels
  const original = sharp(imagePath).removeAlpha()
  const { width, height } = await original.metadata() as { width: number; height: number }
  const origBuf = await original.raw().toBuffer()

  // Resave at lower quality and decode back
  const resavedBuf = await sharp(imagePath)
    .removeAlpha()
    .jpeg({ quality })
    .toBuffer()
  const resavedPixels = await sharp(resavedBuf).raw().toBuffer()

  // Compute absolute difference per channel
  const len = origBuf.length
  const diff = Buffer.alloc(len)
  let sum = 0
  let max = 0

  for (let i = 0; i < len; i++) {
    const d = Math.abs(origBuf[i] - resavedPixels[i])
    diff[i] = d
    sum += d
    if (d > max) max = d
  }

  const score = sum / len / 255
  const maxScore = max / 255

  // Brighten the diff image (scale so max → 255)
  const scale = max > 0 ? 255 / max : 1
  const enhanced = Buffer.alloc(len)
  for (let i = 0; i < len; i++) {
    enhanced[i] = Math.min(255, Math.round(diff[i] * scale))
  }

  const elaJpeg = await sharp(enhanced, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 85 })
    .toBuffer()

  let verdict: string
  if (score < 0.012) verdict = 'likely_authentic'
  else if (score < 0.030) verdict = 'possibly_manipulated'
  else verdict = 'likely_manipulated'

  return {
    score: Math.round(score * 100000) / 100000,
    max_score: Math.round(maxScore * 100000) / 100000,
    verdict,
    ela_image_base64: elaJpeg.toString('base64'),
  }
}

// ── Deepfake detection ───────────────────────────────────────────────────────

export interface DeepfakeResult {
  score: number    // 0–1; higher = more likely synthetic
  verdict: string  // 'likely_real' | 'possibly_synthetic' | 'likely_synthetic'
  detail: string
}

/**
 * 1D DCT-II (orthonormal) for a row of length N.
 * Used as a building block for the separable 2D DCT.
 */
function dct1d(input: Float64Array): Float64Array {
  const N = input.length
  const out = new Float64Array(N)
  for (let k = 0; k < N; k++) {
    let s = 0
    for (let n = 0; n < N; n++) {
      s += input[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N))
    }
    out[k] = s
  }
  return out
}

/**
 * 2D DCT via separable 1D transforms on an 8×8 block.
 * Returns the DCT coefficients in a flat Float64Array of length 64.
 */
function dct2d8x8(block: Float64Array): Float64Array {
  const N = 8
  const temp = new Float64Array(64)

  // Row-wise DCT
  for (let r = 0; r < N; r++) {
    const row = block.subarray(r * N, r * N + N)
    const transformed = dct1d(row)
    for (let c = 0; c < N; c++) temp[r * N + c] = transformed[c]
  }

  // Column-wise DCT
  const result = new Float64Array(64)
  const col = new Float64Array(N)
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < N; r++) col[r] = temp[r * N + c]
    const transformed = dct1d(col)
    for (let r = 0; r < N; r++) result[r * N + c] = transformed[r]
  }

  return result
}

/**
 * Compute the high-frequency energy ratio across all 8×8 blocks.
 * Synthetic/GAN images tend to have suppressed high-frequency energy.
 */
function highFreqEnergyRatio(gray: Float64Array, width: number, height: number): number {
  const B = 8
  const hTrim = Math.floor(height / B) * B
  const wTrim = Math.floor(width / B) * B

  let totalEnergy = 0
  let hfEnergy = 0

  for (let y = 0; y < hTrim; y += B) {
    for (let x = 0; x < wTrim; x += B) {
      // Extract 8×8 block
      const block = new Float64Array(64)
      for (let r = 0; r < B; r++) {
        for (let c = 0; c < B; c++) {
          block[r * B + c] = gray[(y + r) * width + (x + c)]
        }
      }

      const dct = dct2d8x8(block)

      for (let u = 0; u < B; u++) {
        for (let v = 0; v < B; v++) {
          const sq = dct[u * B + v] ** 2
          totalEnergy += sq
          if (u + v > B) hfEnergy += sq
        }
      }
    }
  }

  return totalEnergy === 0 ? 0 : hfEnergy / totalEnergy
}

/**
 * Frequency-domain deepfake detection.
 * Resizes to max 512px, converts to grayscale, runs DCT analysis.
 */
export async function detectDeepfake(imagePath: string): Promise<DeepfakeResult> {
  // Load as grayscale, resize to max 512px
  let img = sharp(imagePath).greyscale()
  const meta = await img.metadata() as { width: number; height: number }
  const maxDim = 512

  if (Math.max(meta.width, meta.height) > maxDim) {
    const scale = maxDim / Math.max(meta.width, meta.height)
    img = img.resize(Math.round(meta.width * scale), Math.round(meta.height * scale))
  }

  const { info, data } = await img.raw().toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height

  // Convert to Float64Array
  const gray = new Float64Array(data.length)
  for (let i = 0; i < data.length; i++) gray[i] = data[i]

  const hfRatio = highFreqEnergyRatio(gray, width, height)

  // Real photos have high HF energy; GAN/diffusion images suppress it
  const deepfakeScore = Math.round(Math.max(0, Math.min(1, 1 - hfRatio * 3.5)) * 10000) / 10000

  let verdict: string
  let detail: string

  if (deepfakeScore < 0.35) {
    verdict = 'likely_real'
    detail = `High-frequency energy ratio (${hfRatio.toFixed(4)}) consistent with a real photograph.`
  } else if (deepfakeScore < 0.65) {
    verdict = 'possibly_synthetic'
    detail = `Moderate high-frequency suppression (${hfRatio.toFixed(4)}) — may be synthetic or heavily processed.`
  } else {
    verdict = 'likely_synthetic'
    detail = `Low high-frequency energy (${hfRatio.toFixed(4)}) typical of GAN or diffusion-generated images.`
  }

  return { score: deepfakeScore, verdict, detail }
}

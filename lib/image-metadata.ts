// Image EXIF / metadata extraction using exifr
// Returns a flat key→string map suitable for display, or null if nothing useful found.

export async function extractImageMetadata(
  buffer: Buffer,
  fileName: string
): Promise<Record<string, string> | null> {
  const result: Record<string, string> = {}

  try {
    const exifr = await import('exifr')
    const raw = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      icc: false,
      iptc: false,
      jfif: false,
      ihdr: true,
    }).catch(() => null)

    if (raw) {
      // Date taken
      if (raw.DateTimeOriginal) {
        result['Date taken'] = new Date(raw.DateTimeOriginal).toLocaleString()
      } else if (raw.DateTime) {
        result['Date'] = new Date(raw.DateTime).toLocaleString()
      }

      // Camera
      if (raw.Make || raw.Model) {
        result['Camera'] = [raw.Make, raw.Model].filter(Boolean).join(' ').trim()
      }

      // Dimensions
      if (raw.ImageWidth && raw.ImageHeight) {
        result['Dimensions'] = `${raw.ImageWidth} × ${raw.ImageHeight} px`
      } else if (raw.ExifImageWidth && raw.ExifImageHeight) {
        result['Dimensions'] = `${raw.ExifImageWidth} × ${raw.ExifImageHeight} px`
      }

      // GPS
      if (raw.latitude != null && raw.longitude != null) {
        const lat = raw.latitude.toFixed(6)
        const lon = raw.longitude.toFixed(6)
        result['GPS'] = `${lat}, ${lon}`
      }

      // Exposure / lens info (photojournalism-relevant)
      if (raw.FocalLength) result['Focal length'] = `${raw.FocalLength} mm`
      if (raw.ExposureTime) result['Exposure'] = `1/${Math.round(1 / raw.ExposureTime)}s`
      if (raw.FNumber) result['Aperture'] = `f/${raw.FNumber}`
      if (raw.ISOSpeedRatings) result['ISO'] = String(raw.ISOSpeedRatings)

      // Software
      if (raw.Software) result['Software'] = String(raw.Software).trim()
    }
  } catch {
    // exifr not available or parse failed — fall back to basic info only
  }

  // Always include format + size from file name
  const ext = fileName.split('.').pop()?.toUpperCase()
  if (ext) result['Format'] = ext

  return Object.keys(result).length > 0 ? result : null
}

/**
 * file-cleaner-shared.ts
 *
 * Constants shared between the client (FileCleanerClient) and server (lib/file-cleaner.ts, API routes).
 * No Node.js-only imports — safe to use in client components.
 */

// MAT2 supported extensions (derived from `mat2 --list`).
// Runtime check via /api/files/metadata is authoritative; this is used for UI pre-filtering.
export const MAT2_EXTENSIONS = new Set([
  'pdf', 'docx', 'docm', 'doc',
  'xlsx', 'xlsm', 'xls',
  'pptx', 'pptm', 'ppt',
  'odt', 'ods', 'odp', 'odg', 'odc', 'odi',
  'epub', 'ncx',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'ppm', 'webp',
  'mp3', 'm4a', 'mp2', 'flac', 'ogg', 'opus', 'oga', 'spx',
  'mp4', 'wmv', 'avi',
  'svg', 'svgz',
  'zip', 'tar',
  'torrent',
])

// ExifTool primary stripping targets for writing
export const EXIFTOOL_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'tiff', 'tif', 'gif', 'webp', 'heic',
  'mp3', 'm4a', 'flac', 'ogg', 'wav', 'aac', 'opus',
  'mp4', 'mov', 'avi', 'mkv',
  'pdf',
])

// Tag key prefixes considered sensitive — highlighted in the metadata inspector
export const SENSITIVE_TAG_PREFIXES = [
  'gps', 'author', 'creator', 'artist', 'copyright', 'owner',
  'email', 'phone', 'address', 'serial', 'uniqueimage',
  'cameraserialnum', 'deviceserialnum',
]

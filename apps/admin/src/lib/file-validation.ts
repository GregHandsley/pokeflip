/**
 * File upload validation utilities
 * Validates file type, size, and content to prevent malicious uploads
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024, // 10MB for images
  document: 5 * 1024 * 1024, // 5MB for documents
} as const;

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

// Magic numbers for file type detection (first bytes of file)
const FILE_SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  "image/webp": [
    [0x52, 0x49, 0x46, 0x46],
    [0x57, 0x45, 0x42, 0x50],
  ], // RIFF...WEBP
};

/**
 * Reads the first bytes of a file to detect its actual type (magic number check)
 */
async function getFileSignature(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.slice(0, 16).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Validates file type using magic numbers (file signatures)
 */
async function validateFileSignature(file: File, expectedMimeType: string): Promise<boolean> {
  try {
    const signature = await getFileSignature(file);
    const expectedSignatures = FILE_SIGNATURES[expectedMimeType];

    if (!expectedSignatures) {
      // If we don't have a signature for this type, allow it if MIME type matches
      return true;
    }

    // Check if the file signature matches any expected signature
    for (const expectedSig of expectedSignatures) {
      let matches = true;
      for (let i = 0; i < expectedSig.length; i++) {
        if (signature[i] !== expectedSig[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }

    // Special case for WEBP: check for RIFF header (bytes 0-3) and WEBP string (bytes 8-11)
    if (expectedMimeType === "image/webp" && signature.length >= 12) {
      if (
        signature[0] === 0x52 && // R
        signature[1] === 0x49 && // I
        signature[2] === 0x46 && // F
        signature[3] === 0x46 && // F
        signature[8] === 0x57 && // W
        signature[9] === 0x45 && // E
        signature[10] === 0x42 && // B
        signature[11] === 0x50 // P
      ) {
        return true;
      }
    }

    return false;
  } catch {
    // If we can't read the signature, fail validation for safety
    return false;
  }
}

/**
 * Validates an image file upload
 * Checks: file type, size, and content (magic numbers)
 */
export async function validateImageFile(
  file: File,
  maxSizeBytes: number = MAX_FILE_SIZES.image
): Promise<FileValidationResult> {
  // Check if file exists
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }

  // Validate file extension matches MIME type
  const extension = file.name.split(".").pop()?.toLowerCase();
  const extensionMap: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
  };

  const allowedExtensions = extensionMap[file.type];
  if (extension && allowedExtensions && !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: "File extension does not match file type",
    };
  }

  // Validate file content using magic numbers
  const signatureValid = await validateFileSignature(file, file.type);
  if (!signatureValid) {
    return {
      valid: false,
      error:
        "File content does not match declared file type (possible file corruption or spoofing)",
    };
  }

  // Additional validation: check for suspicious patterns
  // This is a basic check - in production, you might want more sophisticated scanning
  if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
    return {
      valid: false,
      error: "Invalid filename (contains illegal characters)",
    };
  }

  return { valid: true };
}

/**
 * Gets a safe filename for storage (sanitized)
 */
export function getSafeFilename(originalFilename: string, prefix: string = ""): string {
  // Extract extension
  const lastDot = originalFilename.lastIndexOf(".");
  const extension = lastDot >= 0 ? originalFilename.substring(lastDot + 1).toLowerCase() : "";
  const nameWithoutExt = lastDot >= 0 ? originalFilename.substring(0, lastDot) : originalFilename;

  // Sanitize the filename
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9_-]/g, "_") // Replace special chars with underscore
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .substring(0, 100); // Limit length

  const finalName = prefix ? `${prefix}_${sanitized}` : sanitized;

  // Ensure filename is not empty
  if (!finalName) {
    return prefix || "file";
  }

  return extension ? `${finalName}.${extension}` : finalName;
}

/**
 * Validates file kind parameter
 */
export function validateFileKind(kind: string, allowedKinds: string[]): string | null {
  if (!kind || typeof kind !== "string") {
    return null;
  }

  const normalized = kind.toLowerCase().trim();
  if (allowedKinds.includes(normalized)) {
    return normalized;
  }

  return null;
}

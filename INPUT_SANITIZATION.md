# Input Sanitization and Validation

This document outlines the input sanitization and file validation measures implemented to prevent XSS attacks and malicious file uploads.

## 1. Text Input Sanitization ✅

**Location**: `apps/admin/src/lib/sanitization.ts`

### Functions:

- `sanitizeString(input: string)` - Removes/escapes dangerous HTML/JavaScript from user input
- `sanitizeForDisplay(input: string)` - Sanitizes for display (allows some HTML, removes dangerous content)
- `sanitizeFilename(filename: string)` - Sanitizes filenames to prevent directory traversal
- `sanitizeUrl(url: string)` - Validates and sanitizes URLs
- `sanitizeEmail(email: string)` - Validates and sanitizes email addresses

### Integration:

**Location**: `apps/admin/src/lib/validation.ts`

New validation functions that automatically sanitize:

- `sanitizedString(value, fieldName)` - Validates and sanitizes strings
- `sanitizedNonEmptyString(value, fieldName)` - Validates and sanitizes required strings
- `sanitizedHtmlString(value, fieldName)` - Sanitizes HTML content for display

### Applied To:

- ✅ Bundle names and descriptions (`/api/admin/bundles`)
- ✅ Buyer handles (`/api/admin/sales/create`, `/api/admin/bundles/[bundleId]/sell`)
- ✅ Bundle updates (`/api/admin/bundles/[bundleId]`)

### Still To Apply:

- Acquisition source names and notes (currently client-side only)
- Listing titles and descriptions
- Notes fields throughout the application

## 2. File Upload Validation ✅

**Location**: `apps/admin/src/lib/file-validation.ts`

### Features:

- **MIME Type Validation**: Checks declared file type
- **File Size Limits**: 10MB maximum for images
- **Content Validation**: Magic number checks to verify actual file type
- **Filename Sanitization**: Prevents directory traversal and dangerous filenames
- **Extension Validation**: Ensures file extension matches MIME type

### Allowed Image Types:

- `image/jpeg` / `image/jpg`
- `image/png`
- `image/webp`
- `image/gif`

### Magic Number Checks:

The validation verifies file signatures (first bytes) to ensure:

- JPEG files start with `FF D8 FF`
- PNG files start with `89 50 4E 47 0D 0A 1A 0A`
- GIF files start with `47 49 46 38 37 61` or `47 49 46 38 39 61`
- WEBP files have RIFF header with WEBP signature

### Applied To:

- ✅ Lot photo uploads (`/api/admin/lots/[lotId]/photos/upload`)
- ✅ Intake line photo uploads (`/api/admin/intake-lines/[lineId]/photos/upload`)
- ✅ Bundle photo uploads (`/api/admin/bundles/[bundleId]/photos/upload`)
- ✅ Client-side validation in upload components

## 3. Client-Side Validation

### File Upload Components:

Updated components now validate:

- File type (MIME type check)
- File size (10MB limit)
- Allowed image types list

**Components Updated:**

- `LotDetailModal.tsx`
- `LotPhotoUpload.tsx`
- `IntakeLinePhotoUpload.tsx`
- `SalesFlowModal.tsx`

### Client-Side Sanitization:

For client-side text inputs, React's built-in escaping handles most XSS automatically. However, for data that will be stored:

- Use `sanitizeString()` from `@/lib/sanitization` before sending to API
- Consider creating a client-side sanitization utility wrapper

## 4. Server-Side Validation

All file uploads are validated on the server using:

1. **Type Check**: MIME type validation
2. **Size Check**: File size limits
3. **Content Check**: Magic number verification (actual file type)
4. **Filename Sanitization**: Safe filename generation
5. **Kind Validation**: Validates file kind parameter

## 5. Security Best Practices

### XSS Prevention:

- ✅ All user text inputs are sanitized before storage
- ✅ React automatically escapes content in JSX (prevents most XSS)
- ⚠️ If rendering user content as HTML, use `sanitizeForDisplay()`
- ⚠️ Never use `dangerouslySetInnerHTML` with unsanitized user content

### File Upload Security:

- ✅ Server validates file type, size, and content
- ✅ Filenames are sanitized to prevent path traversal
- ✅ Only allowed MIME types are accepted
- ✅ Magic number checks verify actual file type
- ✅ Files are stored in private buckets with signed URLs

### Recommended Next Steps:

1. **Create API endpoint for acquisitions** - Currently client-side only, should have server-side validation
2. **Add Content Security Policy (CSP)** - Additional XSS protection
3. **Rate limiting on uploads** - Prevent abuse
4. **File scanning** - Consider virus scanning for uploads in production
5. **Client-side sanitization wrapper** - Create React hook for easy sanitization

## 6. Usage Examples

### Server-Side (API Routes):

```typescript
import { sanitizedNonEmptyString, sanitizedString } from "@/lib/validation";

// Required field
const name = sanitizedNonEmptyString(body.name, "name");

// Optional field
const description = optional(
  body.description,
  (v) => sanitizedString(v, "description"),
  "description"
);
```

### File Upload Validation:

```typescript
import { validateImageFile, getSafeFilename } from "@/lib/file-validation";

const validation = await validateImageFile(file);
if (!validation.valid) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}

const safeFilename = getSafeFilename(file.name, "photo");
```

### Client-Side:

```typescript
import { sanitizeString } from "@/lib/sanitization";

// Before sending to API
const sanitizedInput = sanitizeString(userInput);
```

## 7. Testing

### Manual Testing Checklist:

- [ ] Test XSS payloads in text inputs (e.g., `<script>alert('xss')</script>`)
- [ ] Test file uploads with:
  - [ ] Valid images (JPEG, PNG, WebP, GIF)
  - [ ] Files with wrong extension (e.g., `.jpg` but actual PNG)
  - [ ] Files exceeding size limit
  - [ ] Non-image files (e.g., `.exe`, `.php`)
  - [ ] Files with malicious filenames (`../../../etc/passwd`)
- [ ] Verify sanitized content is stored correctly
- [ ] Verify files are validated on both client and server

### Automated Testing:

Consider adding tests for:

- Sanitization functions
- File validation functions
- API endpoints with malicious inputs

## Notes

- Sanitization is applied at the validation layer, ensuring consistency
- File validation happens both client-side (UX) and server-side (security)
- Magic number checks prevent MIME type spoofing
- Filenames are always sanitized to prevent path traversal attacks
- React's automatic escaping provides additional XSS protection in the UI

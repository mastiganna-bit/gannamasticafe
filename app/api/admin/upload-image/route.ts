import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_INPUT_BYTES = 5 * 1024 * 1024
const MAX_OUTPUT_BYTES = 200 * 1024

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'Choose an image to upload.', 'FILE_REQUIRED')
    if (file.size > MAX_INPUT_BYTES) throw new ApiError(400, 'Source image must be smaller than 5 MB.', 'FILE_TOO_LARGE')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new ApiError(400, 'Only PNG, JPEG, and WebP images are accepted.', 'INVALID_FILE_TYPE')
    }

    const input = Buffer.from(await file.arrayBuffer())
    const metadata = await sharp(input, { failOn: 'error', limitInputPixels: 25_000_000 }).metadata()
    if (!metadata.width || !metadata.height || !['png', 'jpeg', 'webp'].includes(metadata.format || '')) {
      throw new ApiError(400, 'The uploaded file is not a valid image.', 'INVALID_IMAGE')
    }

    let quality = 82
    let maxWidth = 1400
    let output: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    while (quality >= 52) {
      output = await sharp(input, { failOn: 'error' })
        .rotate()
        .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toBuffer()
      if (output.length <= MAX_OUTPUT_BYTES) break
      quality -= 8
      if (quality < 65) maxWidth = 1000
    }
    if (output.length > MAX_OUTPUT_BYTES) throw new ApiError(400, 'Image could not be compressed below 200 KB. Choose a simpler photo.', 'IMAGE_TOO_COMPLEX')

    const admin = createAdminClient()
    const filename = `menu/${crypto.randomUUID()}.webp`
    const { error } = await admin.storage.from('menu-images').upload(filename, output, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw new ApiError(500, 'Image storage is not configured.', 'STORAGE_FAILED')
    const { data } = admin.storage.from('menu-images').getPublicUrl(filename)
    return NextResponse.json({ success: true, url: data.publicUrl, bytes: output.length, width: metadata.width, height: metadata.height })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

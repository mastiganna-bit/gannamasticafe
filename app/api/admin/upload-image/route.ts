import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is logged in
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify user has admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Parse form data file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate image mimetype
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 4. Ensure storage bucket exists
    const { data: buckets } = await adminSupabase.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === 'menu-images')

    if (!bucketExists) {
      const { error: bucketError } = await adminSupabase.storage.createBucket('menu-images', {
        public: true,
        allowedMimeTypes: validTypes,
        fileSizeLimit: 5242880 // 5MB limit
      })
      if (bucketError) {
        console.error('Error creating bucket:', bucketError)
        return NextResponse.json({ error: 'Failed to initialize storage bucket' }, { status: 500 })
      }
    }

    // 5. Upload image file to bucket
    const buffer = await file.arrayBuffer()
    const sanitizeName = file.name.replace(/[^a-zA-Z0-9.]/g, '')
    const filename = `menu-item-${Date.now()}-${sanitizeName}`

    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('menu-images')
      .upload(filename, Buffer.from(buffer), {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('File upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // 6. Get Public URL
    const { data: { publicUrl } } = adminSupabase.storage
      .from('menu-images')
      .getPublicUrl(filename)

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error) {
    console.error('Image upload endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

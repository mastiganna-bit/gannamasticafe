import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { postgresUuidSchema } from '@/lib/server/validation'
import { createAdminClient } from '@/lib/supabase/admin'

const imageSchema = z.string().trim().max(500).refine((value) => value.startsWith('/') || /^https:\/\//.test(value), 'Use a secure image URL or local path.')
const sizeSchema = z.object({ id: postgresUuidSchema.optional(), label: z.string().trim().min(1).max(40), pricePaise: z.number().int().min(0).max(10_000_000), extraCheesePricePaise: z.number().int().min(0).max(100_000), isAvailable: z.boolean() })
const itemSchema = z.object({
  id: postgresUuidSchema.optional(), name: z.string().trim().min(2).max(100), description: z.string().trim().max(500),
  category: z.string().trim().min(2).max(80), imagePath: imageSchema, isAvailable: z.boolean(),
  allowExtraCheese: z.boolean(), noMayonnaise: z.boolean(), defaultSizeIndex: z.number().int().min(0),
  sizes: z.array(sizeSchema).min(1).max(20),
})

export async function GET() {
  try {
    await requireAdmin(); const admin = createAdminClient()
    const { data, error } = await admin.from('menu_items').select('*,menu_item_sizes(*)').is('archived_at', null).order('sort_order').order('category').order('name')
    if (error) throw error
    return NextResponse.json({ items: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiErrorResponse(error) }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(); const input = itemSchema.parse(await request.json())
    if (input.defaultSizeIndex >= input.sizes.length) throw new ApiError(400, 'Choose a valid default size.', 'INVALID_DEFAULT_SIZE')
    const admin = createAdminClient()
    const { data: id, error } = await admin.rpc('admin_save_menu_item', { payload: input })
    if (error || !id) throw error || new Error('Menu item was not created.')
    return NextResponse.json({ success:true,id },{status:201})
  } catch (error) { return apiErrorResponse(error) }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(); const input = itemSchema.extend({id:postgresUuidSchema}).parse(await request.json())
    if (input.defaultSizeIndex >= input.sizes.length) throw new ApiError(400, 'Choose a valid default size.', 'INVALID_DEFAULT_SIZE')
    const { error } = await createAdminClient().rpc('admin_save_menu_item', { payload: input })
    if (error) throw error
    return NextResponse.json({success:true})
  } catch(error){return apiErrorResponse(error)}
}

export async function DELETE(request:Request){try{await requireAdmin();const {id}=z.object({id:postgresUuidSchema}).parse(await request.json());const {error}=await createAdminClient().from('menu_items').update({is_available:false,archived_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;return NextResponse.json({success:true})}catch(error){return apiErrorResponse(error)}}

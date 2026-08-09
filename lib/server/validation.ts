import { z } from 'zod'

export const indianPhoneSchema = z.string().trim().transform((value, ctx) => {
  const digits = value.replace(/\D/g, '')
  const national = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
  if (!/^[6-9]\d{9}$/.test(national)) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number.' })
    return z.NEVER
  }
  return `+91${national}`
})
export const passwordSchema = z.string()
  .min(8, 'Password must contain at least 8 characters.')
  .max(72, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.')

export const uuidSchema = z.string().uuid()

export const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(30).default('Home'),
  recipientName: z.string().trim().min(2).max(80),
  phone: indianPhoneSchema,
  house: z.string().trim().min(1).max(120),
  area: z.string().trim().min(2).max(160),
  landmark: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().min(2).max(80).default('Rohtak'),
  postalCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().default(false),
})

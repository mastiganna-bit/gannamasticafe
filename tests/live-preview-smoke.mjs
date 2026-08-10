import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const required = ['PREVIEW_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`)
}

const previewUrl = process.env.PREVIEW_URL.replace(/\/$/, '')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const tempDirectory = resolve('.backups', 'live-preview-smoke')
const createdUserIds = []
let createdOrderId = null
let originalStoreSettings = null
let storeSettingsId = null
let storeSettingsModified = false
let phase = 'initialization'

mkdirSync(tempDirectory, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function randomPhone(suffix) {
  const seed = Number.parseInt(randomBytes(3).toString('hex'), 16) % 100000
  return `+9198${String(seed).padStart(6, '0')}${suffix}`
}

async function createTestUser({ role, suffix, isAdmin = false }) {
  const phone = randomPhone(suffix)
  const password = `Qa!${randomBytes(12).toString('hex')}`
  const fullName = `Codex ${role} smoke test`
  const { data, error } = await admin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
    user_metadata: { role, full_name: fullName },
  })
  if (error || !data.user) throw error || new Error(`Could not create ${role} test user`)
  createdUserIds.push(data.user.id)

  const { error: profileError } = await admin.from('profiles').upsert({
    id: data.user.id,
    full_name: fullName,
    phone,
    role,
    is_admin: isAdmin,
    phone_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (profileError) throw profileError
  return { id: data.user.id, phone, password, fullName }
}

async function authHeaderFile(user, label) {
  const cookies = new Map()
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  })
  const { error } = await client.auth.signInWithPassword({ phone: user.phone, password: user.password })
  if (error) throw error
  const path = join(tempDirectory, `${label}.headers`)
  const cookieHeader = [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  writeFileSync(path, `Cookie: ${cookieHeader}\nOrigin: ${previewUrl}\nContent-Type: application/json\n`, { encoding: 'utf8', mode: 0o600 })
  return path
}

function previewRequest(path, { method = 'GET', headersFile, body } = {}) {
  const args = ['vercel', 'curl', path, '--deployment', previewUrl]
  if (method !== 'GET' || headersFile || body !== undefined) {
    args.push('--', '--request', method)
    if (headersFile) args.push('--header', `@${headersFile}`)
    if (body !== undefined) args.push('--data', JSON.stringify(body))
  }
  const command = process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node.exe' : 'npx'
  const commandArgs = process.platform === 'win32'
    ? ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js', ...args]
    : args
  const output = execFileSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  }).trim()
  return JSON.parse(output)
}

try {
  phase = 'create customer'
  const customer = await createTestUser({ role: 'customer', suffix: '01' })
  phase = 'read store settings'
  const cafeSettings = await admin.from('store_settings')
    .select('id,cafe_lat,cafe_lng,is_open,temporarily_closed,opening_time,closing_time,cod_enabled')
    .limit(1)
    .single()
  if (cafeSettings.error) throw cafeSettings.error
  storeSettingsId = cafeSettings.data.id
  originalStoreSettings = {
    is_open: cafeSettings.data.is_open,
    temporarily_closed: cafeSettings.data.temporarily_closed,
    opening_time: cafeSettings.data.opening_time,
    closing_time: cafeSettings.data.closing_time,
    cod_enabled: cafeSettings.data.cod_enabled,
  }
  phase = 'create customer address'
  const { data: address, error: addressError } = await admin.from('customer_addresses').insert({
    user_id: customer.id,
    label: 'Test',
    recipient_name: customer.fullName,
    phone: customer.phone,
    house: 'Smoke test only',
    area: 'Rohtak',
    city: 'Rohtak',
    latitude: cafeSettings.data.cafe_lat,
    longitude: cafeSettings.data.cafe_lng,
    is_default: true,
  }).select('id').single()
  if (addressError || !address) throw addressError || new Error('Could not create the smoke-test address')
  phase = 'authenticate customer'
  const customerHeaders = await authHeaderFile(customer, 'customer')
  const addresses = previewRequest('/api/addresses', { headersFile: customerHeaders })
  assert(addresses.addresses?.length === 1, 'Customer could not read their saved address')
  const forbiddenAdmin = previewRequest('/api/admin/dashboard', { headersFile: customerHeaders })
  assert(forbiddenAdmin.code === 'ADMIN_REQUIRED', 'Customer unexpectedly crossed the admin boundary')

  phase = 'create and authenticate admin'
  const cafeAdmin = await createTestUser({ role: 'admin', suffix: '02', isAdmin: true })
  const adminHeaders = await authHeaderFile(cafeAdmin, 'admin')
  const directOrders = await admin.from('orders').select('*,order_items(*)').order('created_at', { ascending: false }).limit(250)
  if (directOrders.error) throw new Error(`Direct admin order query failed: ${directOrders.error.message}`)
  const directDrivers = await admin.from('delivery_profiles').select('*').order('created_at', { ascending: false })
  if (directDrivers.error) throw new Error(`Direct admin driver query failed: ${directDrivers.error.message}`)
  const dashboard = previewRequest('/api/admin/dashboard', { headersFile: adminHeaders })
  assert(
    Array.isArray(dashboard.orders) && Array.isArray(dashboard.drivers),
    `Admin dashboard failed: ${JSON.stringify({ code: dashboard.code, error: dashboard.error, keys: Object.keys(dashboard) })}`,
  )

  phase = 'create and authenticate driver'
  const driver = await createTestUser({ role: 'driver', suffix: '03' })
  const { error: driverError } = await admin.from('delivery_profiles').insert({
    user_id: driver.id,
    full_name: driver.fullName,
    phone: driver.phone,
    vehicle_number: 'QA-TEST',
    is_active: true,
    is_approved: true,
    approved_by: cafeAdmin.id,
    approved_at: new Date().toISOString(),
  })
  if (driverError) throw driverError
  const driverHeaders = await authHeaderFile(driver, 'driver')
  const driverOrders = previewRequest('/api/delivery/orders', { headersFile: driverHeaders })
  assert(Array.isArray(driverOrders.orders), 'Approved driver could not load assigned orders')

  phase = 'select orderable menu size'
  const { data: menuSize, error: sizeError } = await admin.from('menu_item_sizes')
    .select('id,menu_item_id,menu_items!inner(id,is_available,archived_at)')
    .eq('is_available', true)
    .eq('menu_items.is_available', true)
    .is('menu_items.archived_at', null)
    .limit(1)
    .single()
  if (sizeError || !menuSize) throw sizeError || new Error('No available menu size found for order smoke test')
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  assert(uuidPattern.test(menuSize.id), `Live menu size has a non-UUID id: ${String(menuSize.id)}`)
  assert(uuidPattern.test(menuSize.menu_item_id), `Live menu item has a non-UUID id: ${String(menuSize.menu_item_id)}`)

  phase = 'temporarily open ordering'
  const { error: openError } = await admin.from('store_settings').update({
    is_open: true,
    temporarily_closed: false,
    opening_time: '00:00:00',
    closing_time: '23:59:59',
    cod_enabled: true,
  }).eq('id', storeSettingsId)
  if (openError) throw openError
  storeSettingsModified = true

  const clientOrderKey = randomUUID()
  const orderRequest = {
    clientOrderKey,
    items: [{ menu_item_id: menuSize.menu_item_id, size_id: menuSize.id, quantity: 1, extra_cheese: false }],
    deliveryType: 'delivery',
    paymentMethod: 'cod',
    addressId: address.id,
    notes: 'Automated production smoke test; delete after completion',
  }
  phase = 'create COD order'
  const createdOrder = previewRequest('/api/create-order', { method: 'POST', headersFile: customerHeaders, body: orderRequest })
  assert(createdOrder.orderId && createdOrder.fulfillmentStatus === 'awaiting_acceptance', `COD order creation failed: ${JSON.stringify(createdOrder)}`)
  createdOrderId = createdOrder.orderId

  phase = 'verify idempotent replay'
  const replay = previewRequest('/api/create-order', { method: 'POST', headersFile: customerHeaders, body: orderRequest })
  assert(replay.idempotentReplay === true && replay.orderId === createdOrderId, 'Duplicate order submission was not idempotent')

  const { error: restoreError } = await admin.from('store_settings').update(originalStoreSettings).eq('id', storeSettingsId)
  if (restoreError) throw restoreError
  storeSettingsModified = false

  phase = 'admin order transitions'
  for (const action of ['accept', 'prepare', 'ready']) {
    const transition = previewRequest('/api/admin/orders/transition', {
      method: 'POST', headersFile: adminHeaders, body: { orderId: createdOrderId, action },
    })
    assert(transition.success === true, `Admin ${action} transition failed: ${JSON.stringify(transition)}`)
  }
  phase = 'assign driver'
  const assignment = previewRequest('/api/admin/assign-driver', {
    method: 'POST', headersFile: adminHeaders, body: { orderId: createdOrderId, driverId: driver.id },
  })
  assert(assignment.success === true, `Driver assignment failed: ${JSON.stringify(assignment)}`)

  phase = 'driver pickup'
  const pickup = previewRequest('/api/delivery/update-status', {
    method: 'POST', headersFile: driverHeaders, body: { orderId: createdOrderId, action: 'pickup' },
  })
  assert(pickup.success === true, `Driver pickup failed: ${JSON.stringify(pickup)}`)
  phase = 'customer handover code'
  const handover = previewRequest(`/api/orders/${createdOrderId}/handover-code`, { headersFile: customerHeaders })
  assert(/^\d{6}$/.test(handover.code), 'Customer could not retrieve a valid 6-digit handover code')
  phase = 'driver delivery confirmation'
  const delivered = previewRequest('/api/delivery/update-status', {
    method: 'POST', headersFile: driverHeaders, body: { orderId: createdOrderId, action: 'deliver', otp: handover.code },
  })
  assert(delivered.success === true, `Driver handover failed: ${JSON.stringify(delivered)}`)
  const { data: finalOrder, error: finalOrderError } = await admin.from('orders')
    .select('fulfillment_status,delivery_status,status,delivery_otp_hash,delivery_otp_ciphertext')
    .eq('id', createdOrderId)
    .single()
  if (finalOrderError) throw finalOrderError
  assert(
    finalOrder.fulfillment_status === 'delivered' && finalOrder.delivery_status === 'delivered' &&
      finalOrder.status === 'completed' && !finalOrder.delivery_otp_hash && !finalOrder.delivery_otp_ciphertext,
    `Final delivery state is invalid: ${JSON.stringify(finalOrder)}`,
  )

  phase = 'driver duty update'
  const dutyOff = previewRequest('/api/delivery/duty', { method: 'POST', headersFile: driverHeaders, body: { active: false } })
  assert(dutyOff.success === true && dutyOff.active === false, 'Driver duty update failed')

  console.log('LIVE_PREVIEW_SMOKE_READY customer-address admin-boundary admin-dashboard idempotent-cod-order admin-lifecycle driver-assignment otp-handover driver-duty')
} catch (error) {
  throw new Error(`Live preview smoke failed during: ${phase}`, { cause: error })
} finally {
  if (storeSettingsModified && storeSettingsId && originalStoreSettings) {
    const { error } = await admin.from('store_settings').update(originalStoreSettings).eq('id', storeSettingsId)
    if (error) console.error('Cleanup failed to restore store settings')
  }
  if (createdOrderId) {
    const { error } = await admin.from('orders').delete().eq('id', createdOrderId)
    if (error) console.error(`Cleanup failed for temporary order ${createdOrderId.slice(0, 8)}`)
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.error(`Cleanup failed for temporary user ${userId.slice(0, 8)}`)
  }
  rmSync(tempDirectory, { recursive: true, force: true })
}

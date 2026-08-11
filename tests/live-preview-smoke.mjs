import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const tempDirectory = resolve('.backups', 'live-preview-smoke')
const createdUserIds = []
let createdOrderId = null
let cancellationOrderId = null
const auxiliaryOrderIds = []
let temporaryMenuItemId = null
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
  const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(previewUrl)
  const args = isLocal
    ? ['--silent', '--show-error', '--max-time', '20', `${previewUrl}${path}`]
    : ['vercel', 'curl', path, '--deployment', previewUrl]
  if (method !== 'GET' || headersFile || body !== undefined) {
    if (!isLocal) args.push('--')
    args.push('--max-time', '20', '--request', method)
    if (headersFile) args.push('--header', `@${headersFile}`)
    if (body !== undefined) args.push('--data', JSON.stringify(body))
  }
  const command = isLocal
    ? (process.platform === 'win32' ? 'C:\\Windows\\System32\\curl.exe' : 'curl')
    : (process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node.exe' : 'npx')
  const commandArgs = isLocal
    ? args
    : (process.platform === 'win32'
        ? ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js', ...args]
        : args)
  const output = execFileSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  }).trim()
  return JSON.parse(output)
}

function previewPdf(path, { headersFile, label }) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(previewUrl)) {
    throw new Error('PDF smoke helper currently requires the local preview server')
  }
  const outputPath = join(tempDirectory, `${label}.pdf`)
  const output = execFileSync(process.platform === 'win32' ? 'C:\\Windows\\System32\\curl.exe' : 'curl', [
    '--silent', '--show-error', '--max-time', '20', '--output', outputPath,
    '--write-out', '%{http_code}|%{content_type}|%{size_download}', `${previewUrl}${path}`,
    '--header', `@${headersFile}`,
  ], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false }).trim()
  const [status, contentType, size] = output.split('|')
  const bytes = readFileSync(outputPath)
  return { status: Number(status), contentType, size: Number(size), signature: bytes.subarray(0, 5).toString('ascii') }
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
  phase = 'update customer profile'
  const updatedName = `${customer.fullName} Updated`
  const profileUpdate = previewRequest('/api/account/profile', {
    method: 'PATCH', headersFile: customerHeaders, body: { fullName: updatedName },
  })
  assert(profileUpdate.success === true, 'Customer profile update failed')
  const updatedProfile = await admin.from('profiles').select('full_name').eq('id', customer.id).single()
  if (updatedProfile.error) throw updatedProfile.error
  assert(updatedProfile.data.full_name === updatedName, 'Customer profile name was not persisted')

  const secondAddressPayload = {
    label: 'Office', recipientName: updatedName, phone: customer.phone,
    house: 'Second smoke test address', area: 'Rohtak', landmark: 'QA landmark', city: 'Rohtak',
    postalCode: '124001', latitude: cafeSettings.data.cafe_lat, longitude: cafeSettings.data.cafe_lng,
    isDefault: true,
  }
  phase = 'create second default address'
  const secondAddress = previewRequest('/api/addresses', {
    method: 'POST', headersFile: customerHeaders, body: secondAddressPayload,
  })
  assert(secondAddress.address?.id && secondAddress.address.is_default === true, 'Second default address was not saved')
  const defaultAfterCreate = await admin.from('customer_addresses').select('id,is_default').eq('user_id', customer.id)
  if (defaultAfterCreate.error) throw defaultAfterCreate.error
  assert(defaultAfterCreate.data.filter((item) => item.is_default).length === 1, 'Customer has multiple default addresses after create')

  phase = 'edit and restore original default address'
  const originalAddressPayload = {
    ...secondAddressPayload,
    label: 'Home updated',
    house: 'Updated smoke test house',
    isDefault: true,
  }
  const editedAddress = previewRequest(`/api/addresses/${address.id}`, {
    method: 'PATCH', headersFile: customerHeaders, body: originalAddressPayload,
  })
  assert(editedAddress.address?.id === address.id && editedAddress.address.is_default === true, 'Address edit/default update failed')

  phase = 'protect default address on invalid edit'
  const missingAddressId = randomUUID()
  const missingAddressEdit = previewRequest(`/api/addresses/${missingAddressId}`, {
    method: 'PATCH', headersFile: customerHeaders, body: { ...originalAddressPayload, label: 'Missing' },
  })
  assert(missingAddressEdit.code === 'ADDRESS_NOT_FOUND', 'Missing address edit did not return ADDRESS_NOT_FOUND')
  const defaultsAfterMissingEdit = await admin.from('customer_addresses').select('id,is_default').eq('user_id', customer.id)
  if (defaultsAfterMissingEdit.error) throw defaultsAfterMissingEdit.error
  assert(defaultsAfterMissingEdit.data.filter((item) => item.is_default).length === 1 && defaultsAfterMissingEdit.data.find((item) => item.id === address.id)?.is_default, 'Invalid address edit cleared the customer default')

  phase = 'delete secondary address and protect final address'
  const deletedAddress = previewRequest(`/api/addresses/${secondAddress.address.id}`, { method: 'DELETE', headersFile: customerHeaders })
  assert(deletedAddress.success === true, 'Secondary address deletion failed')
  const finalAddressDelete = previewRequest(`/api/addresses/${address.id}`, { method: 'DELETE', headersFile: customerHeaders })
  assert(finalAddressDelete.code === 'LAST_ADDRESS', 'Customer was allowed to delete their final address')
  const forbiddenAdmin = previewRequest('/api/admin/dashboard', { headersFile: customerHeaders })
  assert(forbiddenAdmin.code === 'ADMIN_REQUIRED', 'Customer unexpectedly crossed the admin boundary')

  phase = 'save update and remove push subscription'
  const pushEndpoint = `https://push.example.test/${randomUUID()}`
  const pushCreate = previewRequest('/api/push-subscribe', {
    method: 'POST', headersFile: customerHeaders,
    body: { endpoint: pushEndpoint, keys: { auth: 'qa-auth-key', p256dh: 'qa-p256dh-key-material-long-enough' } },
  })
  assert(pushCreate.success === true, 'Customer push subscription creation failed')
  const pushUpdate = previewRequest('/api/push-subscribe', {
    method: 'POST', headersFile: customerHeaders,
    body: { endpoint: pushEndpoint, keys: { auth: 'qa-auth-key-updated', p256dh: 'qa-p256dh-key-material-updated' } },
  })
  assert(pushUpdate.success === true, 'Customer push subscription update failed')
  const savedPush = await admin.from('push_subscriptions').select('keys_auth').eq('endpoint', pushEndpoint).eq('user_id', customer.id).single()
  if (savedPush.error) throw savedPush.error
  assert(savedPush.data.keys_auth === 'qa-auth-key-updated', 'Updated push subscription was not persisted')
  const pushDelete = previewRequest('/api/push-subscribe', {
    method: 'DELETE', headersFile: customerHeaders, body: { endpoint: pushEndpoint },
  })
  assert(pushDelete.success === true, 'Customer push subscription deletion failed')

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

  phase = 'save and restore store settings through admin API'
  const apiSettings = previewRequest('/api/admin/store-settings', { headersFile: adminHeaders })
  const settingsPayload = {
    storeName: apiSettings.store_name,
    isOpen: apiSettings.is_open,
    temporarilyClosed: apiSettings.temporarily_closed,
    openingTime: String(apiSettings.opening_time).slice(0, 5),
    closingTime: String(apiSettings.closing_time).slice(0, 5),
    closedMessage: apiSettings.closed_message,
    platformFeePaise: apiSettings.platform_fee_paise,
    sugarcanePackagingFeePaise: apiSettings.sugarcane_packaging_fee_paise,
    deliveryFeePaise: apiSettings.delivery_fee_paise,
    freeDeliveryThresholdPaise: apiSettings.free_delivery_threshold_paise,
    pickupDiscountPercent: Number(apiSettings.pickup_discount_percent),
    deliveryCity: apiSettings.delivery_city,
    cafeLat: Number(apiSettings.cafe_lat),
    cafeLng: Number(apiSettings.cafe_lng),
    deliveryRadiusKm: Number(apiSettings.delivery_radius_km),
    codEnabled: apiSettings.cod_enabled,
  }
  const temporarySettings = previewRequest('/api/admin/store-settings', {
    method: 'PATCH', headersFile: adminHeaders,
    body: { ...settingsPayload, closedMessage: `${settingsPayload.closedMessage} QA` },
  })
  assert(temporarySettings.success === true, 'Admin store-settings update failed')
  const changedSettings = previewRequest('/api/admin/store-settings', { headersFile: adminHeaders })
  assert(changedSettings.closed_message === `${settingsPayload.closedMessage} QA`, 'Admin store-settings update was not persisted')
  const restoredApiSettings = previewRequest('/api/admin/store-settings', {
    method: 'PATCH', headersFile: adminHeaders, body: settingsPayload,
  })
  assert(restoredApiSettings.success === true, 'Admin store-settings restoration failed')

  phase = 'admin menu create edit and archive'
  const menuCreate = previewRequest('/api/admin/menu', {
    method: 'POST', headersFile: adminHeaders,
    body: {
      name: 'Codex QA Temporary Item', description: 'Temporary automated menu-manager test',
      category: 'QA Temporary', imagePath: '/images/logo.png', isAvailable: true,
      allowExtraCheese: true, noMayonnaise: true, defaultSizeIndex: 0,
      sizes: [{ label: 'Regular', pricePaise: 12300, extraCheesePricePaise: 1700, isAvailable: true }],
    },
  })
  assert(uuidPattern.test(menuCreate.id), `Admin menu creation failed: ${JSON.stringify(menuCreate)}`)
  temporaryMenuItemId = menuCreate.id
  const createdMenu = previewRequest('/api/admin/menu', { headersFile: adminHeaders })
  const createdMenuItem = createdMenu.items?.find((item) => item.id === temporaryMenuItemId)
  assert(createdMenuItem?.menu_item_sizes?.length === 1, 'Created admin menu item was not returned')
  const originalSizeId = createdMenuItem.menu_item_sizes[0].id
  const menuUpdate = previewRequest('/api/admin/menu', {
    method: 'PATCH', headersFile: adminHeaders,
    body: {
      id: temporaryMenuItemId, name: 'Codex QA Temporary Item Updated', description: 'Updated temporary automated menu-manager test',
      category: 'QA Temporary', imagePath: '/images/logo.png', isAvailable: true,
      allowExtraCheese: true, noMayonnaise: false, defaultSizeIndex: 1,
      sizes: [
        { id: originalSizeId, label: 'Regular', pricePaise: 12500, extraCheesePricePaise: 1900, isAvailable: true },
        { label: 'Large', pricePaise: 17500, extraCheesePricePaise: 2500, isAvailable: true },
      ],
    },
  })
  assert(menuUpdate.success === true, 'Admin menu update failed')
  const updatedMenu = previewRequest('/api/admin/menu', { headersFile: adminHeaders })
  const updatedMenuItem = updatedMenu.items?.find((item) => item.id === temporaryMenuItemId)
  assert(updatedMenuItem?.name.endsWith('Updated') && updatedMenuItem.menu_item_sizes.length === 2, 'Admin menu update was not persisted')
  assert(updatedMenuItem.default_size_id === updatedMenuItem.menu_item_sizes.find((size) => size.size_label === 'Large')?.id, 'Admin menu default size was not persisted')
  const archivedMenu = previewRequest('/api/admin/menu', {
    method: 'DELETE', headersFile: adminHeaders, body: { id: temporaryMenuItemId },
  })
  assert(archivedMenu.success === true, 'Admin menu archive failed')
  const menuAfterArchive = previewRequest('/api/admin/menu', { headersFile: adminHeaders })
  assert(!menuAfterArchive.items?.some((item) => item.id === temporaryMenuItemId), 'Archived menu item remained visible in admin menu')

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
  phase = 'admin suspend and reapprove idle driver'
  const suspendedDriver = previewRequest('/api/admin/drivers/status', {
    method: 'POST', headersFile: adminHeaders, body: { driverId: driver.id, approved: false },
  })
  assert(suspendedDriver.success === true && suspendedDriver.approved === false, 'Admin could not suspend an idle driver')
  const reapprovedDriver = previewRequest('/api/admin/drivers/status', {
    method: 'POST', headersFile: adminHeaders, body: { driverId: driver.id, approved: true },
  })
  assert(reapprovedDriver.success === true && reapprovedDriver.approved === true, 'Admin could not reapprove a driver')
  const dutyOn = previewRequest('/api/delivery/duty', { method: 'POST', headersFile: driverHeaders, body: { active: true } })
  assert(dutyOn.success === true && dutyOn.active === true, 'Reapproved driver could not go on duty')

  phase = 'select orderable menu size'
  const { data: menuSize, error: sizeError } = await admin.from('menu_item_sizes')
    .select('id,menu_item_id,menu_items!inner(id,is_available,archived_at)')
    .eq('is_available', true)
    .eq('menu_items.is_available', true)
    .is('menu_items.archived_at', null)
    .limit(1)
    .single()
  if (sizeError || !menuSize) throw sizeError || new Error('No available menu size found for order smoke test')
  assert(uuidPattern.test(menuSize.id), `Live menu size has a non-UUID id: ${String(menuSize.id)}`)
  assert(uuidPattern.test(menuSize.menu_item_id), `Live menu item has a non-UUID id: ${String(menuSize.menu_item_id)}`)

  const { data: nonCaneItem, error: nonCaneError } = await admin.from('menu_items')
    .select('id,menu_item_sizes!inner(id,is_available)')
    .neq('category', 'The Cane Bar')
    .eq('is_available', true)
    .eq('menu_item_sizes.is_available', true)
    .is('archived_at', null)
    .limit(1)
    .single()
  if (nonCaneError || !nonCaneItem?.menu_item_sizes?.[0]) throw nonCaneError || new Error('No non-cane menu item is available for pickup tests')
  const nonCaneOrderItem = { menu_item_id: nonCaneItem.id, size_id: nonCaneItem.menu_item_sizes[0].id, quantity: 1, extra_cheese: false }

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

  phase = 'validate delivery serviceability and fulfillment quotes'
  const missingLocationQuote = previewRequest('/api/quote', {
    method: 'POST', headersFile: customerHeaders, body: { items: [{ menu_item_id: menuSize.menu_item_id, size_id: menuSize.id, quantity: 1, extra_cheese: false }], deliveryType: 'delivery' },
  })
  assert(missingLocationQuote.code === 'LOCATION_REQUIRED', `Delivery quote accepted a missing map location: ${JSON.stringify(missingLocationQuote)}`)
  const nearbyDeliveryQuote = previewRequest('/api/quote', {
    method: 'POST', headersFile: customerHeaders, body: { items: [nonCaneOrderItem], deliveryType: 'delivery', latitude: cafeSettings.data.cafe_lat, longitude: cafeSettings.data.cafe_lng },
  })
  assert(nearbyDeliveryQuote.serviceability?.distanceKm !== null && nearbyDeliveryQuote.totals?.grandTotalPaise > 0, 'Nearby delivery quote failed')
  const outsideDeliveryQuote = previewRequest('/api/quote', {
    method: 'POST', headersFile: customerHeaders, body: { items: [nonCaneOrderItem], deliveryType: 'delivery', latitude: 0, longitude: 0 },
  })
  assert(outsideDeliveryQuote.code === 'OUTSIDE_DELIVERY_AREA', 'Outside delivery location was accepted')
  const takeawayQuote = previewRequest('/api/quote', { method: 'POST', headersFile: customerHeaders, body: { items: [nonCaneOrderItem], deliveryType: 'takeaway' } })
  assert(takeawayQuote.totals?.discountPaise > 0 && takeawayQuote.totals.deliveryFeePaise === 0, 'Takeaway discount or delivery fee is incorrect')
  const dineInQuote = previewRequest('/api/quote', { method: 'POST', headersFile: customerHeaders, body: { items: [nonCaneOrderItem], deliveryType: 'dine_in' } })
  assert(dineInQuote.totals?.discountPaise === 0 && dineInQuote.totals.deliveryFeePaise === 0, 'Dine-in quote contains an invalid discount or delivery fee')

  phase = 'create and complete takeaway order'
  const takeawayOrder = previewRequest('/api/create-order', {
    method: 'POST', headersFile: customerHeaders,
    body: { clientOrderKey: randomUUID(), items: [nonCaneOrderItem], deliveryType: 'takeaway', paymentMethod: 'cod', notes: 'Automated takeaway smoke test' },
  })
  assert(takeawayOrder.orderId, `Takeaway order creation failed: ${JSON.stringify(takeawayOrder)}`)
  auxiliaryOrderIds.push(takeawayOrder.orderId)
  for (const action of ['accept', 'prepare', 'ready', 'complete']) {
    const transition = previewRequest('/api/admin/orders/transition', {
      method: 'POST', headersFile: adminHeaders, body: { orderId: takeawayOrder.orderId, action },
    })
    assert(transition.success === true, `Takeaway ${action} transition failed: ${JSON.stringify(transition)}`)
  }

  phase = 'start online payment and reject invalid signature'
  const onlineOrder = previewRequest('/api/create-order', {
    method: 'POST', headersFile: customerHeaders,
    body: { clientOrderKey: randomUUID(), items: [nonCaneOrderItem], deliveryType: 'takeaway', paymentMethod: 'online', notes: 'Automated safe online-payment smoke test' },
  })
  assert(onlineOrder.orderId && /^order_/.test(onlineOrder.razorpayOrderId || ''), `Online payment initiation failed: ${JSON.stringify(onlineOrder)}`)
  auxiliaryOrderIds.push(onlineOrder.orderId)
  const invalidPayment = previewRequest('/api/verify-payment', {
    method: 'POST', headersFile: customerHeaders,
    body: {
      orderId: onlineOrder.orderId,
      razorpayOrderId: onlineOrder.razorpayOrderId,
      razorpayPaymentId: 'pay_QA_invalid',
      razorpaySignature: '0'.repeat(64),
    },
  })
  assert(invalidPayment.code === 'INVALID_SIGNATURE', `Invalid Razorpay signature was not rejected: ${JSON.stringify(invalidPayment)}`)

  const clientOrderKey = randomUUID()
  const orderRequest = {
    clientOrderKey,
    items: [{ menu_item_id: menuSize.menu_item_id, size_id: menuSize.id, quantity: 1, extra_cheese: false }],
    deliveryType: 'delivery',
    paymentMethod: 'cod',
    addressId: address.id,
    notes: 'Automated production smoke test; delete after completion',
  }

  phase = 'validate dine-in table requirement'
  const missingTableOrder = previewRequest('/api/create-order', {
    method: 'POST', headersFile: customerHeaders,
    body: { clientOrderKey: randomUUID(), items: [nonCaneOrderItem], deliveryType: 'dine_in', paymentMethod: 'cod', notes: 'Missing table validation' },
  })
  assert(missingTableOrder.code === 'TABLE_REQUIRED', 'Dine-in order accepted a missing table number')

  phase = 'create and complete dine-in order'
  const dineInOrder = previewRequest('/api/create-order', {
    method: 'POST', headersFile: customerHeaders,
    body: { clientOrderKey: randomUUID(), items: [nonCaneOrderItem], deliveryType: 'dine_in', paymentMethod: 'cod', tableNumber: 'QA-7', notes: 'Automated dine-in smoke test' },
  })
  assert(dineInOrder.orderId, `Dine-in order creation failed: ${JSON.stringify(dineInOrder)}`)
  auxiliaryOrderIds.push(dineInOrder.orderId)
  const earlyReview = previewRequest('/api/orders/review', {
    method: 'POST', headersFile: customerHeaders, body: { orderId: dineInOrder.orderId, rating: 5, comment: 'Should be rejected before completion' },
  })
  assert(earlyReview.code === 'ORDER_NOT_COMPLETE', 'Review was accepted before order completion')
  for (const action of ['accept', 'prepare', 'ready', 'complete']) {
    const transition = previewRequest('/api/admin/orders/transition', {
      method: 'POST', headersFile: adminHeaders, body: { orderId: dineInOrder.orderId, action },
    })
    assert(transition.success === true, `Dine-in ${action} transition failed: ${JSON.stringify(transition)}`)
  }
  const completedReview = previewRequest('/api/orders/review', {
    method: 'POST', headersFile: customerHeaders, body: { orderId: dineInOrder.orderId, rating: 4, comment: 'Automated completed-order review' },
  })
  assert(completedReview.success === true, 'Completed dine-in review failed')
  const updatedReview = previewRequest('/api/orders/review', {
    method: 'POST', headersFile: customerHeaders, body: { orderId: dineInOrder.orderId, rating: 5, comment: 'Automated updated review' },
  })
  assert(updatedReview.success === true, 'Review update failed')
  const reviewRow = await admin.from('reviews').select('rating,comment').eq('order_id', dineInOrder.orderId).eq('user_id', customer.id).single()
  if (reviewRow.error) throw reviewRow.error
  assert(reviewRow.data.rating === 5 && reviewRow.data.comment === 'Automated updated review', 'Updated review was not persisted')
  if (process.env.SKIP_PDF_SMOKE !== '1') {
    phase = 'download customer and admin receipts'
    const customerReceipt = previewPdf(`/api/orders/${dineInOrder.orderId}/receipt`, { headersFile: customerHeaders, label: 'customer-receipt' })
    assert(customerReceipt.status === 200 && customerReceipt.contentType.startsWith('application/pdf') && customerReceipt.size > 1000 && customerReceipt.signature === '%PDF-', `Customer receipt is invalid: ${JSON.stringify(customerReceipt)}`)
    const adminReceipt = previewPdf(`/api/orders/${dineInOrder.orderId}/receipt`, { headersFile: adminHeaders, label: 'admin-receipt' })
    assert(adminReceipt.status === 200 && adminReceipt.signature === '%PDF-', 'Admin could not download the order receipt')
    const forbiddenReceipt = previewRequest(`/api/orders/${dineInOrder.orderId}/receipt`, { headersFile: driverHeaders })
    assert(forbiddenReceipt.code === 'FORBIDDEN', 'Unrelated driver could access a customer receipt')
  }

  phase = 'create COD order'
  const createdOrder = previewRequest('/api/create-order', { method: 'POST', headersFile: customerHeaders, body: orderRequest })
  assert(createdOrder.orderId && createdOrder.fulfillmentStatus === 'awaiting_acceptance', `COD order creation failed: ${JSON.stringify(createdOrder)}`)
  createdOrderId = createdOrder.orderId

  phase = 'verify idempotent replay'
  const replay = previewRequest('/api/create-order', { method: 'POST', headersFile: customerHeaders, body: orderRequest })
  assert(replay.idempotentReplay === true && replay.orderId === createdOrderId, 'Duplicate order submission was not idempotent')

  if (process.env.SKIP_CANCELLATION_SMOKE !== '1') {
  phase = 'create cancellation test order'
  const cancellationOrder = previewRequest('/api/create-order', {
    method: 'POST',
    headersFile: customerHeaders,
    body: {
      ...orderRequest,
      clientOrderKey: randomUUID(),
      items: [{ ...orderRequest.items[0], quantity: 2 }],
      notes: 'Automated cancellation smoke test; delete after completion',
    },
  })
  assert(cancellationOrder.orderId, `Cancellation test order failed: ${JSON.stringify(cancellationOrder)}`)
  cancellationOrderId = cancellationOrder.orderId
  const cancellationItems = await admin.from('order_items').select('id,quantity').eq('order_id', cancellationOrderId).single()
  if (cancellationItems.error || !cancellationItems.data) throw cancellationItems.error || new Error('Cancellation test item is missing')

  phase = 'reject duplicate cancellation items'
  const duplicateCancellation = previewRequest('/api/orders/cancel', {
    method: 'POST',
    headersFile: customerHeaders,
    body: {
      orderId: cancellationOrderId,
      reason: 'Automated duplicate validation',
      items: [
        { orderItemId: cancellationItems.data.id, quantity: 1 },
        { orderItemId: cancellationItems.data.id, quantity: 1 },
      ],
    },
  })
  assert(duplicateCancellation.code === 'INVALID_INPUT', `Duplicate cancellation items were accepted: ${JSON.stringify(duplicateCancellation)}`)

  phase = 'partially cancel order item'
  const partialCancellation = previewRequest('/api/orders/cancel', {
    method: 'POST',
    headersFile: customerHeaders,
    body: {
      orderId: cancellationOrderId,
      reason: 'Automated partial cancellation',
      items: [{ orderItemId: cancellationItems.data.id, quantity: 1 }],
    },
  })
  assert(partialCancellation.success === true && partialCancellation.fullCancellation === false, `Partial cancellation failed: ${JSON.stringify(partialCancellation)}`)

  phase = 'cancel all remaining order items'
  const finalCancellation = previewRequest('/api/orders/cancel', {
    method: 'POST',
    headersFile: customerHeaders,
    body: {
      orderId: cancellationOrderId,
      reason: 'Automated final cancellation',
      items: [{ orderItemId: cancellationItems.data.id, quantity: 1 }],
    },
  })
  assert(finalCancellation.success === true && finalCancellation.fullCancellation === true, `Final cancellation failed: ${JSON.stringify(finalCancellation)}`)
  const cancelledOrder = await admin.from('orders').select('fulfillment_status,total_paise').eq('id', cancellationOrderId).single()
  if (cancelledOrder.error) throw cancelledOrder.error
  assert(cancelledOrder.data.fulfillment_status === 'cancelled' && cancelledOrder.data.total_paise === 0, 'Fully cancelled order retained an invalid state or balance')
  }

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
  phase = 'protect active driver assignment'
  const activeSuspension = previewRequest('/api/admin/drivers/status', {
    method: 'POST', headersFile: adminHeaders, body: { driverId: driver.id, approved: false },
  })
  assert(activeSuspension.code === 'DRIVER_HAS_ACTIVE_ORDERS', 'Admin suspension stranded an active delivery')

  phase = 'persist assigned driver location'
  const locationUpdate = previewRequest('/api/delivery/location', {
    method: 'POST', headersFile: driverHeaders,
    body: { orderId: createdOrderId, latitude: cafeSettings.data.cafe_lat, longitude: cafeSettings.data.cafe_lng, accuracy: 12 },
  })
  assert(locationUpdate.success === true, `Assigned driver location update failed: ${JSON.stringify(locationUpdate)}`)
  const savedLocation = await admin.from('delivery_locations').select('delivery_boy_id,latitude,longitude,accuracy').eq('order_id', createdOrderId).single()
  if (savedLocation.error) throw savedLocation.error
  assert(savedLocation.data.delivery_boy_id === driver.id && Number(savedLocation.data.accuracy) === 12, 'Driver location was not persisted correctly')

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

  console.log('LIVE_PREVIEW_SMOKE_READY profile-address push-subscription service-radius fulfillment-quotes admin-boundary admin-dashboard store-settings menu-crud takeaway dine-in review receipts cancellation online-payment-signature idempotent-cod-order admin-lifecycle driver-assignment driver-location otp-handover driver-duty')
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
  if (cancellationOrderId) {
    const { error } = await admin.from('orders').delete().eq('id', cancellationOrderId)
    if (error) console.error(`Cleanup failed for cancellation order ${cancellationOrderId.slice(0, 8)}`)
  }
  for (const orderId of auxiliaryOrderIds) {
    const { error } = await admin.from('orders').delete().eq('id', orderId)
    if (error) console.error(`Cleanup failed for auxiliary order ${orderId.slice(0, 8)}`)
  }
  if (temporaryMenuItemId) {
    const { error } = await admin.from('menu_items').delete().eq('id', temporaryMenuItemId)
    if (error) console.error(`Cleanup failed for temporary menu item ${temporaryMenuItemId.slice(0, 8)}`)
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.error(`Cleanup failed for temporary user ${userId.slice(0, 8)}`)
  }
  rmSync(tempDirectory, { recursive: true, force: true })
}

const { count: remainingProfiles, error: profileCleanupError } = await admin.from('profiles')
  .select('id', { count: 'exact', head: true })
  .in('id', createdUserIds)
if (profileCleanupError) throw profileCleanupError
assert(remainingProfiles === 0, `${remainingProfiles} temporary profiles remain after cleanup`)
if (createdOrderId) {
  const { data: remainingOrder, error: orderCleanupError } = await admin.from('orders')
    .select('id')
    .eq('id', createdOrderId)
    .maybeSingle()
  if (orderCleanupError) throw orderCleanupError
  assert(!remainingOrder, 'Temporary order remains after cleanup')
}
if (cancellationOrderId) {
  const { data: remainingCancellationOrder, error: cancellationCleanupError } = await admin.from('orders')
    .select('id')
    .eq('id', cancellationOrderId)
    .maybeSingle()
  if (cancellationCleanupError) throw cancellationCleanupError
  assert(!remainingCancellationOrder, 'Temporary cancellation order remains after cleanup')
}
for (const auxiliaryOrderId of auxiliaryOrderIds) {
  const { data: remainingAuxiliaryOrder, error: auxiliaryCleanupError } = await admin.from('orders')
    .select('id')
    .eq('id', auxiliaryOrderId)
    .maybeSingle()
  if (auxiliaryCleanupError) throw auxiliaryCleanupError
  assert(!remainingAuxiliaryOrder, 'Temporary auxiliary order remains after cleanup')
}
if (storeSettingsId && originalStoreSettings) {
  const { data: restoredSettings, error: restoredSettingsError } = await admin.from('store_settings')
    .select('is_open,temporarily_closed,opening_time,closing_time,cod_enabled')
    .eq('id', storeSettingsId)
    .single()
  if (restoredSettingsError) throw restoredSettingsError
  for (const [key, value] of Object.entries(originalStoreSettings)) {
    assert(restoredSettings[key] === value, `Store setting ${key} was not restored after smoke test`)
  }
}
console.log('LIVE_PREVIEW_SMOKE_CLEAN temporary-users temporary-order store-settings')

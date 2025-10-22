#!/usr/bin/env node
import 'dotenv/config'
import fs from 'fs'
import fetch from 'node-fetch'

async function main() {
  const base = process.env.ROLES_BASE || 'http://localhost:3001/api/roles'
  const tenantId = '6f21ec6e-dac9-47d7-9ad0-ad576d2d9039'
  const token = JSON.parse(fs.readFileSync('token-superadmin.json','utf-8')).access_token
  const headers = { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }
  const email = `audit.webhook.${Date.now()}@example.com`
  console.log('Inviting', email)

  // Invite user
  let res = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'invite', tenantId, email, role:'USER' }) })
  let invitePayload
  try { invitePayload = await res.json() } catch { invitePayload = await res.text() }
  console.log('INVITE', res.status, invitePayload)
  const createdUserId = invitePayload?.userId || null

  // List actions with default limit
  let listRes = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'list_user_actions', tenantId, limit: 5 }) })
  let list = await listRes.json()
  console.log('ACTIONS after invite (limit=5)', Array.isArray(list?.actions) ? list.actions.map(a => ({ action:a.action, resource:a.resource, created_at:a.created_at, details:a.details })) : list)

  // List filtered by userId (if available)
  if (createdUserId) {
    const filteredRes = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'list_user_actions', tenantId, userId: createdUserId, limit: 5 }) })
    const filtered = await filteredRes.json()
    console.log('ACTIONS filtered by userId (limit=5)', Array.isArray(filtered?.actions) ? filtered.actions.map(a => ({ action:a.action, resource:a.resource, created_at:a.created_at, details:a.details })) : filtered)
  }

  // Find created user by email via /api/roles list_users
  let usersRes = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'list_users', tenantId }) })
  let usersPayload = await usersRes.json()
  let users = Array.isArray(usersPayload?.users) ? usersPayload.users : []
  let u = users.find(x => x.email === email)
  console.log('Found user?', !!u, u && { user_id:u.user_id, email:u.email, role:u.role })
  if (u) {
    // Remove user
    res = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'remove', tenantId, userId: u.user_id }) })
    const removePayload = await res.json().catch(async () => await res.text())
    console.log('REMOVE', res.status, removePayload)
  }

  // List actions after remove with limit and since filter (last 10 minutes)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  listRes = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'list_user_actions', tenantId, limit: 10, since }) })
  list = await listRes.json()
  console.log('ACTIONS after remove (limit=10, since=10m)', Array.isArray(list?.actions) ? list.actions.map(a => ({ action:a.action, resource:a.resource, created_at:a.created_at, details:a.details })) : list)

  if (createdUserId) {
    const filteredRes2 = await fetch(base, { method:'POST', headers, body: JSON.stringify({ action:'list_user_actions', tenantId, userId: createdUserId, limit: 10 }) })
    const filtered2 = await filteredRes2.json()
    console.log('ACTIONS filtered by userId after remove', Array.isArray(filtered2?.actions) ? filtered2.actions.map(a => ({ action:a.action, resource:a.resource, created_at:a.created_at, details:a.details })) : filtered2)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
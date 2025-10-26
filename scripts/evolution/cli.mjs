#!/usr/bin/env node
import 'dotenv/config'

// Simple argv parser
function parseArgs(argv) {
  const args = {}
  let key = null
  for (const token of argv) {
    if (token.startsWith('--')) {
      key = token.slice(2)
      args[key] = true
    } else if (key) {
      args[key] = token
      key = null
    } else if (!args._) {
      args._ = [token]
    } else {
      args._.push(token)
    }
  }
  return args
}

function getConfig(args) {
  const baseUrl = args.baseUrl || process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080'
  const apiKey = args.apiKey || process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTION_API_KEY || 'your-api-key'
  const instanceName = args.instance || process.env.EVOLUTION_INSTANCE_NAME || process.env.VITE_EVOLUTION_INSTANCE_NAME || 'demo-instance'
  const webhookUrl = args.webhookUrl || process.env.WEBHOOK_URL || process.env.VITE_WEBHOOK_URL || 'http://localhost:3001/webhook'
  const webhookSecret = args.webhookSecret || process.env.WEBHOOK_SECRET || process.env.VITE_WEBHOOK_SECRET || ''
  return { baseUrl, apiKey, instanceName, webhookUrl, webhookSecret }
}

function headers(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    apikey: String(apiKey || '').trim(),
  }
}

async function request(baseUrl, endpoint, init) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}${endpoint}`
  console.log(`\n🌐 ${init.method || 'GET'} ${url}`)
  try {
    const res = await fetch(url, init)
    const text = await res.text()
    const json = (() => { try { return JSON.parse(text) } catch { return text } })()
    console.log(`📡 ${res.status} ${res.statusText}`)
    if (!res.ok) {
      throw new Error(typeof json === 'string' ? json : JSON.stringify(json))
    }
    return json
  } catch (err) {
    console.error('❌ Request error:', err.message || err)
    throw err
  }
}

function printUsage() {
  console.log(`\nUsage: node scripts/evolution/cli.mjs <command> [options]\n\nCommands:\n  status                 Check instance status\n  create                 Create instance on Evolution API\n  connect                Connect instance (prints last QR data)\n  set-webhook            Set webhook URL on instance\n  send-text              Send a text message\n\nCommon options:\n  --instance <name>      Instance name (default: demo-instance)\n  --baseUrl <url>        Evolution API base URL\n  --apiKey <key>         Evolution API key\n\nsend-text options:\n  --to <number>          Recipient number (e.g., 5511999999999)\n  --text <msg>           Message text\n\nset-webhook options:\n  --webhookUrl <url>     Webhook URL (default: http://localhost:3001/webhook)\n  --webhookSecret <sec>  Webhook secret (optional)\n`)
}

async function cmdStatus(cfg) {
  const q = `?instanceName=${encodeURIComponent(cfg.instanceName)}`
  const data = await request(cfg.baseUrl, `/instance/fetchInstances${q}`, { method: 'GET', headers: headers(cfg.apiKey) })
  const info = Array.isArray(data) && data.length > 0 ? data[0] : data
  console.log('\nℹ️ Instance info:', JSON.stringify(info, null, 2))
}

async function cmdCreate(cfg) {
  const body = {
    instanceName: cfg.instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS'
  }
  const data = await request(cfg.baseUrl, `/instance/create`, { method: 'POST', headers: headers(cfg.apiKey), body: JSON.stringify(body) })
  console.log('\n✅ Create result:', JSON.stringify(data, null, 2))
}

async function cmdConnect(cfg) {
  const data = await request(cfg.baseUrl, `/instance/connect/${encodeURIComponent(cfg.instanceName)}`, { method: 'GET', headers: headers(cfg.apiKey) })
  console.log('\n🔗 Connect result:', JSON.stringify(data, null, 2))
  // Also show current status
  await cmdStatus(cfg)
}

async function cmdSetWebhook(cfg) {
  const body = {
    webhook: {
      url: cfg.webhookUrl,
      enabled: true,
      events: [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'PRESENCE_UPDATE',
        'CHATS_UPSERT',
        'CHATS_UPDATE',
        'CHATS_DELETE',
        'CONTACTS_UPSERT',
        'CONTACTS_UPDATE'
      ],
      webhook_by_events: false,
      webhook_base64: false,
      // Provide secret for authorization via body if set
      secret: cfg.webhookSecret || undefined,
      headers: cfg.webhookSecret ? { 'Authorization': `Bearer ${cfg.webhookSecret}`, 'x-webhook-secret': cfg.webhookSecret } : undefined
    }
  }
  const data = await request(cfg.baseUrl, `/webhook/set/${encodeURIComponent(cfg.instanceName)}`, { method: 'POST', headers: headers(cfg.apiKey), body: JSON.stringify(body) })
  console.log('\n✅ Webhook set result:', JSON.stringify(data, null, 2))
}

async function cmdSendText(cfg, args) {
  const to = args.to || ''
  const text = args.text || ''
  if (!to || !text) {
    console.error('❌ Missing --to or --text')
    printUsage()
    process.exit(1)
  }
  const body = { number: to, text }
  const data = await request(cfg.baseUrl, `/message/sendText/${encodeURIComponent(cfg.instanceName)}`, { method: 'POST', headers: headers(cfg.apiKey), body: JSON.stringify(body) })
  console.log('\n✅ SendText result:', JSON.stringify(data, null, 2))
}

async function main() {
  const argv = parseArgs(process.argv.slice(2))
  const cmd = (argv._ && argv._[0]) || ''
  if (!cmd) { printUsage(); process.exit(1) }
  const cfg = getConfig(argv)

  console.log(`\n⚙️ Config:\n  baseUrl: ${cfg.baseUrl}\n  instance: ${cfg.instanceName}\n  apiKey: ${cfg.apiKey ? '[provided]' : '[missing]'}\n`)

  try {
    switch (cmd) {
      case 'status':
        await cmdStatus(cfg)
        break
      case 'create':
        await cmdCreate(cfg)
        break
      case 'connect':
        await cmdConnect(cfg)
        break
      case 'set-webhook':
        await cmdSetWebhook(cfg)
        break
      case 'send-text':
        await cmdSendText(cfg, argv)
        break
      default:
        printUsage()
        process.exit(1)
    }
  } catch (err) {
    console.error('\n❌ Command failed:', err.message || err)
    process.exit(1)
  }
}

main()
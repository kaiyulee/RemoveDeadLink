const DEFAULTS = { scanConcurrency: 10, requestTimeoutMs: 8000, rdapEndpoint: 'https://rdap.org/domain/', whitelist: [] }

async function loadConfig() {
  const cfg = await chrome.storage.local.get(['config'])
  const c = cfg && cfg.config ? cfg.config : {}
  return {
    scanConcurrency: typeof c.scanConcurrency === 'number' && c.scanConcurrency > 0 ? c.scanConcurrency : DEFAULTS.scanConcurrency,
    requestTimeoutMs: typeof c.requestTimeoutMs === 'number' && c.requestTimeoutMs >= 1000 ? c.requestTimeoutMs : DEFAULTS.requestTimeoutMs,
    rdapEndpoint: typeof c.rdapEndpoint === 'string' && c.rdapEndpoint ? c.rdapEndpoint : DEFAULTS.rdapEndpoint,
    whitelist: Array.isArray(c.whitelist) ? c.whitelist : DEFAULTS.whitelist,
  }
}

function flattenBookmarks(nodes, acc) {
  for (const n of nodes) {
    if (n.url) acc.push({ id: n.id, title: n.title || '', url: n.url })
    if (n.children) flattenBookmarks(n.children, acc)
  }
  return acc
}

async function tryFetch(url, method, signal) {
  const res = await fetch(url, { method, redirect: 'follow', cache: 'no-store', signal })
  return { ok: res.ok, status: res.status, url: res.url }
}

async function checkUrl(url, timeoutMs) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const head = await tryFetch(url, 'HEAD', ac.signal)
    clearTimeout(t)
    if (head.ok) return { alive: true, status: head.status, finalUrl: head.url }
    if (head.status === 405 || head.status === 501) {
      const ac2 = new AbortController()
      const t2 = setTimeout(() => ac2.abort(), timeoutMs)
      try {
        const getRes = await tryFetch(url, 'GET', ac2.signal)
        clearTimeout(t2)
        return { alive: getRes.ok, status: getRes.status, finalUrl: getRes.url }
      } catch (e) {
        clearTimeout(t2)
        return { alive: false, status: 0, finalUrl: url, error: String(e && e.message || e) }
      }
    }
    return { alive: head.ok, status: head.status, finalUrl: head.url }
  } catch (e) {
    clearTimeout(t)
    return { alive: false, status: 0, finalUrl: url, error: String(e && e.message || e) }
  }
}

function getHostname(u) {
  try { return new URL(u).hostname } catch { return '' }
}

async function checkDomainRdap(hostname, endpoint) {
  if (!hostname) return { rdapAvailable: false }
  try {
    const res = await fetch(endpoint + hostname, { redirect: 'follow', cache: 'no-store' })
    if (!res.ok) return { rdapAvailable: false }
    const data = await res.json()
    const statuses = Array.isArray(data.status) ? data.status : []
    const events = Array.isArray(data.events) ? data.events : []
    const expEvent = events.find(e => String(e.eventAction || '').toLowerCase().includes('expiration'))
    const expStr = expEvent ? (expEvent.eventDate || expEvent.date) : null
    const expTs = expStr ? Date.parse(expStr) : null
    const now = Date.now()
    const isExpired = expTs ? expTs < now : false
    const isHold = statuses.some(s => /hold/i.test(String(s)))
    return { rdapAvailable: true, isExpired: isExpired || isHold, expirationDate: expTs || null, statuses }
  } catch (e) {
    return { rdapAvailable: false }
  }
}

function isLocalHostname(hostname) {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
  if (h.endsWith('.local') || !h.includes('.')) return true
  return false
}

function isPrivateIPv4(ip) {
  if (!ip) return false
  const parts = ip.split('.').map(x => parseInt(x, 10))
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  return false
}

async function resolveDns(hostname) {
  if (!hostname) return { ok: false }
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`
    const res = await fetch(url, { headers: { 'accept': 'application/dns-json' }, cache: 'no-store' })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    const rcode = typeof data.Status === 'number' ? data.Status : data.status
    const answers = Array.isArray(data.Answer) ? data.Answer : (Array.isArray(data.answer) ? data.answer : [])
    const ips = answers.filter(a => a && (a.type === 1 || a.type === 'A') && a.data).map(a => a.data)
    return { ok: true, rcode, ips }
  } catch (e) {
    return { ok: false }
  }
}

function whitelistMatches(hostname, whitelist) {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  for (const entry of whitelist || []) {
    const e = String(entry || '').toLowerCase().trim()
    if (!e) continue
    if (e.startsWith('.')) {
      if (h === e.slice(1) || h.endsWith(e)) return true
    } else {
      if (h === e) return true
    }
  }
  return false
}

async function scanBookmarks() {
  const cfg = await loadConfig()
  const tree = await chrome.bookmarks.getTree()
  const all = flattenBookmarks(tree, [])
  const http = all.filter(b => typeof b.url === 'string' && (b.url.startsWith('http://') || b.url.startsWith('https://')))
  let done = 0
  const total = http.length
  const deadLinks = []

  const queue = [...http]
  const workers = Array.from({ length: cfg.scanConcurrency }).map(async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      const host = getHostname(item.url)
      if (whitelistMatches(host, cfg.whitelist)) {
        done += 1
        chrome.runtime.sendMessage({ type: 'scan_progress', done, total })
        continue
      }
      try { chrome.runtime.sendMessage({ type: 'scan_current', id: item.id, title: item.title, url: item.url, hostname: host }) } catch (e) {}
      const result = await checkUrl(item.url, cfg.requestTimeoutMs)
      done += 1
      chrome.runtime.sendMessage({ type: 'scan_progress', done, total })
      if (!result.alive || result.status >= 400) {
        let reason = 'http_error'
        if (result.status === 0) reason = /abort/i.test(String(result.error)) ? 'timeout' : 'network_error'
        let expirationDate = null
        let rdapStatuses = []
        const dns = await resolveDns(host)
        if (dns.ok) {
          if (dns.rcode === 3 || (Array.isArray(dns.ips) && dns.ips.length === 0)) {
            reason = 'domain_nonexistent'
          } else if (isLocalHostname(host) || (dns.ips || []).some(ip => isPrivateIPv4(ip))) {
            reason = 'local_domain'
          }
        } else if (isLocalHostname(host)) {
          reason = 'local_domain'
        }
        const rdap = await checkDomainRdap(host, cfg.rdapEndpoint)
        if (rdap.rdapAvailable) {
          rdapStatuses = rdap.statuses || []
          if (rdap.isExpired) {
            reason = 'expired_domain'
            expirationDate = rdap.expirationDate || null
          }
        }
        deadLinks.push({ id: item.id, title: item.title, url: item.url, status: result.status, finalUrl: result.finalUrl, error: result.error || '', reason, expirationDate, rdapStatuses })
      }
    }
  })

  await Promise.all(workers)
  await chrome.storage.local.set({ deadLinks, scannedAt: Date.now(), totalScanned: total })
  return { total, deadCount: deadLinks.length, deadLinks }
}

async function removeDead(ids) {
  const store = await chrome.storage.local.get(['deadLinks'])
  const list = Array.isArray(store.deadLinks) ? store.deadLinks : []
  const target = ids && ids.length ? list.filter(x => ids.includes(x.id)) : list
  let removed = 0
  for (const b of target) {
    try {
      await chrome.bookmarks.remove(b.id)
      removed += 1
    } catch (e) {}
  }
  const remaining = list.filter(x => !target.find(y => y.id === x.id))
  await chrome.storage.local.set({ deadLinks: remaining })
  return { removed, remainingCount: remaining.length }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'scan_bookmarks') {
    scanBookmarks().then(res => sendResponse(res))
    return true
  }
  if (message && message.type === 'remove_dead_bookmarks') {
    const ids = Array.isArray(message.ids) ? message.ids : []
    removeDead(ids).then(res => sendResponse(res))
    return true
  }
})

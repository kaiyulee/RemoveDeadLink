const scanBtn = document.getElementById('scanBtn')
const removeAllBtn = document.getElementById('removeAllBtn')
const progressText = document.getElementById('progressText')
const barFill = document.getElementById('barFill')
const deadList = document.getElementById('deadList')
const timeoutInput = document.getElementById('timeoutInput')
const concurrencyInput = document.getElementById('concurrencyInput')
const saveCfgBtn = document.getElementById('saveCfgBtn')
const whitelistInput = document.getElementById('whitelistInput')
const addWhitelistBtn = document.getElementById('addWhitelistBtn')
const whitelistList = document.getElementById('whitelistList')
const titleText = document.getElementById('titleText')
const summaryText = document.getElementById('summaryText')
const langSelect = document.getElementById('langSelect')
const timeoutLabel = document.getElementById('timeoutLabel')
const concurrencyLabel = document.getElementById('concurrencyLabel')
const whitelistHeading = document.getElementById('whitelistHeading')
const langLabel = document.getElementById('langLabel')
const nowScanning = document.getElementById('nowScanning')
const nowTitle = document.getElementById('nowTitle')
const nowFavicon = document.getElementById('nowFavicon')

let currentLang = 'en'
let currentFaviconRequestId = 0
const EMPTY_IMG = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const I18N = {
  zh: {
    title: '书签死链清理器',
    scan: '开始扫描',
    removeAll: '移除全部死链',
    notStarted: '未开始',
    progress: (d, t, p) => `进度：${d}/${t}（${p}%）`,
    summaryNone: '未发现死链',
    summarySome: n => `发现 ${n} 个死链`,
    timeoutLabel: '请求超时(ms)',
    concurrencyLabel: '并发数',
    save: '保存设置',
    whitelistHeading: '白名单',
    whitelistPlaceholder: '例如: localhost 或 .example.com',
    add: '添加',
    remove: '移除',
    itemRemove: '移除此项',
    addToWhitelist: '加入白名单',
    scanning: '正在扫描… 受网络超时、重定向与注册局查询影响，可能较慢',
    status: s => `状态：${s}`,
    error: e => `错误：${e}`,
    reason: {
      local_domain: { text: '本地域名', cls: 'local' },
      expired_domain: { text: '域名到期', cls: 'expired' },
      domain_nonexistent: { text: '域名不存在', cls: 'nxdomain' },
      timeout: { text: '超时', cls: 'timeout' },
      network_error: { text: '网络错误', cls: 'timeout' },
      http_error: { text: 'HTTP错误', cls: 'http' },
    },
  },
  en: {
    title: 'Bookmark Dead Link Cleaner',
    scan: 'Scan',
    removeAll: 'Remove All',
    notStarted: 'Not started',
    progress: (d, t, p) => `Progress: ${d}/${t} (${p}%)`,
    summaryNone: 'No dead links found',
    summarySome: n => `Found ${n} dead links`,
    timeoutLabel: 'Request timeout (ms)',
    concurrencyLabel: 'Concurrency',
    save: 'Save settings',
    whitelistHeading: 'Whitelist',
    whitelistPlaceholder: 'e.g. localhost or .example.com',
    add: 'Add',
    remove: 'Remove',
    itemRemove: 'Remove',
    addToWhitelist: 'Whitelist',
    scanning: 'Scanning… This may take a while due to timeouts, redirects and registry lookups',
    status: s => `Status: ${s}`,
    error: e => `Error: ${e}`,
    reason: {
      local_domain: { text: 'Local Domain', cls: 'local' },
      expired_domain: { text: 'Expired Domain', cls: 'expired' },
      domain_nonexistent: { text: 'Domain Not Found', cls: 'nxdomain' },
      timeout: { text: 'Timeout', cls: 'timeout' },
      network_error: { text: 'Network Error', cls: 'timeout' },
      http_error: { text: 'HTTP Error', cls: 'http' },
    },
  },
}

function applyI18n() {
  const t = I18N[currentLang]
  titleText.textContent = t.title
  scanBtn.textContent = t.scan
  removeAllBtn.textContent = t.removeAll
  timeoutLabel.textContent = t.timeoutLabel
  concurrencyLabel.textContent = t.concurrencyLabel
  saveCfgBtn.textContent = t.save
  whitelistHeading.textContent = t.whitelistHeading
  whitelistInput.placeholder = t.whitelistPlaceholder
  addWhitelistBtn.textContent = t.add
  langLabel.textContent = currentLang === 'zh' ? '语言' : 'Language'
}

function getDefaultWhitelist() {
  return [
    '.google.com', '.googleusercontent.com', '.gstatic.com', '.youtube.com',
    '.facebook.com', '.fb.com', '.twitter.com', '.x.com', '.instagram.com', '.whatsapp.com', '.t.co',
    '.reddit.com', '.wikipedia.org', '.medium.com', '.blogspot.com'
  ]
}

function setProgress(done, total) {
  if (!total) {
    const t = I18N[currentLang]
    progressText.textContent = t.notStarted
    barFill.style.width = '0%'
    return
  }
  const pct = Math.floor((done / total) * 100)
  const t = I18N[currentLang]
  progressText.textContent = t.progress(done, total, pct)
  barFill.style.width = `${pct}%`
}

function renderDeadList(items, showSummary) {
  deadList.innerHTML = ''
  const tr = I18N[currentLang]
  if (showSummary) {
    summaryText.textContent = items && items.length ? tr.summarySome(items.length) : tr.summaryNone
  } else {
    summaryText.textContent = ''
  }
  if (!items || !items.length) {
    removeAllBtn.disabled = true
    return
  }
  removeAllBtn.disabled = false
  for (const it of items) {
    const li = document.createElement('li')
    li.className = 'item'
    const info = document.createElement('div')
    info.className = 'info'
    const titleEl = document.createElement('div')
    titleEl.className = 'title'
    titleEl.textContent = it.title || '(无标题)'
    const u = document.createElement('div')
    u.className = 'url'
    u.textContent = it.url
    const m = document.createElement('div')
    m.className = 'meta'
    const expText = it.expirationDate ? (currentLang === 'zh' ? `过期：${new Date(it.expirationDate).toLocaleDateString()}` : `Expired: ${new Date(it.expirationDate).toLocaleDateString()}`) : ''
    const chip = document.createElement('span')
    chip.className = 'chip '
    const reasonMap = I18N[currentLang].reason
    const r = reasonMap[it.reason] || reasonMap.http_error
    chip.textContent = r.text
    chip.className = `chip ${r.cls}`
    const statusSpan = document.createElement('span')
    statusSpan.textContent = tr.status(it.status || 0)
    m.appendChild(chip)
    if (expText) {
      const e = document.createElement('span')
      e.className = 'chip expired'
      e.textContent = expText
      m.appendChild(e)
    }
    m.appendChild(statusSpan)
    if (it.error) {
      const err = document.createElement('span')
      err.className = 'chip http'
      err.textContent = tr.error(it.error)
      m.appendChild(err)
    }
    info.appendChild(titleEl)
    info.appendChild(u)
    info.appendChild(m)
    const btn = document.createElement('button')
    btn.className = 'remove'
    btn.textContent = tr.itemRemove
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'remove_dead_bookmarks', ids: [it.id] }, res => {
        if (chrome.runtime.lastError) return
        loadFromStorage()
        if (res && res.remainingCount === 0) setProgress(0, 0)
      })
    })
    const wlBtn = document.createElement('button')
    wlBtn.className = 'remove'
    wlBtn.textContent = I18N[currentLang].addToWhitelist
    wlBtn.addEventListener('click', () => addItemToWhitelist(it))
    li.appendChild(info)
    li.appendChild(btn)
    li.appendChild(wlBtn)
    deadList.appendChild(li)
  }
}

function loadFromStorage() {
  chrome.storage.local.get(['deadLinks', 'totalScanned', 'config', 'scannedAt']).then(store => {
    const hasScanned = Boolean(store.scannedAt)
    renderDeadList(store.deadLinks || [], hasScanned)
    setProgress((store.deadLinks && store.totalScanned) ? store.totalScanned : 0, store.totalScanned || 0)
    const c = store.config || { lang: 'en' }
    timeoutInput.value = typeof c.requestTimeoutMs === 'number' ? c.requestTimeoutMs : 8000
    concurrencyInput.value = typeof c.scanConcurrency === 'number' ? c.scanConcurrency : 10
    currentLang = c.lang === 'zh' ? 'zh' : 'en'
    langSelect.value = currentLang
    applyI18n()
    const wl = Array.isArray(c.whitelist) ? c.whitelist : []
    if (!wl.length) {
      const def = getDefaultWhitelist()
      chrome.storage.local.set({ config: { ...c, whitelist: def } }).then(() => renderWhitelist(def))
    } else {
      renderWhitelist(wl)
    }
  })
}

scanBtn.addEventListener('click', () => {
  deadList.innerHTML = ''
  removeAllBtn.disabled = true
  setProgress(0, 0)
  summaryText.textContent = ''
  const t = I18N[currentLang]
  summaryText.textContent = t.scanning
  nowScanning.style.display = 'flex'
  nowTitle.textContent = ''
  nowFavicon.src = EMPTY_IMG
  chrome.runtime.sendMessage({ type: 'scan_bookmarks' }, res => {
    if (chrome.runtime.lastError) return
    renderDeadList(res && res.deadLinks ? res.deadLinks : [], true)
    setProgress(res ? res.total : 0, res ? res.total : 0)
    nowScanning.style.display = 'none'
  })
})

removeAllBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'remove_dead_bookmarks' }, res => {
    if (chrome.runtime.lastError) return
    loadFromStorage()
    setProgress(0, 0)
  })
})

chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'scan_progress') setProgress(msg.done, msg.total)
  if (msg && msg.type === 'scan_current') {
    const host = msg.hostname || ''
    nowTitle.textContent = msg.title || host || msg.url || ''
    const myId = ++currentFaviconRequestId
    if (!host) { nowFavicon.src = EMPTY_IMG; return }
    const url = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host)}`
    nowFavicon.src = EMPTY_IMG
    const pre = new Image()
    pre.onload = () => { if (myId === currentFaviconRequestId) nowFavicon.src = url }
    pre.onerror = () => { if (myId === currentFaviconRequestId) nowFavicon.src = EMPTY_IMG }
    pre.src = url
  }
})

saveCfgBtn.addEventListener('click', () => {
  const timeoutMs = parseInt(timeoutInput.value, 10)
  const conc = parseInt(concurrencyInput.value, 10)
  const cfg = {
    requestTimeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1000 ? timeoutMs : 8000,
    scanConcurrency: Number.isFinite(conc) && conc > 0 ? conc : 10,
  }
  chrome.storage.local.get(['config']).then(s => {
    const prev = s.config || {}
    chrome.storage.local.set({ config: { ...prev, ...cfg } }).then(() => loadFromStorage())
  })
})

langSelect.addEventListener('change', () => {
  const v = langSelect.value === 'en' ? 'en' : 'zh'
  chrome.storage.local.get(['config']).then(s => {
    const prev = s.config || {}
    chrome.storage.local.set({ config: { ...prev, lang: v } }).then(() => {
      currentLang = v
      applyI18n()
      loadFromStorage()
    })
  })
})

function renderWhitelist(list) {
  whitelistList.innerHTML = ''
  for (const entry of list) {
    const li = document.createElement('li')
    li.className = 'wl-item'
    const span = document.createElement('span')
    span.textContent = entry
    const rm = document.createElement('button')
    rm.textContent = I18N[currentLang].remove
    rm.addEventListener('click', () => {
      chrome.storage.local.get(['config']).then(s => {
        const cfg = s.config || {}
        const wl = Array.isArray(cfg.whitelist) ? cfg.whitelist : []
        const next = wl.filter(x => x !== entry)
        chrome.storage.local.set({ config: { ...cfg, whitelist: next } }).then(() => renderWhitelist(next))
      })
    })
    li.appendChild(span)
    li.appendChild(rm)
    whitelistList.appendChild(li)
  }
}

addWhitelistBtn.addEventListener('click', () => {
  const v = (whitelistInput.value || '').trim().toLowerCase()
  if (!v) return
  chrome.storage.local.get(['config']).then(s => {
    const cfg = s.config || {}
    const wl = Array.isArray(cfg.whitelist) ? cfg.whitelist : []
    if (wl.includes(v)) return
    const next = [...wl, v]
    chrome.storage.local.set({ config: { ...cfg, whitelist: next } }).then(() => {
      whitelistInput.value = ''
      renderWhitelist(next)
    })
  })
})

function getHostname(u) { try { return new URL(u).hostname } catch { return '' } }

function addItemToWhitelist(item) {
  const host = getHostname(item.url)
  if (!host) return
  chrome.storage.local.get(['config', 'deadLinks']).then(s => {
    const cfg = s.config || {}
    const wl = Array.isArray(cfg.whitelist) ? cfg.whitelist : []
    if (!wl.includes(host)) wl.push(host)
    const list = Array.isArray(s.deadLinks) ? s.deadLinks : []
    const nextList = list.filter(x => x.id !== item.id)
    chrome.storage.local.set({ config: { ...cfg, whitelist: wl }, deadLinks: nextList }).then(() => {
      renderWhitelist(wl)
      renderDeadList(nextList, true)
    })
  })
}

loadFromStorage()

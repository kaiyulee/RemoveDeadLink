# Bookmark Dead Link Cleaner

Scan bookmarks for dead links and clean with one click. Detects HTTP errors, timeouts, expired or missing domains. Whitelist.

## Development
- Load unpacked in Chrome: `chrome://extensions` → Enable Developer Mode → Load unpacked → pick repo root
- Click the extension icon to open the popup and run a scan

## Pack
```bash
bash scripts/pack.sh
```

## Privacy & Permissions
- Privacy policy: see `store/privacy.en.html` or your GitHub Pages link
- Permissions: `bookmarks`, `storage`, `<all_urls>` for reachability checks

## Release
- Tag `v*` to auto-build and attach zip via GitHub Actions

## License
MIT
# Privacy Practices and Permission Justifications

## Data Collection
- No personal data collected, transmitted or sold.
- All processing happens locally in the browser.

## Single‑Purpose Description
- The extension’s sole purpose is to detect dead bookmarks and help the user remove them.

## Permissions Justification
### bookmarks
- Used to read the bookmarks tree in order to scan URLs and, upon explicit user action, remove selected dead bookmarks.
- No other bookmark metadata is read or transmitted; operations are on‑device only.

### host permissions (<all_urls>)
- Required to perform `HEAD/GET` requests to bookmarked URLs to verify reachability.
- No content scripts are injected into pages. No tracking or analytics are performed.
- Requests are made only during an on‑demand scan or when the user removes items.

### storage
- Stores user settings (timeout, concurrency, language, whitelist) and last scan results locally (`chrome.storage.local`).
- No sync to external services; the user can clear data by removing the extension or clearing site data.

### Remote Code
- The extension does not download or execute remote code, scripts, or configuration that alters execution.
- Network calls are limited to:
  - Bookmarked URLs (HEAD/GET) for availability checks
  - Public RDAP endpoints (domain status/expiration)
  - DNS‑over‑HTTPS (NXDOMAIN checks)
- These calls are strictly for validation and do not execute returned content.

## Data Usage Compliance
- Complies with the Chrome Web Store Developer Program Policies: no data collection beyond the stated purpose; transparent permission use; single, narrow purpose.

## Contact
- Please add your contact email in the Account tab. The project itself does not embed a contact address.
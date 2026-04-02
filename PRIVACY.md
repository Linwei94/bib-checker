# Privacy Policy — DeHallucinate Reference Checker

**Last updated: April 2026**

## Data Collection

DeHallucinate Reference Checker does **not** collect, transmit, or store any personal data on external servers.

## What stays on your device

- Your `.bib` file content is stored only in your browser's `localStorage` for session persistence.
- It is never uploaded to any server.

## Network requests

The only external network requests made by this extension are:

1. **`scholar.google.com`** — opened as a browser tab (user-initiated via the batch fetch feature) to search for your references, exactly as you would do manually.
2. **`scholar.googleusercontent.com`** — fetched to retrieve the raw BibTeX content returned by Google Scholar.

No data is sent to any third-party server operated by the extension author.

## Permissions

- **`tabs`** — required to open Google Scholar tabs programmatically and to send messages between the extension page and the Scholar content script.

## Contact

Questions or concerns: open an issue at [github.com/Linwei94/bib-checker](https://github.com/Linwei94/bib-checker)

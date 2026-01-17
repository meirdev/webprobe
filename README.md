# WebProbe

A web crawler and probe tool that explores websites, collects links, tracks HTTP requests, and generates an HTML report. Built with Playwright and uses stealth mode to avoid bot detection.

## Installation

To install dependencies:

```bash
bun install
bunx playwright install-deps chromium
bunx playwright install chromium
```

## Usage

```bash
bun run index.ts <url> [options]
```

### Options

| Option              | Alias | Default                   | Description                                      |
| ------------------- | ----- | ------------------------- | ------------------------------------------------ |
| `--domain`          | `-d`  | URL's domain + subdomains | Only include pages from specified domains        |
| `--show-browser`    | `-S`  | `false`                   | Show browser window (disable headless mode)      |
| `--human`           | `-u`  | `false`                   | Imitate human behavior                           |
| `--max-pages`       | `-m`  | `25`                      | Maximum number of pages to check                 |
| `--delay`           | `-w`  | `0`                       | Seconds to wait between pages                    |
| `--network-timeout` | `-t`  | `10`                      | Seconds to wait for network requests to complete |
| `--output`          | `-o`  | `report.html`             | Output path for the HTML report                  |

### Examples

```bash
# Basic usage
bun run index.ts https://example.com

# Crawl with visible browser and human behavior
bun run index.ts https://example.com -S -u

# Limit to 10 pages with 2 second delay
bun run index.ts https://example.com -m 10 -w 2

# Custom domain filter and output
bun run index.ts https://example.com -d example.com -d "*.example.com" -o my-report.html
```

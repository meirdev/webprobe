#!/usr/bin/env bun

import chalk from "chalk";
import isValidDomain from "is-valid-domain";
import micromatch from "micromatch";
import type { Page } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import yargs, { type Argv } from "yargs";
import { hideBin } from "yargs/helpers";

chromium.use(stealth());

const SKIP_EXTENSIONS = [
  // Archives
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  ".rar",
  ".7z",
  ".bz2",
  // Documents
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".svg",
  ".webp",
  ".ico",
  ".tiff",
  // Audio
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".aac",
  ".m4a",
  // Video
  ".mp4",
  ".avi",
  ".mkv",
  ".mov",
  ".wmv",
  ".webm",
  ".flv",
  // Fonts
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  // Data
  ".json",
  ".xml",
  ".csv",
  ".rss",
  ".atom",
  // Code/binary
  ".exe",
  ".dmg",
  ".apk",
  ".deb",
  ".rpm",
  ".msi",
  ".bin",
  ".iso",
  // Source maps & misc
  ".map",
  ".wasm",
];

function shouldSkipUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return SKIP_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

async function saveReport({
  outputPath,
  url,
  links,
  visits,
  requests,
  domains,
}: {
  outputPath: string;
  url: string;
  links: Set<string>;
  visits: Set<string>;
  requests: Map<string, number>;
  domains: Set<string>;
}) {
  const errorRequests = [...requests.entries()].filter(
    ([, status]) => status >= 400,
  );
  const okRequests = [...requests.entries()].filter(
    ([, status]) => status < 400,
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Probe Report - ${url}</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="bg-gray-100 min-h-screen p-6">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-800 mb-2">Probe Report</h1>
    <p class="text-gray-600 mb-1">Target: <a href="${url}" class="text-blue-600 hover:underline">${url}</a></p>
    <p class="text-gray-500 text-sm mb-6">Generated: ${new Date().toISOString()}</p>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm text-gray-500 mb-1">Pages Visited</h3>
        <div class="text-3xl font-bold text-gray-800">${visits.size}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm text-gray-500 mb-1">Links Found</h3>
        <div class="text-3xl font-bold text-gray-800">${links.size}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm text-gray-500 mb-1">OK Requests</h3>
        <div class="text-3xl font-bold text-green-600">${okRequests.length}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm text-gray-500 mb-1">Error Requests</h3>
        <div class="text-3xl font-bold text-red-600">${errorRequests.length}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm text-gray-500 mb-1">Domains</h3>
        <div class="text-3xl font-bold text-gray-800">${domains.size}</div>
      </div>
    </div>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-3">Requests (${requests.size})</h2>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-600">URL</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-600 w-24">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${[...requests.entries()]
              .sort(
                ([urlA, statusA], [urlB, statusB]) =>
                  statusB - statusA || urlA.localeCompare(urlB),
              )
              .map(
                ([reqUrl, status]) =>
                  `<tr class="hover:bg-gray-50"><td class="px-4 py-3 text-sm"><a href="${reqUrl}" class="text-blue-600 hover:underline break-all">${decodeURIComponent(reqUrl)}</a></td><td class="px-4 py-3 text-sm"><span class="px-2 py-1 rounded text-xs font-medium ${status < 400 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}">${status}</span></td></tr>`,
              )
              .join("\n")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-3">Visited Pages (${visits.size})</h2>
      <ul class="bg-white rounded-lg shadow divide-y divide-gray-100">
        ${[...visits]
          .sort()
          .map(
            (v) =>
              `<li class="px-4 py-3"><a href="${v}" class="text-blue-600 hover:underline break-all">${decodeURIComponent(v)}</a></li>`,
          )
          .join("\n")}
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-3">All Links Found (${links.size})</h2>
      <ul class="bg-white rounded-lg shadow divide-y divide-gray-100">
        ${[...links]
          .sort()
          .map(
            (l) =>
              `<li class="px-4 py-3"><a href="${l}" class="text-blue-600 hover:underline break-all">${decodeURIComponent(l)}</a></li>`,
          )
          .join("\n")}
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-3">Domains (${domains.size})</h2>
      <ul class="bg-white rounded-lg shadow divide-y divide-gray-100">
        ${[...domains]
          .sort()
          .map((d) => `<li class="px-4 py-3 text-gray-700">${d}</li>`)
          .join("\n")}
      </ul>
    </section>
  </div>
</body>
</html>`;

  await Bun.write(outputPath, html);
}

// from: https://github.com/HasData/cloudflare-bypass/blob/main/NodeJS/human_behavior.js
async function humanBehavior(page: Page) {
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * 700) + 100;
    const y = Math.floor(Math.random() * 500) + 100;
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 20) + 5 });
    await page.waitForTimeout(Math.random() * 400 + 200);
  }

  for (let i = 0; i < 3; i++) {
    await page.evaluate("window.scrollBy(0, window.innerHeight * 0.8)");
    await page.waitForTimeout(Math.random() * 700 + 500);
  }

  await page.waitForTimeout(Math.random() * 500 + 500);
  await page.evaluate("window.scrollBy(0, -window.innerHeight * 0.5)");
  await page.waitForTimeout(Math.random() * 500 + 300);

  //   const bx = Math.floor(Math.random() * 700) + 50;
  //   const by = Math.floor(Math.random() * 500) + 50;
  //   await page.mouse.click(bx, by);
  //   await page.waitForTimeout(Math.random() * 1000 + 1000);
}

async function probe({
  url,
  domain,
  headless,
  networkTimeout,
  human,
  maxPages,
  delay,
  outputPath,
}: {
  url: string;
  domain: string[];
  headless: boolean;
  networkTimeout: number;
  human: boolean;
  maxPages: number;
  delay: number;
  outputPath: string;
}) {
  const links = new Set<string>();
  const visits = new Set<string>();
  const requests = new Map<string, number>();
  const domains = new Set<string>();

  const browser = await chromium.launch({
    headless,
  });

  const page = await browser.newPage();

  page.on("response", (response) => {
    try {
      const requestUrl = new URL(response.url());
      domains.add(requestUrl.hostname);

      const status = response.status();
      const statusText = response.ok()
        ? chalk.green(status)
        : chalk.red(status);
      console.log(`Request: ${response.url()}`, statusText);

      if (domain.includes(requestUrl.hostname)) {
        requests.set(response.url(), status);
      }
    } catch {}
  });

  let nextUrl = url;

  for (let i = 0; i < maxPages; i++) {
    visits.add(nextUrl);

    console.log(chalk.cyan(`Visiting: ${nextUrl}`));

    const response = await page
      .goto(nextUrl, { waitUntil: "networkidle", timeout: networkTimeout })
      .catch(() => {});

    const title = await page.title().catch(() => "");

    if (human) {
      await humanBehavior(page);
    }

    const anchors = await page.locator("a[href]").all();

    for (const anchor of anchors) {
      const href = await anchor.getAttribute("href");
      if (href) {
        try {
          const absoluteUrl = new URL(href, url);
          absoluteUrl.hash = "";
          if (
            domain.some((d) => micromatch.isMatch(absoluteUrl.hostname, d)) &&
            !shouldSkipUrl(absoluteUrl.href)
          ) {
            links.add(absoluteUrl.href);
          }
        } catch {}
      }
    }

    if (response) {
      const status = response.status();
      const statusText = response.ok()
        ? chalk.green(status)
        : chalk.red(status);

      console.log(chalk.gray(`Title: ${title}`), statusText);
    } else {
      console.error(chalk.gray(`Title: ${title}`), chalk.red("timeout"));
    }

    await page.waitForTimeout(delay);

    const unvisited = [...links.difference(visits)];
    if (unvisited.length === 0) {
      console.log(chalk.yellow("No unvisited pages remaining"));
      break;
    }
    nextUrl = unvisited[Math.floor(Math.random() * unvisited.length)]!;
  }

  await browser.close();

  await saveReport({
    outputPath,
    url,
    links,
    visits,
    requests,
    domains,
  });

  console.log(chalk.green(`\nReport saved to: ${outputPath}`));
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <url> [options]")
    .command("$0 <url>", "Probe a website", (yargs: Argv) => {
      return yargs.positional("url", {
        describe: "The URL to probe",
        type: "string",
        demandOption: true,
      });
    })
    .option("domain", {
      alias: "d",
      type: "string",
      array: true,
      description:
        "Only include pages from this domain (defaults to the URL's domain and all its subdomains)",
    })
    .option("show-browser", {
      alias: "S",
      type: "boolean",
      default: false,
      description: "Show browser window (disable headless mode)",
    })
    .option("human", {
      alias: "u",
      type: "boolean",
      default: false,
      description: "Imitate human behavior",
    })
    .option("max-pages", {
      alias: "m",
      type: "number",
      default: 25,
      description: "Maximum number of pages to check",
    })
    .option("delay", {
      alias: "w",
      type: "number",
      default: 0,
      description: "Seconds to wait between pages",
    })
    .option("network-timeout", {
      alias: "t",
      type: "number",
      default: 10,
      description: "Seconds to wait for network requests to complete",
    })
    .option("output", {
      alias: "o",
      type: "string",
      default: "report.html",
      description: "Output path for the HTML report",
    })
    .check((argv) => {
      try {
        new URL(argv.url as string);
      } catch {
        throw new Error(`Invalid URL: ${argv.url}`);
      }

      const domains = argv.domain as string[] | undefined;
      if (domains) {
        for (const domain of domains) {
          if (!isValidDomain(domain)) {
            throw new Error(`Invalid domain: ${domain}`);
          }
        }
      }

      return true;
    })
    .help()
    .version(false)
    .alias("help", "h")
    .strict()
    .parse();

  let domain = argv.domain || [];
  if (domain.length === 0) {
    const { hostname } = new URL(argv.url as string);
    domain = [hostname, `*.${hostname}`];
  }

  console.log(chalk.bold("URL:"), chalk.blue(argv.url));
  console.log(chalk.bold("Domains:"), chalk.blue(domain.join(", ")));
  console.log(
    chalk.bold("Headless:"),
    !argv.showBrowser ? chalk.green("true") : chalk.yellow("false"),
  );
  console.log(
    chalk.bold("Human:"),
    argv.human ? chalk.green("true") : chalk.gray("false"),
  );
  console.log(chalk.bold("Max Pages:"), chalk.blue(argv.maxPages));
  console.log(chalk.bold("Delay:"), chalk.blue(argv.delay), "seconds");
  console.log(
    chalk.bold("Network Timeout:"),
    chalk.blue(argv.networkTimeout),
    "seconds",
  );
  console.log(chalk.bold("Output:"), chalk.blue(argv.output));

  await probe({
    url: argv.url as string,
    domain,
    headless: !argv.showBrowser,
    networkTimeout: argv.networkTimeout * 1000,
    human: argv.human,
    maxPages: argv.maxPages,
    delay: argv.delay * 1000,
    outputPath: argv.output,
  });
}

main();

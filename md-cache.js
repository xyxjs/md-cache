import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import fm from "front-matter";

export default class MarkdownCache {
  constructor(options = {}) {
    if (!options.md) {
      throw new Error("No markdown-it provide!");
    }

    this.md = options.md;
    this.fmParser = fm;

    this.root = options.root || process.cwd();
    this.mdRoot = options.mdRoot || "markdown";

    this.markdownDir = path.join(this.root, this.mdRoot);

    this.cacheDir = path.join(this.root, ".cache");
    this.htmlCacheDir = path.join(this.cacheDir, "md_html");
    this.fmCacheDir = path.join(this.cacheDir, "md_fm");

    this.metadataPath = path.join(this.cacheDir, "md_cache.json");

    this._initPromise = null;
  }

  async _init() {
    await fs.mkdir(this.htmlCacheDir, { recursive: true });
    await fs.mkdir(this.fmCacheDir, { recursive: true });

    try {
      await fs.access(this.metadataPath);
    } catch {
      await fs.writeFile(this.metadataPath, "{}", "utf-8");
    }
  }

  async _ensureInit() {
    if (!this._initPromise) {
      this._initPromise = () => this._init();
    }
    await this._initPromise();
  }

  _getHash(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  _getCacheKey(requestPath) {
    return this._getHash(requestPath);
  }

  async _readMetadata() {
    const data = await fs.readFile(this.metadataPath, "utf-8");
    return JSON.parse(data || "{}");
  }

  async _writeMetadata(metadata) {
    await fs.writeFile(this.metadataPath, JSON.stringify(metadata), "utf-8");
  }

  async _readMarkdown(requestPath) {
    const fullPath = path.join(this.markdownDir, requestPath);
    return fs.readFile(fullPath, "utf-8");
  }

  _getFrontmatter(attributes) {
    return Object.assign(
      { author: "xyxjs", license: "CC BY-NC-SA 4.0" },
      attributes,
    );
  }

  async _build(requestPath) {
    await this._ensureInit();

    let rawContent;
    try {
      rawContent = await this._readMarkdown(requestPath);
    } catch {
      return null;
    }

    const parsed = this.fmParser(rawContent);

    const fmJson = this._getFrontmatter(parsed.attributes);
    const mdBody = parsed.body + "\n[TOC]\n";

    const contentHash = this._getHash(rawContent);
    const cacheKey = this._getCacheKey(requestPath);

    const metadata = await this._readMetadata();
    const record = metadata[requestPath];

    const htmlPath = path.join(this.htmlCacheDir, `${cacheKey}.html`);
    const jsonPath = path.join(this.fmCacheDir, `${cacheKey}.json`);

    if (record && record.hash === contentHash) {
      try {
        const [html, json] = await Promise.all([
          fs.readFile(htmlPath, "utf-8"),
          fs.readFile(jsonPath, "utf-8"),
        ]);

        return {
          html,
          fm: JSON.parse(json),
        };
      } catch {}
    }

    const html = this.md.render(mdBody);

    await Promise.all([
      fs.writeFile(htmlPath, html, "utf-8"),
      fs.writeFile(jsonPath, JSON.stringify(fmJson), "utf-8"),
    ]);

    metadata[requestPath] = {
      hash: contentHash,
      cacheFileName: cacheKey,
      updatedAt: Date.now(),
    };

    await this._writeMetadata(metadata);

    return {
      html,
      fm: fmJson,
    };
  }

  async html(requestPath) {
    const result = await this._build(requestPath);
    return result ? result.html : "Markdown file not found.";
  }

  async fm(requestPath) {
    const result = await this._build(requestPath);
    return result ? result.fm : {};
  }
}

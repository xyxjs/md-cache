# md-cache

## Introduction

It is a light weight way to get your markdown files by only rendering it when it changes.

Spawn `.cache` dir in your root dir.

Support frontmatter.

## Install

```bash
npm i markdown-cache
```

## Use

Use `express` server for example.

```js
import express from "express";
import MarkdownCache from "markdown-cache";
import markdownIt from "markdown-it";

const app = express();

const md = new markdownIt();

const mdCacheEngine = new MarkdownCache({
  md: md, // markdown-it, error if not get it
  root: "./", // working root dir, default to process.cwd()
  mdRoot: "markdown" // dir to your md files, default to "markdown"
});

app.use(/\.md$/, (req, res, next) => {
  res.send(await mdCacheEngine.html(req.path));
});

app.listen(8080);
```

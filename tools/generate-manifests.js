#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const root = process.cwd();
const projectsDir = path.join(root, "projects");
const mediaDir = path.join(root, "media");
const videosDir = path.join(root, "videos");
const imagesDir = path.join(root, "images");

const imageExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const videoExt = new Set([".mp4", ".webm", ".mov", ".m4v"]);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await ensureDir(projectsDir);
  await ensureDir(mediaDir);
  await ensureDir(videosDir);
  await ensureDir(imagesDir);

  const projectSlugs = await buildProjectManifest();
  const mediaItems = await buildFlatMediaManifest(mediaDir, "media");
  const videoItems = await buildFlatMediaManifest(videosDir, "videos");
  const imageItems = await buildFlatMediaManifest(imagesDir, "images");

  await writeJSON(path.join(projectsDir, "index.json"), projectSlugs);
  await writeJSON(path.join(mediaDir, "index.json"), { items: mediaItems });
  await writeJSON(path.join(videosDir, "index.json"), { items: videoItems });
  await writeJSON(path.join(imagesDir, "index.json"), { items: imageItems });

  console.log(`Manifest generation complete. Projects: ${projectSlugs.length}`);
}

async function buildProjectManifest() {
  const dirents = await fs.readdir(projectsDir, { withFileTypes: true });
  const slugs = [];

  for (const entry of dirents) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const projectPath = path.join(projectsDir, slug);
    const metaPath = path.join(projectPath, "meta.json");
    let meta;

    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
    } catch {
      continue;
    }

    const projectFiles = await fs.readdir(projectPath);
    const mediaFiles = projectFiles
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExt.has(ext) || videoExt.has(ext);
      })
      .map((file) => `projects/${slug}/${file}`);

    if (!Array.isArray(meta.gallery) || meta.gallery.length === 0) {
      meta.gallery = mediaFiles.filter((asset) => asset !== meta.thumbnail);
    }

    if (!meta.thumbnail) {
      meta.thumbnail = mediaFiles.find((asset) => imageExt.has(path.extname(asset).toLowerCase())) || "";
    }

    if (!meta.previewVideo) {
      meta.previewVideo = mediaFiles.find((asset) => videoExt.has(path.extname(asset).toLowerCase())) || "";
    }

    if (!meta.heroVideo) {
      meta.heroVideo = meta.previewVideo || "";
    }

    await writeJSON(metaPath, meta);
    slugs.push(slug);
  }

  return slugs;
}

async function buildFlatMediaManifest(directory, prefix) {
  const files = await fs.readdir(directory);
  const items = [];

  // Preserve manually added external entries (e.g. YouTube links)
  // so `npm run build:manifests` does not remove them.
  let preservedItems = [];
  const existingIndexPath = path.join(directory, "index.json");
  try {
    const existing = JSON.parse(await fs.readFile(existingIndexPath, "utf8"));
    if (Array.isArray(existing.items)) {
      preservedItems = existing.items.filter((item) => {
        if (!item || typeof item !== "object") return false;
        if (typeof item.src !== "string") return false;
        return item.src.startsWith("http://") || item.src.startsWith("https://");
      });
    }
  } catch {
    preservedItems = [];
  }

  for (const filename of files) {
    if (filename === "index.json") continue;
    const ext = path.extname(filename).toLowerCase();
    const src = `${prefix}/${filename}`;

    if (videoExt.has(ext)) {
      items.push({
        title: humanize(filename),
        src,
        type: "video",
        filterType: inferFilter(filename, "Video")
      });
      continue;
    }

    if (imageExt.has(ext)) {
      items.push({
        title: humanize(filename),
        src,
        type: "image",
        filterType: inferFilter(filename, "Image")
      });
    }
  }

  const merged = [...preservedItems, ...items];
  const seen = new Set();
  return merged.filter((item) => {
    if (!item?.src || seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

function inferFilter(name, fallback) {
  const lower = name.toLowerCase();
  if (lower.includes("motion")) return "Motion";
  if (lower.includes("live")) return "Live";
  if (lower.includes("graphic")) return "Graphics";
  if (lower.includes("video")) return "Video";
  if (lower.includes("image") || lower.includes("photo")) return "Image";
  return fallback;
}

function humanize(name) {
  return name
    .replace(path.extname(name), "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJSON(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, text, "utf8");
}

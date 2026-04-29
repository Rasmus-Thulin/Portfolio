# Premium Portfolio CV

High-end, dark-mode portfolio and CV site for a technical producer and digital content creator.

## Features

- Fullscreen hero with autoplay background video (`media/hero.mp4`)
- Dynamic project loading from `projects/<slug>/meta.json`
- Dynamic media library loaded from `media`, `videos`, and `images`
- Project detail modal with hero media, tools, gallery, and external links
- Tag filtering for projects and smart media-type filtering
- Premium visual style, smooth reveal animations, subtle ambient background motion
- Responsive layout for desktop and mobile

## Quick Start

1. Generate manifests:

```bash
npm run build:manifests
```

2. Start a local server:

```bash
npm run dev
```

3. Open:

`http://localhost:4173`

## Content Model

### Projects

Each project folder in `projects/` should include at minimum a `meta.json`:

```json
{
  "title": "Project Name",
  "description": "Short description",
  "tags": ["Live", "Motion"],
  "year": "2026",
  "tools": ["After Effects", "JavaScript"],
  "thumbnail": "projects/project-name/thumbnail.jpg",
  "previewVideo": "projects/project-name/preview.mp4",
  "heroVideo": "projects/project-name/hero.mp4",
  "gallery": [
    "projects/project-name/shot-1.jpg",
    "projects/project-name/shot-2.jpg"
  ],
  "embeds": [
    { "label": "YouTube", "url": "https://youtube.com/..." }
  ]
}
```

`npm run build:manifests` writes:

- `projects/index.json` (all project slugs)
- `media/index.json`
- `videos/index.json`
- `images/index.json`

### Media

Drop assets into:

- `media/` (hero video, highlight media, misc)
- `videos/` (library videos)
- `images/` (library images)

File names can include keywords (`motion`, `live`, `graphic`, `video`, `image`) to improve auto filter categorization.

## Notes

- The site is fully static and deployable on any static host.
- Keep videos optimized for web playback (H.264 MP4 recommended).
- Missing media files are handled gracefully in UI, but best results come from complete project folders.

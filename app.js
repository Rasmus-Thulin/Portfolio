const state = {
  projects: [],
  mediaItems: [],
  projectFilter: "All",
  mediaFilter: "All"
};

const projectsGrid = document.getElementById("projectsGrid");
const projectFilters = document.getElementById("projectFilters");
const mediaGrid = document.getElementById("mediaGrid");
const mediaFilters = document.getElementById("mediaFilters");
const projectTemplate = document.getElementById("projectCardTemplate");
const mediaTemplate = document.getElementById("mediaItemTemplate");
const modal = document.getElementById("projectModal");
const modalInner = document.getElementById("modalInner");

init();

async function init() {
  bindUI();
  observeReveal();

  const [projects, media] = await Promise.all([loadProjects(), loadMedia()]);
  state.projects = projects;
  state.mediaItems = media;

  renderProjectFilters();
  renderProjects();
  renderMediaFilters();
  renderMedia();
}

function bindUI() {
  document.addEventListener("click", (event) => {
    const closeTarget = event.target.closest("[data-close='modal']");
    if (closeTarget) closeModal();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  const cursor = document.querySelector(".cursor-dot");
  window.addEventListener("pointermove", (event) => {
    if (!cursor) return;
    cursor.style.opacity = "1";
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });

  const hero = document.getElementById("heroVideo");
  hero?.addEventListener("error", () => {
    hero.style.display = "none";
  });
}

async function loadProjects() {
  const slugs = await fetchJSON("projects/index.json", []);
  if (!Array.isArray(slugs) || !slugs.length) return [];

  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const meta = await fetchJSON(`projects/${slug}/meta.json`, null);
      if (!meta) return null;
      return {
        slug,
        ...meta,
        path: `projects/${slug}`
      };
    })
  );

  return entries.filter(Boolean);
}

async function loadMedia() {
  const [mediaRoot, videosRoot, imagesRoot] = await Promise.all([
    fetchJSON("media/index.json", { items: [] }),
    fetchJSON("videos/index.json", { items: [] }),
    fetchJSON("images/index.json", { items: [] })
  ]);

  const rootItems = Array.isArray(mediaRoot.items) ? mediaRoot.items : [];
  const videoItems = Array.isArray(videosRoot.items) ? videosRoot.items : [];
  const imageItems = Array.isArray(imagesRoot.items) ? imagesRoot.items : [];

  return [...rootItems, ...videoItems, ...imageItems].map((item) => ({
    ...item,
    filterType: item.filterType || item.type || "Other"
  }));
}

function renderProjectFilters() {
  const tags = new Set(["All"]);
  state.projects.forEach((project) => {
    (project.tags || []).forEach((tag) => tags.add(tag));
  });

  projectFilters.innerHTML = "";
  Array.from(tags).forEach((tag) => {
    const btn = createFilterButton(tag, state.projectFilter === tag, () => {
      state.projectFilter = tag;
      renderProjectFilters();
      renderProjects();
    });
    projectFilters.appendChild(btn);
  });
}

function renderProjects() {
  projectsGrid.innerHTML = "";
  const filtered = state.projects.filter((project) => {
    if (state.projectFilter === "All") return true;
    return (project.tags || []).includes(state.projectFilter);
  });

  if (!filtered.length) {
    projectsGrid.innerHTML =
      '<div class="empty-state">No projects found. Add project folders with meta.json, then run npm run build:manifests.</div>';
    return;
  }

  filtered.forEach((project) => {
    const fragment = projectTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".project-card");
    const button = fragment.querySelector(".project-visual");
    const thumb = fragment.querySelector(".thumb");
    const preview = fragment.querySelector(".preview");
    const year = fragment.querySelector(".year-badge");

    thumb.src = project.thumbnail || `${project.path}/thumbnail.jpg`;
    thumb.alt = `${project.title} thumbnail`;

    if (project.previewVideo) {
      preview.src = project.previewVideo;
    } else {
      preview.remove();
    }

    year.textContent = project.year || "";
    fragment.querySelector("h3").textContent = project.title || "Untitled Project";
    fragment.querySelector(".description").textContent = project.description || "";

    const tagsWrap = fragment.querySelector(".tag-row");
    (project.tags || []).forEach((tag) => {
      const badge = document.createElement("span");
      badge.textContent = tag;
      tagsWrap.appendChild(badge);
    });

    button.addEventListener("mouseenter", () => {
      card.classList.add("is-hovering");
      if (preview.src) preview.play().catch(() => {});
    });

    button.addEventListener("mouseleave", () => {
      card.classList.remove("is-hovering");
      preview.pause();
      preview.currentTime = 0;
    });

    button.addEventListener("click", () => openProjectModal(project));
    projectsGrid.appendChild(fragment);
  });

  observeReveal();
}

function renderMediaFilters() {
  const filters = new Set(["All"]);
  state.mediaItems.forEach((item) => filters.add(item.filterType || "Other"));

  mediaFilters.innerHTML = "";
  Array.from(filters).forEach((filter) => {
    const btn = createFilterButton(filter, state.mediaFilter === filter, () => {
      state.mediaFilter = filter;
      renderMediaFilters();
      renderMedia();
    });
    mediaFilters.appendChild(btn);
  });
}

function renderMedia() {
  mediaGrid.innerHTML = "";
  const filtered = state.mediaItems.filter((item) => {
    if (state.mediaFilter === "All") return true;
    return item.filterType === state.mediaFilter;
  });

  if (!filtered.length) {
    mediaGrid.innerHTML =
      '<div class="empty-state">No media found. Add assets in media, videos, or images folders and run npm run build:manifests.</div>';
    return;
  }

  filtered.forEach((item) => {
    const fragment = mediaTemplate.content.cloneNode(true);
    const mediaVideo = fragment.querySelector(".media-video");
    const mediaImage = fragment.querySelector(".media-image");

    if (item.type === "youtube") {
      const ytMatch = item.src.match(/[?&]v=([^&]+)/);
      const ytId = ytMatch ? ytMatch[1] : "";
      mediaVideo.remove();
      mediaImage.remove();
      const ytWrap = document.createElement("a");
      ytWrap.href = item.src;
      ytWrap.target = "_blank";
      ytWrap.rel = "noreferrer";
      ytWrap.className = "media-yt-wrap";
      ytWrap.dataset.ytId = ytId;
      ytWrap.dataset.ytTitle = item.title || "";
      ytWrap.addEventListener("click", (e) => {
        e.preventDefault();
        openYouTubeModal(ytId, item.title || "");
      });
      ytWrap.innerHTML = `<img src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg" alt="${item.title || "YouTube"}" loading="lazy" /><span class="media-yt-play" aria-hidden="true">&#9654;</span>`;
      fragment.querySelector("article").prepend(ytWrap);
    } else if (item.type === "video") {
      mediaVideo.src = item.src;
      if (item.poster) mediaVideo.poster = item.poster;
      mediaImage.remove();
    } else {
      mediaImage.src = item.src;
      mediaImage.alt = item.title || "Media item";
      mediaVideo.remove();
    }

    fragment.querySelector(".media-item-meta").textContent = [item.title, item.filterType]
      .filter(Boolean)
      .join(" / ");

    mediaGrid.appendChild(fragment);
  });

  observeReveal();
}

function openProjectModal(project) {
  const toolTags = (project.tools || []).map((tool) => `<span>${escapeHTML(tool)}</span>`).join("");
  const embeds = (project.embeds || [])
    .map((embed) => `<a class="secondary-btn" target="_blank" rel="noreferrer" href="${escapeAttr(embed.url)}">${escapeHTML(embed.label || "External Link")}</a>`)
    .join(" ");

  const galleryItems = (project.gallery || [])
    .map((item) => {
      if (isVideo(item)) {
        return `<video controls preload="none" src="${escapeAttr(item)}"></video>`;
      }
      return `<img src="${escapeAttr(item)}" alt="${escapeAttr(project.title)} gallery image" loading="lazy" />`;
    })
    .join("");

  const heroMedia = project.heroVideo
    ? `<video class="modal-hero" controls autoplay muted loop playsinline src="${escapeAttr(project.heroVideo)}"></video>`
    : `<img class="modal-hero" src="${escapeAttr(project.thumbnail || `${project.path}/thumbnail.jpg`)}" alt="${escapeAttr(project.title)}" />`;

  modalInner.innerHTML = `
    ${heroMedia}
    <h2>${escapeHTML(project.title || "Untitled")}</h2>
    <p>${escapeHTML(project.description || "")}</p>
    <div class="tech-stack">${toolTags}</div>
    <div class="modal-gallery">${galleryItems}</div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem;">${embeds}</div>
  `;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modalInner.innerHTML = "";
}

function openYouTubeModal(ytId, title) {
  modalInner.innerHTML = `
    <div class="yt-modal-wrap">
      ${title ? `<h3 class="yt-modal-title">${escapeHTML(title)}</h3>` : ""}
      <div class="yt-iframe-wrap">
        <iframe
          src="https://www.youtube.com/embed/${ytId}?autoplay=1"
          title="${escapeAttr(title)}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function createFilterButton(label, isActive, onClick) {
  const btn = document.createElement("button");
  btn.className = `filter-btn${isActive ? " active" : ""}`;
  btn.textContent = label;
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

async function fetchJSON(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return await response.json();
  } catch {
    return fallback;
  }
}

function observeReveal() {
  const elements = document.querySelectorAll(".reveal:not(.visible)");
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  elements.forEach((el) => observer.observe(el));
}

function isVideo(path) {
  return /\.(mp4|webm|mov|m4v)$/i.test(path || "");
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHTML(value).replaceAll("`", "&#96;");
}

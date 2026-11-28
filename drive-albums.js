// Drive folders use the Albums navigation and detail shell.
(() => {
 const D = window.LDrive;
 if (!D) return;
 const folderMime = "application/vnd.google-apps.folder";
 const pages = new Map(), routes = new Map(), thumbnails = new Map(), observers = new Map();
 const queue = [];
 let running = 0, account = "", route = null, rootSlot, detailSlot;
 const drives = () => D.albumDrives();
 const identity = (conn, id) => JSON.stringify([conn, id]);
 const coverId = (conn, id) => AlbumCovers.key("drive", conn, id);
 const path = r => "albdrive/" + [r.conn, ...r.stack.map(f => f.id)].map(encodeURIComponent).join("/");
 const current = () => route?.stack.at(-1);
 const root = {id: "root", name: "My Drive"};
 const page = (conn, id) => {
  const key = identity(conn, id);
  if (!pages.has(key)) pages.set(key, {files: [], next: "", updated: 0, error: "", loading: null});
  return pages.get(key);
 };
 const folders = p => p.files.filter(f => f.mimeType === folderMime);
 const media = (conn, p) => p.files.filter(f => /^(image|video)\//.test(f.mimeType)).map(f => ({
  id: "gd_" + f.id, aid: f.id, gconn: conn, _gdrive: true, sp: "drive",
  name: f.name || "Untitled", type: f.mimeType, date: Date.parse(f.createdTime) || 0,
  lat: f.imageMediaMetadata?.location?.latitude, lng: f.imageMediaMetadata?.location?.longitude,
  w: +(f.imageMediaMetadata || f.videoMediaMetadata || {}).width || 0,
  h: +(f.imageMediaMetadata || f.videoMediaMetadata || {}).height || 0,
  size: +f.size || 0, th: thumbnails.get(identity(conn, f.id)) || "", url: ""
 }));

 async function load(conn, id, {append = false, force = false} = {}) {
  const p = page(conn, id);
  if (p.loading) return p.loading;
  if (!force && !append && Date.now() - p.updated < 60000) return;
  if (append && !p.next) return;
  p.error = "";
  // Defer the network call until the loading state has been set.
  p.loading = Promise.resolve().then(async () => {
   try {
    const result = await D.listAlbum(conn, id, append ? p.next : "");
    const files = new Map((append ? p.files : []).map(f => [f.id, f]));
    for (const f of result.files || []) files.set(f.id, f);
    p.files = [...files.values()];
    p.next = result.next_page_token || "";
    p.updated = Date.now();
   } catch (_) {
    p.error = "Couldn't load this folder.";
   } finally {
    p.loading = null;
    paint();
   }
  });
  paint();
  return p.loading;
 }

 function pump() {
  while (running < 3 && queue.length) {
   const {node, job} = queue.shift();
   if (!node.isConnected || node.closest(".cl")) continue;
   running++;
   Promise.resolve().then(job).catch(() => {}).finally(() => { running--; pump(); });
  }
 }

 async function thumb(conn, id) {
  const key = identity(conn, id);
  if (thumbnails.has(key)) return thumbnails.get(key);
  const blob = await D.albumThumb(conn, id);
  // Keep compressed thumbnails in a bounded memory cache. Visible images own their data URLs.
  const src = await new Promise((resolve, reject) => {
   const reader = new FileReader();
   reader.onload = () => resolve(reader.result);
   reader.onerror = reject;
   reader.readAsDataURL(blob);
  });
  thumbnails.set(key, src);
  if (thumbnails.size > 160) thumbnails.delete(thumbnails.keys().next().value);
  return src;
 }

 async function folderThumb(conn, id) {
  const listing = page(conn, id);
  if (!listing.updated) await load(conn, id);
  const items = media(conn, listing);
  const ordered = [...items.filter(p => !isVid(p)), ...items.filter(isVid)];
  for (const p of ordered.slice(0, 3)) {
   try { return await thumb(conn, p.aid); } catch (_) {}
  }
  return "";
 }

 function observe(container, conn) {
  if (!container) return;
  for (const [host, observer] of observers) {
   if (!host.isConnected) { observer.disconnect(); observers.delete(host); }
  }
  let observer = observers.get(container);
  const request = node => {
   queue.push({node, job: async () => {
    const image = node.matches("img") ? node : node.querySelector("img");
    const folder = node.dataset.driveFolderThumb, id = node.dataset.driveThumb;
    const src = folder ? await folderThumb(conn, folder) : await thumb(conn, id);
    if (!src || !image?.isConnected) return;
    if (image.dataset.coverId) {
     image.dataset.coverFallback = src;
     AlbumCovers.paint();
    } else {
     image.src = src;
     image.classList.add("l");
    }
   }});
   pump();
  };
  if (!observer && window.IntersectionObserver) {
   observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
     observer.unobserve(entry.target);
     request(entry.target);
    }
   }, {rootMargin: "100px"});
   observers.set(container, observer);
  }
  container.querySelectorAll("[data-drive-thumb],[data-drive-folder-thumb]").forEach(node => {
   if (node.dataset.observed) return;
   node.dataset.observed = "1";
   if (observer) observer.observe(node);
   else request(node);
  });
 }

 function folderCard(conn, folder, options = true) {
  const p = page(conn, folder.id);
  const count = p.updated && !p.next ? String(media(conn,p).length + folders(p).length) : "";
  return `<div class=ar data-dalb=open data-gid="${esc(folder.id)}" data-drive-folder-thumb="${esc(folder.id)}">${AlbumCovers.image(coverId(conn,folder.id),"")}<span style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(folder.name)}</span><span class=mu>${count ? esc(count)+" " : ""}›</span>${options ? `<button class=ic data-dalb=more data-gid="${esc(folder.id)}" aria-label="Folder options">${ico("dots",18)}</button>` : ""}</div>`;
 }

 function status(p, empty) {
  if (p.loading && !p.updated) return '<div class=dalb-empty>Loading Google Drive…</div>';
  if (p.error) return `<div class=dalb-empty>${p.error} <button class=chip data-dalb=retry>Retry</button></div>`;
  if (!p.files.length) return `<div class=dalb-empty>${empty}</div>`;
  return p.next ? `<button class=chip data-dalb=loadmore ${p.loading ? "disabled" : ""}>Load more</button>` : "";
 }

 function setContent(node, html) {
  if (node && node._driveHTML !== html) {
   node._driveHTML = html;
   node.innerHTML = html;
  }
 }

 function paint() {
  if (S.view === "alb" && rootSlot?.isConnected) {
   const ds = drives();
   if (!ds.length) {
    setContent(rootSlot, '<div class=sh><h3>Gdrive Albums</h3></div><div class=dalb-empty>Connect Google Drive in Profile to see its folders here.</div>');
    return;
   }
   if (!ds.some(d => d.id === account)) account = (ds.find(d => d.is_default) || ds[0]).id;
   if (rootSlot.dataset.account !== account) {
    rootSlot.dataset.account = account;
    setContent(rootSlot, '<div class=sh><h3>Gdrive Albums</h3><div data-drive-accounts></div></div><div class=gp style="padding:4px 16px;margin-top:0" data-drive-folders></div><div data-drive-status></div>');
   }
   const p = page(account, "root");
   setContent(rootSlot.querySelector("[data-drive-accounts]"), ds.length > 1 ? `<label>Account <select data-drive-account>${ds.map(d => `<option value="${esc(d.id)}" ${d.id === account ? "selected" : ""}>${esc(d.email || "Google Drive")}</option>`).join("")}</select></label>` : "");
   setContent(rootSlot.querySelector("[data-drive-folders]"), folderCard(account, root, false) + folders(p).map(f => folderCard(account, f)).join(""));
   setContent(rootSlot.querySelector("[data-drive-status]"), status(p, ""));
   observe(rootSlot, account);
  } else if (S.view === "albdrive" && detailSlot?.isConnected && route) {
   const {conn} = route, id = current().id, p = page(conn, id), items = media(conn, p);
   const first = items.find(x => !isVid(x)) || items[0];
   const info = document.querySelector("[data-drive-info]");
   info.firstElementChild.textContent = p.updated ? `${pl(items.length, "item")} · ${pl(folders(p).length, "folder")}` : "Google Drive";
   const cover = document.querySelector(".hero [data-cover-id]");
   if (first && cover.dataset.driveThumb !== first.aid) {
    cover.dataset.driveThumb = first.aid;
    delete cover.dataset.observed;
    if (first.th) cover.dataset.coverFallback = first.th;
   }
   setContent(detailSlot.querySelector("[data-drive-subfolders]"), folders(p).map(f => folderCard(conn, f)).join(""));
   const grid = detailSlot.querySelector(".dalb-grid");
   const existing = new Map([...grid.children].map(node => [node.dataset.gid, node]));
   for (const item of items) {
    const node = existing.get(item.id);
    if (node) { existing.delete(item.id); continue; }
    grid.insertAdjacentHTML("beforeend", `<button class="mi dalb-media" data-dalb=photo data-gid="${esc(item.id)}" aria-label="${esc(item.name)}"><img alt="" loading=lazy ${item.th ? `src="${esc(item.th)}"` : `data-drive-thumb="${esc(item.aid)}"`}>${isVid(item) ? '<i class=pb>▶</i>' : ""}</button>`);
   }
   existing.forEach(node => node.remove());
   setContent(detailSlot.querySelector("[data-drive-status]"), status(p, "This folder is empty."));
   AlbumCovers.paint();
   observe(detailSlot.parentElement, conn);
  }
 }

 function mount() {
  rootSlot = document.querySelector("[data-drive-root]");
  detailSlot = document.querySelector("[data-drive-detail]");
  paint();
  if (rootSlot && drives().length && !page(account, "root").error) load(account, "root");
  if (detailSlot && route && !page(route.conn, current().id).error) load(route.conn, current().id);
 }

 function detail() {
  const {conn} = route, folder = current(), id = coverId(conn, folder.id);
  return detailHeader('<button class=ic data-dalb=back aria-label="Back">' + ico("back") + '</button>',
   '<button class=ic data-dalb=new aria-label="New folder">' + ico("plus") + '</button>') +
   detailHero(id, folder.name, "", '<div data-drive-info><div class=mu>Google Drive</div></div>',
    `<button class=chip data-dalb=cover>Change Cover</button>${folder.id === "root" ? "" : '<button class=chip data-dalb=manage>Manage</button>'}`) +
   '<div data-drive-detail><div class=gp style="padding:4px 16px;margin:0 0 24px" data-drive-subfolders></div><div class=dalb-grid></div><div data-drive-status></div></div>';
 }

 function open(conn, stack) {
  const next = {conn, stack};
  routes.set(path(next), next);
  navigate(next);
 }

 function navigate(next) {
  route = next;
  S.view = "albdrive";
  render();
  document.getElementById("scr").scrollTop = 0;
 }

 function fromHash(hash) {
  const next = routes.get(hash);
  if (next) navigate(next);
 }

 function editCover(conn, id) {
  const p = page(conn, id);
  AlbumCovers.edit(coverId(conn, id), () => media(conn, p), {
   available: () => !!(p.next || p.loading || p.error),
   load: () => p.loading || load(conn, id, {append: !!p.next, force: true}),
   observe: panel => observe(panel, conn)
  });
 }

 function preview(conn, id, mediaId, source) {
  const list = media(conn, page(conn, id));
  if (!window.LViewer || !list.some(p => p.id === mediaId)) return;
  const urls = new Set();
  let closed = false;
  LViewer(mediaId, list, source.querySelector("img"), {readonly: true, resolveFull: async item => {
   if (item.type.startsWith("video/")) return vidSrc(item);
   const blob = await getBlob(item);
   if (closed) return "";
   if (item.url) return item.url;
   item.url = URL.createObjectURL(blob);
   urls.add(item.url);
   return item.url;
  }, onClose: () => { closed = true; urls.forEach(url => URL.revokeObjectURL(url)); }});
 }

 function create(conn, id) {
  ask("New Google Drive folder", "", async name => {
   try {
    await D.createAlbumFolder(conn, id, name);
    await load(conn, id, {force: true});
    toast("Folder created in Google Drive");
   } catch (_) { toast("Couldn't create folder"); }
  });
 }
 window.newDriveAlbumFolder = () => create(account || drives()[0]?.id, "root");

 function manage(conn, folder, parent) {
  sheet('<button class=o data-x=cover>Change Cover</button><button class=o data-x=rename>Rename folder</button><button class=o data-x=trash>Move folder to Drive Trash</button>', async choice => {
   if (choice === "cover") {
    load(conn, folder.id);
    return editCover(conn, folder.id);
   }
   if (choice === "rename") ask("Rename folder", folder.name, async name => {
    try {
     await D.renameAlbumFolder(conn, folder.id, name);
     for (const entry of routes.values()) if (entry.conn === conn) {
      entry.stack = entry.stack.map(f => f.id === folder.id ? {...f, name} : f);
     }
     if (S.view === "albdrive") render();
     await load(conn, parent, {force: true});
     toast("Folder renamed");
    } catch (_) { toast("Couldn't rename folder"); }
   });
   if (choice === "trash") actSheet("Move folder to Drive Trash?", "You can restore the folder and its contents from Google Drive Trash.", "Move to Trash", async () => {
    try {
     await D.trashAlbumFolder(conn, folder.id);
     if (S.view === "albdrive" && route.conn === conn && current().id === folder.id) back();
     await load(conn, parent, {force: true});
     toast("Folder moved to Google Drive Trash");
    } catch (_) { toast("Couldn't move folder to Drive Trash"); }
   });
  });
 }

 function back() {
  if (route.stack.length > 1) open(route.conn, route.stack.slice(0, -1));
  else { S.view = "alb"; render(); }
 }

 document.addEventListener("change", e => {
  if (!e.target.matches("[data-drive-account]")) return;
  account = e.target.value;
  paint();
  load(account, "root");
 });
 document.addEventListener("click", e => {
  const button = e.target.closest("[data-dalb]");
  if (!button) return;
  const inDetail = S.view === "albdrive", conn = inDetail ? route.conn : account;
  const id = inDetail ? current().id : "root", p = page(conn, id);
  const folder = folders(p).find(f => f.id === button.dataset.gid);
  switch (button.dataset.dalb) {
   case "open": {
    const child = button.dataset.gid === "root" ? root : folder;
    if (child) open(conn, inDetail ? [...route.stack, child] : [child]);
    break;
   }
   case "back": back(); break;
   case "new": create(conn, id); break;
   case "more": if (folder) manage(conn, folder, id); break;
   case "manage": manage(conn, current(), route.stack.at(-2)?.id || "root"); break;
   case "cover": editCover(conn, id); break;
   case "photo": preview(conn, id, button.dataset.gid, button); break;
   case "retry": load(conn, id, {force: !p.next, append: !!p.next}); break;
   case "loadmore": load(conn, id, {append: true}); break;
  }
 });
 window.DriveAlbums = {mount, detail, fromHash, hash: () => path(route)};
})();

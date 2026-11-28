// Covers are independent image copies stored in account-scoped settings documents.
(() => {
 const prefix = "album-cover:";
 const covers = new Map();
 const pending = new Map();
 const key = (type, ...ids) => prefix + JSON.stringify([type, ...ids]);
 const url = id => pending.get(id) || covers.get(id) || "";
 const image = (id, fallback = "", className = "") =>
  `<img class="${className}" data-cover-id="${esc(id)}" data-cover-fallback="${esc(fallback)}" src="${esc(url(id) || fallback || placeholder)}" alt="">`;
 const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

 function paint() {
  document.querySelectorAll("img[data-cover-id]").forEach(img => {
   const src = url(img.dataset.coverId) || img.dataset.coverFallback || placeholder;
   if (img.getAttribute("src") !== src) img.src = src;
  });
 }

 function start() {
  col("settings").onSnapshot(snapshot => {
   covers.clear();
   for (const row of snapshot.docs) {
    const src = row.data()?.image;
    if (row.id.startsWith(prefix) && /^data:image\/jpeg;base64,/.test(src)) covers.set(row.id, src);
   }
   paint();
  });
 }

 async function commit(id, file) {
  if (pending.has(id)) return;
  try {
   const bitmap = await createImageBitmap(await file());
   const canvas = document.createElement("canvas");
   const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
   canvas.width = Math.max(1, Math.round(bitmap.width * scale));
   canvas.height = Math.max(1, Math.round(bitmap.height * scale));
   const ctx = canvas.getContext("2d");
   ctx.fillStyle = "#121212";
   ctx.fillRect(0, 0, canvas.width, canvas.height);
   ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
   bitmap.close();
   if (pending.has(id)) return;
   const src = canvas.toDataURL("image/jpeg", .82);
   pending.set(id, src);
   paint();
   try {
    await col("settings").doc(id).set({image: src});
    covers.set(id, src);
    toast("Cover updated");
   } finally {
    pending.delete(id);
    paint();
   }
  } catch (error) {
   console.warn("MIKA cover save failed", error);
   toast("Couldn't update cover. Please try again.");
  }
 }

 function device(id) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;
  input.addEventListener("cancel", () => input.remove(), {once: true});
  input.addEventListener("change", () => {
   const file = input.files[0];
   input.remove();
   if (file) commit(id, () => file);
  }, {once: true});
  document.body.append(input);
  input.click();
 }

 function edit(id, items, more) {
  sheet(`<h3>Change Cover</h3><button class=o data-x=album>Choose from album</button>
   <button class=o data-x=library>Choose from library</button><button class=o data-x=device>Choose from device</button>`, mode => {
   if (mode === "device") return device(id);
   const fromAlbum = mode === "album";
   const library = () => S.photos;
   const pick = () => {
    const photos = (fromAlbum ? items() : library()).filter(p => !isVid(p));
    if (!photos.length && !(fromAlbum && more?.available())) return toast("No photos available");
    const rows = photos.map((p, index) => `<button data-x="${index}" aria-label="${esc(p.name || "Photo")}"><img loading="lazy" alt="" ${p._gdrive && !p.th ? `data-drive-thumb="${esc(p.aid)}"` : `src="${esc(T(p) || placeholder)}"`}></button>`).join("");
    const loadMore = fromAlbum && more?.available();
    const panel = sheet(`<h3>Choose a cover</h3><div class="mbgrid cover-picker">${rows}</div>${loadMore ? '<button class=o data-x=more>Load more</button>' : ""}`, async choice => {
     if (choice === "more") {
      await more.load();
      return pick();
     }
     const photo = photos[Number(choice)];
     if (photo) commit(id, async () => {
      if (photo._gdrive) {
       try { return await LDrive.albumThumb(photo.gconn, photo.aid); } catch (_) { return getBlob(photo); }
      }
      const thumbnail = T(photo);
      if (thumbnail) {
       try { const response = await fetch(thumbnail); if (response.ok) return await response.blob(); } catch (_) {}
      }
      return getBlob(photo);
     });
    });
    if (fromAlbum) more?.observe(panel);
   };
   pick();
  });
 }
 window.AlbumCovers = {key, image, paint, start, edit, commit};
})();

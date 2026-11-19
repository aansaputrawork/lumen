// Cache hanya file statis aplikasi (app shell). Supabase, Google, signed URL foto & Edge Function TIDAK di-cache.
const V="mika-v2",SHELL=["./","index.html","style.css","login.css","popup.css","gallery.css","login.js","login-config.js","cover.js","profile.js","gallery.js","app.js","config.js","supabase-adapter.js","drive.js","features.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","assets/login-hero.png","assets/logo.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request)))});

// Cache hanya file statis aplikasi (app shell). Supabase, Google, signed URL foto & Edge Function TIDAK di-cache.
// Share target: foto/video yang dibagikan dari galeri HP ke MIKA disimpan sementara di cache "mika-share", lalu diunggah oleh drive.js.
const V="mika-v19",SHARE="mika-share",SHELL=["./","index.html","style.css","login.css","popup.css","gallery.css","login.js","login-config.js","cover.js","profile.js","gallery.js","app.js","motion.js","config.js","supabase-adapter.js","drive.js","drive-albums.js","features.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","assets/login-hero.png","assets/logo.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==SHARE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
async function shareIn(req){
 try{
  const fd=await req.formData(),fs=fd.getAll("media").filter(f=>f&&f.size),c=await caches.open(SHARE),t=Date.now();
  await Promise.all(fs.map((f,i)=>c.put(new URL("__share/"+t+"_"+i,self.registration.scope).href,new Response(f,{headers:{"Content-Type":f.type||"application/octet-stream","X-Name":encodeURIComponent(f.name||"shared"),"X-Mod":String(f.lastModified||t)}}))));
 }catch(e){}
 return Response.redirect(new URL("./?share=1",self.registration.scope).href,303);
}
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(e.request.method==="POST"&&u.origin===location.origin&&u.pathname.endsWith("/share-target")){e.respondWith(shareIn(e.request));return}
 if(e.request.method!=="GET"||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request)))});

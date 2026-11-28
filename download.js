// download.js: (1) LDL = menyimpan file ke perangkat dengan benar di semua platform, (2) LProg = kartu progres yang diam/stabil.
//
// Masalah lama: simpan file lewat <a download> + blob: URL. Di iPhone (PWA) dan WebView aplikasi (Capacitor) atribut `download`
// diabaikan, sehingga layar malah pindah ke halaman gambar (blob:). LDL.save memilih jalur yang benar per platform:
//   aplikasi native (Capacitor) -> langsung ke galeri HP (plugin Media) atau Documents/MIKA bila plugin Media belum dipasang
//   iPhone/iPad (browser & PWA) -> lembar Share ("Save Image" = masuk Photos, "Save to Files")
//   Android / desktop           -> <a download> biasa (masuk folder Download; Android otomatis memasukkannya ke galeri)
(()=>{
const NAT=()=>{try{return!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())}catch(e){return false}};
const plug=n=>{try{return(window.MikaPlugins&&window.MikaPlugins[n])||(window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins[n])||null}catch(e){return null}};
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const MIME={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",heic:"image/heic",heif:"image/heif",avif:"image/avif",bmp:"image/bmp",svg:"image/svg+xml",mp4:"video/mp4",m4v:"video/mp4",mov:"video/quicktime",webm:"video/webm","3gp":"video/3gpp",mkv:"video/x-matroska",zip:"application/zip"};
const ext=n=>(String(n||"").split(".").pop()||"").toLowerCase();
// Tipe MIME harus benar; kalau blob bertipe kosong/octet-stream, peramban bisa membukanya sebagai halaman alih-alih menyimpannya.
const norm=(b,name)=>{const t=b.type&&b.type!="application/octet-stream"?b.type:(MIME[ext(name)]||b.type||"application/octet-stream");return b.type===t?b:new Blob([b],{type:t})};
const b64=b=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]||"");r.onerror=()=>no(r.error);r.readAsDataURL(b)});
const L=window.LDL={};
L.native=NAT;
L.hasGallery=()=>NAT()&&!!plug("Media");

// ---- Galeri HP (hanya aplikasi native + plugin @capacitor-community/media) ----
const AL={};
async function albumId(name){const M=plug("Media");if(AL[name])return AL[name];
 const find=async()=>((await M.getAlbums()).albums||[]).find(a=>a.name===name);
 let a=await find();if(!a){await M.createAlbum({name});a=await find()}
 if(!a)throw Object.assign(new Error("Couldn't create the album “"+name+"”"),{code:"album"});
 return AL[name]=a.identifier}
async function toGallery(blob,name,album){
 const M=plug("Media"),F=plug("Filesystem"),base=name.replace(/\.[^.]+$/,"");
 if(M&&/^(image|video)\//.test(blob.type)){
  const alb=album||"MIKA",id=await albumId(alb);
  if(blob.type.startsWith("image/"))await M.savePhoto({path:"data:"+blob.type+";base64,"+await b64(blob),albumIdentifier:id,fileName:base});
  else{ // video: dipindah lewat file sementara supaya tidak membuat string base64 raksasa di jalur plugin
   if(!F)throw Object.assign(new Error("Filesystem plugin is missing"),{code:"plugin"});
   const tmp="mika_"+Date.now()+"_"+name.replace(/[^\w.-]/g,"_");
   await F.writeFile({path:tmp,data:await b64(blob),directory:"CACHE"});
   try{const u=await F.getUri({path:tmp,directory:"CACHE"});await M.saveVideo({path:u.uri,albumIdentifier:id,fileName:base})}
   finally{F.deleteFile({path:tmp,directory:"CACHE"}).catch(()=>{})}}
  return{kind:"saved",msg:"Saved to your gallery · "+alb}}
 if(F){await F.writeFile({path:"MIKA/"+name,data:await b64(blob),directory:"DOCUMENTS",recursive:true});return{kind:"saved",msg:"Saved to Documents/MIKA"}}
 return null}

// ---- Web ----
const canShare=files=>!!(navigator.share&&navigator.canShare&&navigator.canShare({files}));
async function share(files){
 try{await navigator.share({files});return{kind:"shared"}}
 catch(e){
  if(e&&e.name=="AbortError")return{kind:"cancelled"};
  // Safari menolak share bila sudah terlalu lama sejak ketukan terakhir (file besar sedang disiapkan). Minta satu ketukan lagi.
  if(e&&e.name=="NotAllowedError"&&typeof toast=="function"){toast("Ready to save",{l:"Save",f:()=>navigator.share({files}).catch(()=>{})});return{kind:"pending"}}
  return null}}
function anchor(blob,name){
 const u=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=u;a.download=name;a.rel="noopener";a.style.display="none";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),6e4);
 return{kind:"saved",msg:"Saved to Downloads"}}

// Simpan satu file. Mengembalikan {kind:"saved"|"shared"|"pending"|"cancelled", msg?}
L.save=async(blob,name,o={})=>{
 blob=norm(blob,name);
 if(NAT()){const r=await toGallery(blob,name,o.album);if(r)return r}
 const f=new File([blob],name,{type:blob.type});
 if(IOS&&canShare([f])){const r=await share([f]);if(r)return r}
 return anchor(blob,name)};

// Banyak file sekaligus. Mengembalikan null bila platform ini lebih baik memakai ZIP (desktop/Android).
L.canMany=()=>NAT()||IOS;
L.saveMany=async(items,o={})=>{ // items: [{blob,name,album?}]
 if(NAT()){let n=0;for(const it of items){const r=await L.save(it.blob,it.name,{album:it.album||o.album});if(r.kind=="saved")n++}return{kind:"saved",msg:`Saved ${n} file${n==1?"":"s"}${L.hasGallery()?" to your gallery":""}`}}
 if(IOS){const fs=items.map(it=>{const b=norm(it.blob,it.name);return new File([b],it.name,{type:b.type})});
  if(canShare(fs)){const r=await share(fs);if(r)return r}}
 return null};

// ===================== Kartu progres yang stabil =====================
// Satu elemen yang dibuat sekali lalu hanya diperbarui isinya (tidak dibuat ulang seperti toast). Bar bergerak lewat transform+transition,
// angka dibatasi ±8x/detik, persentase tidak pernah mundur selama satu pekerjaan.
const P=window.LProg={};
let el,raf=0,floor=0,hide=0,last=0,V={title:"",sub:"",pct:0,ind:false};
const q=s=>el&&el.querySelector(s);
const mk=()=>{if(el&&el.isConnected)return el;el=document.createElement("div");el.className="lprog";el.setAttribute("role","status");el.setAttribute("aria-live","polite");
 el.innerHTML='<div class=lp-h><b class=lp-t></b><span class=lp-p></span></div><div class=lp-s></div><div class=lp-bar><i></i></div>';document.body.append(el);return el};
const flush=()=>{raf=0;last=Date.now();if(!el)return;q(".lp-t").textContent=V.title;q(".lp-s").textContent=V.sub;
 q(".lp-p").textContent=V.ind?"":Math.round(V.pct)+"%";el.classList.toggle("ind",!!V.ind);q(".lp-bar i").style.transform="scaleX("+(V.ind?1:V.pct/100)+")"};
const sched=()=>{if(raf)return;const w=Math.max(0,240-(Date.now()-last));raf=setTimeout(()=>requestAnimationFrame(flush),w)};
P.start=(title,sub="")=>{clearTimeout(hide);clearTimeout(raf);raf=0;floor=0;V={title,sub,pct:0,ind:false};mk();el.classList.remove("done","err","out");flush();requestAnimationFrame(()=>el&&el.classList.add("in"))};
// o: {title, sub, pct (0-100), ind (true = tanpa persentase)}
P.set=o=>{if(!el)return;if(o.pct!=null){o.pct=Math.max(floor,Math.min(100,+o.pct||0));floor=o.pct}Object.assign(V,o);sched()};
const end=(cls,title,sub,ms)=>{if(!el)mk();clearTimeout(raf);raf=0;clearTimeout(hide);V.title=title;V.sub=sub||"";V.ind=false;if(cls=="done")V.pct=100;flush();el.classList.add(cls,"in");
 hide=setTimeout(()=>{if(!el)return;el.classList.add("out");setTimeout(()=>{if(el&&el.classList.contains("out")){el.remove();el=null}},400)},ms)};
P.done=(title,sub)=>end("done",title,sub,2600);
P.fail=(title,sub)=>end("err",title,sub,6000);
P.hide=()=>{if(!el)return;clearTimeout(hide);clearTimeout(raf);raf=0;el.remove();el=null};
})();

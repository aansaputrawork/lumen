// Fitur tambahan: kuota paket, pengelompokan otomatis (AI di browser), duplikat, perangkat, Wi-Fi saja, deep link native.
(()=>{
const LQ=window.LQ={cap:0,max:0,plan:""},LF=window.LF={aiFail:0};
const lib=src=>new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.append(s)});
const J="https://cdn.jsdelivr.net/npm/";let M=null;
const loadAI=()=>M||(M=(async()=>{await lib(J+"@tensorflow/tfjs@4.22.0/dist/tf.min.js");
 await Promise.all([lib(J+"@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"),lib(J+"@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js")]);
 return{det:await cocoSsd.load({base:"lite_mobilenet_v2"}),net:await mobilenet.load({version:2,alpha:1})}})().catch(e=>{M=null;throw e}));
const ANIMAL=new Set(["bird","cat","dog","horse","sheep","cow","elephant","bear","zebra","giraffe"]);
const ARCH=/castle|palace|church|mosque|monastery|triumphal arch|dome|lighthouse|bridge|viaduct|obelisk|stupa|library|cinema|barn|boathouse|bell cote|greenhouse|patio|fountain|water tower|bookshop|restaurant|prison|planetarium|altar|totem|megalith|street sign|traffic light|turnstile/i;
const TRAVEL=/seashore|sandbar|pier|boat|ship|liner|airliner|gondola|canoe|catamaran|trimaran|schooner|yawl|balloon|minibus|streetcar|trolleybus|school bus|locomotive|bullet train|passenger car|backpack|tent|sleeping bag|paddle|speedboat|aircraft carrier|jeep|cab\b|moped|motor scooter|snowmobile|ski\b/i;
const NAT=/valley|volcano|alp\b|cliff|geyser|coral reef|promontory|lakeside|daisy|flower|rapeseed|corn\b|acorn|buckeye|fungus|agaric|stinkhorn|earthstar|bolete|mushroom|lady's slipper|hay\b|fish|shark|ray\b|bee\b|butterfly|beetle|spider|snake|lizard|frog|turtle|crab|jellyfish|owl|eagle|parrot|duck|goose|swan|penguin|monkey/i;
// Urutan keputusan: orang (1 besar = Portraits, selain itu People) -> hewan -> bangunan -> perjalanan -> alam -> Other. Video selalu Motion.
async function autoCat(f){if(f.type.startsWith("video"))return"Motion";if(!f.type.startsWith("image"))return"Other";
 try{const m=await loadAI(),bm=await createImageBitmap(f),k=Math.min(1,320/Math.max(bm.width,bm.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(bm.width*k));c.height=Math.max(1,Math.round(bm.height*k));c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
  const ds=(await m.det.detect(c,10)).filter(o=>o.score>.5),ps=ds.filter(o=>o.class=="person"),A=c.width*c.height;
  if(ps.length)return ps.length==1&&ps[0].bbox[2]*ps[0].bbox[3]>.12*A?"Portraits":"People";
  if(ds.some(o=>ANIMAL.has(o.class)))return"Nature";
  for(const r of await m.net.classify(c,3)){if(r.probability<.15)continue;if(ARCH.test(r.className))return"Architecture";if(TRAVEL.test(r.className))return"Travel";if(NAT.test(r.className))return"Nature"}
  return"Other"}catch(e){LF.aiFail=1;return"Other"}}
window.autoCat=autoCat;
// Sidik jari cepat untuk deteksi duplikat: SHA-256 dari 4 MB pertama + ukuran file (aman untuk video besar).
window.fpOf=async f=>{try{const b=await crypto.subtle.digest("SHA-256",await f.slice(0,4194304).arrayBuffer());return[...new Uint8Array(b)].slice(0,12).map(x=>x.toString(16).padStart(2,"0")).join("")+"-"+f.size}catch(e){return""}};
window.netOK=()=>{const c=navigator.connection;return!(S.prefs&&S.prefs.wifi&&c&&c.type=="cellular")};
LF.init=async()=>{
 try{const{data}=await sb.from("user_accounts").select("plan_id,quota_override,plans(name,storage_bytes,max_file_bytes)").maybeSingle();
  if(data&&data.plans){LQ.cap=data.quota_override||data.plans.storage_bytes;LQ.max=data.plans.max_file_bytes;LQ.plan=data.plans.name;render()}}catch(e){}
 try{let id=localStorage.getItem("lumen_dev");if(!id){id=crypto.randomUUID?crypto.randomUUID():String(Date.now());localStorage.setItem("lumen_dev",id)}
  const ua=navigator.userAgent,pl=/iPhone|iPad/.test(ua)?"iOS":/Android/.test(ua)?"Android":/Mac/.test(ua)?"macOS":/Windows/.test(ua)?"Windows":"Web";
  await sb.from("devices").upsert({id,name:pl+" · "+(/Edg|Firefox|Chrome|Safari/.exec(ua)||["Browser"])[0],platform:pl,last_seen:new Date().toISOString()},{onConflict:"user_id,id"})}catch(e){}};
LF.regroupRun=async x=>{
 const l=S.photos.filter(p=>!isVid(p)&&(x=="all"||!p.cat||p.cat=="Other"));if(!l.length)return toast("No photos to categorize");
 LF.aiFail=0;let n=0;for(const p of l){try{toast(`Categorizing ${++n}/${l.length}…`);const b=await(await fetch(p.th||p.url)).blob(),c=await autoCat(new File([b],p.name,{type:"image/jpeg"}));
  if(LF.aiFail){toast("Failed: couldn't load the AI model. Check your connection.");return}if(c&&c!=p.cat)await save(null,p.id,{...p,cat:c},"photos")}catch(e){}}
 toast("Categorization complete")};
LF.regroup=()=>sheet(`<h3 style="margin-top:0">Auto-categorize</h3><div class=mu style="font-size:12px;margin-bottom:6px">AI runs on your device and your photos are never sent to another server. The model (~15 MB) downloads once.</div><button class=o data-x=other>Only "Other" photos</button><button class=o data-x=all>All photos (overwrites manual choices)</button>`,LF.regroupRun);
LF.dup=()=>{const g=new Map();S.photos.forEach(p=>{const k=p.hash||p.name+"|"+p.size;(g.get(k)||g.set(k,[]).get(k)).push(p)});
 const d=[...g.values()].filter(a=>a.length>1);if(!d.length)return toast("No duplicate photos");
 const extra=d.flatMap(a=>[...a].sort((x,y)=>(x.up||x.date)-(y.up||y.date)).slice(1));
 sheet(`<h3 style="margin-top:0">${d.length} duplicate group${d.length>1?"s":""}</h3><div class=mas style="columns:3">${d.map(a=>isVid(a[0])?"":`<img src="${T(a[0])}" style="opacity:1">`).join("")}</div><button class=o data-x=go>Move ${extra.length} cop${extra.length>1?"ies":"y"} to Recently Deleted</button>`,x=>{if(x=="go")delPhotos(extra)})};
LF.dev=async()=>{try{const{data,error}=await sb.from("devices").select("*").order("last_seen",{ascending:false});if(error)throw error;const me=localStorage.getItem("lumen_dev");
 sheet(`<h3 style="margin-top:0">Devices</h3><div class=mu style="font-size:12px;margin-bottom:6px">Tap another device to remove it from the list. This does not sign it out.</div>`+(data||[]).map(d=>`<button class=o data-x="${esc(d.id)}">${esc(d.name||d.platform)}${d.id==me?" (this device)":""} · ${new Date(d.last_seen).toLocaleDateString()}</button>`).join(""),async id=>{if(id==me)return;await sb.from("devices").delete().eq("id",id);toast("Device removed from the list")})}catch(e){toast("Couldn't load devices")}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-lf]");if(b&&LF[b.dataset.lf])LF[b.dataset.lf]()});
// Aplikasi native (Capacitor): login Google kembali lewat deep link com.lumen.photos://login-callback?code=...
const cap=window.Capacitor;if(cap&&cap.isNativePlatform&&cap.isNativePlatform()){window.LOGIN_REDIRECT="com.lumen.photos://login-callback";
 cap.Plugins.App.addListener("appUrlOpen",async({url})=>{try{const c=new URL(url).searchParams.get("code");if(c){await sb.auth.exchangeCodeForSession(c);try{cap.Plugins.Browser.close()}catch(e){}location.reload()}}catch(e){}})}
})();

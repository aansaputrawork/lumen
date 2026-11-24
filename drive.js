// Google Drive: pemanggil Edge Function, upload resumable, UI pengaturan, indikator.
(()=>{const C=window.LUMEN_CONFIG||{};if(!window.sb)return;
const FN=(C.FUNCTIONS_URL||C.SUPABASE_URL+"/functions/v1").replace(/\/drive\/?$/,"")+"/drive"; // FUNCTIONS_URL boleh berakhiran /drive atau tidak
const MSG={offline:"You're offline. Check your connection and try again.",not_connected:"Google Drive isn't connected. Connect it in Profile → Google Drive.",token_expired:"Your Google Drive session has expired. Reconnect it in Profile.",quota:"Your Google Drive is full. Free up some space and try again.",folder_missing:"The destination folder wasn't found. Choose another folder in Profile.",upload_failed:"Upload to Google Drive failed.",no_thumb:"No preview available.",unauthorized:"Your session has expired. Please sign in again.",cloud_quota:"MIKA Cloud storage quota reached.",too_large:"The file exceeds your plan's file size limit.",not_media:"The selected item is not a photo or video.",error:"Something went wrong."};
const E=(c,m)=>Object.assign(new Error(m&&m!==c?m:(MSG[c]||c)),{code:c});
const D=window.LDrive={st:null,busy:false,uf:0,ff:[],lastErr:"",lastCid:""};
const hdr=async()=>{const{data:{session}}=await sb.auth.getSession();return{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,apikey:C.SUPABASE_ANON_KEY}};
async function raw(action,body={}){if(!navigator.onLine)throw E("offline");try{return await fetch(FN,{method:"POST",headers:await hdr(),body:JSON.stringify({action,...body})})}catch(e){throw E("offline")}}
async function call(action,body){const r=await raw(action,body),j=await r.json().catch(()=>({}));if(!r.ok)throw E(j.code||"error",j.message);return j}

D.up=async (f,onProgress)=>{
 const mime=f.type||"application/octet-stream";
 const {uploadUrl,conn_id}=await call("init_upload",{name:f.name,mime,size:f.size,conn_id:f._conn!=null?f._conn:(window.LUMEN_DRIVE||"")});
 D.lastCid=conn_id||"";

 return new Promise((resolve,reject)=>{
  const x=new XMLHttpRequest();
  x.open("PUT",uploadUrl);
  x.setRequestHeader("Content-Type",mime);

  x.upload.onprogress=e=>{
   if(e.lengthComputable){
    const percent=Math.round(e.loaded/e.total*100);
    if(onProgress){
 onProgress(percent,e.loaded,e.total);
}
   }
  };

  x.onload=()=>{
   if(x.status>=200&&x.status<300){
    try{resolve(JSON.parse(x.responseText).id)}
    catch(e){reject(E("upload_failed"))}
   }else{
    const t=x.responseText||"";
    reject(E(/quota/i.test(t)?"quota":x.status===401?"token_expired":x.status===404?"folder_missing":"upload_failed"));
   }
  };

  x.onerror=()=>reject(E("offline"));
  x.onabort=()=>reject(E("upload_failed"));
  x.send(f);
 });
};

D.refresh=async()=>{try{D.st=await call("status")}catch(e){D.st={connected:false,err:e.code}}rr()};
D.init=()=>{const q=new URLSearchParams(location.search),r=q.get("drive");if(r){history.replaceState(null,"",location.pathname+location.hash);toast(r=="connected"?"Google Drive connected":"Couldn't connect Google Drive ("+(q.get("reason")||"error")+")")}if(q.get("share")){history.replaceState(null,"",location.pathname+location.hash);toast("Receiving shared files…")}sb.auth.getSession().then(({data:{session}})=>{D.uid=session&&session.user.id;D.refresh().then(()=>setTimeout(D.tick,1500))});if(LSB.orphans())D.orphanWarn()};
D.orphanWarn=()=>toast("The file is in Google Drive, but saving its details failed.",{l:"Retry",f:async()=>{try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}}});
// ---- Banyak akun Google Drive ----
const drives=()=>{const s=D.st;if(!s)return[];if(s.drives)return s.drives;return s.connected?[{id:"",email:s.email,status:s.status,folder_id:s.folder_id,folder_name:s.folder_name,auto_backup:s.auto_backup,is_default:true}]:[]};
const live=()=>drives().filter(d=>d.status=="connected"),ok=()=>live().length>0,dflt=()=>drives().find(d=>d.is_default)||drives()[0];
const dr=id=>drives().find(d=>d.id==id)||dflt();
window.getBlob=async p=>{if(p._blob instanceof Blob)return p._blob;if(p.sp=="drive"){const r=p._gdrive?await raw("import_download",{conn_id:p.gconn,file_id:p.aid}):await raw("download",{file_id:p.aid});if(!r.ok)throw E((await r.json().catch(()=>({}))).code||"error");p._blob=await r.blob();return p._blob}const r=await fetch(p.url);if(!r.ok)throw E("error","Couldn't read the file from MIKA Cloud ("+r.status+")");return r.blob()};
// URL yang bisa diputar <video>. Video di Supabase: signed URL biasa. Video yang hanya ada di Google Drive: URL stream bertanda tangan
// dari Edge Function (mendukung Range, jadi bisa seek). Di-cache sampai mendekati kedaluwarsa (6 jam).
const VS={};
window.vidSrc=async p=>{if(p.sp!="drive"&&p.url)return p.url;const id=p.aid||p.gid;if(!id)throw E("error","Video file not found");
 const h=VS[id];if(h&&h.e>Date.now())return h.u;
 const j=await call("stream_url",{file_id:id,mime:p.type||""});if(!j.url)throw E("error");VS[id]={u:j.url,e:Date.now()+5*36e5};return j.url};
window.lBadge=p=>p.sp=="drive"?'<i class=lb>Drive</i>':p.bs=="done"?'<i class=lb>S + Drive</i>':p.bs=="failed"?'<i class="lb f">Backup failed</i>':"";
window.lLoc=p=>p.sp=="drive"?" · Google Drive":p.bs=="done"?" · Supabase + Drive":p.bs=="failed"?" · Supabase (Drive backup failed)":p.sp=="supabase"?" · Supabase":"";
window.storagePicker=()=>{const d=dflt(),o=ok(),a=o&&d&&d.auto_backup,L=live();
 const dc=L.length>1?`<label class=mu>Google Drive account</label><select id=dc style="margin-bottom:6px">${L.map(x=>`<option value="${esc(x.id)}" ${x.is_default?"selected":""}>${esc(x.email||"")}${x.is_default?" (default)":""}</option>`).join("")}</select>`:"";
 return`<label class=mu>Storage</label><select id=sm style="margin-bottom:6px"><option value=both ${o?"":"disabled"} ${a?"selected":""}>MIKA Cloud + Google Drive</option><option value=supabase ${a?"disabled":""} ${a?"":"selected"}>MIKA Cloud${a?" (automatic backup is ON)":""}</option><option value=drive ${o?"":"disabled"}>Google Drive only</option></select>${a?`<div class=mu style="font-size:12px;margin-bottom:6px">Automatic backup is ON. New uploads are saved to MIKA Cloud and Google Drive.</div>`:o?"":`<div class=mu style="font-size:12px;margin-bottom:6px">Connect Google Drive in Profile to use the Drive options.</div>`}${dc}`};
window.lMode=s=>{const m=(s.querySelector("#sm")||{}).value||"supabase";D.ff.length=0;D.uf=0;if(m!="supabase"&&!ok()){toast(MSG[drives().some(x=>x.status=="expired")?"token_expired":"not_connected"]);return null}window.LUMEN_DRIVE=(s.querySelector("#dc")||{}).value||"";return m};
window.lSuffix=()=>(D.ff.length?" · failed: "+D.ff.length:"")+(D.uf?" · Drive backup failed: "+D.uf:"");
window.lAct=()=>{if(D.ff.length){const l=D.ff.splice(0);D.uf=0;return{l:"Retry",f:()=>upload(l)}}if(D.uf){D.uf=0;return{l:"Retry",f:()=>backup(S.photos.filter(p=>p.bs=="failed"))}}};
async function backup(l,o={}){if(D.busy||!l.length)return;D.busy=true;let n=0,bad=0,last;const say=o.silent?()=>{}:toast;
 for(const p of l){try{say(`Backing up ${n+bad+1}/${l.length}…`);AB.msg=`Backing up to Drive ${n+bad+1}/${l.length}…`;R2();const b=await getBlob(p),f=new File([b],p.name||"photo",{type:p.type||b.type});f._conn="";const did=await D.up(f),{error}=await sb.from("photos").update({backup_drive_file_id:did,backup_status:"done",drive_conn_id:D.lastCid||null}).eq("id",p.id);if(error)throw error;n++}
  catch(e){bad++;last=e;await sb.from("photos").update({backup_status:"failed"}).eq("id",p.id);if(["token_expired","not_connected","quota","offline","folder_missing"].includes(e.code))break}}
 D.busy=false;await LSB.reload("photos");D.refresh();AB.msg=bad?`${n} backed up to Drive, ${bad} failed`:`${n} backed up to Drive`;R2();
 if(n||bad||!o.silent)toast(bad?`${n} backed up, ${bad} failed: ${last.message}`:`${n} photo${n==1?"":"s"} backed up to Google Drive`)}
const furl=d=>"https://drive.google.com/drive/folders/"+d.folder_id;
function manualBackup(){
 const items=S.photos.filter(p=>p.sp=="supabase"&&p.bs!="done");
 if(!items.length)return toast("All MIKA Cloud files are already backed up");
 const chosen=new Set(),s=document.createElement("div");s.className="sheet";
 s.innerHTML=`<div class="mbsheet" style="max-width:680px;max-height:90vh"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div><h3 style="margin:0">Manual backup</h3><div class="mu" style="font-size:12px;margin-top:4px">Choose photos and videos from your MIKA Cloud library</div></div><button class="chip" data-mb-close>Close</button></div><div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 10px;gap:8px"><span class="mu" id="mbcount">0 selected</span><button class="chip" data-mb-all>Select all</button></div><div class="mbgrid">${items.map(p=>`<div class="mi" data-mb-id="${esc(p.id)}" style="margin:0;position:relative;overflow:hidden;border-radius:16px;outline:2px solid transparent;cursor:pointer">${media(p)}<span class="mbcheck" style="position:absolute;right:8px;top:8px;width:24px;height:24px;border-radius:50%;border:2px solid white;background:rgba(0,0,0,.3);display:grid;place-items:center;color:white;font-size:14px">✓</span><span style="position:absolute;left:6px;right:6px;bottom:6px;padding:4px 6px;border-radius:8px;background:rgba(0,0,0,.55);color:white;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name||"Untitled")}</span></div>`).join("")}</div><div class="mu" style="font-size:11px;margin-top:8px">${items.length} files available to back up</div><button class="btn" data-mb-go disabled style="width:100%;margin-top:14px">Back up selected files</button></div>`;
 document.body.append(s);
 const count=s.querySelector("#mbcount"),go=s.querySelector("[data-mb-go]"),all=s.querySelector("[data-mb-all]");
 const paint=()=>{count.textContent=chosen.size+" selected";go.disabled=!chosen.size;go.textContent=chosen.size?`Back up ${chosen.size} selected file${chosen.size==1?"":"s"}`:"Back up selected files";s.querySelectorAll("[data-mb-id]").forEach(el=>{const on=chosen.has(el.dataset.mbId);el.style.outline=on?"3px solid var(--ac)":"2px solid transparent";el.querySelector(".mbcheck").style.background=on?"var(--ac)":"rgba(0,0,0,.3)";el.querySelector(".mbcheck").style.borderColor=on?"var(--ac)":"white"})};
 s.addEventListener("click",e=>{if(e.target.closest("[data-mb-close]")||e.target===s){closeS(s);return}if(e.target.closest("[data-mb-all]")){if(chosen.size===items.length)chosen.clear();else items.forEach(p=>chosen.add(p.id));all.textContent=chosen.size===items.length?"Clear selection":"Select all";paint();return}const el=e.target.closest("[data-mb-id]");if(el){const id=el.dataset.mbId;chosen.has(id)?chosen.delete(id):chosen.add(id);all.textContent=chosen.size===items.length?"Clear selection":"Select all";paint()}});
 go.onclick=()=>{const picked=items.filter(p=>chosen.has(p.id));closeS(s);backup(picked)};
}
async function browseDrive(connId){
 const host=document.createElement("div");host.className="gdv";
 host.innerHTML=`<div class="top gdv-top"><button class=ic data-gclose aria-label="Back">${window.IC&&IC.back?`<svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`:"‹"}</button><div class=gdv-heading><h1>Google Drive</h1><span class=mu data-gpath>My Drive</span></div><button class=ic data-grefresh title="Refresh" aria-label="Refresh">↻</button><button class=chip data-gnew>+ Folder</button></div><div class=gdv-body><div class=gdv-crumb data-gcrumb></div><div class=gdv-status mu data-gstatus>Loading Google Drive…</div><div class=mas data-ggrid></div><button data-gmore class=chip style="display:none;width:100%;margin:16px 0 28px">Load more</button></div>`;
 document.body.append(host);
 const grid=host.querySelector("[data-ggrid]"),status=host.querySelector("[data-gstatus]"),crumb=host.querySelector("[data-gcrumb]"),path=host.querySelector("[data-gpath]"),more=host.querySelector("[data-gmore]");
 const stack=[{id:"root",name:"My Drive"}],thumbUrls=new Set(),previewUrls=new Set(),photos=[];let token="",busy=false,closed=false;
 const current=()=>stack[stack.length-1],revoke=set=>{for(const u of set)URL.revokeObjectURL(u);set.clear()};
 const drawCrumb=()=>{crumb.innerHTML=stack.map((f,i)=>`${i?'<span class=mu>›</span>':""}<button class="gdv-crumb-item${i===stack.length-1?" a":""}" data-gcrumb="${i}">${esc(f.name)}</button>`).join("");path.textContent=stack.map(x=>x.name).join(" / ")};
 const loadThumb=async(el,f,p)=>{try{const r=await raw("import_thumb",{conn_id:connId,file_id:f.id});if(!r.ok)return;const u=URL.createObjectURL(await r.blob());if(closed){URL.revokeObjectURL(u);return}thumbUrls.add(u);p.th=u;el.src=u;el.classList.add("l")}catch(_){}};
 const openPhoto=(p,card)=>{
  if(!window.LViewer)return toast("Photo preview is unavailable");
  const list=photos.slice(),resolveFull=async item=>{if(item.url)return item.url;const r=await raw("import_download",{conn_id:connId,file_id:item.aid});if(!r.ok)throw E("error","Couldn't load the original photo from Google Drive");const blob=await r.blob();item._blob=blob;item.url=URL.createObjectURL(blob);previewUrls.add(item.url);return item.url};
  LViewer(p.id,list,card.querySelector("img"),{readonly:true,resolveFull,onClose:()=>{revoke(previewUrls);list.forEach(x=>{x.url="";x._blob=null})}});
 };
 const load=async(reset=false)=>{
  if(busy||closed)return;busy=true;
  if(reset){token="";photos.length=0;revoke(thumbUrls);grid.innerHTML="";more.style.display="none";status.textContent="Loading…";status.style.display="block"}
  try{
   const j=await call("list_gallery",{conn_id:connId,parent_id:current().id,page_token:token}),files=j.files||[],folders=files.filter(f=>f.mimeType==="application/vnd.google-apps.folder"),images=files.filter(f=>/^image\//.test(f.mimeType||""));
   if(reset)status.style.display="none";
   if(!files.length&&!grid.children.length){status.textContent="This folder is empty.";status.style.display="block"}
   for(const f of folders){
    const el=document.createElement("div");el.className="mi gdv-folder";el.dataset.gfolder=f.id;
    el.innerHTML=`<span class=gdv-folder-icon aria-hidden=true>📁</span><span class=gdv-folder-name>${esc(f.name)}</span><button class=gdv-folder-more data-grename="${esc(f.id)}" aria-label="Rename ${esc(f.name)}" title="Rename folder">···</button>`;
    grid.append(el);
   }
   for(const f of images){
    const p={id:"gd_"+f.id,aid:f.id,gconn:connId,_gdrive:true,name:f.name||"Untitled",date:Date.parse(f.createdTime||"")||Date.now(),size:+f.size||0,type:f.mimeType||"image/jpeg",w:+(f.imageMediaMetadata&&f.imageMediaMetadata.width)||0,h:+(f.imageMediaMetadata&&f.imageMediaMetadata.height)||0,sp:"drive",url:"",th:""};
    photos.push(p);
    const card=document.createElement("div");card.className="mi gdv-photo";card.dataset.id=p.id;card.dataset.gphoto=p.id;
    card.innerHTML=`<img alt="${esc(p.name)}" loading="lazy">`;
    const im=card.querySelector("img");loadThumb(im,f,p);card.onclick=()=>openPhoto(p,card);grid.append(card);
   }
   token=j.next_page_token||"";more.style.display=token?"block":"none";
  }catch(e){status.textContent="Couldn't load this folder: "+(e.message||"Unknown error");status.style.display="block";more.style.display="none"}
  finally{busy=false}
 };
 const close=()=>{if(closed)return;closed=true;revoke(thumbUrls);revoke(previewUrls);host.remove()};
 host.querySelector("[data-gclose]").onclick=close;
 host.querySelector("[data-grefresh]").onclick=()=>load(true);
 more.onclick=()=>load(false);
 host.querySelector("[data-gnew]").onclick=()=>ask("New folder name","",async name=>{const n=String(name||"").trim();if(!n)return;try{await call("create_gallery_folder",{conn_id:connId,parent_id:current().id,name:n});toast("Folder created in Google Drive");await load(true)}catch(e){toast("Couldn't create folder: "+e.message)}});
 crumb.addEventListener("click",e=>{const b=e.target.closest("[data-gcrumb]");if(!b)return;stack.splice(+b.dataset.gcrumb+1);drawCrumb();load(true)});
 grid.addEventListener("click",e=>{
  const rename=e.target.closest("[data-grename]");
  if(rename){e.stopPropagation();const id=rename.dataset.grename,folder=rename.closest("[data-gfolder]"),old=folder&&folder.querySelector(".gdv-folder-name")?.textContent||"";ask("Rename folder",old,async name=>{const n=String(name||"").trim();if(!n||n===old)return;try{await call("rename_gallery_folder",{conn_id:connId,file_id:id,name:n});const item=stack.find(x=>x.id===id);if(item)item.name=n;toast("Folder renamed in Google Drive");drawCrumb();await load(true)}catch(err){toast("Couldn't rename folder: "+err.message)}});return}
  const f=e.target.closest("[data-gfolder]");if(f){const name=f.querySelector(".gdv-folder-name")?.textContent||"Folder";stack.push({id:f.dataset.gfolder,name});drawCrumb();load(true)}
 });
 drawCrumb();load(true);
}
const A={
 async connect(){try{location.href=(await call("start")).url}catch(e){toast("Failed: "+e.message)}},
 browse(id){const d=dr(id);if(!d||d.status!=="connected")return toast(MSG.not_connected);browseDrive(d.id)},
 disc(id){const d=dr(id);actSheet("Disconnect "+(d.email||"Google Drive")+"?","Its access token is deleted from the server. Files in Drive are not deleted. Photos stored only in this Drive can't be opened or downloaded in full until you reconnect it.","Disconnect",async()=>{try{await call("disconnect",{conn_id:d.id});toast("Disconnected");D.refresh()}catch(e){toast("Failed: "+e.message)}})},
 async def(id){try{await call("set_default",{conn_id:id});toast("Default Drive changed");D.refresh()}catch(e){toast("Failed: "+e.message)}},
 async folder(id){const d=dr(id);try{const{folders}=await call("list_folders",{conn_id:d.id});sheet(`<h3 style="margin-top:0">Storage folder</h3><div class=mu style="font-size:12px;margin-bottom:6px">${esc(d.email||"")} · folders your Google account can access appear here.</div>`+folders.map(f=>`<button class=o data-x="f:${esc(f.id)}">${esc(f.name)}${f.id==d.folder_id?" ✓":""}</button>`).join("")+`<button class=o data-x=new>Create new folder…</button>`,async x=>{
  try{if(x=="new")return ask("New folder name","MIKA",async n=>{try{await call("create_folder",{conn_id:d.id,name:n});toast("Folder created");D.refresh()}catch(e){toast("Failed: "+e.message)}});await call("set_folder",{conn_id:d.id,id:x.slice(2)});toast("Folder changed");D.refresh()}catch(e){toast("Failed: "+e.message)}})}catch(e){toast("Failed: "+e.message)}},
 open(id){window.open(furl(dr(id)),"_blank","noopener")},
 share(id){window.open(furl(dr(id)),"_blank","noopener");toast("Use Share on the folder in Google Drive to manage access")},
 async auto(id){const d=dr(id);try{await call("set_auto",{conn_id:d.id,value:!d.auto_backup});D.refresh()}catch(e){toast("Failed: "+e.message)}},
 retry(){backup(S.photos.filter(p=>p.bs=="failed"))},
 all(){backup(S.photos.filter(p=>p.sp=="supabase"&&p.bs!="done"))},
 manual(){manualBackup()},
 async orph(){try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}},
 imp(){D.imp()},
 logout(){LSB.logout()}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-dr]");if(b&&A[b.dataset.dr])A[b.dataset.dr](b.dataset.id)});

// ---- Menu Upload: dari perangkat ATAU impor dari Google Drive ----
window.uploadMenu=()=>{if(!ok())return upload();sheet(`<h3 style="margin-top:0">Upload</h3><button class=o data-x=dev>From this device</button><button class=o data-x=drv>From Google Drive</button>`,x=>{if(x=="dev")upload();else if(x=="drv")D.imp()})};
// Impor dari Google Drive: file asli disalin ke MIKA Cloud (Supabase); file sumber di Google Drive tidak diubah atau dihapus.
// ======================= Util bersama (impor + backup otomatis) =======================
const R2=(()=>{let t=0;return()=>{const n=Date.now();if(n-t<1500||!document.querySelector(".gp"))return;t=n;try{typeof rr=="function"&&rr()}catch(e){}}})();
const MIME={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",heic:"image/heic",heif:"image/heif",avif:"image/avif",bmp:"image/bmp",mp4:"video/mp4",m4v:"video/mp4",mov:"video/quicktime",webm:"video/webm","3gp":"video/3gpp",mkv:"video/x-matroska"};
const guessMime=n=>MIME[(String(n||"").split(".").pop()||"").toLowerCase()]||"";
const isMedia=f=>/^(image|video)\//.test(f.type||"")||!!guessMime(f.name);
const fpOf=f=>[f.name,f.size,f.lastModified].join("|");
// Indeks perpustakaan untuk deteksi duplikat. Memakai data adapter (bukan S) supaya tidak bergantung pada kapan UI selesai render.
const lib=()=>{const fp=new Set(),ns=new Set(),dr=new Set(),all=[...LSB.docs("photos"),...((typeof S!="undefined"&&S.trash)||[])];
 for(const p of all){if(p.src_fp)fp.add(p.src_fp);if(p.name&&p.size)ns.add(p.name+"|"+p.size);[p.source_drive_id,p.gid,p.sp=="drive"?p.aid:null].forEach(x=>x&&dr.add(x))}
 return{fp,ns,dr,used:all.reduce((a,p)=>a+(+p.size||0),0)}};
const isDup=(f,L)=>L.fp.has(fpOf(f))||L.ns.has(f.name+"|"+f.size);
const isoDate=s=>Date.parse(String(s||"").replace(/^(\d{4}):(\d\d):(\d\d) /,"$1-$2-$3T"))||0;
const saveRow=async(id,row)=>{if(typeof save=="function")return save(null,id,row,"photos");return(await window.claude.use("db")).collection("photos").doc(id).set(row)};

// Satu jalur untuk memasukkan file ke perpustakaan: unggah → thumbnail → baris database.
// o.mode: "supabase" | "both" | "drive"; o.meta: {w,h,dur,created,taken}; o.srcDriveId; o.thumbFallback: async()=>File|null
async function ingest(f0,o={}){
 const A=await window.claude.use("assets"),m=o.meta||{},mime=f0.type||guessMime(f0.name)||"application/octet-stream";
 const file=new File([f0],f0.name||("file-"+Date.now()),{type:mime,lastModified:f0.lastModified||Date.now()});
 const mode=o.mode||"supabase",L=lib();
 if(window.LQ){if(LQ.max&&file.size>LQ.max)throw E("too_large",`${file.name} exceeds your plan's file size limit`);if(LQ.cap&&L.used+file.size>LQ.cap)throw E("cloud_quota")}
 file._mode=mode;if(mode=="supabase")file._forceSupabase=1;
 let up,tid="",th="";
 up=await A.upload(file,o.prog);
 try{
  let w=+m.w||0,h=+m.h||0,dur=+m.dur||0,tm=null;
  try{tm=mime.startsWith("image/")&&typeof mkThumb=="function"?await mkThumb(file):mime.startsWith("video/")&&typeof mkVThumb=="function"?await mkVThumb(file):null}catch(e){console.warn("MIKA thumbnail failed",e)}
  if(tm){w=w||tm.w||0;h=h||tm.h||0;dur=dur||tm.dur||0;tm.file._th=1;try{const t=await A.upload(tm.file);th=t.url;tid=t.id}catch(e){console.warn("MIKA thumbnail upload failed",e)}}
  if(!th&&o.thumbFallback){try{const tf=await o.thumbFallback();if(tf){tf._th=1;const t=await A.upload(tf);th=t.url;tid=t.id}}catch(e){console.warn("MIKA thumbnail fallback failed",e)}}
  let cat=mime.startsWith("video/")?"Motion":(typeof S!="undefined"&&S.prefs&&S.prefs.cat&&S.prefs.cat!="Auto"?S.prefs.cat:"Auto");
  if(cat=="Auto"&&mime.startsWith("image/")&&typeof autoCat=="function")try{cat=await autoCat(file)}catch(e){}
  if(cat=="Auto")cat=(typeof CATS!="undefined"&&CATS&&CATS[1])||"Photos";
  const date=isoDate(m.taken)||Date.parse(m.created||"")||f0.lastModified||Date.now();
  const id="p"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
  const row={name:file.name,url:up.url,th,tid,aid:up.id,up:Date.now(),type:mime,size:up.sizeBytes||file.size,w,h,dur,cat,date,fav:false,hash:"",src_fp:fpOf(f0)};
  if(o.srcDriveId)row.source_drive_id=o.srcDriveId;
  await saveRow(id,row);
  return id;
 }catch(e){
  if(tid)try{await A.delete(tid)}catch(_){}
  try{await A.delete(up.id)}catch(_){}
  throw e}
}

// ======================= Impor dari Google Drive (pemilih bawaan MIKA) =======================
const fmtSize=n=>{n=+n||0;if(n<1024)return n+" B";if(n<1048576)return (n/1024).toFixed(0)+" KB";if(n<1073741824)return (n/1048576).toFixed(1)+" MB";return (n/1073741824).toFixed(1)+" GB"};
const fmtDriveDate=s=>{const d=new Date(s||"");return Number.isNaN(+d)?"":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})};
D.imp=async cid=>{
 const L=live();if(!L.length)return toast(MSG.not_connected);
 if(cid==null&&L.length>1)return sheet(`<h3 style="margin-top:0">Import from which account?</h3>`+L.map(d=>`<button class=o data-x="c:${esc(d.id)}">${esc(d.email||"")}${d.is_default?" (default)":""}</button>`).join(""),x=>{if(x&&x.startsWith("c:"))D.imp(x.slice(2))});
 if(cid==null)cid=L[0].id;
 if(D.importing)return toast("An import is already running");
 const chosen=new Set(),urls=new Set(),s=document.createElement("div");s.className="sheet";
 s.innerHTML=`<div class="mbsheet" style="max-width:760px;max-height:92vh;display:flex;flex-direction:column;gap:10px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h3 style="margin:0">Import from Google Drive</h3><div class="mu" style="font-size:12px;margin-top:4px">${esc(dr(cid).email||"Google account")} · Photos and videos</div></div><button class="chip" data-gd-close>Close</button></div>
  <input id="gd-search" type="search" placeholder="Search file names…" autocomplete="off">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span class="mu" id="gd-count">0 selected</span><button class="chip" data-gd-all>Select this page</button></div>
  <div class="mbgrid" id="gd-grid" style="max-height:56vh;min-height:150px"><div class="mu" style="grid-column:1/-1;text-align:center;padding:35px 10px">Loading Google Drive files…</div></div>
  <div class="mu" id="gd-status" style="font-size:12px">Loading photos and videos…</div>
  <button class="chip" id="gd-more" style="width:100%;display:none">Load more</button>
  <button class="btn" data-gd-import disabled style="width:100%">Import selected files</button>
 </div>`;
 document.body.append(s);
 const grid=s.querySelector("#gd-grid"),status=s.querySelector("#gd-status"),count=s.querySelector("#gd-count"),more=s.querySelector("#gd-more"),go=s.querySelector("[data-gd-import]"),all=s.querySelector("[data-gd-all]"),search=s.querySelector("#gd-search");
 let next="",loading=false,pending=false,term="",files=[],timer=0,closed=false;
 const cleanup=()=>{closed=true;urls.forEach(u=>URL.revokeObjectURL(u));urls.clear()};
 const close=()=>{cleanup();closeS(s)};
 const paint=()=>{
  count.textContent=chosen.size+" selected";go.disabled=!chosen.size;
  go.textContent=chosen.size?`Import ${chosen.size} selected file${chosen.size===1?"":"s"}`:"Import selected files";
  all.textContent=files.length&&files.every(f=>chosen.has(f.id))?"Clear page selection":"Select this page";
  grid.querySelectorAll("[data-gd-id]").forEach(el=>{const on=chosen.has(el.dataset.gdId);el.style.outline=on?"3px solid var(--ac)":"2px solid transparent";const ck=el.querySelector(".gd-check");if(ck){ck.style.background=on?"var(--ac)":"rgba(0,0,0,.35)";ck.style.borderColor=on?"var(--ac)":"white"}});
 };
 const thumb=async(el,f)=>{
  if(!f.thumbnailLink)return;
  try{const r=await raw("import_thumb",{conn_id:cid,file_id:f.id});if(!r.ok)return;const b=await r.blob();if(!b.size||!/^image\//.test(b.type||""))return;
   const u=URL.createObjectURL(b);if(closed){URL.revokeObjectURL(u);return}urls.add(u);const im=el.querySelector("img");if(im)im.src=u;
  }catch(e){console.warn("MIKA Drive thumbnail unavailable",e)}
 };
 const render=async added=>{
  if(!added.length)return;
  const frag=document.createDocumentFragment(),els=[];
  for(const f of added){
   const el=document.createElement("div");el.className="mi";el.dataset.gdId=f.id;
   el.style.cssText="margin:0;position:relative;overflow:hidden;border-radius:16px;outline:2px solid transparent;cursor:pointer;min-height:130px;background:var(--pill)";
   const icon=String(f.mimeType||"").startsWith("video/")?"▶":"▧";
   el.innerHTML=`<div style="aspect-ratio:1/1;display:grid;place-items:center;overflow:hidden;background:var(--pill)"><img alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;opacity:.95" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23888888' fill-opacity='.12'/%3E%3Ctext x='50' y='57' text-anchor='middle' font-size='28' fill='%23888888'%3E${icon}%3C/text%3E%3C/svg%3E"></div><span class="gd-check" style="position:absolute;right:8px;top:8px;width:24px;height:24px;border-radius:50%;border:2px solid white;background:rgba(0,0,0,.35);display:grid;place-items:center;color:white;font-size:14px">✓</span><span style="position:absolute;left:6px;right:6px;bottom:6px;padding:5px 7px;border-radius:8px;background:rgba(0,0,0,.65);color:white;font-size:10px;line-height:1.35"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name||"Untitled")}</span><span style="opacity:.8">${fmtSize(f.size)}${f.createdTime?" · "+fmtDriveDate(f.createdTime):""}</span></span>`;
   frag.append(el);els.push({el,f});
  }
  grid.append(frag);paint();
  let i=0;await Promise.all(Array.from({length:4},async()=>{while(i<els.length&&!closed){const x=els[i++];await thumb(x.el,x.f)}}));
 };
 const load=async reset=>{
  if(loading){if(reset)pending=true;return}loading=true;more.disabled=true;status.textContent="Loading photos and videos…";
  if(reset){next="";files=[];grid.innerHTML=`<div class="mu" style="grid-column:1/-1;text-align:center;padding:35px 10px">Loading Google Drive files…</div>`}
  try{
   const j=await call("list_media",{conn_id:cid,page_token:reset?"":next,search:term});
   const got=Array.isArray(j.files)?j.files:[];
   if(reset)grid.innerHTML="";
   files=reset?got:files.concat(got);next=j.next_page_token||"";
   if(got.length)await render(got);
   if(!files.length)grid.innerHTML=`<div class="mu" style="grid-column:1/-1;text-align:center;padding:35px 10px">${term?"No matching photos or videos found.":"No photos or videos found in this Google Drive account."}</div>`;
   status.textContent=files.length?`${files.length} files loaded${j.incomplete_search?" · Google Drive may have returned an incomplete result":""}`:"";
   more.style.display=next?"block":"none";more.disabled=false;paint();
  }catch(e){status.textContent="Could not load files: "+(e.message||"Unknown error");if(reset)grid.innerHTML=`<div class="mu" style="grid-column:1/-1;text-align:center;padding:25px 10px">Could not load Google Drive files. ${esc(e.message||"Please try again.")}</div>`;more.style.display=files.length?"block":"none";more.disabled=false}
  finally{loading=false;if(pending&&!closed){pending=false;load(true)}}
 };
 s.addEventListener("click",e=>{
  if(e.target.closest("[data-gd-close]")||e.target===s){close();return}
  if(e.target.closest("[data-gd-all]")){if(files.length&&files.every(f=>chosen.has(f.id)))files.forEach(f=>chosen.delete(f.id));else files.forEach(f=>chosen.add(f.id));paint();return}
  if(e.target.closest("#gd-more")){load(false);return}
  const el=e.target.closest("[data-gd-id]");if(el){const id=el.dataset.gdId;chosen.has(id)?chosen.delete(id):chosen.add(id);paint()}
 });
 search.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>{term=search.value.trim();load(true)},350)});
 go.onclick=()=>{const ids=[...chosen];close();if(ids.length)D.doImport(cid,ids)};
 load(true);
};
async function readBody(r,cb){const len=+r.headers.get("content-length")||0;if(!r.body||!r.body.getReader)return r.blob();
 const rd=r.body.getReader(),ch=[];let n=0;for(;;){const{done,value}=await rd.read();if(done)break;ch.push(value);n+=value.length;cb&&cb(n,len)}return new Blob(ch,{type:r.headers.get("content-type")||""})}
async function importBlob(cid,f,cb){
 const r=await raw("import_download",{conn_id:cid,file_id:f.id});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw E(j.code||"error",j.message||"Could not download the selected file from Google Drive")}
 const b=await readBody(r,cb);if(!b.size)throw E("error","Google Drive returned an empty file");return b;
}
D.doImport=async(cid,ids)=>{
 if(!Array.isArray(ids)||!ids.length)return toast("No files selected");
 if(D.importing)return toast("An import is already running");
 D.importing=true;
 try{
  toast("Reading selected files…");
  const files=[],skipped=[];
  for(let i=0;i<ids.length;i+=50){const j=await call("import_info",{conn_id:cid,ids:ids.slice(i,i+50)});files.push(...(j.files||[]));skipped.push(...(j.skipped||[]))}
  if(!files.length){console.warn("MIKA Drive import: no readable media returned",{selected:ids.length,skipped});return toast(skipped.length?(skipped[0].code=="not_media"?"The selected items are not supported photos or videos.":`Google Drive couldn't read the selected file (${skipped[0].code||"access error"}). Reconnect the account in Profile and try again.`):"The selected items are not supported photos or videos.")}
  const have=lib().dr,todo=files.filter(f=>!have.has(f.id));
  if(!todo.length)return toast("All selected files are already in your MIKA library");
  let n=0,bad=0;
  for(const f of todo){
   const at=n+bad+1,tot=todo.length;
   try{
    toast(`Downloading from Google Drive ${at}/${tot}…`);
    let last=0;const blob=await importBlob(cid,f,(got,len)=>{const now=Date.now();if(now-last>700){last=now;toast(`Downloading ${at}/${tot}… ${len?Math.round(got/len*100)+"%":(got/1048576).toFixed(0)+" MB"}`)}});
    const mime=f.mime||blob.type||guessMime(f.name)||"application/octet-stream";
    const file=new File([blob],f.name||("Google-Drive-"+f.id),{type:mime,lastModified:Date.parse(f.created||"")||Date.now()});
    await ingest(file,{mode:"supabase",srcDriveId:f.id,meta:f,prog:p=>toast(`Uploading to MIKA Cloud ${at}/${tot}… ${p}%`),
     thumbFallback:async()=>{const r=await raw("import_thumb",{conn_id:cid,file_id:f.id});if(!r.ok)return null;const tb=await r.blob();return tb.size&&/^image\//.test(tb.type||"")?new File([tb],"t_"+file.name+".jpg",{type:tb.type}):null}});
    n++;
   }catch(e){
    console.error("MIKA Drive import failed",f.id,e);bad++;
    toast(`Import failed: ${f.name||"file"} — ${e.message||"unknown error"}`);
    if(["cloud_quota","offline","unauthorized","token_expired"].includes(e.code))break;
   }
  }
  await LSB.reload("photos");
  toast(bad?`Imported ${n}, ${bad} failed`:`Imported ${n} file${n==1?"":"s"} into MIKA Cloud`);
 }catch(e){console.error("MIKA Drive import failed",e);toast("Import failed: "+(e.message||"Something went wrong"))}
 finally{D.importing=false}
};

// ======================= Backup otomatis =======================
// (1) Cloud → Drive: bila "Auto backup" Drive default aktif, semua file MIKA Cloud yang belum tercadangkan dikirim ke Drive di latar depan.
// (2) HP → MIKA: pantau satu folder (File System Access API, Chrome/Edge desktop) dan terima foto yang dibagikan dari galeri (Share Target PWA).
// Peramban TIDAK mengizinkan pemindaian galeri di latar belakang saat aplikasi tertutup; semua berjalan saat MIKA terbuka.
const AB=D.ab={q:[],run:false,n:0,bad:0,msg:"",perm:"",skip:new Set(),tried:new Set(),cap:false};
const CK=()=>"mika_ab_"+(D.uid||""),DEF={dev:false,wifi:true,dest:"both",since:0,dirName:""};
const cfg=()=>{try{return{...DEF,...JSON.parse(localStorage.getItem(CK())||"{}")}}catch(e){return{...DEF}}};
const setCfg=p=>{try{localStorage.setItem(CK(),JSON.stringify({...cfg(),...p}))}catch(e){}};
const dest=()=>cfg().dest=="both"&&ok()?"both":"supabase";
const netOK=()=>{if(!navigator.onLine)return false;if(!cfg().wifi)return true;const c=navigator.connection;return!(c&&c.type&&!["wifi","ethernet","unknown"].includes(c.type))};
const idb=(m,k,v)=>new Promise((res,rej)=>{const o=indexedDB.open("mika_ab",1);o.onupgradeneeded=()=>o.result.createObjectStore("h");o.onerror=()=>rej(o.error);
 o.onsuccess=()=>{const t=o.result.transaction("h",m=="get"?"readonly":"readwrite"),s=t.objectStore("h"),r=m=="get"?s.get(k):m=="set"?s.put(v,k):s.delete(k);t.oncomplete=()=>res(r.result);t.onerror=()=>rej(t.error)}});
const dropShare=f=>{if(f._shareKey)caches.open("mika-share").then(c=>c.delete(f._shareKey)).catch(()=>{})};
function enqueue(files){const L=lib(),inQ=new Set(AB.q.map(fpOf));let add=0;
 for(const f of files){if(!isMedia(f))continue;if(isDup(f,L)){dropShare(f);continue}const k=fpOf(f);if(inQ.has(k)||AB.skip.has(k))continue;inQ.add(k);AB.q.push(f);add++}
 if(add)pump();return add}
async function pump(){if(AB.run)return;AB.run=true;AB.n=0;AB.bad=0;AB.cap=false;let dfail=0;
 while(AB.q.length){
  if(!netOK()){AB.msg=cfg().wifi&&navigator.onLine?"Waiting for Wi-Fi…":"Waiting for connection…";break}
  const f=AB.q[0],u0=D.uf;AB.msg=`Backing up from phone: ${AB.n+1} of ${AB.n+AB.q.length}…`;R2();
  try{await ingest(f,{mode:dest(),prog:()=>{}});AB.q.shift();AB.n++;dropShare(f)}
  catch(e){AB.q.shift();
   if(e.code=="offline"){AB.q.unshift(f);AB.msg="Waiting for connection…";break}
   AB.skip.add(fpOf(f));AB.bad++;console.warn("MIKA auto backup failed",f.name,e);
   if(e.code=="cloud_quota"){AB.cap=true;AB.q.length=0;AB.msg="MIKA Cloud storage is full.";break}}
  dfail+=D.uf-u0;D.uf=u0; // gagal cadangan Drive tercatat di bs="failed"; jangan memunculkan toast "Retry" untuk proses senyap
 }
 AB.run=false;if(AB.n||AB.bad)try{await LSB.reload("photos")}catch(e){}
 if(!AB.q.length){AB.msg=AB.cap?AB.msg:(AB.n||AB.bad?`Last run: ${AB.n} backed up${AB.bad?`, ${AB.bad} failed`:""}${dfail?`, ${dfail} not copied to Drive`:""}`:AB.msg);
  if(AB.n||AB.bad)toast(AB.cap?"MIKA Cloud storage is full. Automatic backup stopped.":`Automatic backup: ${AB.n} file${AB.n==1?"":"s"} backed up${AB.bad?`, ${AB.bad} failed`:""}`)}
 R2()}
async function shareIntake(){if(!window.caches||!(await caches.has("mika-share")))return;const c=await caches.open("mika-share"),ks=await c.keys();if(!ks.length)return;const fs=[];
 for(const k of ks){try{const r=await c.match(k),b=await r.blob();fs.push(Object.assign(new File([b],decodeURIComponent(r.headers.get("X-Name")||"shared"),{type:b.type||r.headers.get("Content-Type")||"",lastModified:+r.headers.get("X-Mod")||Date.now()}),{_shareKey:k.url}))}catch(e){}}
 if(fs.length){const n=enqueue(fs);if(n)toast(`Backing up ${n} shared file${n==1?"":"s"}…`)}}
async function dirPerm(h,ask){const o={mode:"read"};if(await h.queryPermission(o)=="granted")return true;return ask&&await h.requestPermission(o)=="granted"}
async function walk(h,out,d=0){for await(const[n,e]of h.entries()){if(e.kind=="file"){if(guessMime(n))out.push(e)}else if(d<3&&!n.startsWith("."))await walk(e,out,d+1)}}
async function scanFolder(ask){const c=cfg();if(!c.dev||!window.showDirectoryPicker||!netOK())return;
 const h=await idb("get","dir:"+D.uid).catch(()=>null);if(!h){setCfg({dev:false});return}
 if(!await dirPerm(h,ask)){if(AB.perm!="needed"){AB.perm="needed";toast("Automatic backup needs permission to read your folder.",{l:"Allow",f:()=>A.abresume()});R2()}return}
 AB.perm="";const ents=[];await walk(h,ents);const fs=[];
 for(const e of ents){try{const f=await e.getFile();if(!c.since||f.lastModified>c.since)fs.push(f)}catch(_){}}
 const n=enqueue(fs);if(n&&!AB.run)AB.msg=`Found ${n} new file${n==1?"":"s"}`}
function cloudSync(){const d=dflt();if(!d||d.status!="connected"||!d.auto_backup||D.busy||AB.run||!netOK())return;
 const l=LSB.docs("photos").filter(p=>p.sp=="supabase"&&p.bs!="done"&&p.url&&!AB.tried.has(p.id));if(!l.length)return;l.forEach(p=>AB.tried.add(p.id));return backup(l,{silent:true})}
let tk=false;
async function tick(){if(tk||document.hidden||!D.uid||!D.st||!LSB.loaded("photos"))return;tk=true;
 try{await shareIntake();await cloudSync();await scanFolder(false)}catch(e){console.warn("MIKA auto backup",e)}finally{tk=false}}
D.tick=tick;
setInterval(tick,60000);["visibilitychange","online","focus"].forEach(ev=>addEventListener(ev,()=>setTimeout(tick,800)));
addEventListener("beforeunload",e=>{if(AB.run||D.busy||D.importing){e.preventDefault();e.returnValue=""}});
Object.assign(A,{
 async abdev(){if(cfg().dev){setCfg({dev:false});AB.msg="";return R2()}
  if(!window.showDirectoryPicker)return toast("This browser can't watch a folder. Share photos from your gallery to MIKA instead.");
  try{const h=await showDirectoryPicker({id:"mika-backup",mode:"read"});await idb("set","dir:"+D.uid,h);AB.perm="";
   sheet(`<h3 style="margin-top:0">Back up “${esc(h.name)}”</h3><div class=mu style="font-size:12px;margin-bottom:6px">New photos and videos in this folder are backed up automatically whenever MIKA is open.</div><button class=o data-x=all>Existing and new files</button><button class=o data-x=new>Only new files from now</button>`,x=>{setCfg({dev:true,dirName:h.name,since:x=="new"?Date.now():0});R2();tick()})}
  catch(e){if(e.name!="AbortError")toast("Failed: "+e.message)}},
 async abfolder(){if(!window.showDirectoryPicker)return;try{const h=await showDirectoryPicker({id:"mika-backup",mode:"read"});await idb("set","dir:"+D.uid,h);setCfg({dirName:h.name});AB.perm="";R2();tick()}catch(e){if(e.name!="AbortError")toast("Failed: "+e.message)}},
 async abresume(){try{await scanFolder(true);R2()}catch(e){toast("Failed: "+e.message)}},
 abwifi(){setCfg({wifi:!cfg().wifi});R2()},
 abdest(){setCfg({dest:cfg().dest=="both"?"supabase":"both"});R2()}});
const abRows=()=>{const c=cfg(),sup=!!window.showDirectoryPicker,B=(k,t)=>`<button class=chip data-dr=${k}>${t}</button>`,Rw=(a,b,x="")=>`<div class=row${x}><span>${a}</span>${b}</div>`;
 let h=`<div class=mu style="font-size:12px;margin:12px 0 2px"><b style="color:var(--tx)">Automatic backup</b> · runs while MIKA is open</div>`;
 h+=Rw("Watch a phone folder",sup?B("abdev",c.dev?"On":"Off"):`<span class=mu style="font-size:12px">Not supported here</span>`);
 if(c.dev&&sup){h+=Rw("Folder",`<span style="display:flex;gap:6px;align-items:center"><span class="mu v">${esc(c.dirName||"—")}</span>${B("abfolder","Change")}</span>`);
  if(AB.perm=="needed")h+=Rw('<b style="color:var(--ac2)">Permission needed</b>',B("abresume","Allow"))}
 h+=Rw("Wi-Fi only",B("abwifi",c.wifi?"On":"Off"))+Rw("Send to",B("abdest",dest()=="both"?"MIKA Cloud + Drive":"MIKA Cloud only"));
 h+=`<p class=mu style="font-size:12px;margin:4px 0 0">${sup?"":"This browser can't watch folders. "}Photos shared from your gallery (Share → MIKA) are also backed up automatically once MIKA is installed.</p>`;
 if(AB.msg)h+=Rw("Status",`<span class=mu style="text-align:right">${esc(AB.msg)}</span>`);
 return h};
window.driveCard=()=>{const s=D.st,P=S.photos,done=P.filter(p=>p.sp=="supabase"&&p.bs=="done").length,fail=P.filter(p=>p.bs=="failed").length,todo=P.filter(p=>p.sp=="supabase"&&p.bs!="done").length,only=P.filter(p=>p.sp=="drive").length,L=drives();
 const R=(a,b,x="")=>`<div class=row${x}><span>${a}</span>${b}</div>`,B=(k,t,id)=>`<button class=chip data-dr=${k}${id!=null?` data-id="${esc(id)}"`:""}>${t}</button>`;let h;
 if(!s)h=R("Status",'<span class=mu>Checking…</span>',' style="border:0"');
 else if(!L.length)h=R('<span class=dot></span>Not connected',B("connect","Connect"),' style="border:0"')+`<p class=mu style="font-size:12px;margin:4px 0 0">MIKA can browse the Google Drive files and folders you authorize. Your originals stay in Google Drive unless you explicitly upload or import them elsewhere. You can connect more than one Google account.</p>`;
 else h=L.map((d,i)=>{const on=d.status=="connected",e=esc(d.email||"Google account");
   return`<div class="dv${i?" dv2":""}">`+R(`<span class="dot ${on?"g":"r"}"></span><span style="color:var(--tx);min-width:0;overflow-wrap:anywhere">${e}</span>${d.is_default?'<span class=mu style="font-size:12px;margin-left:6px">Default</span>':""}`,"",' style="border:0;padding-bottom:2px"')
   +(on?R("Browse Google Drive",B("browse","Open gallery",d.id))
    +R("Folder",`<span style="display:flex;gap:6px;align-items:center"><span class="mu v">${esc(d.folder_name||"—")}</span>${B("folder","Change",d.id)}</span>`)
   +R("Open / share folder",`<span style="display:flex;gap:6px">${B("open","Open",d.id)}${B("share","Share",d.id)}</span>`)
   +(d.is_default?R("Auto backup to Drive",B("auto",d.auto_backup?"On":"Off",d.id)):""):"")
   +R("Account",`<span style="display:flex;gap:6px;flex-wrap:wrap">${on?B("connect","Update permissions",d.id):B("connect","Reconnect",d.id)}${on&&L.length>1&&!d.is_default?B("def","Make default",d.id):""}${B("disc","Disconnect",d.id)}</span>`,' style="border:0"')+`</div>`}).join("")
  +R("Add another Google Drive",B("connect","Add"))
  +R("Import from Google Drive",B("imp","Import"))
  +abRows()+R("Backup status",`<span class=mu>${done} backed up${only?` · ${only} Drive only`:""}${fail?` · <b style="color:var(--ac2)">${fail} failed</b>`:""}</span>`)
  +(fail||todo?R(todo?`${todo} not backed up yet`:"",`<span style="display:flex;gap:6px">${fail?B("retry","Retry"):""}${todo?B("all","Back up all"):""}</span>`):"")
  +(L.some(d=>d.status=="connected")?R("Manual backup",B("manual","Choose files")):"")
  +(LSB.orphans()?R("Pending details",B("orph","Recover")):"")+R("Sign out of MIKA",B("logout","Sign out"),' style="border:0"');
 return`<div class=gp><div class=tt>Google Drive</div>${h}</div>`};
})();

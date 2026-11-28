// Google Drive: pemanggil Edge Function, upload resumable, UI pengaturan, indikator.
(()=>{const C=window.LUMEN_CONFIG||{};if(!window.sb)return;
const FN=(C.FUNCTIONS_URL||C.SUPABASE_URL+"/functions/v1").replace(/\/drive\/?$/,"")+"/drive"; // FUNCTIONS_URL boleh berakhiran /drive atau tidak
const MSG={offline:"You're offline. Check your connection and try again.",not_connected:"Google Drive isn't connected. Connect it in Profile → Google Drive.",token_expired:"Your Google Drive session has expired. Reconnect it in Profile.",quota:"Your Google Drive is full. Free up some space and try again.",folder_missing:"The destination folder wasn't found. Choose another folder in Profile.",upload_failed:"Upload to Google Drive failed.",no_thumb:"No preview available.",unauthorized:"Your session has expired. Please sign in again.",cloud_quota:"MIKA Cloud storage quota reached.",too_large:"The file exceeds your plan's file size limit.",not_media:"The selected item is not a photo or video.",error:"Something went wrong."};
const E=(c,m)=>Object.assign(new Error(m&&m!==c?m:(MSG[c]||c)),{code:c});
const D=window.LDrive={st:null,busy:false,uf:0,ff:[],lastErr:"",lastCid:""};
const hdr=async()=>{const{data:{session}}=await sb.auth.getSession();return{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,apikey:C.SUPABASE_ANON_KEY}};
async function raw(action,body={}){if(!navigator.onLine)throw E("offline");try{return await fetch(FN,{method:"POST",headers:await hdr(),body:JSON.stringify({action,...body})})}catch(e){console.error("[MIKA Drive] Request failed:",{action,url:FN,error:e,message:e&&e.message,stack:e&&e.stack});throw E("offline")}}
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
D.albumDrives=()=>live().map(d=>({...d}));
D.listAlbum=async(connId,parentId="root",pageToken="")=>call("list_gallery",{conn_id:connId,parent_id:parentId,page_token:pageToken});
D.albumThumb=async(connId,fileId)=>{const r=await raw("import_thumb",{conn_id:connId,file_id:fileId});if(!r.ok)throw E("error","Couldn't load the Google Drive thumbnail");return r.blob()};
D.createAlbumFolder=(connId,parentId,name)=>call("create_gallery_folder",{conn_id:connId,parent_id:parentId,name});
D.renameAlbumFolder=(connId,fileId,name)=>call("rename_gallery_folder",{conn_id:connId,file_id:fileId,name});
D.trashAlbumFolder=(connId,fileId)=>call("trash_gallery_folder",{conn_id:connId,file_id:fileId});

D.init=()=>{const q=new URLSearchParams(location.search),r=q.get("drive");if(r){history.replaceState(null,"",location.pathname+location.hash);toast(r=="connected"?"Google Drive connected":"Couldn't connect Google Drive ("+(q.get("reason")||"error")+")")}if(q.get("share")){history.replaceState(null,"",location.pathname+location.hash);toast("Receiving shared files…")}sb.auth.getSession().then(({data:{session}})=>{D.uid=session&&session.user.id;D.refresh().then(()=>setTimeout(D.tick,1500))});if(LSB.orphans())D.orphanWarn()};
D.orphanWarn=()=>toast("The file is in Google Drive, but saving its details failed.",{l:"Retry",f:async()=>{try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}}});
// ---- Banyak akun Google Drive ----
const drives=()=>{const s=D.st;if(!s)return[];if(s.drives)return s.drives;return s.connected?[{id:"",email:s.email,status:s.status,folder_id:s.folder_id,folder_name:s.folder_name,auto_backup:s.auto_backup,is_default:true}]:[]};
const live=()=>drives().filter(d=>d.status=="connected"),ok=()=>live().length>0,dflt=()=>drives().find(d=>d.is_default)||drives()[0];
const dr=id=>drives().find(d=>d.id==id)||dflt();
window.getBlob=async p=>{if(p._blob instanceof Blob)return p._blob;if(p.sp=="drive"){const cid=p.gconn||p.cid||p.drive_conn_id||"";const fid=p.aid||p.gid||p.source_drive_id;if(!fid)throw E("error","Google Drive file ID is missing");const r=await raw("import_download",{conn_id:cid,file_id:fid});if(!r.ok){const j=await r.json().catch(()=>({}));throw E(j.code||"error",j.message||"Couldn't download this file from Google Drive")}p._blob=await r.blob();if(!p._blob.size)throw E("error","Google Drive returned an empty file");return p._blob}const r=await fetch(p.url);if(!r.ok)throw E("error","Couldn't read the file from MIKA Cloud ("+r.status+")");return r.blob()};
// URL yang bisa diputar <video>. Video di Supabase: signed URL biasa. Video yang hanya ada di Google Drive: URL stream bertanda tangan
// dari Edge Function (mendukung Range, jadi bisa seek). Di-cache sampai mendekati kedaluwarsa (6 jam).
const VS={};
window.vidSrc=async p=>{if(p.sp!="drive"&&p.url)return p.url;const id=p.aid||p.gid;if(!id)throw E("error","Video file not found");
 const h=VS[id];if(h&&h.e>Date.now())return h.u;
 const j=await call("stream_url",{conn_id:p.gconn||"",file_id:id,mime:p.type||""});if(!j.url)throw E("error");VS[id]={u:j.url,e:Date.now()+5*36e5};return j.url};
window.lBadge=p=>p.sp=="drive"?'<i class=lb>Drive</i>':p.bs=="done"?'<i class=lb>S + Drive</i>':p.bs=="failed"?'<i class="lb f">Backup failed</i>':"";
window.lLoc=p=>p.sp=="drive"?" · Google Drive":p.bs=="done"?" · Supabase + Drive":p.bs=="failed"?" · Supabase (Drive backup failed)":p.sp=="supabase"?" · Supabase":"";
window.storagePicker=()=>{const d=dflt(),o=ok(),a=o&&d&&d.auto_backup,L=live();
 const dc=L.length>1?`<label class=mu>Google Drive account</label><select id=dc style="margin-bottom:6px">${L.map(x=>`<option value="${esc(x.id)}" ${x.is_default?"selected":""}>${esc(x.email||"")}${x.is_default?" (default)":""}</option>`).join("")}</select>`:"";
 return`<label class=mu>Storage</label><select id=sm style="margin-bottom:6px"><option value=both ${o?"":"disabled"} ${a?"selected":""}>MIKA Cloud + Google Drive</option><option value=supabase ${a?"disabled":""} ${a?"":"selected"}>MIKA Cloud${a?" (automatic backup is ON)":""}</option><option value=drive ${o?"":"disabled"}>Google Drive only</option></select>${a?`<div class=mu style="font-size:12px;margin-bottom:6px">Automatic backup is ON. New uploads are saved to MIKA Cloud and Google Drive.</div>`:o?"":`<div class=mu style="font-size:12px;margin-bottom:6px">Connect Google Drive in Profile to use the Drive options.</div>`}${dc}`};
window.lMode=s=>{const m=(s.querySelector("#sm")||{}).value||"supabase";D.ff.length=0;D.uf=0;if(m!="supabase"&&!ok()){toast(MSG[drives().some(x=>x.status=="expired")?"token_expired":"not_connected"]);return null}window.LUMEN_DRIVE=(s.querySelector("#dc")||{}).value||"";return m};
window.lSuffix=()=>(D.ff.length?" · failed: "+D.ff.length:"")+(D.uf?" · Drive backup failed: "+D.uf:"");
window.lAct=()=>{if(D.ff.length){const l=D.ff.splice(0);D.uf=0;return{l:"Retry",f:()=>upload(l)}}if(D.uf){D.uf=0;return{l:"Retry",f:()=>backup(S.photos.filter(p=>p.bs=="failed"))}}};
async function backup(l,o={}){if(D.busy||!l.length)return;D.busy=true;let n=0,bad=0,last;const N=l.length;
 if(!o.silent)LProg.start("Backing up to Google Drive",`0 of ${N}`);
 for(const p of l){const k=n+bad,at=(f=0)=>k/N*100+f/N*100;
  try{if(!o.silent)LProg.set({sub:`${k+1} of ${N} · ${p.name||"photo"}`,pct:at()});AB.msg=`Backing up to Drive ${k+1}/${N}…`;R2();
   const b=await getBlob(p),f=new File([b],p.name||"photo",{type:p.type||b.type});f._conn="";
   const did=await D.up(f,pc=>{if(!o.silent)LProg.set({pct:at(.25+.75*pc/100)})}),{error}=await sb.from("photos").update({backup_drive_file_id:did,backup_status:"done",drive_conn_id:D.lastCid||null}).eq("id",p.id);if(error)throw error;n++}
  catch(e){bad++;last=e;await sb.from("photos").update({backup_status:"failed"}).eq("id",p.id);if(["token_expired","not_connected","quota","offline","folder_missing"].includes(e.code))break}}
 D.busy=false;await LSB.reload("photos");D.refresh();AB.msg=bad?`${n} backed up to Drive, ${bad} failed`:`${n} backed up to Drive`;R2();
 if(!o.silent)bad?LProg.fail(`${n} backed up, ${bad} failed`,last&&last.message):LProg.done(`${n} photo${n==1?"":"s"} backed up to Google Drive`);
 else if(n||bad)toast(bad?`${n} backed up, ${bad} failed: ${last.message}`:`${n} photo${n==1?"":"s"} backed up to Google Drive`)}
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
const A={
 async connect(){try{location.href=(await call("start")).url}catch(e){toast("Failed: "+e.message)}},
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
 logout(){LSB.logout()},
};
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
 return{fp,ns,dr,used:all.reduce((a,p)=>a+(p.sp=="drive"?0:(+p.size||0)),0)}};
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
 D.importing=true;LProg.start("Importing from Google Drive","Reading selected files…");LProg.set({ind:true});
 try{
  const files=[],skipped=[];
  for(let i=0;i<ids.length;i+=50){const j=await call("import_info",{conn_id:cid,ids:ids.slice(i,i+50)});files.push(...(j.files||[]));skipped.push(...(j.skipped||[]))}
  if(!files.length){console.warn("MIKA Drive import: no readable media returned",{selected:ids.length,skipped});
   return LProg.fail("Nothing to import",skipped.length&&skipped[0].code!="not_media"?`Google Drive couldn't read the selected file (${skipped[0].code||"access error"}). Reconnect the account in Profile and try again.`:"The selected items are not supported photos or videos.")}
  const have=lib().dr,todo=files.filter(f=>!have.has(f.id));
  if(!todo.length)return LProg.done("Already imported","All selected files are already in your MIKA library");
  // Bobot tiap file = ukurannya, jadi persentase total bergerak rata (bukan melompat per file).
  const W=todo.map(f=>Math.max(1,+f.size||1)),T=W.reduce((a,b)=>a+b,0);let before=0,n=0,bad=0,lastErr="";
  const tot=todo.length,mbs=x=>(x/1048576).toFixed(x>=1e7?0:1);
  LProg.set({ind:false,pct:0});
  for(let i=0;i<tot;i++){
   const f=todo[i],w=W[i],at=i+1,tag=`${at} of ${tot} · ${f.name||"file"}`,pc=fr=>(before+w*fr)/T*100;
   LProg.set({title:tot>1?`Importing ${at} of ${tot}`:"Importing 1 file",sub:`Downloading · ${tag}`,pct:pc(0)});
   try{
    // Tahap: unduh dari Drive 0–50%, unggah ke MIKA Cloud 50–98%, simpan data 98–100%
    const blob=await importBlob(cid,f,(got,len)=>{const total=len||+f.size||0;LProg.set({sub:`Downloading ${mbs(got)}${total?" / "+mbs(total):""} MB · ${f.name||"file"}`,pct:pc(total?Math.min(.5,got/total*.5):.25)})});
    const mime=f.mime||blob.type||guessMime(f.name)||"application/octet-stream";
    const file=new File([blob],f.name||("Google-Drive-"+f.id),{type:mime,lastModified:Date.parse(f.created||"")||Date.now()});
    LProg.set({sub:`Uploading · ${tag}`,pct:pc(.5)});
    await ingest(file,{mode:"supabase",srcDriveId:f.id,meta:f,prog:p=>LProg.set({sub:`Uploading ${Math.round(p)}% · ${f.name||"file"}`,pct:pc(.5+Math.min(.48,p/100*.48))}),
     thumbFallback:async()=>{const r=await raw("import_thumb",{conn_id:cid,file_id:f.id});if(!r.ok)return null;const tb=await r.blob();return tb.size&&/^image\//.test(tb.type||"")?new File([tb],"t_"+file.name+".jpg",{type:tb.type}):null}});
    n++;
   }catch(e){
    console.error("MIKA Drive import failed",f.id,e);bad++;lastErr=`${f.name||"file"}: ${e.message||"unknown error"}`;
    if(["cloud_quota","offline","unauthorized","token_expired"].includes(e.code))break;
   }
   before+=w;LProg.set({pct:before/T*100});
  }
  await LSB.reload("photos");
  if(bad&&!n)LProg.fail("Import failed",lastErr);
  else if(bad)LProg.fail(`Imported ${n}, ${bad} failed`,lastErr);
  else LProg.done(`Imported ${n} file${n==1?"":"s"} into MIKA Cloud`);
 }catch(e){console.error("MIKA Drive import failed",e);LProg.fail("Import failed",e.message||"Something went wrong")}
 finally{D.importing=false}
};

// ======================= Kategori untuk foto Google Drive =======================
// Foto yang hanya ada di Drive tidak punya baris di perpustakaan MIKA, jadi tidak punya kategori dan tidak masuk album kategori.
// Di sini tiap foto Drive dibuatkan baris ringan (id file Drive + thumbnail kecil + kategori hasil AI di perangkat). File aslinya TETAP di Drive,
// tidak disalin; foto penuh dibaca langsung dari Drive saat dibuka. Menjalankan ulang aman: file yang sudah terdaftar dilewati.
const SMALL=n=>String(n||"photo").replace(/\.[^.]+$/,"");
async function indexOne(cid,f,A){
 const mime=f.mimeType||f.mime||"",vid=mime.startsWith("video/");
 let tb=null;
 try{const r=await raw("import_thumb",{conn_id:cid,file_id:f.id});if(r.ok){const b=await r.blob();if(b.size&&/^image\//.test(b.type||""))tb=b}}catch(e){if(e.code=="offline")throw e}
 if(!tb)return false;                                        // tanpa thumbnail grid-nya kosong; lewati
 let cat="Motion";
 if(!vid){cat="Other";
  if(typeof autoCat=="function"){window.LF&&(LF.aiFail=0);cat=await autoCat(new File([tb],"t.jpg",{type:tb.type}));if(window.LF&&LF.aiFail)throw E("ai","Couldn't load the on-device AI model. Check your connection and try again.")}}
 const tf=new File([tb],"t_"+SMALL(f.name)+".jpg",{type:tb.type});tf._th=1;
 const t=await A.upload(tf),im=f.imageMediaMetadata||{},vm=f.videoMediaMetadata||{};
 try{
  const id="p"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
  const row={sp:"drive",cid,gconn:cid,name:f.name||"Untitled",url:"",th:t.url,tid:t.id,aid:f.id,up:Date.now(),type:mime,size:+f.size||0,w:+(im.width||vm.width)||0,h:+(im.height||vm.height)||0,dur:Math.round((+vm.durationMillis||0)/1000),cat,
   date:isoDate(im.time)||Date.parse(f.createdTime||f.created||"")||Date.now(),fav:false,hash:"",src_fp:"gd:"+f.id,source_drive_id:f.id};
  LSB.meta(f.id,{prov:"drive",did:f.id,bs:"done",cid});
  await saveRow(id,row);
 }catch(e){try{await A.delete(t.id)}catch(_){}throw e}
 return true}
async function catRun(cid,files,label,held){
 if(!held&&D.importing)return toast("Another task is still running. Wait until it finishes.");
 const have=lib().dr,todo=files.filter(f=>/^(image|video)\//.test(f.mimeType||f.mime||"")&&!have.has(f.id));
 if(!todo.length){if(held){D.importing=false;LProg.done("Nothing new to sort","Every photo in Drive is already in your categories")}else toast(files.length?"These photos are already in your categories":"No photos or videos found");return}
 D.importing=true;LProg.start(label||"Sorting Drive photos into categories",`Preparing on-device AI…`);
 let n=0,skip=0,stop="";
 try{
  const A=await window.claude.use("assets"),N=todo.length;
  for(let i=0;i<N;i++){const f=todo[i];
   LProg.set({title:`Sorting ${i+1} of ${N}`,sub:f.name||"",pct:i/N*100});
   try{if(await indexOne(cid,f,A))n++;else skip++}
   catch(e){if(["ai","offline","unauthorized","token_expired","not_connected"].includes(e.code)){stop=e.message;break}skip++;console.warn("MIKA Drive categorize skipped",f.id,e)}}
  await LSB.reload("photos")}
 catch(e){stop=e.message||"Something went wrong"}
 finally{D.importing=false}
 if(stop)LProg.fail(n?`Sorted ${n}, then stopped`:"Couldn't sort Drive photos",stop);
 else LProg.done(`${n} Drive photo${n==1?"":"s"} added to categories`,skip?`${skip} skipped (no preview available)`:"")}
// Satu folder (dipanggil dari Albums > Google Drive)
// Seluruh akun Drive
D.catAll=async cid=>{
 const L=live();if(!L.length)return toast(MSG.not_connected);
 if(cid==null&&L.length>1)return sheet(`<h3 style="margin-top:0">Sort which account?</h3>`+L.map(d=>`<button class=o data-x="c:${esc(d.id)}">${esc(d.email||"")}${d.is_default?" (default)":""}</button>`).join(""),x=>{if(x&&x.startsWith("c:"))D.catAll(x.slice(2))});
 if(cid==null)cid=L[0].id;
 if(D.importing)return toast("Another task is still running. Wait until it finishes.");
 D.importing=true;LProg.start("Looking through Google Drive…","0 photos and videos found");LProg.set({ind:true});
 const all=[];let tk="";
 try{do{const j=await call("list_media",{conn_id:cid,page_token:tk,search:""});all.push(...(j.files||[]));tk=j.next_page_token||"";LProg.set({sub:`${all.length} photos and videos found`})}while(tk&&all.length<5000)}
 catch(e){D.importing=false;return LProg.fail("Couldn't read Google Drive",e.message)}
 return catRun(cid,all,"Sorting Drive photos into categories",true)};

// ======================= Backup otomatis =======================
// (1) Cloud → Drive: bila "Auto backup" Drive default aktif, semua file MIKA Cloud yang belum tercadangkan dikirim ke Drive di latar depan.
// (2) HP → MIKA: pantau satu folder (File System Access API, Chrome/Edge desktop) dan terima foto yang dibagikan dari galeri (Share Target PWA).
// Peramban TIDAK mengizinkan pemindaian galeri di latar belakang saat aplikasi tertutup; semua berjalan saat MIKA terbuka.
const AB=D.ab={q:[],run:false,n:0,bad:0,msg:"",perm:"",skip:new Set(),tried:new Set(),cap:false};
const CK=()=>"mika_ab_"+(D.uid||""),DEF={dev:false,wifi:true,dest:"both",since:0,dirName:"",gal:false};
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
// ---- Simpan semua foto MIKA ke galeri HP (aplikasi native + plugin Media). Satu album per kategori: "MIKA Portraits", "MIKA Nature", ... ----
const GK=()=>"mika_gal_"+(D.uid||""),galDone=()=>{try{return new Set(JSON.parse(localStorage.getItem(GK())||"[]"))}catch(e){return new Set()}},galSave=x=>{try{localStorage.setItem(GK(),JSON.stringify([...x]))}catch(e){}};
let galBusy=false;
async function galSync(manual){
 if(!window.LDL||!LDL.hasGallery()||galBusy||D.importing||D.busy)return;
 const done=galDone(),todo=LSB.docs("photos").filter(p=>(p.sp=="supabase"||p.sp=="drive")&&!done.has(p.id));
 if(!todo.length){if(manual)toast("Everything is already in your phone gallery");return}
 if(!manual&&!netOK())return;
 galBusy=true;if(manual)LProg.start("Saving to your phone gallery",`0 of ${todo.length}`);
 let n=0,bad=0,last="";
 for(const p of todo){
  try{if(manual)LProg.set({title:`Saving ${n+bad+1} of ${todo.length}`,sub:p.name||"",pct:(n+bad)/todo.length*100});
   const b=await getBlob(p),r=await LDL.save(b,fname(p),{album:p.cat?"MIKA "+p.cat:"MIKA"});p._blob=null;
   if(r.kind=="saved"){done.add(p.id);n++;if(n%10==0)galSave(done)}else bad++}
  catch(e){bad++;last=e.message||"error";if(e.code=="offline")break}}
 galSave(done);galBusy=false;
 if(manual)bad&&!n?LProg.fail("Couldn't save to your gallery",last):LProg.done(`${n} saved to your phone gallery`,bad?`${bad} failed${last?": "+last:""}`:"");
 else if(n)toast(`${n} photo${n==1?"":"s"} saved to your phone gallery`)}
let driveIndexAt=0;
async function autoDriveIndex(){
 if(Date.now()-driveIndexAt<15*60*1000)return;
 for(const d of live()){
  try{await D.catAll(d.id||undefined)}
  catch(e){if(e.code==="offline")throw e;console.warn("MIKA Drive indexing",e)}
 }
 driveIndexAt=Date.now();
}
let tk=false;
async function tick(){if(tk||document.hidden||!D.uid||!D.st||!LSB.loaded("photos"))return;tk=true;
 try{await shareIntake();await cloudSync();await autoDriveIndex();await scanFolder(false);if(cfg().gal)await galSync(false)}catch(e){console.warn("MIKA auto backup",e)}finally{tk=false}}
D.tick=tick;
setInterval(tick,60000);["visibilitychange","online","focus"].forEach(ev=>addEventListener(ev,()=>setTimeout(tick,800)));
addEventListener("beforeunload",e=>{if(AB.run||D.busy||D.importing){e.preventDefault();e.returnValue=""}});
const RF=()=>{try{typeof rr=="function"&&rr()}catch(e){}};
Object.assign(A,{
 async abdev(){if(cfg().dev){setCfg({dev:false});AB.msg="";return RF()}
  if(!window.showDirectoryPicker)return toast("This browser can't watch a folder. Share photos from your gallery to MIKA instead.");
  try{const h=await showDirectoryPicker({id:"mika-backup",mode:"read"});await idb("set","dir:"+D.uid,h);AB.perm="";
   sheet(`<h3 style="margin-top:0">Back up “${esc(h.name)}”</h3><div class=mu style="font-size:12px;margin-bottom:6px">New photos and videos in this folder are backed up automatically whenever MIKA is open.</div><button class=o data-x=all>Existing and new files</button><button class=o data-x=new>Only new files from now</button>`,x=>{setCfg({dev:true,dirName:h.name,since:x=="new"?Date.now():0});RF();tick()})}
  catch(e){if(e.name!="AbortError")toast("Failed: "+e.message)}},
 async abfolder(){if(!window.showDirectoryPicker)return;try{const h=await showDirectoryPicker({id:"mika-backup",mode:"read"});await idb("set","dir:"+D.uid,h);setCfg({dirName:h.name});AB.perm="";RF();tick()}catch(e){if(e.name!="AbortError")toast("Failed: "+e.message)}},
 async abresume(){try{await scanFolder(true);RF()}catch(e){toast("Failed: "+e.message)}},
 abwifi(){setCfg({wifi:!cfg().wifi});RF()},
 abdest(){setCfg({dest:cfg().dest=="both"?"supabase":"both"});RF()},
 galall(){galSync(true)},
 galauto(){setCfg({gal:!cfg().gal});RF();if(cfg().gal)galSync(true)}});
const abRows=()=>{const c=cfg(),sup=!!window.showDirectoryPicker,B=(k,t)=>`<button class=chip data-dr=${k}>${t}</button>`,
  Rw=(a,b,d="")=>`<div class=row><span${d?" class=rl":""}>${a}${d?`<small class=rdesc>${d}</small>`:""}</span>${b}</div>`;
 let h=`<div class=mu style="font-size:12px;margin:12px 0 2px"><b style="color:var(--tx)">Automatic backup</b> · runs while MIKA is open</div>`;
 // Pantau folder hanya ada di peramban desktop (Chrome/Edge). Di HP baris ini tidak berguna, jadi disembunyikan.
 if(sup){h+=Rw("Watch folder",B("abdev",c.dev?"On":"Off"),"Desktop only: automatically backs up new photos and videos from a folder on this computer.");
  if(c.dev){h+=Rw("Folder",`<span class=acts><span class="mu v">${esc(c.dirName||"—")}</span>${B("abfolder","Change")}</span>`);
   if(AB.perm=="needed")h+=Rw('<b style="color:var(--ac2)">Permission needed</b>',B("abresume","Allow"))}}
 h+=Rw("Wi-Fi only",B("abwifi",c.wifi?"On":"Off"),"Don't back up while on mobile data.");
 h+=Rw("Back up to",B("abdest",dest()=="both"?"MIKA Cloud + Drive":"MIKA Cloud only"),"Tap to change");
 if(window.LDL&&LDL.hasGallery()){
  h+=Rw("Phone gallery",B("galall","Save all"),"Save photos to your phone gallery.");
  h+=Rw("Save new photos to gallery",B("galauto",c.gal?"On":"Off"))}
 if(!sup)h+=`<p class=mu style="font-size:12px;margin:4px 0 0">Photos shared from your gallery (Share → MIKA) are backed up automatically once MIKA is installed.</p>`;
 if(AB.msg)h+=Rw("Status",`<span class=mu style="text-align:right">${esc(AB.msg)}</span>`);
 return h};
window.backupSettingsRows=abRows;
window.driveCard=()=>{const s=D.st,P=S.photos,done=P.filter(p=>p.sp=="supabase"&&p.bs=="done").length,fail=P.filter(p=>p.bs=="failed").length,todo=P.filter(p=>p.sp=="supabase"&&p.bs!="done").length,only=P.filter(p=>p.sp=="drive").length,L=drives();
 const R=(a,b,x="",d="")=>`<div class=row${x}><span${d?" class=rl":""}>${a}${d?`<small class=rdesc>${d}</small>`:""}</span>${b}</div>`,B=(k,t,id)=>`<button class=chip data-dr=${k}${id!=null?` data-id="${esc(id)}"`:""}>${t}</button>`;let h;
 if(!s)h=R("Status",'<span class=mu>Checking…</span>',' style="border:0"');
 else if(!L.length)h=R('<span class=dot></span>Not connected',B("connect","Connect"),' style="border:0"')+`<p class=mu style="font-size:12px;margin:4px 0 0">MIKA can browse the Google Drive files and folders you authorize. Your originals stay in Google Drive unless you explicitly upload or import them elsewhere. You can connect more than one Google account.</p>`;
 else h=L.map((d,i)=>{const on=d.status=="connected",e=esc(d.email||"Google account");
   return`<div class="dv${i?" dv2":""}">`+R(`<span class="dot ${on?"g":"r"}"></span><span style="color:var(--tx);min-width:0;overflow-wrap:anywhere">${e}</span>${d.is_default?'<span class=mu style="font-size:12px;margin-left:6px">Default</span>':""}`,"",' style="border:0;padding-bottom:2px"')
   +(on?R("Folder",`<span class=acts><span class="mu v">${esc(d.folder_name||"—")}</span>${B("folder","Change",d.id)}</span>`)
   +R("Open / share folder",`<span class=acts>${B("open","Open",d.id)}${B("share","Share",d.id)}</span>`)
   +R("Connection",B("disc","Disconnect",d.id))+(d.is_default?R("Auto backup to Drive",B("auto",d.auto_backup?"On":"Off",d.id)):""):"")
   +(!on?R("Connection",B("connect","Reconnect",d.id),' account-row style="border:0"'):L.length>1&&!d.is_default?R("Account",B("def","Make default",d.id),' account-row style="border:0"'):"")+`</div>`}).join("")
  +R("Add another Google Drive",B("connect","Add"))
  +R("Backup status",`<span class=mu>${done} backed up${only?` · ${only} Drive only`:""}${fail?` · <b style="color:var(--ac2)">${fail} failed</b>`:""}</span>`)
  +(fail||todo?R(todo?`${todo} not backed up yet`:"",`<span style="display:flex;gap:6px">${fail?B("retry","Retry"):""}${todo?B("all","Back up all"):""}</span>`):"")
  +(L.some(d=>d.status=="connected")?R("Manual backup",B("manual","Choose files")):"")
  +(LSB.orphans()?R("Pending details",B("orph","Recover")):"");
 return`<div class=gp><div class=tt>Google Drive</div>${h}</div>`};
})();

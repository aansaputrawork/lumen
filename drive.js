// Google Drive: pemanggil Edge Function, upload resumable, UI pengaturan, indikator.
(()=>{const C=window.LUMEN_CONFIG||{};if(!window.sb)return;
const FN=(C.FUNCTIONS_URL||C.SUPABASE_URL+"/functions/v1").replace(/\/drive\/?$/,"")+"/drive"; // FUNCTIONS_URL boleh berakhiran /drive atau tidak
const MSG={offline:"You're offline. Check your connection and try again.",not_connected:"Google Drive isn't connected. Connect it in Profile → Google Drive.",token_expired:"Your Google Drive session has expired. Reconnect it in Profile.",quota:"Your Google Drive is full. Free up some space and try again.",folder_missing:"The destination folder wasn't found. Choose another folder in Profile.",upload_failed:"Upload to Google Drive failed.",picker_not_configured:"Import from Google Drive isn't set up yet (see docs/SETUP.md, \"Import from Drive\").",no_thumb:"No preview available.",unauthorized:"Your session has expired. Please sign in again.",error:"Something went wrong."};
const E=(c,m)=>Object.assign(new Error(MSG[c]||m||c),{code:c});
const D=window.LDrive={st:null,busy:false,uf:0,ff:[],lastErr:"",lastCid:""};
const hdr=async()=>{const{data:{session}}=await sb.auth.getSession();return{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,apikey:C.SUPABASE_ANON_KEY}};
async function raw(action,body={}){if(!navigator.onLine)throw E("offline");try{return await fetch(FN,{method:"POST",headers:await hdr(),body:JSON.stringify({action,...body})})}catch(e){throw E("offline")}}
async function call(action,body){const r=await raw(action,body),j=await r.json().catch(()=>({}));if(!r.ok)throw E(j.code||"error",j.message);return j}

D.up=async (f,onProgress)=>{
 const mime=f.type||"application/octet-stream";
 const {uploadUrl,conn_id}=await call("init_upload",{name:f.name,mime,size:f.size,conn_id:window.LUMEN_DRIVE||""});
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
D.init=()=>{const q=new URLSearchParams(location.search),r=q.get("drive");if(r){history.replaceState(null,"",location.pathname+location.hash);toast(r=="connected"?"Google Drive connected":"Couldn't connect Google Drive ("+(q.get("reason")||"error")+")")}D.refresh();if(LSB.orphans())D.orphanWarn()};
D.orphanWarn=()=>toast("The file is in Google Drive, but saving its details failed.",{l:"Retry",f:async()=>{try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}}});
// ---- Banyak akun Google Drive ----
const drives=()=>{const s=D.st;if(!s)return[];if(s.drives)return s.drives;return s.connected?[{id:"",email:s.email,status:s.status,folder_id:s.folder_id,folder_name:s.folder_name,auto_backup:s.auto_backup,is_default:true}]:[]};
const live=()=>drives().filter(d=>d.status=="connected"),ok=()=>live().length>0,dflt=()=>drives().find(d=>d.is_default)||drives()[0];
const dr=id=>drives().find(d=>d.id==id)||dflt();
window.getBlob=async p=>{if(p.sp=="drive"){const r=await raw("download",{file_id:p.aid});if(!r.ok)throw E((await r.json().catch(()=>({}))).code||"error");return r.blob()}return(await fetch(p.url)).blob()};
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
async function backup(l){if(D.busy||!l.length)return;D.busy=true;window.LUMEN_DRIVE="";let n=0,bad=0,last;
 for(const p of l){try{toast(`Backing up ${n+bad+1}/${l.length}…`);const b=await getBlob(p),did=await D.up(new File([b],p.name,{type:p.type||b.type})),{error}=await sb.from("photos").update({backup_drive_file_id:did,backup_status:"done",drive_conn_id:D.lastCid||null}).eq("id",p.id);if(error)throw error;n++}
  catch(e){bad++;last=e;await sb.from("photos").update({backup_status:"failed"}).eq("id",p.id);if(["token_expired","not_connected","quota","offline","folder_missing"].includes(e.code))break}}
 D.busy=false;await LSB.reload("photos");D.refresh();toast(bad?`${n} backed up, ${bad} failed: ${last.message}`:`${n} photo${n==1?"":"s"} backed up to Google Drive`)}
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
 async folder(id){const d=dr(id);try{const{folders}=await call("list_folders",{conn_id:d.id});sheet(`<h3 style="margin-top:0">Storage folder</h3><div class=mu style="font-size:12px;margin-bottom:6px">${esc(d.email||"")} · limited access (drive.file): only folders created by MIKA appear here.</div>`+folders.map(f=>`<button class=o data-x="f:${esc(f.id)}">${esc(f.name)}${f.id==d.folder_id?" ✓":""}</button>`).join("")+`<button class=o data-x=new>Create new folder…</button>`,async x=>{
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
let GP=null;
const loadPicker=()=>GP||(GP=new Promise((res,rej)=>{const go=()=>gapi.load("picker",{callback:res,onerror:()=>rej(E("error","Couldn't load Google Picker"))});
 if(window.gapi&&gapi.load)return go();const s=document.createElement("script");s.src="https://apis.google.com/js/api.js";s.onload=go;s.onerror=()=>{GP=null;rej(E("error","Couldn't load Google Picker"))};document.head.append(s)}));
D.imp=async cid=>{const L=live();if(!L.length)return toast(MSG.not_connected);
 if(cid==null&&L.length>1)return sheet(`<h3 style="margin-top:0">Import from which account?</h3>`+L.map(d=>`<button class=o data-x="c:${esc(d.id)}">${esc(d.email||"")}${d.is_default?" (default)":""}</button>`).join(""),x=>{if(x&&x.startsWith("c:"))D.imp(x.slice(2))});
 if(cid==null)cid=L[0].id;
 let k;try{k=await call("pick_token",{conn_id:cid})}catch(e){return toast(e.code=="picker_not_configured"?MSG.picker_not_configured:"Failed: "+e.message)}
 try{await loadPicker()}catch(e){return toast("Failed: "+e.message)}
 const v=new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS).setIncludeFolders(false).setSelectFolderEnabled(false).setEnableDrives(true);
 const builder=new google.picker.PickerBuilder().addView(v).enableFeature(google.picker.Feature.MULTISELECT_ENABLED).enableFeature(google.picker.Feature.SUPPORT_DRIVES).setOAuthToken(k.token).setDeveloperKey(k.api_key).setAppId(String(k.app_id)).setOrigin(location.protocol+"//"+location.host)
  .setCallback(d=>{if(d.action==google.picker.Action.PICKED){const docs=d[google.picker.Response.DOCUMENTS]||d.docs||[],ids=docs.map(x=>x[google.picker.Document.ID]||x.id).filter(Boolean);if(!ids.length)return toast("Google Picker did not return any selected files. Select photos/videos and press Open.");D.doImport(k.conn_id,ids)}});
 builder.build().setVisible(true)};
async function importDriveBlob(cid,id){
 const r=await raw("import_download",{conn_id:cid,file_id:id});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw E(j.code||"error",j.message||"Could not download the selected file from Google Drive")}
 const b=await r.blob();if(!b.size)throw E("error","Google Drive returned an empty file");return b;
}
D.doImport=async(cid,ids)=>{
 if(!Array.isArray(ids)||!ids.length)return toast("No files were returned by Google Picker");
 if(!assets)return toast("Imports need editor access to this page");
 try{
  toast("Reading selected files…");
  const have=new Set([...S.photos,...S.trash].flatMap(p=>[p.source_drive_id,p.gid,p.sp=="drive"?p.aid:null]).filter(Boolean));
  const {files=[],skipped=[]}=await call("import_info",{conn_id:cid,ids});
  if(!files.length){console.warn("MIKA Drive import: no readable media returned",{selected:ids.length,skipped});return toast(skipped.length?`Google Drive couldn't read the selected file (${skipped[0].code||"access error"}). Check Drive API access and try reconnecting the account.`:"The selected items are not supported photos or videos.")}
  const todo=files.filter(f=>!have.has(f.id));
  if(!todo.length)return toast("All selected files are already in your MIKA library");
  let n=0,bad=0;
  let used=[...S.photos,...S.trash].reduce((a,p)=>a+(+p.size||0),0);
  for(const f of todo){
   toast(`Downloading from Google Drive ${n+bad+1}/${todo.length}…`);
   let mainId="",thumbId="";
   try{
    const estimate=+f.size||0;
    if(window.LQ&&LQ.cap&&estimate&&used+estimate>LQ.cap)throw E("quota","MIKA Cloud storage quota reached");
    if(window.LQ&&LQ.max&&estimate&&estimate>LQ.max)throw E("too_large",`${f.name||"This file"} exceeds your plan's file size limit`);
    const blob=await importDriveBlob(cid,f.id);
    const mime=f.mime||blob.type||"application/octet-stream";
    const file=new File([blob],f.name||("Google-Drive-"+f.id),{type:mime,lastModified:Date.parse(f.created||"")||Date.now()});
    if(window.LQ&&LQ.cap&&used+file.size>LQ.cap)throw E("quota","MIKA Cloud storage quota reached");
    if(window.LQ&&LQ.max&&file.size>LQ.max)throw E("too_large",`${file.name} exceeds your plan's file size limit`);

    // Force the original file into MIKA Cloud, regardless of the upload preference for normal uploads.
    const cloudFile=Object.assign(file,{_forceSupabase:1});
    const uploaded=await assets.upload(cloudFile,(p,loaded,total)=>toast(`Uploading to MIKA Cloud ${n+bad+1}/${todo.length}… ${p}%`));
    mainId=uploaded.id;
    LSB.meta(mainId,{prov:"supabase",bs:"none"});

    let w=+f.w||0,h=+f.h||0,dur=+f.dur||0,th="",tid="";
    let cat=mime.startsWith("video/")?"Motion":(S.prefs&&S.prefs.cat&&S.prefs.cat!="Auto"?S.prefs.cat:"Auto");
    // Build thumbnail from the actual downloaded original, not a Drive hotlink.
    let tm=mime.startsWith("image/")?await mkThumb(file):mime.startsWith("video/")?await mkVThumb(file):null;
    if(tm){w=w||tm.w;h=h||tm.h;dur=dur||tm.dur||0;
     try{const tr=await assets.upload(tm.file);th=tr.url;tid=tr.id;thumbId=tr.id}catch(e){console.warn("MIKA import thumbnail upload failed",f.id,e)}
    }
    // If the browser cannot decode the original format/codec, use Google's generated thumbnail as a poster.
    if(!th){try{const tr0=await raw("import_thumb",{conn_id:cid,file_id:f.id});if(tr0.ok){const tb=await tr0.blob();if(tb.size&&/^image\//.test(tb.type||"")){const tf=Object.assign(new File([tb],"t_"+(file.name||"drive")+".jpg",{type:tb.type}),{_th:1});const tr=await assets.upload(tf);th=tr.url;tid=tr.id;thumbId=tr.id}}}catch(e){console.warn("MIKA Drive thumbnail fallback failed",f.id,e)}}
    if(cat=="Auto"&&mime.startsWith("image/"))try{cat=await autoCat(file)}catch(e){}
    if(cat=="Auto")cat=(CATS&&CATS[1])||"Photos";
    const date=Date.parse((f.taken||"").replace(/^(\d{4}):(\d\d):(\d\d)/,"$1-$2-$3"))||Date.parse(f.created)||file.lastModified||Date.now();
    const rowId="p"+Date.now()+"_"+n;
    await save(null,rowId,{name:file.name,url:uploaded.url,th,tid,aid:mainId,source_drive_id:f.id,up:Date.now(),type:mime,size:uploaded.sizeBytes||file.size,w,h,dur,cat,date,fav:false,hash:""},"photos");
    n++;used+=file.size;
   }catch(e){
    console.error("MIKA Drive import failed",f.id,e);
    if(thumbId)try{await assets.delete(thumbId)}catch(_){}
    if(mainId)try{await assets.delete(mainId)}catch(_){}
    bad++;
    toast(`Import failed: ${f.name||"file"} — ${e.message||"unknown error"}`);
   }
  }
  await LSB.reload("photos");
  toast(bad?`Imported ${n}, ${bad} failed to copy into MIKA Cloud`:`Successfully imported ${n} photo/video${n==1?"":"s"} into MIKA Cloud`);
 }catch(e){console.error("MIKA Drive import failed",e);toast("Import failed: "+(e.message||"Something went wrong"))}
};

window.driveCard=()=>{const s=D.st,P=S.photos,done=P.filter(p=>p.sp=="supabase"&&p.bs=="done").length,fail=P.filter(p=>p.bs=="failed").length,todo=P.filter(p=>p.sp=="supabase"&&p.bs!="done").length,only=P.filter(p=>p.sp=="drive").length,L=drives();
 const R=(a,b,x="")=>`<div class=row${x}><span>${a}</span>${b}</div>`,B=(k,t,id)=>`<button class=chip data-dr=${k}${id!=null?` data-id="${esc(id)}"`:""}>${t}</button>`;let h;
 if(!s)h=R("Status",'<span class=mu>Checking…</span>',' style="border:0"');
 else if(!L.length)h=R('<span class=dot></span>Not connected',B("connect","Connect"),' style="border:0"')+`<p class=mu style="font-size:12px;margin:4px 0 0">Access is limited to files created or picked in MIKA. Nothing is ever made public. You can connect more than one Google account.</p>`;
 else h=L.map((d,i)=>{const on=d.status=="connected",e=esc(d.email||"Google account");
   return`<div class="dv${i?" dv2":""}">`+R(`<span class="dot ${on?"g":"r"}"></span><span style="color:var(--tx);min-width:0;overflow-wrap:anywhere">${e}</span>${d.is_default?'<span class=mu style="font-size:12px;margin-left:6px">Default</span>':""}`,"",' style="border:0;padding-bottom:2px"')
   +(on?R("Folder",`<span style="display:flex;gap:6px;align-items:center"><span class="mu v">${esc(d.folder_name||"—")}</span>${B("folder","Change",d.id)}</span>`)
   +R("Open / share folder",`<span style="display:flex;gap:6px">${B("open","Open",d.id)}${B("share","Share",d.id)}</span>`)
   +(d.is_default?R("Auto backup",B("auto",d.auto_backup?"On":"Off",d.id)):""):"")
   +R("Account",`<span style="display:flex;gap:6px">${!on?B("connect","Reconnect"):""}${on&&L.length>1&&!d.is_default?B("def","Make default",d.id):""}${B("disc","Disconnect",d.id)}</span>`,' style="border:0"')+`</div>`}).join("")
  +R("Add another Google Drive",B("connect","Add"))
  +R("Import from Google Drive",B("imp","Import"))
  +R("Backup status",`<span class=mu>${done} backed up${only?` · ${only} Drive only`:""}${fail?` · <b style="color:var(--ac2)">${fail} failed</b>`:""}</span>`)
  +(fail||todo?R(todo?`${todo} not backed up yet`:"",`<span style="display:flex;gap:6px">${fail?B("retry","Retry"):""}${todo?B("all","Back up all"):""}</span>`):"")
  +(L.some(d=>d.status=="connected")?R("Manual backup",B("manual","Choose files")):"")
  +(LSB.orphans()?R("Pending details",B("orph","Recover")):"")+R("Sign out of MIKA",B("logout","Sign out"),' style="border:0"');
 return`<div class=gp><div class=tt>Google Drive</div>${h}</div>`};
})();

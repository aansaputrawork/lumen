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
 return`<label class=mu>Storage</label><select id=sm style="margin-bottom:6px"><option value=both ${o?"":"disabled"} ${a?"selected":""}>Mika Cloud + Google Drive</option><option value=supabase ${a?"":"selected"}>Mika cloud</option><option value=drive ${o?"":"disabled"}>Google Drive</option></select>${o?"":`<div class=mu style="font-size:12px;margin-bottom:6px">Connect Google Drive in Profile to use the Drive options.</div>`}${dc}`};
window.lMode=s=>{const m=(s.querySelector("#sm")||{}).value||"supabase";D.ff.length=0;D.uf=0;if(m!="supabase"&&!ok()){toast(MSG[drives().some(x=>x.status=="expired")?"token_expired":"not_connected"]);return null}window.LUMEN_DRIVE=(s.querySelector("#dc")||{}).value||"";return m};
window.lSuffix=()=>(D.ff.length?" · failed: "+D.ff.length:"")+(D.uf?" · Drive backup failed: "+D.uf:"");
window.lAct=()=>{if(D.ff.length){const l=D.ff.splice(0);D.uf=0;return{l:"Retry",f:()=>upload(l)}}if(D.uf){D.uf=0;return{l:"Retry",f:()=>backup(S.photos.filter(p=>p.bs=="failed"))}}};
async function backup(l){if(D.busy||!l.length)return;D.busy=true;window.LUMEN_DRIVE="";let n=0,bad=0,last;
 for(const p of l){try{toast(`Backing up ${n+bad+1}/${l.length}…`);const b=await getBlob(p),did=await D.up(new File([b],p.name,{type:p.type||b.type})),{error}=await sb.from("photos").update({backup_drive_file_id:did,backup_status:"done",drive_conn_id:D.lastCid||null}).eq("id",p.id);if(error)throw error;n++}
  catch(e){bad++;last=e;await sb.from("photos").update({backup_status:"failed"}).eq("id",p.id);if(["token_expired","not_connected","quota","offline","folder_missing"].includes(e.code))break}}
 D.busy=false;await LSB.reload("photos");D.refresh();toast(bad?`${n} backed up, ${bad} failed: ${last.message}`:`${n} photo${n==1?"":"s"} backed up to Google Drive`)}
const furl=d=>"https://drive.google.com/drive/folders/"+d.folder_id;
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
 async orph(){try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}},
 imp(){D.imp()},
 logout(){LSB.logout()}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-dr]");if(b&&A[b.dataset.dr])A[b.dataset.dr](b.dataset.id)});

// ---- Menu Upload: dari perangkat ATAU impor dari Google Drive ----
window.uploadMenu=()=>{if(!ok())return upload();sheet(`<h3 style="margin-top:0">Upload</h3><button class=o data-x=dev>From this device</button><button class=o data-x=drv>From Google Drive</button>`,x=>{if(x=="dev")upload();else if(x=="drv")D.imp()})};
// Impor dari Google Drive: Google Picker (file yang dipilih otomatis boleh diakses scope drive.file). File TIDAK disalin; hanya dicatat di perpustakaan
// (thumbnail dibuat di sini). Menghapus dari MIKA tidak menghapus file di Drive.
let GP=null;
const loadPicker=()=>GP||(GP=new Promise((res,rej)=>{const go=()=>gapi.load("picker",{callback:res,onerror:()=>rej(E("error","Couldn't load Google Picker"))});
 if(window.gapi&&gapi.load)return go();const s=document.createElement("script");s.src="https://apis.google.com/js/api.js";s.onload=go;s.onerror=()=>{GP=null;rej(E("error","Couldn't load Google Picker"))};document.head.append(s)}));
D.imp=async cid=>{const L=live();if(!L.length)return toast(MSG.not_connected);
 if(cid==null&&L.length>1)return sheet(`<h3 style="margin-top:0">Import from which account?</h3>`+L.map(d=>`<button class=o data-x="c:${esc(d.id)}">${esc(d.email||"")}${d.is_default?" (default)":""}</button>`).join(""),x=>{if(x&&x.startsWith("c:"))D.imp(x.slice(2))});
 if(cid==null)cid=L[0].id;
 let k;try{k=await call("pick_token",{conn_id:cid})}catch(e){return toast(e.code=="picker_not_configured"?MSG.picker_not_configured:"Failed: "+e.message)}
 try{await loadPicker()}catch(e){return toast("Failed: "+e.message)}
 const v=new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS).setIncludeFolders(true).setSelectFolderEnabled(false);
 new google.picker.PickerBuilder().addView(v).enableFeature(google.picker.Feature.MULTISELECT_ENABLED).setOAuthToken(k.token).setDeveloperKey(k.api_key).setAppId(k.app_id)
  .setCallback(d=>{if(d.action==google.picker.Action.PICKED)D.doImport(k.conn_id,(d.docs||[]).map(x=>x.id))}).build().setVisible(true)};
D.doImport=async(cid,ids)=>{if(!ids.length)return;if(!assets)return toast("Imports need editor access to this page");
 try{toast("Reading files…");const have=new Set([...S.photos,...S.trash].map(p=>p.aid)),{files}=await call("import_info",{conn_id:cid,ids});
  const todo=files.filter(f=>!have.has(f.id));if(!todo.length)return toast(files.length?"Already in your library":"No photos or videos selected");
  let n=0,bad=0;
  for(const f of todo){toast(`Importing ${n+bad+1}/${todo.length}…`);
   try{let w=f.w,h=f.h,dur=f.dur,th="",tid="",cat=f.mime.startsWith("video")?"Motion":(S.prefs&&S.prefs.cat&&S.prefs.cat!="Auto"?S.prefs.cat:"Auto");
    if(f.mime.startsWith("image")){try{const r=await raw("import_thumb",{conn_id:cid,file_id:f.id});if(r.ok){const bl=await r.blob(),m=await mkThumb(new File([bl],f.name,{type:bl.type||"image/jpeg"}));if(m){w=w||m.w;h=h||m.h;const tr=await assets.upload(m.file);th=tr.url;tid=tr.id;if(cat=="Auto")try{cat=await autoCat(m.file)}catch(e){}}}}catch(e){}}
    else{try{const j=await call("stream_url",{file_id:f.id,conn_id:cid,mime:f.mime}),g=await vtGrab(j.url,true),b=await new Promise(r=>g.cv.toBlob(r,"image/jpeg",.8));if(b){w=w||g.w;h=h||g.h;dur=dur||Math.round(g.dur||0);const tr=await assets.upload(Object.assign(new File([b],"t_"+f.name+".jpg",{type:"image/jpeg"}),{_th:1}));th=tr.url;tid=tr.id}}catch(e){}}
    if(cat=="Auto")cat=(CATS&&CATS[1])||"Photos";
    const d=Date.parse((f.taken||"").replace(/^(\d{4}):(\d\d):(\d\d)/,"$1-$2-$3"))||Date.parse(f.created)||Date.now();
    LSB.meta(f.id,{prov:"drive",did:f.id,bs:"done",cid});
    await save(null,"p"+Date.now()+n,{name:f.name,url:"",th,tid,aid:f.id,up:Date.now(),type:f.mime,size:f.size,w,h,dur,cat,date:d,fav:false,hash:""},"photos");n++}
   catch(e){bad++}}
  toast(bad?`Imported ${n}, ${bad} failed`:`Imported ${n} from Google Drive`)}catch(e){toast("Failed: "+e.message)}};

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
  +(fail||todo?R(todo?`${todo} not backed up yet`:"",`<span style="display:flex;gap:6px">${fail?B("retry","Retry"):""}${todo?B("all","Back up"):""}</span>`):"")
  +(LSB.orphans()?R("Pending details",B("orph","Recover")):"")+R("Sign out of MIKA",B("logout","Sign out"),' style="border:0"');
 return`<div class=gp><div class=tt>Google Drive</div>${h}</div>`};
})();

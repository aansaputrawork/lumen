// Google Drive: pemanggil Edge Function, upload resumable, UI pengaturan, indikator.
(()=>{const C=window.LUMEN_CONFIG||{};if(!window.sb)return;
const FN=(C.FUNCTIONS_URL||C.SUPABASE_URL+"/functions/v1").replace(/\/drive\/?$/,"")+"/drive"; // FUNCTIONS_URL boleh berakhiran /drive atau tidak
const MSG={offline:"You're offline. Check your connection and try again.",not_connected:"Google Drive isn't connected. Connect it in Profile → Google Drive.",token_expired:"Your Google Drive session has expired. Reconnect it in Profile.",quota:"Your Google Drive is full. Free up some space and try again.",folder_missing:"The destination folder wasn't found. Choose another folder in Profile.",upload_failed:"Upload to Google Drive failed.",unauthorized:"Your session has expired. Please sign in again.",error:"Something went wrong."};
const E=(c,m)=>Object.assign(new Error(MSG[c]||m||c),{code:c});
const D=window.LDrive={st:null,busy:false,uf:0,ff:[],lastErr:""};
const hdr=async()=>{const{data:{session}}=await sb.auth.getSession();return{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,apikey:C.SUPABASE_ANON_KEY}};
async function raw(action,body={}){if(!navigator.onLine)throw E("offline");try{return await fetch(FN,{method:"POST",headers:await hdr(),body:JSON.stringify({action,...body})})}catch(e){throw E("offline")}}
async function call(action,body){const r=await raw(action,body),j=await r.json().catch(()=>({}));if(!r.ok)throw E(j.code||"error",j.message);return j}
D.up=async f=>{const mime=f.type||"application/octet-stream",{uploadUrl}=await call("init_upload",{name:f.name,mime,size:f.size});let r;
 try{r=await fetch(uploadUrl,{method:"PUT",headers:{"Content-Type":mime},body:f})}catch(e){throw E("offline")}
 if(!r.ok){const t=await r.text().catch(()=>"");throw E(/quota/i.test(t)?"quota":r.status==401?"token_expired":r.status==404?"folder_missing":"upload_failed")}
 return(await r.json()).id};
D.refresh=async()=>{try{D.st=await call("status")}catch(e){D.st={connected:false,err:e.code}}rr()};
D.init=()=>{const q=new URLSearchParams(location.search),r=q.get("drive");if(r){history.replaceState(null,"",location.pathname+location.hash);toast(r=="connected"?"Google Drive connected":"Couldn't connect Google Drive ("+(q.get("reason")||"error")+")")}D.refresh();if(LSB.orphans())D.orphanWarn()};
D.orphanWarn=()=>toast("The file is in Google Drive, but saving its details failed.",{l:"Retry",f:async()=>{try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}}});
const ok=()=>{const s=D.st;return!!(s&&s.connected&&s.status!="expired")};
window.getBlob=async p=>{if(p.sp=="drive"){const r=await raw("download",{file_id:p.aid});if(!r.ok)throw E((await r.json().catch(()=>({}))).code||"error");return r.blob()}return(await fetch(p.url)).blob()};
window.lBadge=p=>p.sp=="drive"?'<i class=lb>Drive</i>':p.bs=="done"?'<i class=lb>S + Drive</i>':p.bs=="failed"?'<i class="lb f">Backup failed</i>':"";
window.lLoc=p=>p.sp=="drive"?" · Google Drive":p.bs=="done"?" · Supabase + Drive":p.bs=="failed"?" · Supabase (Drive backup failed)":p.sp=="supabase"?" · Supabase":"";
window.storagePicker=()=>{const s=D.st,a=ok()&&s.auto_backup,o=ok();return`<label class=mu>Storage</label><select id=sm style="margin-bottom:6px"><option value=both ${o?"":"disabled"} ${a?"selected":""}>Supabase + Google Drive</option><option value=supabase ${a?"":"selected"}>Supabase only</option><option value=drive ${o?"":"disabled"}>Google Drive only (images)</option></select>${o?"":`<div class=mu style="font-size:12px;margin-bottom:6px">Connect Google Drive in Profile to use the Drive options.</div>`}`};
window.lMode=s=>{const m=(s.querySelector("#sm")||{}).value||"supabase";D.ff.length=0;D.uf=0;if(m!="supabase"&&!ok()){toast(MSG[D.st&&D.st.status=="expired"?"token_expired":"not_connected"]);return null}return m};
window.lSuffix=()=>(D.ff.length?" · failed: "+D.ff.length:"")+(D.uf?" · Drive backup failed: "+D.uf:"");
window.lAct=()=>{if(D.ff.length){const l=D.ff.splice(0);D.uf=0;return{l:"Retry",f:()=>upload(l)}}if(D.uf){D.uf=0;return{l:"Retry",f:()=>backup(S.photos.filter(p=>p.bs=="failed"))}}};
async function backup(l){if(D.busy||!l.length)return;D.busy=true;let n=0,bad=0,last;
 for(const p of l){try{toast(`Backing up ${n+bad+1}/${l.length}…`);const b=await getBlob(p),did=await D.up(new File([b],p.name,{type:p.type||b.type})),{error}=await sb.from("photos").update({backup_drive_file_id:did,backup_status:"done"}).eq("id",p.id);if(error)throw error;n++}
  catch(e){bad++;last=e;await sb.from("photos").update({backup_status:"failed"}).eq("id",p.id);if(["token_expired","not_connected","quota","offline","folder_missing"].includes(e.code))break}}
 D.busy=false;await LSB.reload("photos");D.refresh();toast(bad?`${n} backed up, ${bad} failed: ${last.message}`:`${n} photo${n==1?"":"s"} backed up to Google Drive`)}
const url=()=>"https://drive.google.com/drive/folders/"+D.st.folder_id;
const A={
 async connect(){try{location.href=(await call("start")).url}catch(e){toast("Failed: "+e.message)}},
 disc(){actSheet("Disconnect Google Drive?","Your access token is deleted from the server. Files in Drive are not deleted. Photos stored only in Drive can't be opened or downloaded in full until you reconnect.","Disconnect",async()=>{try{await call("disconnect");toast("Disconnected");D.refresh()}catch(e){toast("Failed: "+e.message)}})},
 async folder(){try{const{folders}=await call("list_folders");sheet(`<h3 style="margin-top:0">Storage folder</h3><div class=mu style="font-size:12px;margin-bottom:6px">Limited access (drive.file): only folders created by MIKA appear here.</div>`+folders.map(f=>`<button class=o data-x="f:${esc(f.id)}">${esc(f.name)}${f.id==D.st.folder_id?" ✓":""}</button>`).join("")+`<button class=o data-x=new>Create new folder…</button>`,async x=>{
  try{if(x=="new")return ask("New folder name","MIKA Photos",async n=>{try{await call("create_folder",{name:n});toast("Folder created");D.refresh()}catch(e){toast("Failed: "+e.message)}});await call("set_folder",{id:x.slice(2)});toast("Folder changed");D.refresh()}catch(e){toast("Failed: "+e.message)}})}catch(e){toast("Failed: "+e.message)}},
 open(){window.open(url(),"_blank","noopener")},
 share(){window.open(url(),"_blank","noopener");toast("Use Share on the folder in Google Drive to manage access")},
 async auto(){try{await call("set_auto",{value:!D.st.auto_backup});D.refresh()}catch(e){toast("Failed: "+e.message)}},
 retry(){backup(S.photos.filter(p=>p.bs=="failed"))},
 all(){backup(S.photos.filter(p=>p.sp=="supabase"&&p.bs!="done"))},
 async orph(){try{toast("Recovered: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}},
 logout(){LSB.logout()}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-dr]");if(b&&A[b.dataset.dr])A[b.dataset.dr]()});
window.driveCard=()=>{const s=D.st,P=S.photos,done=P.filter(p=>p.sp=="supabase"&&p.bs=="done").length,fail=P.filter(p=>p.bs=="failed").length,todo=P.filter(p=>p.sp=="supabase"&&p.bs!="done").length,only=P.filter(p=>p.sp=="drive").length;
 const R=(a,b,x="")=>`<div class=row${x}><span>${a}</span>${b}</div>`,B=(k,t)=>`<button class=chip data-dr=${k}>${t}</button>`;let h;
 if(!s)h=R("Status",'<span class=mu>Checking…</span>',' style="border:0"');
 else if(!s.connected)h=R('<span class=dot></span>Not connected',B("connect","Connect"),' style="border:0"')+`<p class=mu style="font-size:11px;margin:4px 0 0">Access is limited to files created by MIKA Photos. Nothing is ever made public.</p>`;
 else if(s.status=="expired")h=R('<span class="dot r"></span>Session expired',B("connect","Reconnect"))+R("Account",B("disc","Disconnect"),' style="border:0"');
 else h=R('<span class="dot g"></span>Connected',`<span class="mu v">${esc(s.email||"")}</span>`)+R("Folder",`<span style="display:flex;gap:6px;align-items:center"><span class="mu v">${esc(s.folder_name||"—")}</span>${B("folder","Change")}</span>`)
  +R("Open / share folder",`<span style="display:flex;gap:6px">${B("open","Open")}${B("share","Share")}</span>`)+R("Auto backup",B("auto",s.auto_backup?"On":"Off"))
  +R("Backup status",`<span class=mu>${done} backed up${only?` · ${only} Drive only`:""}${fail?` · <b style="color:#ff453a">${fail} failed</b>`:""}</span>`)
  +(fail||todo?R(todo?`${todo} not backed up yet`:"",`<span style="display:flex;gap:6px">${fail?B("retry","Retry"):""}${todo?B("all","Back up"):""}</span>`):"")
  +(LSB.orphans()?R("Pending details",B("orph","Recover")):"")+R("Google account",B("disc","Disconnect"),' style="border:0"');
 return`<div class=gp><div class=tt>Google Drive</div>${h}</div>`};
})();

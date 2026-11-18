// Google Drive: pemanggil Edge Function, upload resumable, UI pengaturan, indikator.
(()=>{const C=window.LUMEN_CONFIG||{};if(!window.sb)return;
const FN=(C.FUNCTIONS_URL||C.SUPABASE_URL+"/functions/v1")+"/drive";
const MSG={offline:"Koneksi internet terputus. Periksa jaringan lalu coba lagi.",not_connected:"Google Drive belum terhubung. Hubungkan di Profil → Google Drive.",token_expired:"Sesi Google Drive kedaluwarsa. Hubungkan ulang di Profil.",quota:"Kapasitas Google Drive penuh. Kosongkan ruang lalu coba lagi.",folder_missing:"Folder tujuan tidak ditemukan. Pilih folder lain di Profil.",upload_failed:"Upload ke Google Drive gagal.",unauthorized:"Sesi login berakhir. Masuk ulang.",error:"Terjadi kesalahan."};
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
D.init=()=>{const q=new URLSearchParams(location.search),r=q.get("drive");if(r){history.replaceState(null,"",location.pathname+location.hash);toast(r=="connected"?"Google Drive terhubung":"Gagal menghubungkan Google Drive ("+(q.get("reason")||"error")+")")}D.refresh();if(LSB.orphans())D.orphanWarn()};
D.orphanWarn=()=>toast("File sudah di Google Drive tetapi pencatatan gagal.",{l:"Coba lagi",f:async()=>{try{toast("Dipulihkan: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}}});
const ok=()=>{const s=D.st;return!!(s&&s.connected&&s.status!="expired")};
window.getBlob=async p=>{if(p.sp=="drive"){const r=await raw("download",{file_id:p.aid});if(!r.ok)throw E((await r.json().catch(()=>({}))).code||"error");return r.blob()}return(await fetch(p.url)).blob()};
window.lBadge=p=>p.sp=="drive"?'<i class=lb>Drive</i>':p.bs=="done"?'<i class=lb>S + Drive</i>':p.bs=="failed"?'<i class="lb f">Backup gagal</i>':"";
window.lLoc=p=>p.sp=="drive"?" · Google Drive":p.bs=="done"?" · Supabase + Drive":p.bs=="failed"?" · Supabase (backup Drive gagal)":p.sp=="supabase"?" · Supabase":"";
window.storagePicker=()=>{const s=D.st,a=ok()&&s.auto_backup,o=ok();return`<label class=mu>Penyimpanan</label><select id=sm style="margin-bottom:6px"><option value=both ${o?"":"disabled"} ${a?"selected":""}>Supabase + Google Drive</option><option value=supabase ${a?"":"selected"}>Supabase saja</option><option value=drive ${o?"":"disabled"}>Google Drive saja (gambar)</option></select>${o?"":`<div class=mu style="font-size:12px;margin-bottom:6px">Hubungkan Google Drive di Profil untuk opsi Drive.</div>`}`};
window.lMode=s=>{const m=(s.querySelector("#sm")||{}).value||"supabase";D.ff.length=0;D.uf=0;if(m!="supabase"&&!ok()){toast(MSG[D.st&&D.st.status=="expired"?"token_expired":"not_connected"]);return null}return m};
window.lSuffix=()=>(D.ff.length?" · gagal: "+D.ff.length:"")+(D.uf?" · backup Drive gagal: "+D.uf:"");
window.lAct=()=>{if(D.ff.length){const l=D.ff.splice(0);D.uf=0;return{l:"Ulangi",f:()=>upload(l)}}if(D.uf){D.uf=0;return{l:"Coba lagi",f:()=>backup(S.photos.filter(p=>p.bs=="failed"))}}};
async function backup(l){if(D.busy||!l.length)return;D.busy=true;let n=0,bad=0,last;
 for(const p of l){try{toast(`Mencadangkan ${n+bad+1}/${l.length}…`);const b=await getBlob(p),did=await D.up(new File([b],p.name,{type:p.type||b.type})),{error}=await sb.from("photos").update({backup_drive_file_id:did,backup_status:"done"}).eq("id",p.id);if(error)throw error;n++}
  catch(e){bad++;last=e;await sb.from("photos").update({backup_status:"failed"}).eq("id",p.id);if(["token_expired","not_connected","quota","offline","folder_missing"].includes(e.code))break}}
 D.busy=false;await LSB.reload("photos");D.refresh();toast(bad?`${n} dicadangkan, ${bad} gagal: ${last.message}`:`${n} foto dicadangkan ke Google Drive`)}
const url=()=>"https://drive.google.com/drive/folders/"+D.st.folder_id;
const A={
 async connect(){try{location.href=(await call("start")).url}catch(e){toast("Failed: "+e.message)}},
 disc(){actSheet("Putuskan Google Drive?","Token dihapus dari server. File di Drive tidak dihapus. Foto yang hanya ada di Drive tidak bisa dibuka/diunduh penuh sampai terhubung lagi.","Putuskan",async()=>{try{await call("disconnect");toast("Koneksi diputus");D.refresh()}catch(e){toast("Failed: "+e.message)}})},
 async folder(){try{const{folders}=await call("list_folders");sheet(`<h3 style="margin-top:0">Folder penyimpanan</h3><div class=mu style="font-size:12px;margin-bottom:6px">Izin terbatas (drive.file): hanya folder yang dibuat oleh Lumen Photos yang tampil di sini.</div>`+folders.map(f=>`<button class=o data-x="f:${esc(f.id)}">${esc(f.name)}${f.id==D.st.folder_id?" ✓":""}</button>`).join("")+`<button class=o data-x=new>Buat folder baru…</button>`,async x=>{
  try{if(x=="new")return ask("Nama folder baru","Lumen Photos",async n=>{try{await call("create_folder",{name:n});toast("Folder dibuat");D.refresh()}catch(e){toast("Failed: "+e.message)}});await call("set_folder",{id:x.slice(2)});toast("Folder diganti");D.refresh()}catch(e){toast("Failed: "+e.message)}})}catch(e){toast("Failed: "+e.message)}},
 open(){window.open(url(),"_blank","noopener")},
 share(){window.open(url(),"_blank","noopener");toast("Klik Bagikan pada folder di Google Drive untuk mengatur akses")},
 async auto(){try{await call("set_auto",{value:!D.st.auto_backup});D.refresh()}catch(e){toast("Failed: "+e.message)}},
 retry(){backup(S.photos.filter(p=>p.bs=="failed"))},
 all(){backup(S.photos.filter(p=>p.sp=="supabase"&&p.bs!="done"))},
 async orph(){try{toast("Dipulihkan: "+await LSB.retryOrphans())}catch(e){toast("Failed: "+e.message)}},
 logout(){LSB.logout()}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-dr]");if(b&&A[b.dataset.dr])A[b.dataset.dr]()});
window.driveCard=()=>{const s=D.st,P=S.photos,done=P.filter(p=>p.sp=="supabase"&&p.bs=="done").length,fail=P.filter(p=>p.bs=="failed").length,todo=P.filter(p=>p.sp=="supabase"&&p.bs!="done").length,only=P.filter(p=>p.sp=="drive").length;
 const R=(a,b,x="")=>`<div class=row${x}><span>${a}</span>${b}</div>`,B=(k,t)=>`<button class=chip data-dr=${k}>${t}</button>`;let h;
 if(!s)h=R("Status",'<span class=mu>Memeriksa…</span>',' style="border:0"');
 else if(!s.connected)h=R('<span class=dot></span>Belum terhubung',B("connect","Hubungkan"),' style="border:0"')+`<p class=mu style="font-size:11px;margin:4px 0 0">Izin terbatas pada file yang dibuat Lumen Photos. Tidak ada file/folder yang dibuat publik.</p>`;
 else if(s.status=="expired")h=R('<span class="dot r"></span>Sesi kedaluwarsa',B("connect","Hubungkan ulang"))+R("Akun",B("disc","Putuskan"),' style="border:0"');
 else h=R('<span class="dot g"></span>Terhubung',`<span class="mu v">${esc(s.email||"")}</span>`)+R("Folder",`<span style="display:flex;gap:6px;align-items:center"><span class="mu v">${esc(s.folder_name||"—")}</span>${B("folder","Ganti")}</span>`)
  +R("Buka / bagikan folder",`<span style="display:flex;gap:6px">${B("open","Buka")}${B("share","Bagikan")}</span>`)+R("Backup otomatis",B("auto",s.auto_backup?"On":"Off"))
  +R("Status backup",`<span class=mu>${done} dicadangkan${only?` · ${only} hanya di Drive`:""}${fail?` · <b style="color:#ff453a">${fail} gagal</b>`:""}</span>`)
  +(fail||todo?R(todo?`${todo} belum dicadangkan`:"",`<span style="display:flex;gap:6px">${fail?B("retry","Coba lagi"):""}${todo?B("all","Cadangkan"):""}</span>`):"")
  +(LSB.orphans()?R("Metadata tertunda",B("orph","Pulihkan")):"")+R("Akun Google",B("disc","Putuskan"),' style="border:0"');
 return`<div class=gp><div class=tt>Google Drive</div>${h}</div>`};
})();

// Google Drive folders and media rendered inside MIKA Albums.
(()=> {
 const D=window.LDrive;
 if(!D)return;
 const state={conn:"",stack:[],files:[],media:[],token:"",busy:false,error:"",urls:new Set(),folderCovers:new Map(),folderLoading:new Set(),loading:0};
 const folderMime="application/vnd.google-apps.folder";
 const clean=()=>{for(const u of state.urls)URL.revokeObjectURL(u);state.urls.clear()};
 const current=()=>state.stack[state.stack.length-1];
 const drives=()=>D.albumDrives?D.albumDrives():[];
 const esc=s=>String(s||"").replace(/[<>&"]/g,c=>"&#"+c.charCodeAt(0)+";");
 const isVideo=f=>(f.mimeType||f.type||"").startsWith("video/");
 const makeMedia=f=>({id:"gd_"+f.id,aid:f.id,gconn:state.conn,_gdrive:true,sp:"drive",name:f.name||"Untitled",type:f.mimeType||"image/jpeg",date:Date.parse(f.createdTime||"")||Date.now(),size:+f.size||0,w:+((f.imageMediaMetadata||f.videoMediaMetadata||{}).width)||0,h:+((f.imageMediaMetadata||f.videoMediaMetadata||{}).height)||0,dur:+(f.videoMediaMetadata||{}).durationMillis||0,url:"",th:""});
 const html=()=>{
  const ds=drives();
  if(!ds.length)return '<section class="dalb"><div class="sh"><h3>Google Drive Albums</h3></div><div class="dalb-empty">Connect Google Drive in Profile to see its folders and media here.</div></section>';
  const title=state.stack.length?current().name:"Google Drive";
  const crumbs=state.stack.map((x,i)=>`${i?'<span class="mu">›</span>':""}<button class="dalb-crumb" data-dalb="crumb" data-index="${i}">${esc(x.name)}</button>`).join("");
  const folders=state.files.filter(f=>f.mimeType===folderMime).map(f=>{const c=state.folderCovers.get(f.id);return `<div class="ar dalb-folder-row" data-dalb="open" data-gid="${esc(f.id)}">${c&&c.url?`<img src="${c.url}" alt="">`:'<span class="ph dalb-folder-ph">📁</span>'}<span class="dalb-folder-label">${esc(f.name)}</span><span class="mu">${c?c.count+" items":"Folder"} ›</span><button class="dalb-folder-more" data-dalb="more" data-gid="${esc(f.id)}" data-name="${esc(f.name)}" aria-label="Folder options">···</button></div>`}).join("");
  const media=state.media.map(p=>`<div class="mi dalb-media" data-dalb="photo" data-gid="${esc(p.id)}"><img loading="lazy" alt="${esc(p.name)}" data-thumb="${esc(p.aid)}">${isVideo(p)?'<i class="pb">▶</i>':""}</div>`).join("");
  const body=state.busy&&!state.files.length?'<div class="dalb-empty">Loading Google Drive…</div>':state.error?'<div class="dalb-empty">'+esc(state.error)+'</div>':(!state.files.length?'<div class="dalb-empty">This folder is empty.</div>':"");
  const cover=state.stack.length>1?state.folderCovers.get(current().id):null;
  const heroMedia=state.media.find(p=>p.th);
  return `<section class="dalb"><div class="sh"><h3>Google Drive Albums</h3></div>
  ${!state.stack.length?ds.map(d=>`<button class="dalb-account" data-dalb="account" data-gid="${esc(d.id)}"><span class="dalb-drive-icon">◉</span><span><b>${esc(d.email||"Google Drive")}</b><small>Browse My Drive folders and media</small></span><span class="mu">›</span></button>`).join(""):
  `<div class="top dalb-detail-top"><button class="ic" data-dalb="back" aria-label="Back">‹</button><h1>${esc(title)}</h1><button class="chip" data-dalb="new">+ Folder</button></div><div class="dalb-crumbs">${crumbs}</div><div class="hero dalb-hero">${cover&&cover.url?`<img src="${cover.url}" alt="">`:heroMedia?`<img src="${heroMedia.th}" alt="">`:'<div class="dalb-hero-empty">📁</div>'}<div><h3>${esc(title)}</h3><div class="mu">${state.media.length} media · ${state.files.filter(f=>f.mimeType===folderMime).length} folders</div><div class="mu">Google Drive</div></div></div><div class="dalb-folder-list">${folders}</div><div class="dalb-grid">${media}</div>${body}${state.token?'<button class="chip dalb-moreload" data-dalb="loadmore">Load more</button>':""}`}
  </section>`;
 };
 window.driveAlbumsSection=html;
 const refresh=()=>{if(typeof S!=="undefined"&&S.view==="alb")render()};
 async function load(reset=true){
  if(state.busy)return;state.busy=true;state.error="";
  if(reset){state.files=[];state.media=[];state.token="";state.folderCovers.clear();state.folderLoading.clear();clean()}
  refresh();
  try{
   const j=await D.listAlbum(state.conn,current().id,state.token),files=j.files||[];
   state.files=reset?files:[...state.files,...files];
   const media=files.filter(f=>/^(image|video)\//.test(f.mimeType||""));
   for(const f of media)state.media.push(makeMedia(f));
   state.token=j.next_page_token||"";refresh();for(const f of media){const p=state.media.find(x=>x.aid===f.id);if(p)thumb(p)}for(const f of files.filter(x=>x.mimeType===folderMime))folderCover(f)
  }catch(e){state.error="Couldn't load this folder: "+(e.message||"Unknown error")}
  finally{state.busy=false;refresh()}
 }
 async function folderCover(folder){
  if(state.folderCovers.has(folder.id)||state.folderLoading.has(folder.id))return;
  state.folderLoading.add(folder.id);
  const conn=state.conn,parent=current()&&current().id;
  try{
   const j=await D.listAlbum(conn,folder.id,""),files=j.files||[],items=files.filter(f=>/^(image|video)\//.test(f.mimeType||""));
   let url="";
   if(items.length){
    const b=await D.albumThumb(conn,items[0].id),u=URL.createObjectURL(b);
    if(state.conn!==conn||!current()||current().id!==parent){URL.revokeObjectURL(u);return}
    state.urls.add(u);url=u;
   }
   if(state.conn!==conn||!current()||current().id!==parent)return;
   state.folderCovers.set(folder.id,{url,count:files.length});
   refresh();
  }catch(_){}
  finally{state.folderLoading.delete(folder.id)}
 }
 async function thumb(p){
  const marker=++state.loading;
  try{const b=await D.albumThumb(state.conn,p.aid),u=URL.createObjectURL(b);if(!document.body.contains(document.querySelector(".dalb"))){URL.revokeObjectURL(u);return}state.urls.add(u);p.th=u;
   const q=[...document.querySelectorAll(".dalb-media")].find(x=>x.dataset.gid===p.id);if(q){const im=q.querySelector("img");im.src=u;im.classList.add("l")}
  }catch(_){}
 }
 function openAccount(id){state.conn=id;state.stack=[{id:"root",name:"My Drive"}];load(true)}
 function openFolder(id){const f=state.files.find(x=>x.id===id);if(!f)return;state.stack.push({id:f.id,name:f.name});load(true)}
 function preview(id,el){
  const p=state.media.find(x=>x.id===id);if(!p)return;
  const list=state.media.slice();
  if(!window.LViewer)return toast("Photo preview is unavailable");
  LViewer(p.id,list,el&&el.querySelector("img"),{readonly:true,resolveFull:async item=>{
   if(item.url)return item.url;
   if(item.type.startsWith("video/"))return vidSrc(item);
   const blob=await getBlob(item);item._blob=blob;item.url=URL.createObjectURL(blob);state.urls.add(item.url);return item.url;
  },onClose:()=>{list.forEach(x=>{if(x.url&&x.url.startsWith("blob:")){URL.revokeObjectURL(x.url);state.urls.delete(x.url)}x.url="";x._blob=null})}});
 }
 document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-dalb]");if(!b||!document.querySelector(".dalb"))return;
  const action=b.dataset.dalb,id=b.dataset.gid;
  if(action==="account"){e.preventDefault();openAccount(id);return}
  if(action==="back"){e.preventDefault();if(state.stack.length){state.stack.pop();if(!state.stack.length){state.conn="";state.files=[];state.media=[];clean();refresh()}else load(true)}return}
  if(action==="crumb"){e.preventDefault();state.stack=state.stack.slice(0,+b.dataset.index+1);load(true);return}
  if(action==="open"){e.preventDefault();openFolder(id);return}
  if(action==="photo"){e.preventDefault();preview(id,b);return}
  if(action==="more"){e.preventDefault();e.stopPropagation();const name=b.dataset.name||"Folder";sheet('<button class="o" data-x="rename">Rename folder</button><button class="o" data-x="trash" style="color:#e5484d">Move folder to Drive Trash</button>',async choice=>{
   if(choice==="rename")ask("Rename folder",name,async n=>{try{await D.renameAlbumFolder(state.conn,id,n);toast("Folder renamed");await load(true)}catch(err){toast("Couldn't rename folder: "+err.message)}});
   if(choice==="trash")actSheet("Move folder to Drive Trash?","The folder and its contents will be moved to Google Drive Trash. You can restore them from Google Drive Trash.", "Move to Trash",async()=>{try{await D.trashAlbumFolder(state.conn,id);toast("Folder moved to Google Drive Trash");await load(true)}catch(err){toast("Couldn't move folder: "+err.message)}});
  });return}
  if(action==="new"){e.preventDefault();ask("New folder name","",async n=>{try{await D.createAlbumFolder(state.conn,current().id,n);toast("Folder created in Google Drive");await load(true)}catch(err){toast("Couldn't create folder: "+err.message)}});return}
  if(action==="more"){e.preventDefault();return}
  if(action==="loadmore"){e.preventDefault();load(false);return}
 });
})();

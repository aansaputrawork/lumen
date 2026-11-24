// Google Drive folders and media rendered inside MIKA Albums.
(()=> {
 const D=window.LDrive;
 if(!D)return;
 const state={conn:"",stack:[],files:[],media:[],token:"",busy:false,error:"",urls:new Set(),loading:0};
 const folderMime="application/vnd.google-apps.folder";
 const clean=()=>{for(const u of state.urls)URL.revokeObjectURL(u);state.urls.clear()};
 const current=()=>state.stack[state.stack.length-1];
 const drives=()=>D.albumDrives?D.albumDrives():[];
 const esc=s=>String(s||"").replace(/[<>&"]/g,c=>"&#"+c.charCodeAt(0)+";");
 const isVideo=f=>(f.mimeType||"").startsWith("video/");
 const makeMedia=f=>({id:"gd_"+f.id,aid:f.id,gconn:state.conn,_gdrive:true,sp:"drive",name:f.name||"Untitled",type:f.mimeType||"image/jpeg",date:Date.parse(f.createdTime||"")||Date.now(),size:+f.size||0,w:+((f.imageMediaMetadata||f.videoMediaMetadata||{}).width)||0,h:+((f.imageMediaMetadata||f.videoMediaMetadata||{}).height)||0,dur:+(f.videoMediaMetadata||{}).durationMillis||0,url:"",th:""});
 const html=()=>{
  const ds=drives();
  if(!ds.length)return '<section class="dalb"><div class="sh"><h3>Google Drive Albums</h3></div><div class="dalb-empty">Connect Google Drive in Profile to see its folders and media here.</div></section>';
  const title=state.stack.length?current().name:"Google Drive";
  const crumbs=state.stack.map((x,i)=>`${i?'<span class="mu">›</span>':""}<button class="dalb-crumb" data-dalb="crumb" data-index="${i}">${esc(x.name)}</button>`).join("");
  const folders=state.files.filter(f=>f.mimeType===folderMime).map(f=>`<div class="dalb-folder" data-dalb="open" data-gid="${esc(f.id)}"><span class="dalb-folder-icon">📁</span><span class="dalb-folder-name">${esc(f.name)}</span><button class="dalb-more" data-dalb="menu" data-gid="${esc(f.id)}" data-name="${esc(f.name)}" aria-label="Folder options">···</button></div>`).join("");
  const media=state.media.map(p=>`<div class="mi dalb-media" data-dalb="photo" data-gid="${esc(p.id)}"><img loading="lazy" alt="${esc(p.name)}" data-thumb="${esc(p.aid)}">${isVideo(p)?'<i class="pb">▶</i>':""}</div>`).join("");
  const body=state.busy&&!state.files.length?'<div class="dalb-empty">Loading Google Drive…</div>':state.error?'<div class="dalb-empty">'+esc(state.error)+'</div>':(!folders&&!media?'<div class="dalb-empty">This folder is empty.</div>':"");
  return `<section class="dalb"><div class="sh"><h3>Google Drive Albums</h3><span class="mu">${state.stack.length?esc(title):ds.length+" connected account"+(ds.length===1?"":"s")}</span></div>
  ${!state.stack.length?ds.map(d=>`<button class="dalb-account" data-dalb="account" data-gid="${esc(d.id)}"><span class="dalb-drive-icon">◉</span><span><b>${esc(d.email||"Google Drive")}</b><small>Browse My Drive folders and media</small></span><span class="mu">›</span></button>`).join(""):
  `<div class="dalb-toolbar"><button class="chip" data-dalb="back">‹ Back</button><div class="dalb-crumbs">${crumbs}</div><button class="chip" data-dalb="new">+ Folder</button></div><div class="dalb-path">${esc(title)}</div><div class="dalb-grid">${folders}${media}</div>${body}${state.token?'<button class="chip dalb-moreload" data-dalb="loadmore">Load more</button>':""}`}
  </section>`;
 };
 window.driveAlbumsSection=html;
 const refresh=()=>{if(window.S&&S.view==="alb")render()};
 async function load(reset=true){
  if(state.busy)return;state.busy=true;state.error="";
  if(reset){state.files=[];state.media=[];state.token="";clean()}
  refresh();
  try{
   const j=await D.listAlbum(state.conn,current().id,state.token),files=j.files||[];
   state.files=reset?files:[...state.files,...files];
   const media=files.filter(f=>/^(image|video)\//.test(f.mimeType||""));
   for(const f of media)state.media.push(makeMedia(f));
   state.token=j.next_page_token||"";refresh();for(const f of media){const p=state.media.find(x=>x.aid===f.id);if(p)thumb(p)}
  }catch(e){state.error="Couldn't load this folder: "+(e.message||"Unknown error")}
  finally{state.busy=false;refresh()}
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

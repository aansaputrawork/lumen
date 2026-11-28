// Galeri kalender (detail bulan) + preview foto baru.
// Dipakai oleh app.js lewat 2 hook: calUI() untuk view "col" dan LViewer() untuk membuka foto.
// Memakai global dari app.js (S, D, T, MON, ico, IC, esc, mb, $, isVid, hasLoc, placeOf, ...) saat dipanggil.
(()=>{
// Disable page zoom consistently across the app (including iOS Safari/WebView).
const viewport=document.querySelector('meta[name="viewport"]')||(()=>{const m=document.createElement("meta");m.name="viewport";document.head.appendChild(m);return m})();
viewport.content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
if(!window.__mikaNoZoomBound){
 window.__mikaNoZoomBound=true;
 ["gesturestart","gesturechange","gestureend"].forEach(type=>document.addEventListener(type,e=>e.preventDefault(),{passive:false}));
}
const dkey=d=>d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();
const reduce=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===================== DETAIL BULAN: GRID KALENDER ===================== */
// Hanya bulan yang diklik di Home (S.year + S.mon) yang tampil; bulan lain tidak ikut dimuat.
window.calUI=function(){
 const enter=S._v!=="col",tk=dkey(new Date()),y=S.year,mo=S.mon;
 if(enter)S.selDay=null;
 const by=new Map();
 S.photos.forEach(p=>{const d=D(p);if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==mo)return;const k=dkey(d);(by.get(k)||by.set(k,[]).get(k)).push(p)});
 const n=new Date(y,mo+1,0).getDate(),off=(new Date(y,mo,1).getDay()+6)%7;
 let t="";
 for(let d=1;d<=n;d++){
  const k=y+"-"+mo+"-"+d,l=by.get(k),first=d==1?`;grid-column-start:${off+1}`:"";
  if(l){
   l.sort((a,b)=>b.date-a.date);
   IC.play=IC.play||"M7 4l13 8-13 8z";
   const c=l[0],nv=l.filter(isVid).length;   // cover = item terbaru hari itu (foto atau video; poster video diambil dari videonya)
   t+=`<button class="dy has${S.selDay===k?" on":""}"${isVid(c)?` data-vt="${esc(c.id)}"`:""} data-day="${k}" style="--i:${d}${first};background-image:url('${esc(T(c))}')"><span>${d}</span>${l.length>1?`<i class=n>${l.length}</i>`:""}${nv?`<i class=vi aria-label="${nv} video">${ico("play",9,"currentColor")}${nv>1?nv:""}</i>`:""}</button>`;
  }else t+=`<div class="dy em${k==tk?" td":""}" style="--i:${d}${first}"><span>${d}</span></div>`;
 }
 const wk=["M","T","W","T","F","S","S"].map(x=>`<span>${x}</span>`).join("");
 const monthItems=S.photos.filter(p=>{const d=D(p);return !isNaN(d)&&d.getFullYear()===y&&d.getMonth()===mo});
 const photoCount=monthItems.filter(p=>!isVid(p)).length,videoCount=monthItems.filter(isVid).length;
 const locations=[...new Set(monthItems.filter(hasLoc).map(placeOf).filter(Boolean))];
 const overview=`<section class=cm-overview><h2>Monthly Overview</h2><div class=cm-stats><div><span>Photos</span><b>${photoCount}</b></div><div><span>Videos</span><b>${videoCount}</b></div><div class=cm-locations><span>Locations</span><b>${locations.length?locations.map(esc).join(" · "):"—"}</b></div></div></section>`;
 const monthSlider=monthItems.length?`<section class="cm-month-section">
  <div class="cm-month-head"><h2>Photos this month</h2><span>${monthItems.length}</span></div>
  <div class="cm-month-track">${monthItems.slice().sort((a,b)=>D(b)-D(a)).map(p=>`<button class="cm-month-card" data-month-photo="${esc(p.id)}" aria-label="Open ${isVid(p)?"video":"photo"}"><img src="${esc(T(p))}" loading="lazy" alt="">${isVid(p)?`<span>${ico("play",10,"currentColor")} Video</span>`:""}</button>`).join("")}</div>
 </section>`:"";
 return `<div class="top ht cal-header"><div class="cal-head-row"><button class="ic cal-back" data-go="home" aria-label="Back">${ico("back")}</button><h1 id="ct">${MON[mo]} ${y}</h1><button class="cal-today" data-cal-today>Today</button></div><label class="cal-search"><span>${ico("search")}</span><input id="cal-date-search" type="search" placeholder="Search month, day, date..." autocomplete="off" aria-label="Search photos by date"></label></div><div class="cal-search-results" hidden></div><div class="cal-content">${by.size?"":`<div class=empty>No photos in ${MON[mo]} ${y}.</div>`}<section class=cm><div class=cwk>${wk}</div><div class=cgd>${t}</div></section>${overview}${monthSlider}</div>`;
};

// Pencarian kalender: hanya mencocokkan tanggal, bulan, dan tahun metadata foto/video.
const calMonthNames=()=>Array.from({length:12},(_,i)=>{const d=new Date(2020,i,1);return [d.toLocaleString("en",{month:"long"}).toLowerCase(),d.toLocaleString("id",{month:"long"}).toLowerCase(),d.toLocaleString("en",{month:"short"}).toLowerCase(),d.toLocaleString("id",{month:"short"}).toLowerCase()]});
const calSearchItems=q=>{
 const raw=String(q||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");if(!raw)return[];
 const months=calMonthNames(),tokens=raw.match(/[a-z]+|\d+/g)||[],monthIndex=tokens.map(t=>months.findIndex(a=>a.includes(t)||t.includes(a[0]))).find(i=>i>=0);
 const nums=tokens.filter(t=>/^\d+$/.test(t)).map(Number);
 return S.photos.filter(p=>{const d=D(p);if(isNaN(d))return false;const day=d.getDate(),month=d.getMonth(),year=d.getFullYear();
  if(/^\d{4}$/.test(raw))return year===Number(raw);
  if(/^\d{1,2}$/.test(raw))return day===Number(raw);
  const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(iso)return year===Number(iso[1])&&month+1===Number(iso[2])&&day===Number(iso[3]);
  const yearMonth=raw.match(/^(\d{4})-(\d{1,2})$/);
  if(yearMonth)return year===Number(yearMonth[1])&&month+1===Number(yearMonth[2]);
  const monthYear=raw.match(/^(\d{1,2})[\/.](\d{4})$/);
  if(monthYear)return month+1===Number(monthYear[1])&&year===Number(monthYear[2]);
  const slash=raw.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  if(slash){const a=Number(slash[1]),b=Number(slash[2]),yy=slash[3]?Number(slash[3]):null;return day===a&&month+1===b&&(yy===null||year===yy||(yy<100&&year%100===yy));}
  if(monthIndex>=0&&month!==monthIndex)return false;
  const years=nums.filter(n=>n>31);if(years.length&&!years.some(n=>year===n))return false;
  const days=nums.filter(n=>n>=1&&n<=31);if(days.length&&!days.some(n=>day===n))return false;
  if(monthIndex<0&&!years.length&&!days.length)return false;
  return true;
 }).sort((a,b)=>D(b)-D(a));
};
const calRenderSearch=q=>{
 const panel=document.querySelector(".cal-search-results"),content=document.querySelector(".cal-content");if(!panel||!content)return;
 const query=String(q||"").trim();if(!query){panel.hidden=true;panel.innerHTML="";content.hidden=false;return;}
 const items=calSearchItems(query);content.hidden=true;panel.hidden=false;
 if(!items.length){panel.innerHTML='<div class="cal-search-empty">No photos found</div>';return;}
 const groups=new Map();items.forEach(p=>{const d=D(p),key=d.getFullYear()+"-"+d.getMonth();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)});
 panel.innerHTML=[...groups.values()].sort((a,b)=>D(b[0])-D(a[0])).map(list=>{const d=D(list[0]),label=d.toLocaleString("en",{month:"long",year:"numeric"});return `<section class="cm-month-section cal-result-group"><div class="cm-month-head"><h2>${label}</h2><span>${list.length}</span></div><div class="cm-month-track">${list.map(p=>`<button class="cm-month-card" data-search-photo="${esc(p.id)}" aria-label="Open ${isVid(p)?"video":"photo"}"><img src="${esc(T(p))}" loading="lazy" alt="">${isVid(p)?`<span>${ico("play",10,"currentColor")} Video</span>`:""}</button>`).join("")}</div></section>`}).join("");
};
document.addEventListener("input",e=>{if(e.target&&e.target.id==="cal-date-search"&&S.view==="col")calRenderSearch(e.target.value)});

// Ketuk hasil pencarian atau thumbnail bulan untuk membuka viewer.
document.addEventListener("click",e=>{
 const today=e.target.closest("[data-cal-today]");if(today&&S.view==="col"){const d=new Date();S.year=d.getFullYear();S.mon=d.getMonth();S.selDay=null;render();return;}
 const searchCard=e.target.closest(".cm-month-card[data-search-photo]");
 if(searchCard&&S.view==="col"){const id=searchCard.dataset.searchPhoto,list=calSearchItems(document.getElementById("cal-date-search")?.value||"");const p=list.find(x=>String(x.id)===String(id));if(p)LViewer(p.id,list,searchCard);return;}
 const card=e.target.closest(".cm-month-card[data-month-photo]");
 if(card&&S.view==="col"){
  const id=card.dataset.monthPhoto;
  const list=S.photos.filter(p=>{const d=D(p);return !isNaN(d)&&d.getFullYear()===S.year&&d.getMonth()===S.mon}).sort((a,b)=>D(b)-D(a));
  const p=list.find(x=>String(x.id)===String(id));
  if(p)LViewer(p.id,list,card);
  return;
 }
 const t=e.target.closest(".dy.has");if(!t||S.view!=="col")return;
 const k=t.dataset.day,l=S.photos.filter(p=>dkey(D(p))===k).sort((a,b)=>b.date-a.date);if(!l.length)return;
 document.querySelectorAll(".dy.on").forEach(x=>x.classList.remove("on"));t.classList.add("on");S.selDay=k;
 setTimeout(()=>LViewer(l[0].id,l,t),reduce()?0:170);
});

/* ============================ GESER ANTAR BULAN (kalender) ============================
   Seret ke kiri = bulan berikutnya, ke kanan = bulan sebelumnya. Juga: panah kiri/kanan di keyboard dan geser horizontal di trackpad.
   Animasi: bulan lama meluncur keluar (klon), bulan baru masuk dari sisi sebaliknya, judul bulan memudar halus. Dibatasi dari bulan
   foto paling awal sampai bulan terbaru/bulan ini. */
(function(){
 const EASE="cubic-bezier(.22,1,.36,1)",ids=()=>S.photos.map(p=>D(p)).filter(d=>!isNaN(d)).map(d=>d.getFullYear()*12+d.getMonth());
 const bounds=()=>{const a=ids(),n=new Date(),nm=n.getFullYear()*12+n.getMonth();let lo=a.length?Math.min(...a):nm,hi=Math.max(nm,...(a.length?[Math.max(...a)]:[]));if(lo>hi)lo=hi;return[lo,hi]};
 const can=dir=>{const[lo,hi]=bounds(),nx=S.year*12+S.mon+dir;return nx>=lo&&nx<=hi};
 const cmEl=()=>document.querySelector(".cm");
 const nudge=dir=>{const cm=cmEl();if(cm&&!reduce())cm.animate([{transform:"none"},{transform:`translateX(${-dir*14}px)`},{transform:"none"}],{duration:320,easing:EASE})};
 function go(dir,from){
  if(!can(dir)){nudge(dir);return false}
  const cm=cmEl(),nx=S.year*12+S.mon+dir;
  if(reduce()||!cm){S.year=Math.floor(nx/12);S.mon=nx%12;S.selDay=null;render();return true}
  // klon bulan lama sebagai lapisan yang meluncur keluar
  const r=cm.getBoundingClientRect(),old=cm.cloneNode(true),cur=getComputedStyle(cm).transform;
  old.classList.add("cmx");old.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;margin:0;z-index:6;pointer-events:none;transform:${cur==="none"?"none":cur}`;
  document.body.append(old);
  old.animate([{transform:cur==="none"?"none":cur,opacity:+getComputedStyle(cm).opacity||1},{transform:`translateX(${-dir*40}%)`,opacity:0}],{duration:420,easing:EASE,fill:"forwards"}).onfinish=()=>old.remove();
  S.year=Math.floor(nx/12);S.mon=nx%12;S.selDay=null;render();
  const nc=cmEl(),ct=document.getElementById("ct");
  if(nc)nc.animate([{transform:`translateX(${dir*40}%)`,opacity:0},{transform:"none",opacity:1}],{duration:460,easing:EASE});
  if(ct)ct.animate([{opacity:0,transform:`translateY(${dir*10}px)`},{opacity:1,transform:"none"}],{duration:360,easing:EASE});
  return true}
 window.calGo=go;
 let st=null;
 const live=()=>S.view==="col"&&!document.querySelector(".pv")&&!document.querySelector(".sheet,.dlg");
 document.addEventListener("pointerdown",e=>{const cm=e.target.closest&&e.target.closest(".cm");if(!cm||!live()||(e.pointerType==="mouse"&&e.button))return;st={x:e.clientX,y:e.clientY,t:Date.now(),cm,id:e.pointerId,on:0,dx:0}},true);
 document.addEventListener("pointermove",e=>{if(!st||e.pointerId!==st.id)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
  if(!st.on){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3){st.on=1;try{st.cm.setPointerCapture(e.pointerId)}catch(_){}st.cm.style.transition="none"}else{if(Math.abs(dy)>10)st=null;return}}
  const dir=dx<0?1:-1,k=can(dir)?.9:.22,W=st.cm.clientWidth||300;st.dx=dx;
  st.cm.style.transform=`translateX(${dx*k}px)`;st.cm.style.opacity=String(1-Math.min(.45,Math.abs(dx*k)/W*.7))});
 const end=e=>{if(!st||(e&&e.pointerId!==st.id))return;const s=st;st=null;if(!s.on)return;
  const dx=s.dx,dt=Math.max(1,Date.now()-s.t),v=Math.abs(dx)/dt,W=s.cm.clientWidth||300,dir=dx<0?1:-1;
  const back=()=>{const from=getComputedStyle(s.cm).transform,fo=getComputedStyle(s.cm).opacity;s.cm.style.transform=s.cm.style.opacity="";
   if(!reduce())s.cm.animate([{transform:from,opacity:fo},{transform:"none",opacity:1}],{duration:420,easing:EASE})};
  if((Math.abs(dx)>W*.2||(Math.abs(dx)>36&&v>.45))&&can(dir)){go(dir)}else back()};
 document.addEventListener("pointerup",end,true);document.addEventListener("pointercancel",end,true);
 // keyboard + trackpad
 document.addEventListener("keydown",e=>{if(!live()||/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||""))return;if(e.key==="ArrowLeft")go(-1);else if(e.key==="ArrowRight")go(1)});
 let wx=0,wt=0,lock=0;
 document.addEventListener("wheel",e=>{if(!live()||!e.target.closest||!e.target.closest(".cm,#ct")||Math.abs(e.deltaX)<Math.abs(e.deltaY))return;
  const n=Date.now();if(n<lock)return;if(n-wt>250)wx=0;wt=n;wx+=e.deltaX;if(Math.abs(wx)>70){lock=n+550;go(wx>0?1:-1);wx=0}},{passive:true});
})();

/* ============================ PREVIEW FOTO ============================ */
window.LViewer=function(id,list,srcEl,opts={}){
 IC.info="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01";IC.play="M7 4l13 8-13 8z";
 list=list&&list.length?list:[...document.querySelectorAll("[data-id]")].map(e=>S.photos.find(p=>p.id==e.dataset.id)).filter(Boolean);
 if(!list.length)return;
 let i=Math.max(0,list.findIndex(p=>p.id==id));
 const src=srcEl||document.querySelector(`.mi[data-id="${id}"] img,.mi[data-id="${id}"] video`);
 const slide=p=>`<div class=sl><div class=pw>${isVid(p)
  ?`<video ${p.sp!="drive"&&p.url?`src="${p.url}#t=0.1" preload=metadata`:"preload=none"} poster="${T(p)}" data-vt="${esc(p.id)}" playsinline></video><button class=vpl data-vp aria-label="Play video">${ico("play",30,"currentColor")}</button><input class=vsk type=range min=0 max=1000 value=0 step=1 aria-label="Seek">`
  :`<img src="${T(p)}" data-full="${p.url}" data-z draggable="false" alt="">`}</div></div>`;
 // thumbnail slider: video memakai poster (frame video) + tanda play
 const thumb=(p,k)=>`<button class="ft${k==i?" a":""}" data-k="${k}" aria-label="${isVid(p)?"Video":"Photo"} ${k+1}"><img src="${T(p)}"${isVid(p)?` data-vt="${esc(p.id)}"`:""} loading=lazy draggable="false" alt="">${isVid(p)?`<span class="fv ov">${ico("play",11,"currentColor")}</span>`:""}</button>`;
 const multi=list.length>1&&list.length<=200;
 const v=$(`<div class="view pv${multi?" ms":""}"><div class=pv-bgw></div>
  <div class="pv-top pc"><button class=pv-b data-c aria-label="Close">${ico("x",22)}</button><div class=pv-t><b id=t></b><span id=m></span></div><button class=pv-cat id=pcat aria-label="Photo category"></button></div>
  <div class=st>${list.map(slide).join("")}</div>
  <div class="pv-bot pc">${multi?`<div class=pv-fs id=fs>${list.map(thumb).join("")}</div>`:""}
   <div class=pv-dock><div class=pv-bar><div class=pv-acts id=acts><button data-s aria-label="Share">${ico("sh",23)}</button><button data-f aria-label="Add to favorites" aria-pressed="false">${ico("heart",23)}</button><button data-i aria-label="Details">${ico("info",23)}</button><button data-d aria-label="Download">${ico("dl",23)}</button><button data-t aria-label="Delete" style="color:#ff6b6b">${ico("tr",23)}</button></div><button class=pv-tg data-tg aria-expanded="false" aria-label="Show actions">${ico("dots",24)}</button></div></div></div></div>`);
 document.body.append(v);
 if(opts.readonly){["[data-s]","[data-f]","[data-t]"].forEach(q=>v.querySelector(q)?.remove())}
 const st=v.querySelector(".st"),sl=[...st.children],fs=v.querySelector("#fs"),bgw=v.querySelector(".pv-bgw"),pc=v.querySelector("#pcat");
 let z=1,tx=0,ty=0,d0=0,z0=1,sx=0,sy=0,dy=0,dx=0,md="",mv=0,ts=0,lt=0,raf=0,closing=0;
 const cur=()=>list[i];

 // menu aksi (share, favorit, detail, download, hapus) bisa dibuka/ditutup lewat tombol toggle; pilihan terakhir diingat
 const tg=v.querySelector("[data-tg]");
 const setMenu=(on,keep)=>{v.classList.toggle("mx",on);tg.setAttribute("aria-expanded",on?"true":"false");tg.setAttribute("aria-label",on?"Hide actions":"Show actions");
  tg.innerHTML=ico(on?"cd":"dots",24);if(!keep&&!reduce()){const sv=tg.firstElementChild;if(sv)sv.animate([{transform:"rotate(-90deg) scale(.6)",opacity:0},{transform:"none",opacity:1}],{duration:400,easing:"cubic-bezier(.22,1,.36,1)"})}if(!keep){try{localStorage.setItem("pvMenu",on?"1":"0")}catch(e){}}};
 IC.cd=IC.cd||"M6 9l6 6 6-6";
 let m0=0;try{m0=localStorage.getItem("pvMenu")=="1"}catch(e){}
 setMenu(m0,true);
 tg.onclick=e=>{e.stopPropagation();setMenu(!v.classList.contains("mx"))};

 // frame preview TERKUNCI: tiap foto/video dihitung muat di dalam area yang sama (rasio dari p.w/p.h), jadi ukurannya tidak
 // melonjak saat thumbnail diganti foto penuh, saat video dimuat, atau saat menu dibuka/ditutup.
 const fit=()=>sl.forEach((s,k)=>{const pw=s.firstElementChild,el=pw.querySelector("img,video"),p=list[k],W=pw.clientWidth,H=pw.clientHeight;if(!el||!W||!H)return;
  // rasio asli file (kalau sudah termuat) > rasio dari data. Tanpa frame/kotak: foto ditampilkan apa adanya, hanya diskalakan muat di area.
  const nat=el.tagName=="IMG"?(el.naturalWidth&&el.naturalHeight?el.naturalWidth/el.naturalHeight:0):(el.videoWidth&&el.videoHeight?el.videoWidth/el.videoHeight:0);
  const ar=nat||(p.w&&p.h?p.w/p.h:0);if(!ar){el.style.width=el.style.height="";return}
  const w=Math.min(W,H*ar),h=w/ar;
  el.style.width=w+"px";el.style.height=h+"px";
  el.style.maxWidth="100%";el.style.maxHeight="100%";el.style.objectFit="contain";el.style.objectPosition="center";
  el.style.borderRadius=Math.round(Math.min(26,Math.min(w,h)*.12))+"px";   // sudut membulat 26px, mengecil proporsional untuk gambar sangat kecil
  const sk=pw.querySelector(".vsk");if(sk){sk.style.width=Math.max(120,w-24)+"px";sk.style.left=((W-w)/2+12)+"px";sk.style.right="auto";sk.style.bottom=((H-h)/2+6)+"px"}});
 sl.forEach(s=>{const el=s.querySelector("img,video");if(!el)return;el.addEventListener(el.tagName=="IMG"?"load":"loadedmetadata",fit)});
 addEventListener("resize",fit);

 // latar blur dari foto yang sedang tampil (crossfade)
 const setBg=p=>{const d=document.createElement("div");d.className="pv-bg";d.style.backgroundImage=`url("${T(p)}")`;bgw.append(d);
  requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add("in")));
  while(bgw.children.length>3)bgw.firstElementChild.remove();
  setTimeout(()=>{if(d===bgw.lastElementChild)[...bgw.children].slice(0,-1).forEach(x=>x.remove())},500)};
 pc.onclick=()=>{if(opts.readonly)return;const p=cur();sheet(CATS.slice(1).map(c=>`<button class=o data-x="${c}">${c}</button>`).join(""),async c=>{await save(null,p.id,{...p,cat:c},"photos");p.cat=c;info()})};
 const info=()=>{const p=cur();if(!p)return;
  v.querySelector("#t").textContent=p.name;
  v.querySelector("#m").textContent=D(p).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})+(list.length>1?`  ·  ${i+1} / ${list.length}`:"");
  // pil kategori sesuai foto yang sedang tampil
  if(pc.textContent!==(p.cat||"")){pc.textContent=p.cat||"";pc.classList.remove("pop");void pc.offsetWidth;pc.classList.add("pop")}
  pc.textContent=p.cat||"Uncategorized";pc.disabled=!!opts.readonly;
  const fb=v.querySelector("[data-f]");if(fb){fb.classList.toggle("on",!!p.fav);fb.setAttribute("aria-pressed",p.fav?"true":"false");fb.setAttribute("aria-label",p.fav?"Remove from favorites":"Add to favorites");const sv=fb.querySelector("svg");if(sv)sv.setAttribute("fill",p.fav?"currentColor":"none")}};
 const mark=sm=>{if(!fs)return;fs.querySelectorAll(".ft.a").forEach(e=>e.classList.remove("a"));const a=fs.children[i];if(!a)return;a.classList.add("a");
  fs.scrollTo({left:a.offsetLeft-fs.clientWidth/2+a.offsetWidth/2,behavior:sm?"smooth":"auto"})};
 // ganti thumbnail dengan foto penuh untuk foto aktif dan tetangganya
 const driveFull=async p=>{if(p._fu)return p._fu;const b=await getBlob(p);return p._fu=URL.createObjectURL(b)};
 const hiRes=k=>{for(let j=k-1;j<=k+1;j++){const im=sl[j]&&sl[j].querySelector("img[data-full]");if(!im||im.dataset.done||im.dataset.loading)continue;im.dataset.loading="1";
  (async()=>{try{const f=opts.resolveFull?await opts.resolveFull(list[j]):(list[j].sp=="drive"&&window.getBlob?await driveFull(list[j]):im.dataset.full);if(!f||im.getAttribute("src")===f)return;const x=new Image();x.onload=()=>{im.src=f;im.dataset.done="1"};x.onerror=()=>{im.dataset.loading=""};x.src=f}catch(e){im.dataset.loading=""}})()}};
 // foto di sebelah mengecil & memudar saat digeser
 const fx=()=>{raf=0;const w=st.clientWidth||1,fi=st.scrollLeft/w;
  for(let k=Math.max(0,Math.floor(fi)-1);k<=Math.min(sl.length-1,Math.ceil(fi)+1);k++){const o=Math.min(1,Math.abs(k-fi)),pw=sl[k].firstElementChild;pw.style.opacity=1-.5*o}};

 st.scrollLeft=i*st.clientWidth;fit();info();mark(false);setBg(cur());hiRes(i);fx();
 if(fs)fs.onclick=e=>{const b=e.target.closest("[data-k]");if(b)st.scrollTo({left:+b.dataset.k*st.clientWidth,behavior:"smooth"})};

 // animasi buka: foto "terbang" dari kotak yang diketuk
 {const first=sl[i]&&sl[i].querySelector("img,video");
  if(src&&first&&!reduce()){const go=()=>{const a=src.getBoundingClientRect(),b=first.getBoundingClientRect();if(!a.width||!b.width)return;
    const s=Math.max(a.width/b.width,a.height/b.height),dx2=a.left+a.width/2-(b.left+b.width/2),dy2=a.top+a.height/2-(b.top+b.height/2);
    first.animate([{transform:`translate(${dx2}px,${dy2}px) scale(${s})`,borderRadius:"16px"},{transform:"none",borderRadius:"26px"}],{duration:520,easing:"cubic-bezier(.22,1,.36,1)"})};
   first.complete||first.readyState>0?go():first.addEventListener(first.tagName=="IMG"?"load":"loadedmetadata",go,{once:true})}}

 /* ----- video: tombol play melayang. Video Drive dimuat lewat URL stream (bisa seek); jika gagal, unduh lalu putar dari blob ----- */
 const fallbackVideoUrls=[];
 sl.forEach((s,k)=>{const vd=s.querySelector("video");if(!vd)return;const p=list[k];
  const bt=s.querySelector(".vpl"),sk=s.querySelector(".vsk");let seeking=0,fallbackPromise=null,failed=0;
  const sync=()=>s.classList.toggle("playing",!vd.paused&&!vd.ended),busy=on=>s.classList.toggle("ld",on);
  const fail=()=>{if(failed)return;failed=1;busy(false);s.classList.remove("playing");toast("Video couldn't be loaded. Check file access or video format.")};
  // Fallback berlaku untuk semua sumber (MIKA Cloud maupun Google Drive), bukan Drive saja.
  // Sebagian URL bertanda tangan/stream dapat gagal di WebView meskipun file aslinya masih bisa diunduh.
  const viaBlob=()=>{
   if(fallbackPromise)return fallbackPromise;
   fallbackPromise=(async()=>{busy(true);try{
    const b=await getBlob(p);if(!b||!b.size)throw new Error("Empty video file");
    const mime=b.type&&b.type.startsWith("video/")?b.type:(p.type&&p.type.startsWith("video/")?p.type:"video/mp4");
    const playable=b.type===mime?b:new Blob([b],{type:mime});
    const u=URL.createObjectURL(playable);fallbackVideoUrls.push(u);vd.src=u;vd.load();
    try{await vd.play();failed=0}catch(e){if(e.name!=="NotAllowedError")throw e;busy(false);vd.controls=true;}
   }catch(e){console.warn("MIKA video fallback failed",{id:p.id,source:p.sp,type:p.type,error:e});fail()}})();
   return fallbackPromise;
  };
  const load=async()=>{if(vd.getAttribute("src"))return true;busy(true);try{vd.src=await vidSrc(p);vd.load();return true}catch(e){console.warn("MIKA video stream URL failed",{id:p.id,source:p.sp,error:e});await viaBlob();return false}};
  const toggle=async()=>{if(!vd.paused&&!vd.ended)return vd.pause();if(!(await load()))return;busy(true);vd.play().catch(e=>{if(e&&e.name==="NotAllowedError"){busy(false);vd.controls=true;toast("Tap the video play control to start.")}else viaBlob()})};
  // Resolve protected video URLs before the user taps Play, preserving iOS user activation.
  const prepare=()=>{if(!vd.getAttribute("src")&&!fallbackPromise)load().then(()=>busy(false)).catch(()=>busy(false))};
  if(k===i)prepare();
  bt.addEventListener("pointerdown",prepare,{passive:true});
  ["play","pause","ended"].forEach(ev=>vd.addEventListener(ev,sync));
  ["playing","canplay","pause"].forEach(ev=>vd.addEventListener(ev,()=>busy(false)));["waiting","seeking"].forEach(ev=>vd.addEventListener(ev,()=>{if(!vd.paused)busy(true)}));
  vd.addEventListener("error",()=>{if(!vd.getAttribute("src"))return;console.warn("MIKA video playback error",{id:p.id,source:p.sp,code:vd.error&&vd.error.code,message:vd.error&&vd.error.message});viaBlob()});
  vd.addEventListener("timeupdate",()=>{if(!seeking&&vd.duration)sk.value=Math.round(vd.currentTime/vd.duration*1000)});
  vd.addEventListener("ended",()=>{vd.currentTime=0;sk.value=0});
  bt.onclick=e=>{e.stopPropagation();toggle()};
  vd.onclick=e=>{e.stopPropagation();if(!vd.controls)toggle()};
  sk.onclick=e=>e.stopPropagation();
  sk.onpointerdown=async()=>{seeking=1;await load()};sk.onpointerup=sk.onpointercancel=()=>{seeking=0};
  sk.oninput=()=>{if(vd.duration)vd.currentTime=sk.value/1000*vd.duration}});
 const pauseAll=()=>sl.forEach(s=>{const vd=s.querySelector("video");if(vd&&!vd.paused)vd.pause()});

 /* ----- tutup: foto terbang kembali ke thumbnail, latar memudar ----- */
 const home=p=>{ // thumbnail foto ini di halaman di belakang preview
  const q=String(p.id).replace(/["\\]/g,"\\$&");
  const el=document.querySelector(`.mi[data-id="${q}"] img,.mi[data-id="${q}"] video`)||(S.view=="col"?document.querySelector(`.dy.has[data-day="${dkey(D(p))}"]`):null);
  if(!el)return null;const r=el.getBoundingClientRect();
  return r.width<8||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth?null:el};
 const rel=(a,b)=>({x:a.left+a.width/2-(b.left+b.width/2),y:a.top+a.height/2-(b.top+b.height/2),s:a.width/b.width});
 const closeP=()=>{
  if(closing)return;closing=1;removeEventListener("keydown",kd);removeEventListener("resize",fit);pauseAll();
  const im=sl[i]&&sl[i].querySelector("img,video"),tg=home(cur()),from=im&&im.getBoundingClientRect();
  const lit=document.querySelector(".dy.on");let cleaned=0;const fin=()=>{if(cleaned)return;cleaned=1;fallbackVideoUrls.forEach(u=>{try{URL.revokeObjectURL(u)}catch(_){}});list.forEach(p=>{if(p._fu){URL.revokeObjectURL(p._fu);p._fu="";if(p.sp=="drive")p._blob=null}});if(v.isConnected)v.remove();if(lit)lit.classList.remove("on");S.selDay=null;if(typeof opts.onClose==="function")try{opts.onClose()}catch(_){}};
  // hapus semua efek tarik/zoom supaya posisi akhir bisa diukur
  st.style.transition="none";st.style.transform="";if(im)im.style.transform="";
  v.classList.add("pcl");v.style.background="transparent";v.style.pointerEvents="none";
  sl.forEach((s,k)=>{if(k!==i)s.style.visibility="hidden"});
  const bo=parseFloat(getComputedStyle(bgw).opacity)||1;
  if(reduce()||!im||!from||!from.width){v.animate([{opacity:1},{opacity:0}],{duration:180,fill:"forwards"}).finished.then(fin,fin);setTimeout(fin,400);return}
  const to=im.getBoundingClientRect(),f=rel(from,to);let end,mid;
  const a0={transform:`translate(${f.x}px,${f.y}px) scale(${f.s})`,opacity:1,borderRadius:`${26/f.s}px`};
  if(tg){const k=rel(tg.getBoundingClientRect(),to),sc=Math.max(k.s,tg.getBoundingClientRect().height/to.height);
   end={transform:`translate(${k.x}px,${k.y}px) scale(${sc})`,opacity:0,borderRadius:`${16/sc}px`};
   mid={transform:`translate(${k.x+(f.x-k.x)*.08}px,${k.y+(f.y-k.y)*.08}px) scale(${sc+(f.s-sc)*.08})`,opacity:1,borderRadius:`${16/sc}px`,offset:.82}}
  else{end={transform:`translate(${f.x}px,${f.y+60}px) scale(${f.s*.82})`,opacity:0,borderRadius:`${26/f.s}px`};mid={...end,opacity:.7,offset:.5}}
  bgw.animate([{opacity:bo},{opacity:0}],{duration:360,easing:"ease-out",fill:"forwards"});
  const an=im.animate([a0,mid,end],{duration:tg?440:320,easing:"cubic-bezier(.32,.72,0,1)",fill:"forwards"});
  an.finished.then(fin,fin);setTimeout(fin,700)};

 /* ----- zoom, geser, tarik ke bawah untuk menutup ----- */
 const cim=()=>sl[i]&&sl[i].querySelector("[data-z]");
 const ap=()=>{const e=cim();if(e)e.style.transform=`translate(${tx}px,${ty}px) scale(${z})`;st.style.touchAction=z>1?"none":"pan-x";st.style.overflowX=z>1?"hidden":"";v.classList.toggle("zm",z>1.05)};
 const tog=()=>{z=z>1?1:2.5;tx=ty=0;ap()},ds=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
 st.onscroll=()=>{if(!raf)raf=requestAnimationFrame(fx);const n=Math.round(st.scrollLeft/st.clientWidth);
  if(n!=i&&n>=0&&n<list.length){pauseAll();v.querySelectorAll("[data-z]").forEach(e=>e.style.transform="");z=1;tx=ty=0;st.style.touchAction="pan-x";st.style.overflowX="";v.classList.remove("zm");i=n;info();mark(true);setBg(cur());hiRes(i)}};
 v.querySelectorAll("[data-z]").forEach(e=>e.ondblclick=tog);
 st.addEventListener("touchstart",e=>{if(e.target.closest(".vsk")){md="";return}const t=e.touches;if(t.length==2){d0=ds(t);z0=z;md="pz"}else if(t.length==1){sx=t[0].clientX;sy=t[0].clientY;dy=0;dx=0;mv=0;ts=Date.now();md=z>1?"pan":"idle"}},{passive:true});
 st.addEventListener("touchmove",e=>{const t=e.touches,c=cim();if(c)c.style.transition="none";
  if(md=="pz"&&t.length==2){z=Math.min(5,Math.max(1,z0*ds(t)/d0));if(z==1)tx=ty=0;ap();e.preventDefault()}
  else if(md=="pan"&&t.length==1){tx+=t[0].clientX-sx;ty+=t[0].clientY-sy;sx=t[0].clientX;sy=t[0].clientY;ap();e.preventDefault()}
  else if(md=="idle"&&t.length==1){const a=t[0].clientX-sx,b=t[0].clientY-sy;if(Math.abs(a)>10||Math.abs(b)>10)mv=1;if(b>12&&b>Math.abs(a)*1.5){md="dn";v.classList.add("dg");st.style.transition="none";bgw.style.transition="none"}}
  if(md=="dn"&&t.length==1){dy=Math.max(0,t[0].clientY-sy);dx=t[0].clientX-sx;
   st.style.transform=`translate(${dx*.7}px,${dy}px) scale(${Math.max(.78,1-dy/1300)})`;bgw.style.opacity=Math.max(0,1-dy/360);e.preventDefault()}},{passive:false});
 st.addEventListener("touchend",e=>{const c=cim();if(c)c.style.transition="";
  if(md=="dn"){
   if(dy>110){closeP()}
   else{st.style.transition="transform .45s var(--e)";bgw.style.transition="opacity .35s";st.style.transform="";bgw.style.opacity="";v.classList.remove("dg");
    setTimeout(()=>{st.style.transition="";bgw.style.transition=""},470)}}
  else if(md=="idle"&&!mv&&Date.now()-ts<250&&!e.target.closest("video,.vpl,.vsk")){if(Date.now()-lt<300){tog();lt=0}else{lt=Date.now();setTimeout(()=>{if(lt&&Date.now()-lt>=290){v.classList.toggle("hb");lt=0}},300)}}
  if(z<1.05&&md!="idle"&&md!="dn"){z=1;tx=ty=0;ap()}if(e.touches.length==0)md=""});
 // desktop: klik area kosong menyembunyikan/menampilkan kontrol
 st.addEventListener("click",e=>{if(e.pointerType=="touch"||e.detail==0)return;if(e.target.closest("img,video"))return;v.classList.toggle("hb")});

 v.querySelector("[data-c]").onclick=closeP;
 const kd=e=>{if(!document.body.contains(v)){removeEventListener("keydown",kd);return}
  if(document.querySelector(".sheet"))return;
  if(e.key=="Escape")closeP();if(e.key=="ArrowRight")st.scrollTo({left:(i+1)*st.clientWidth,behavior:"smooth"});if(e.key=="ArrowLeft")st.scrollTo({left:(i-1)*st.clientWidth,behavior:"smooth"})};
 addEventListener("keydown",kd);

 /* ----- detail foto (sheet kaca) ----- */
 const detail=()=>{const p=cur(),al=S.albums.filter(a=>(a.ids||[]).includes(p.id)).map(a=>esc(a.name)).join(", "),
  stg=(typeof lLoc=="function"?lLoc(p):"").replace(/^ · /,""),
  row=(k,x,ex="")=>`<div class=row><span class=mu>${k}</span><span class=v ${ex}>${x}</span></div>`;
  const s=$(`<div class="sheet pvi"><div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</h3>${opts.readonly?"":'<button class=chip data-rn>Rename</button>'}</div><div style="margin-top:8px">
   ${row("Date",D(p).toLocaleString(undefined,{dateStyle:"long",timeStyle:"short"}))}
   ${p.w?row("Dimensions",p.w+" × "+p.h):""}
   ${row("Size",mb(p.size))}
   ${row("Category",esc(p.cat||"—"))}
   ${hasLoc(p)?`<div class=row data-map style="cursor:pointer"><span class=mu>Location</span><span class=v>${esc(placeOf(p))} ›</span></div>`:row("Location","No location available")}
   ${al?row("Albums",al):""}
   ${stg?row("Storage",esc(stg)):""}
  </div>${opts.readonly?"":'<button class=o data-alb style="margin-top:4px">Add to album…</button>'}</div></div>`);
  document.body.append(s);
  s.onclick=e=>{if(e.target==s)return closeS(s);
   if(e.target.closest("[data-alb]")){closeS(s);albumPick();return}
   if(e.target.closest("[data-rn]")){closeS(s);ask("Rename photo",p.name,async n=>{p.name=n;info();await save(null,p.id,{...p},"photos")});return}
   if(e.target.closest("[data-map]")){closeS(s);pauseAll();S.mv={lat:p.lat,lng:p.lng,z:15};v.remove();S.view="map";render()}}};
 v.querySelectorAll("[data-i]").forEach(b=>b.onclick=detail);

 /* ----- aksi ----- */
 const albumPick=()=>{const p=cur();if(!S.albums.length){ask("New album","",n=>newAlbum(n,[p.id]));return}
  sheet(S.albums.map(a=>`<button class=o data-x="${a.id}">${esc(a.name)}${(a.ids||[]).includes(p.id)?" ✓":""}</button>`).join(""),async x=>{const a=S.albums.find(z=>z.id==x);if(!a)return;const ids=a.ids||[],has=ids.includes(p.id),n=has?ids.filter(z=>z!=p.id):[...ids,p.id];await save(null,a.id,{...a,ids:n,cover:a.cover||p.id},"albums");toast(has?"Removed from "+a.name:"Added to "+a.name)})};
 const favBtn=v.querySelector("[data-f]");if(favBtn)favBtn.onclick=async()=>{const p=cur(),on=!p.fav;p.fav=on;info();
  const sv=v.querySelector("[data-f] svg");if(sv&&!reduce())sv.animate([{transform:"scale(1)"},{transform:"scale(1.4)"},{transform:"scale(1)"}],{duration:380,easing:"cubic-bezier(.22,1,.36,1)"});
  if(on&&!reduce()){const b=v.querySelector("[data-f]"),r=document.createElement("i");r.className="hring";b.append(r);setTimeout(()=>r.remove(),700)}
  toast(on?"Added to Favorites":"Removed from Favorites");
  try{await save(null,p.id,{...p},"photos")}catch(_){p.fav=!on;info()}};
 v.querySelector("[data-d]").onclick=async()=>{const p=cur();toast("Preparing\u2026");try{await dlSave(fname(p),await getBlob(p))}catch(e){toast("Couldn't download: "+(e&&e.message||"unknown error"))}};
 v.querySelector("[data-s]").onclick=async()=>{const p=cur();if(/^data:/.test(p.url))return toast("Sharing isn't available for sample photos");
  try{const b=await getBlob(p),name=fname(p),file=new File([b],name,{type:b.type||p.type||"application/octet-stream"});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:p.name,files:[file]});return}
   const u=p.url?new URL(p.url,location.href).href:"";if(navigator.share&&u){await navigator.share({title:p.name,url:u});return}if(u&&navigator.clipboard){await navigator.clipboard.writeText(u);toast("Link copied")}else toast("Sharing isn't available here")
  }catch(e){if(e&&e.name=="AbortError")return;toast("Couldn't share this file: "+(e.message||"unknown error"))}};
 v.querySelector("[data-t]").onclick=()=>{const p=cur(),vid=isVid(p);pauseAll();
  confirmDelete([p],()=>{v.remove();delPhotos([p])},{title:vid?"Delete video?":"Delete photo?",sub:"It will be moved to Recently Deleted."})};
};
})();

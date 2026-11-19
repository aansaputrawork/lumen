// Cover profil: kotak di atas halaman Profil. Pilihan: dari library, upload dari perangkat, atau kembali otomatis.
// Disimpan di dokumen profil (S.me.cover = gambar upload, S.me.coverId = id foto library), sama seperti foto profil.
(()=>{
window.COV_PEN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
// Urutan: cover upload -> foto library pilihan -> foto pertama (otomatis, seperti sebelumnya)
window.coverUrl=c=>{const m=S.me||{};if(m.cover)return m.cover;const p=m.coverId&&S.photos.find(x=>x.id===m.coverId&&!isVid(x));return p?T(p):c?T(c):""};
const shrink=async f=>{const bm=await createImageBitmap(f),k=Math.min(1,1280/Math.max(bm.width,bm.height)),cv=document.createElement("canvas");cv.width=Math.round(bm.width*k);cv.height=Math.round(bm.height*k);cv.getContext("2d").drawImage(bm,0,0,cv.width,cv.height);return cv.toDataURL("image/jpeg",.82)};
const commit=async msg=>{try{await save(null,"me",{...S.me},"profile");toast(msg);render();window.PF&&PF.paint&&PF.paint()}catch(e){}};
function editCover(){const has=S.me&&(S.me.cover||S.me.coverId);
 sheet(`<h3 style="margin-top:0">Edit cover</h3><button class=o data-x=lib>Choose from library</button><button class=o data-x=up>Upload from device</button>${has?'<button class=o data-x=rm>Reset to automatic</button>':""}`,async x=>{
  if(x=="rm"){delete S.me.cover;delete S.me.coverId;return commit("Cover reset")}
  if(x=="lib"){const l=S.photos.filter(p=>!isVid(p));if(!l.length)return toast("No photos in your library yet");
   return sheet(`<h3 style="margin-top:0">Choose a cover</h3><div class=mas>${l.map(p=>`<img src="${T(p)}" data-x="p:${esc(p.id)}" style="opacity:1">`).join("")}</div>`,y=>{S.me.coverId=y.slice(2);delete S.me.cover;commit("Cover updated")})}
  if(x=="up"){const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.style.cssText="position:fixed;left:-9999px;opacity:0";document.body.append(inp);
   inp.onchange=async()=>{const f=inp.files[0];inp.remove();if(!f)return;try{S.me.cover=await shrink(f);delete S.me.coverId;commit("Cover updated")}catch(e){toast("Couldn't update cover")}};inp.click()}})}
document.addEventListener("click",e=>{if(e.target.closest("[data-cov]"))editCover()});

// Klik cover profil -> pop up preview foto cover (kaca, sama dengan pop up lain). Tombol di dalam cover (foto profil, pensil) tetap berfungsi sendiri.
const coverFull=()=>{const m=S.me||{};if(m.cover)return m.cover;const p=m.coverId&&S.photos.find(x=>x.id===m.coverId&&!isVid(x));if(p)return p.url;const c=S.photos.find(x=>!isVid(x));return c?c.url:""};
function coverPreview(card){
 const src=coverFull();if(!src)return toast("No cover yet");
 const u=S.me||{},nm=u.name||"You",d=$(`<div class="dlg cvp"><div class=cvw><div class=cvc><img class=cvi src="${esc(src)}" alt="Cover"><span class="glass cvn">${esc(nm)} · ${pl(S.photos.length,"item")}</span></div><div class=cvb><button data-e>Edit cover</button><button data-c>Close</button></div></div></div>`);
 document.body.append(d);
 const out=()=>{if(d.classList.contains("cl"))return;d.classList.add("cl");removeEventListener("keydown",kd);setTimeout(()=>d.remove(),300)},
  kd=e=>{if(e.key=="Escape")out()};
 addEventListener("keydown",kd);
 d.onclick=e=>{if(e.target==d||e.target.closest("[data-c]"))out()};
 d.querySelector("[data-e]").onclick=()=>{out();setTimeout(()=>{const b=document.createElement("button");b.dataset.cov=1;b.hidden=true;document.body.append(b);b.click();b.remove()},200)};
 // animasi: foto membesar dari kotak cover
 const im=d.querySelector(".cvi"),go=()=>{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;const a=card.getBoundingClientRect(),b=im.getBoundingClientRect();if(!a.width||!b.width)return;
  const s=a.width/b.width;im.animate([{transform:`translate(${a.left+a.width/2-(b.left+b.width/2)}px,${a.top+a.height/2-(b.top+b.height/2)}px) scale(${s})`,borderRadius:"34px"},{transform:"none",borderRadius:"0px"}],{duration:520,easing:"cubic-bezier(.22,1,.36,1)"})};
 im.complete?go():im.addEventListener("load",go,{once:true})}
document.addEventListener("click",e=>{const c=e.target.closest(".card.pf");if(!c||e.target.closest("button,[data-pfp],[data-cov]"))return;coverPreview(c)});
})();

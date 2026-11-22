// Profile: one "Edit profile" sheet (photo + cover + display name) and one "Photo categories" sheet
// (default category for uploads + auto-categorize existing photos). Both open from Profile -> Account.
// Uses globals from app.js / cover.js / features.js: S, $, esc, save, toast, render, closeS, isVid, coverUrl, CATS, LF.
(()=>{
const PF=window.PF={};
const ini=n=>esc(((n||"").trim()[0]||"Y").toUpperCase());
const pickFile=accept=>new Promise(ok=>{const i=document.createElement("input");i.type="file";i.accept=accept;i.style.cssText="position:fixed;left:-9999px;opacity:0";
 document.body.append(i);i.onchange=()=>{const f=i.files[0];i.remove();ok(f||null)};i.click()});
const saveMe=()=>save(null,"me",{...S.me},"profile");

/* ---------------------------- Edit profile ---------------------------- */
function openEdit(){
 if(document.querySelector(".sheet.pfe.pfp"))return;
 S.me=S.me||{};
 const s=$(`<div class="sheet pfe pfp"><div>
  <h3>Edit profile</h3>
  <div class=pfh><button class=pfav data-pe=photo aria-label="Change profile photo"><span class=pfai></span><i class=pfpen>${window.COV_PEN||""}</i></button>
   <div class=pfm2><b>Profile photo</b><span class=mu>Tap the photo to change it. To change the cover, tap the cover on your Profile.</span><button class=chip data-pe=rm>Remove photo</button></div></div>
  <label class=pfn for=pfn>Display name</label><input id=pfn maxlength=60 placeholder="Your name" autocomplete=off>
  <div class=pfa><button class=chip data-pe=cancel>Cancel</button><button class=btn data-pe=save>Save</button></div>
 </div></div>`);
 document.body.append(s);
 const av=s.querySelector(".pfai"),rm=s.querySelector('[data-pe=rm]'),inp=s.querySelector("#pfn");
 inp.value=S.me.name||"";
 const paint=()=>{const u=S.me||{};
  av.innerHTML=u.photo?`<img src="${u.photo}" alt="">`:ini(inp.value||u.name);
  rm.style.display=u.photo?"":"none"};
 PF.paint=()=>{if(document.body.contains(s))paint()};
 paint();inp.oninput=()=>{if(!S.me.photo)av.innerHTML=ini(inp.value)};
 const finish=async()=>{const n=inp.value.trim();
  if(n&&n!==(S.me.name||"")){S.me.name=n;try{await saveMe();toast("Profile updated");render()}catch(e){toast("Couldn't update profile")}}
  closeS(s)};
 inp.onkeydown=e=>{if(e.key=="Enter")finish()};
 s.onclick=async e=>{
  if(e.target==s)return closeS(s);
  const b=e.target.closest("[data-pe]");if(!b)return;e.stopPropagation();
  const k=b.dataset.pe;
  if(k=="cancel")return closeS(s);
  if(k=="save")return finish();
  if(k=="rm"){S.me.photo="";try{await saveMe();toast("Profile photo removed");render();paint()}catch(err){toast("Couldn't update photo")}return}
  if(k=="photo"){const f=await pickFile("image/*");if(!f)return;
   try{const bm=await createImageBitmap(f),q=Math.min(bm.width,bm.height),c=document.createElement("canvas");c.width=c.height=256;
    c.getContext("2d").drawImage(bm,(bm.width-q)/2,(bm.height-q)/2,q,q,0,0,256,256);
    S.me.photo=c.toDataURL("image/jpeg",.85);await saveMe();toast("Profile photo updated");render();paint()}catch(err){toast("Couldn't update photo")}}};
}

/* -------------------------- Photo categories -------------------------- */
function openCats(){
 if(document.querySelector(".sheet.pfe.pfc"))return;
 S.prefs=S.prefs||{};
 const cur=S.prefs.cat||"Auto",opts=["Auto",...CATS.slice(1)];
 const s=$(`<div class="sheet pfe pfc"><div>
  <h3>Photo categories</h3>
  <div class=pfn style="margin-top:0">Default for new uploads</div>
  <div class=pfg>${opts.map(c=>`<button class="chip${c==cur?" a":""}" data-dc="${c}">${c}</button>`).join("")}</div>
  <div class=mu style="font-size:12px;margin-top:8px">Auto picks a category for each new photo.</div>
  <div class=pfn>Existing photos</div>
  <button class=o data-rg=other>Categorize photos marked “Other”</button>
  <button class=o data-rg=all>Recategorize all photos<span class=mu style="display:block;font-size:12px;margin-top:2px">Overwrites categories you set manually</span></button>
  <div class=mu style="font-size:12px;margin-top:10px">AI runs on your device and your photos are never sent to another server. The model (~15 MB) downloads once.</div>
  <button class=btn style="width:100%;margin-top:16px" data-pc=done>Done</button>
 </div></div>`);
 document.body.append(s);
 s.onclick=async e=>{
  if(e.target==s)return closeS(s);
  const c=e.target.closest("[data-dc]");
  if(c){s.querySelectorAll("[data-dc]").forEach(x=>x.classList.toggle("a",x==c));S.prefs.cat=c.dataset.dc;
   try{await save(null,"prefs",S.prefs,"settings");render()}catch(err){}return}
  const r=e.target.closest("[data-rg]");if(r){closeS(s);LF.regroupRun(r.dataset.rg);return}
  if(e.target.closest("[data-pc]"))closeS(s)};
}

document.addEventListener("click",e=>{
 if(e.target.closest("[data-pfe]"))openEdit();
 else if(e.target.closest("[data-pcat]"))openCats()});
})();

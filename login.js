// Halaman login MIKA Photos. Memakai autentikasi Supabase yang sudah ada (window.sb).
// Pengaturan (teks, logo, foto) ada di login-config.js
(()=>{
const DEF={logo:{text:"M",image:""},hero:{image:"",alt:"MIKA"},subtitle:"Welcome back. Sign in to open your library."};
const CFG=(()=>{const u=window.LOGIN_CONFIG||{};return{logo:{...DEF.logo,...u.logo},hero:{...DEF.hero,...u.hero},subtitle:u.subtitle??DEF.subtitle}})();
const I={
 l:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M11 5l-7 7 7 7"/></svg>',
 r:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg>',
 ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5M15 3h6v6M10 14L21 3"/></svg>',
c:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H7a5 5 0 1 1 1.2-9.9A6 6 0 0 1 19.5 11a4 4 0 0 1-2 8z"/></svg>',
 h:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
 d:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 17H7a5 5 0 1 1 1.4-9.8A6 6 0 0 1 20 9.5 4 4 0 0 1 17 17h-1M12 11v9M8.5 16.5L12 20l3.5-3.5"/></svg>',
 g:'<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.9h6c-.1 1-.8 2.4-2.2 3.4l3.4 2.6c2-1.9 3.4-4.6 3.4-7.9z"/><path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.4-2.6c-.9.6-2.1 1.1-3.8 1.1-2.9 0-5.3-1.9-6.2-4.5l-3.5 2.7C4 20.7 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.8 14.4a6.6 6.6 0 010-4.2L2.3 7.5a11 11 0 000 9.6z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3-3C17.4 2.2 14.9 1 12 1 7.7 1 4 3.3 2.3 7.5l3.5 2.7C6.7 7.3 9.1 5.4 12 5.4z"/></svg>',
 v:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.8l2.4 1.7 2.9-.1 1 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-1 2.8-2.9-.1L12 20.2l-2.4-1.7-2.9.1-1-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7 1-2.8 2.9.1z" transform="translate(0 .9)"/><path d="M8.2 12.2l2.6 2.6 5-5.4" fill="none" stroke="#c9a888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function show(sb){return new Promise(done=>{
 let signup=false,busy=false;
 const el=document.createElement("div");el.className="ll";
 el.innerHTML=`<div class=ll-win>
 <section class=ll-hero><div class=ll-ph></div></section>
 <main class=ll-main><div class=ll-form><div class=ll-logo aria-hidden=true></div><h1 class=ll-h>Sign into your account</h1><p class=ll-sub></p>
  <form class=ll-f novalidate><label for=lle>Email</label><input id=lle type=email inputmode=email autocomplete=email autocapitalize=none spellcheck=false placeholder="Enter your email">
  <label for=llp>Password</label><input id=llp type=password autocomplete=current-password placeholder="••••••••">
  <button class=ll-forgot type=button id=llf>Forgot password?</button>
  <button class=ll-btn type=submit id=llb>Sign in</button><p class=ll-msg id=llm role=status aria-live=polite></p></form>
  <div class=ll-or><i></i><span>or</span><i></i></div><button class=ll-g type=button id=llg>${I.g}Continue with Google</button>
  <p class=ll-cant>Can't sign in? <button class=ll-lnk type=button id=llr>Reset password</button></p></div>
  <p class=ll-sign><span id=lls></span> <button class=ll-lnk type=button id=llt></button></p></main></div>`;
 document.body.append(el);
 const $=s=>el.querySelector(s),msg=$("#llm"),em=$("#lle"),pw=$("#llp"),btn=$("#llb");
 $(".ll-sub").textContent=CFG.subtitle;
 const lg=$(".ll-logo"),ph=$(".ll-ph");lg.textContent=CFG.logo.text;
 const tryImg=(src,ok)=>{if(!src)return;const i=new Image();i.onload=()=>ok(src);i.src=src};
 tryImg(CFG.hero.image,s=>{const im=document.createElement("img");im.alt=CFG.hero.alt||"MIKA";im.draggable=false;im.src=s;ph.prepend(im);ph.classList.add("has-photo")});
 tryImg(CFG.logo.image,s=>{lg.classList.add("img");lg.textContent="";const im=document.createElement("img");im.alt="";im.src=s;lg.append(im)});
 const mode=()=>{$("#lls").textContent=signup?"Already have an account?":"Don't have an account?";$("#llt").textContent=signup?"Sign in":"Sign up";btn.textContent=signup?"Sign up":"Sign in";pw.autocomplete=signup?"new-password":"current-password";msg.textContent=""};
 mode();$("#llt").onclick=()=>{signup=!signup;mode()};
 const say=(t,ok)=>{msg.className="ll-msg"+(ok?" ok":"");msg.textContent=t};
 const reset=async()=>{const e=em.value.trim();if(!e){say("Enter your email first.");em.focus();return}
  try{const{error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.origin+location.pathname});say(error?error.message:"Check your email for the reset link.",!error)}catch(x){say("No internet connection.")}};
 $("#llf").onclick=reset;$("#llr").onclick=reset;
 $("#llg").onclick=async()=>{if(busy)return;const nat=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());busy=true;say("");
  try{const r=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.LOGIN_REDIRECT||location.origin+location.pathname,skipBrowserRedirect:nat}});busy=false;
   if(r.error){say(r.error.message);return}
   if(r.data&&r.data.session){el.remove();done(r.data.session);return}
   if(nat&&r.data&&r.data.url)Capacitor.Plugins.Browser.open({url:r.data.url})}catch(x){busy=false;say("No internet connection.")}};
 $("form.ll-f").onsubmit=async ev=>{ev.preventDefault();if(busy)return;const c={email:em.value.trim(),password:pw.value};if(!c.email||!c.password){say("Enter your email and password.");return}
  busy=true;btn.disabled=true;say("");let r;
  try{r=signup?await sb.auth.signUp(c):await sb.auth.signInWithPassword(c)}catch(x){busy=false;btn.disabled=false;say("No internet connection.");return}
  busy=false;btn.disabled=false;
  if(r.error){say(r.error.message);return}
  if(!r.data.session){say("Check your email to confirm your account, then sign in.",true);return}
  el.remove();done(r.data.session)};
})}
window.LumenLogin={show};  // nama global dipertahankan agar adapter/admin tidak perlu diubah
})();

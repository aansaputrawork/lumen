// MOTION: lapisan animasi UI halus. Berjalan setiap #app selesai dirender (MutationObserver, sebelum frame digambar).
// Semua mati otomatis bila perangkat memilih "reduce motion". Gaya/keyframe-nya ada di bagian "MOTION" style.css.
(function(){
 const rm=()=>matchMedia("(prefers-reduced-motion: reduce)").matches,TAB=["home","map","alb","me"],depth=v=>TAB.includes(v)?0:1;
 let prevV=null,nvx=null,sgx={};
 function fx(){
  const app=document.getElementById("app");if(!app||typeof S==="undefined")return;
  const v=S.view,scr=document.getElementById("scr");
  // 1) arah transisi halaman: maju (dari kanan) saat masuk lebih dalam / pindah tab ke kanan; mundur (dari kiri) sebaliknya
  if(!rm()&&scr&&prevV!==null&&prevV!==v&&!scr.classList.contains("st0")){
   const a=depth(prevV),b=depth(v);let dir=b>a?1:b<a?-1:(a===0?(TAB.indexOf(v)>TAB.indexOf(prevV)?1:-1):0);
   if(dir)scr.classList.add(dir>0?"pgf":"pgb");
  }
  prevV=v;
  if(rm())return;
  // 2) navigasi bawah: pil aktif meluncur dari tab lama ke tab baru
  const nv=app.querySelector(".nav:not(.sb)"),a=nv&&nv.querySelector("button.a");
  if(nv&&a){const x=a.offsetLeft,w=a.offsetWidth,f=nvx||{x,w},i=document.createElement("i");
   i.className="nvi";i.style.width=f.w+"px";i.style.transform=`translateX(${f.x}px)`;nv.classList.add("fx");nv.prepend(i);
   void i.offsetWidth;i.style.width=w+"px";i.style.transform=`translateX(${x}px)`;nvx={x,w}}
  // 3) segmented control (Appearance): thumb meluncur
  app.querySelectorAll(".seg").forEach((sg,k)=>{const b=sg.querySelector("button.a");if(!b)return;
   const x=b.offsetLeft,w=b.offsetWidth,f=sgx[k]||{x,w},i=document.createElement("i");
   i.className="sgi";i.style.width=f.w+"px";i.style.transform=`translateX(${f.x}px)`;sg.classList.add("fx");sg.prepend(i);
   void i.offsetWidth;i.style.width=w+"px";i.style.transform=`translateX(${x}px)`;sgx[k]={x,w}});
 }
 const start=()=>{const app=document.getElementById("app");if(!app)return setTimeout(start,50);
  new MutationObserver(fx).observe(app,{childList:true});fx()};
 start();
})();

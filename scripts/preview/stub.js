/* PREVIEW: pengganti Supabase di memori (tanpa server). Login menerima email/password apa saja. Data hilang saat halaman di-refresh. */
(()=>{
const IMG=window.__PV_IMG||{},img=n=>IMG[n]||("assets/demo/"+n+".jpg");
const names=["a1","a2","f1","f2","f3","r1","r2","r3","t1","t2","hl","mt","dn"],cats=["Portraits","Portraits","People","People","People","Portraits","Portraits","Portraits","Travel","Travel","Travel","Travel","Travel"];
const store={profile:[{id:"me",data:{name:"MIKA"}}],settings:[],albums:[{id:"a1",data:{name:"Moments",ids:["p0","p2","p5"],cover:"p0"}}],
 photos:(()=>{const a=[];let k=0;for(let d=0;d<150;d++){if((d*13+5)%7<4){const c=d%5==0?3:d%3==0?2:1;for(let j=0;j<c;j++){const n=k%13;a.push({id:"p"+k,storage_provider:"supabase",storage_path:"u/"+names[n],backup_status:"none",data:{name:names[n]+".jpg",type:"image/jpeg",size:180000+k*9000,date:Date.now()-d*864e5-j*36e5,cat:cats[n],aid:"u/"+names[n],tid:"u/"+names[n],w:600,h:800,fav:k%4==0}});k++}}}a.push({id:"pv1",storage_provider:"supabase",storage_path:"u/vid1",backup_status:"none",data:{name:"VID_0042.webm",type:"video/webm",size:1200000,date:Date.now()-36e5,cat:"Motion",aid:"u/vid1",w:270,h:480,fav:false}});return a})()};
const blobs={};let logged=false;try{logged=sessionStorage.getItem("pv_logged")=="1"}catch(e){}
const sess={access_token:"preview",user:{id:"u1",email:"you@example.com",user_metadata:{name:"MIKA"}}};
let cb=null;
const url=p=>blobs[p]||(p=="u/vid1"?window.__PV_VID:img((p||"").split("/").pop()));
function qb(n){const f=[];let op=null,pay=null;
 const run=()=>{const t=store[n]=store[n]||[];const m=r=>f.every(([k,v])=>(k=="id"?r.id==v:true));
  if(op=="select")return{data:t.map(r=>({...r,user_id:"u1"})),error:null};
  if(op=="update"){const hit=t.filter(m);hit.forEach(r=>{if(pay.data)r.data=pay.data;Object.assign(r,Object.fromEntries(Object.entries(pay).filter(([k])=>k!="data")))});return{data:hit.map(r=>({id:r.id})),error:null}}
  if(op=="insert"){const{user_id,...r}=pay;t.push(r);return{error:null}}
  if(op=="delete"){store[n]=t.filter(r=>!m(r));return{error:null}}};
 const o={select(){if(!op)op="select";return o},update(p){op="update";pay=p;return o},insert(p){op="insert";pay=p;return Promise.resolve(run())},delete(){op="delete";return o},eq(k,v){f.push([k,v]);return o},order(){return o},upsert(){return Promise.resolve({error:null})},maybeSingle(){return Promise.resolve({data:n=="user_accounts"?{plan_id:"free",quota_override:null,plans:{name:"Free",storage_bytes:5e9,max_file_bytes:5e8}}:null,error:null})},then(a,b){return Promise.resolve(run()).then(a,b)}};return o}
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:logged?sess:null}}),onAuthStateChange:c=>{cb=c},
  signInWithPassword:async()=>{logged=true;try{sessionStorage.setItem("pv_logged","1")}catch(e){}return{data:{session:sess},error:null}},
  signUp:async()=>{logged=true;try{sessionStorage.setItem("pv_logged","1")}catch(e){}return{data:{session:sess},error:null}},
  resetPasswordForEmail:async()=>({error:null}),
  signInWithOAuth:async()=>{logged=true;try{sessionStorage.setItem("pv_logged","1")}catch(e){}return{data:{session:sess},error:null}},
  signOut:async()=>{logged=false;try{sessionStorage.removeItem("pv_logged")}catch(e){}cb&&cb("SIGNED_OUT")}},
 from:qb,channel:()=>{const c={on(){return c},subscribe(){}};return c},
 storage:{from:()=>({
  createSignedUrls:async ps=>({data:ps.map(p=>({path:p,signedUrl:url(p)})),error:null}),
  createSignedUrl:async p=>({data:{signedUrl:url(p)},error:null}),
  upload:async(k,f)=>{blobs[k]=URL.createObjectURL(f);return{error:null}},
  remove:async()=>({error:null})})}})};
const rf=window.fetch.bind(window);window.fetch=(u,o)=>String(u).includes("preview.local")?Promise.resolve(new Response(JSON.stringify({connected:false}),{status:200,headers:{"Content-Type":"application/json"}})):rf(u,o);
})();

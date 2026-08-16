import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {exec} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 5173;

function json(res,data,status=200){
  res.writeHead(status,{"content-type":"application/json; charset=utf-8"});
  res.end(JSON.stringify(data));
}

function body(req){
  return new Promise((resolve,reject)=>{
    let b="";
    req.on("data",x=>b+=x);
    req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch{resolve({})}});
    req.on("error",reject);
  });
}

function run(command){
  return new Promise(resolve=>{
    exec(command,{cwd:root,maxBuffer:1024*1024*10},(error,stdout,stderr)=>{
      resolve({
        ok:!error,
        stdout:stdout||"",
        stderr:stderr||"",
        code:error?.code??0
      });
    });
  });
}

const html=String.raw`<!doctype html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>dev-tools agent</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;background:#000;color:#ddd;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow:hidden}
button,input,textarea{font:inherit}
button{background:#111;color:#ccc;border:1px solid #292929;padding:9px 12px;cursor:pointer}
button:hover{background:#1b1b1b;color:#fff}
.app{height:100dvh;display:grid;grid-template-rows:48px 1fr}
.top{display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #222;background:#050505}
.brand{color:#fff;font-size:14px}
.status{font-size:11px;color:#777}
.main{min-height:0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#222}
.panel{min-width:0;min-height:0;background:#000;display:flex;flex-direction:column}
.head{height:42px;flex:none;border-bottom:1px solid #222;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#aaa;font-size:12px}
.body{min-height:0;flex:1;overflow:auto}
.chat{padding:14px}
.msg{margin-bottom:16px;white-space:pre-wrap;font-size:12px;line-height:1.55}
.msg.user{color:#fff}
.msg.agent{color:#aaa}
.thinking{color:#666}
.composer{border-top:1px solid #222;padding:10px;display:flex;gap:8px}
.composer textarea{flex:1;resize:none;background:#080808;border:1px solid #292929;color:#ddd;padding:10px;min-height:42px;max-height:110px;outline:none}
.send{width:48px}
.terminal{padding:12px;white-space:pre-wrap;font-size:11px;line-height:1.5;color:#aaa}
.terminal .prompt{color:#fff}
.code{padding:14px;font-size:11px;line-height:1.55;white-space:pre;min-height:100%;color:#bbb}
.log{padding:12px;font-size:11px;line-height:1.6;white-space:pre-wrap;color:#888}
.actions{border-top:1px solid #222;padding:9px;display:flex;gap:6px;flex-wrap:wrap}
.actions button{font-size:11px}
.ok{color:#8a8}
.err{color:#a66}
.info{color:#888}
@media(max-width:850px){
 .main{grid-template-columns:1fr;grid-template-rows:1fr 1fr 1fr;overflow:auto}
 .panel{min-height:33vh}
 body{overflow:auto}
}
</style>
</head>
<body>
<div class="app">
<header class="top">
  <div class="brand">dev-tools / agent</div>
  <div id="status" class="status">ready</div>
</header>

<main class="main">

<section class="panel">
  <div class="head"><span>chat + shell</span><span>agent</span></div>
  <div id="chat" class="body chat">
    <div class="msg agent">agent ready.
tell me what to build, fix, review or run.</div>
  </div>
  <div class="composer">
    <textarea id="prompt" placeholder="build README.md dùm tao..."></textarea>
    <button class="send" onclick="sendAgent()">→</button>
  </div>
  <div class="actions">
    <button onclick="runShell()">bash</button>
    <button onclick="reviewCode()">review</button>
    <button onclick="buildProject()">build</button>
    <button onclick="clearChat()">clear</button>
  </div>
</section>

<section class="panel">
  <div class="head"><span>code</span><span id="file">workspace</span></div>
  <div id="code" class="body code">// code workspace
// agent changes will appear here</div>
  <div class="actions">
    <button onclick="saveCode()">save</button>
    <button onclick="reviewCode()">review</button>
    <button onclick="pushGit()">bash code lên github</button>
  </div>
</section>

<section class="panel">
  <div class="head"><span>nhật ký</span><span id="clock"></span></div>
  <div id="log" class="body log">system ready
server: local
agent: free-provider ready
github: waiting
build: waiting</div>
  <div class="actions">
    <button onclick="runShell()">bash</button>
    <button onclick="pushGit()">bash</button>
    <button onclick="createPR()">tạo PR mới</button>
    <button onclick="clearLog()">clear</button>
  </div>
</section>

</main>
</div>

<script>
const $=id=>document.getElementById(id);

function addChat(text,type="agent"){
 const d=document.createElement("div");
 d.className="msg "+type;
 d.textContent=text;
 $("chat").appendChild(d);
 $("chat").scrollTop=$("chat").scrollHeight;
}

function log(text,cls=""){
 const d=document.createElement("div");
 d.className=cls;
 d.textContent=text;
 $("log").appendChild(d);
 $("log").scrollTop=$("log").scrollHeight;
}

function setStatus(x){$("status").textContent=x}

async function api(url,data={}){
 const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
 return r.json();
}

async function sendAgent(){
 const p=$("prompt").value.trim();
 if(!p)return;
 addChat(p,"user");
 $("prompt").value="";
 addChat("agent thinking...","thinking");
 setStatus("thinking");
 try{
   const r=await api("/api/agent",{prompt:p});
   document.querySelector(".thinking:last-child")?.remove();
   addChat(r.answer||r.error||"agent không trả lời");
   if(r.code){$("code").textContent=r.code;$("file").textContent=r.file||"generated";}
   log(r.answer||r.error||"agent finished",r.ok?"ok":"err");
 }catch(e){addChat("agent error: "+e.message,"err")}
 setStatus("ready");
}

async function runShell(){
 const command=prompt("bash command:");
 if(!command)return;
 log("$ "+command);
 setStatus("running");
 const r=await api("/api/shell",{command});
 log(r.stdout||r.stderr||"(no output)",r.ok?"ok":"err");
 setStatus(r.ok?"ready":"error");
}

async function reviewCode(){
 addChat("review code...");
 setStatus("reviewing");
 const r=await api("/api/review",{});
 addChat(r.answer||r.error);
 log(r.answer||r.error,r.ok?"ok":"err");
 setStatus("ready");
}

async function buildProject(){
 addChat("building project...");
 setStatus("building");
 const r=await api("/api/shell",{command:"npm run build"});
 log(r.stdout||r.stderr,r.ok?"ok":"err");
 addChat(r.ok?"build complete.":"build failed.");
 setStatus(r.ok?"ready":"error");
}

async function saveCode(){
 const code=$("code").textContent;
 const r=await api("/api/save",{file:$("file").textContent,code});
 log(r.message||r.error,r.ok?"ok":"err");
}

async function pushGit(){
 setStatus("github");
 const r=await api("/api/git-push",{});
 log(r.stdout||r.stderr,r.ok?"ok":"err");
 if(!r.ok)log("k đủ điều kiện bash → tạo PR mới");
 setStatus(r.ok?"ready":"github check");
}

async function createPR(){
 const r=await api("/api/create-pr",{});
 log(r.stdout||r.stderr,r.ok?"ok":"err");
}

function clearChat(){$("chat").innerHTML=""}
function clearLog(){$("log").textContent=""}
setInterval(()=>{$("clock").textContent=new Date().toLocaleTimeString()},1000);

$("prompt").addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAgent()}
});
</script>
</body>
</html>`;

async function agent(prompt){
 const key=process.env.GROQ_API_KEY;
 if(!key){
   return {
     ok:false,
     answer:"agent chưa có GROQ_API_KEY. đặt biến môi trường GROQ_API_KEY để bật AI.",
     code:""
   };
 }
 const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
   method:"POST",
   headers:{
     "content-type":"application/json",
     "authorization":"Bearer "+key
   },
   body:JSON.stringify({
     model:process.env.GROQ_MODEL||"llama-3.3-70b-versatile",
     temperature:.2,
     messages:[
       {role:"system",content:"You are a coding agent. Inspect the user's local project when possible. Give concise actionable coding results. When asked to create code, return useful code."},
       {role:"user",content:prompt}
     ]
   })
 });
 const j=await r.json();
 if(!r.ok)return {ok:false,answer:j.error?.message||"groq error"};
 return {ok:true,answer:j.choices?.[0]?.message?.content||"no answer"};
}

const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,"http://localhost");

 if(req.method==="GET"&&u.pathname==="/"){
   res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
   return res.end(html);
 }

 if(req.method==="POST"){
   const b=await body(req);

   if(u.pathname==="/api/agent"){
     try{return json(res,await agent(b.prompt||""))}
     catch(e){return json(res,{ok:false,error:e.message},500)}
   }

   if(u.pathname==="/api/shell"){
     return json(res,await run(b.command||""));
   }

   if(u.pathname==="/api/review"){
     const r=await run("git diff -- . ':!node_modules'");
     if(!r.stdout&&!r.stderr)return json(res,{ok:true,answer:"không có thay đổi để review"});
     try{
       const a=await agent("review this git diff and list bugs, risks and exact fixes:\\n\\n"+r.stdout);
       return json(res,a);
     }catch(e){return json(res,{ok:false,error:e.message})}
   }

   if(u.pathname==="/api/save"){
     const f=String(b.file||"generated.txt").replace(/[^a-zA-Z0-9._/-]/g,"_");
     const target=path.resolve(root,f);
     if(!target.startsWith(root))return json(res,{ok:false,error:"invalid file"},400);
     fs.mkdirSync(path.dirname(target),{recursive:true});
     fs.writeFileSync(target,String(b.code||""));
     return json(res,{ok:true,message:"saved: "+f});
   }

   if(u.pathname==="/api/git-push"){
     return json(res,await run("git add -A && git commit -m 'agent update' && git push"));
   }

   if(u.pathname==="/api/create-pr"){
     return json(res,await run("gh pr create --fill"));
   }
 }

 res.writeHead(404);
 res.end("not found");
});

server.listen(port,"0.0.0.0",()=>{
 console.log("DEV-TOOLS AGENT: http://0.0.0.0:"+port);
 console.log("GROQ_API_KEY: "+(process.env.GROQ_API_KEY?"configured":"not configured"));
});

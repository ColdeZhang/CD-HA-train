const DAY_NAMES=["周一","周二","周三","周四","周五","周六","周日"];
const WEEK_COPIES=21;
const BASE_WEEK_OFFSET=10;
const planner=document.querySelector("#planner");
const meta=document.querySelector("#meta");
const hideTight=document.querySelector("#hideTight");
const collapseBtn=document.querySelector("#collapseBtn");
const todayBtn=document.querySelector("#todayBtn");

const hm=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
const mins=(obj)=>obj.dayOffset*1440+hm(obj.time);
const hasTight=p=>p.segments.some(s=>s.tight);

let DATA;
async function init(){
  const res=await fetch("./data/train-plans.json",{cache:"no-store"});
  if(!res.ok) throw new Error("无法加载 data/train-plans.json");
  DATA=await res.json();
  renderMeta();
  render();
  requestAnimationFrame(centerAll);
}
function renderMeta(){
  meta.textContent=`数据版本：${DATA.meta.version} · ${DATA.meta.notes.join(" · ")}`;
}
function render(){
  planner.innerHTML="";
  for(const direction of ["成都-海安","海安-成都"]){
    const plans=DATA.plans.filter(p=>p.direction===direction && (!hideTight.checked || !hasTight(p)));
    const section=document.createElement("section");
    section.className="direction";
    section.innerHTML=`<h2>${direction.replace("-"," → ")}</h2>`;
    if(!plans.length){section.innerHTML+="<div class='empty'>当前筛选下没有方案。</div>";planner.append(section);continue}
    section.append(buildTimeline(plans,direction));
    planner.append(section);
  }
}
function buildTimeline(plans,direction){
  const shell=document.createElement("div");shell.className="timeline-shell";
  const labels=document.createElement("div");labels.className="labels";
  labels.innerHTML="<div class='label-head'>方案</div>"+plans.map(p=>`<div class="plan-label"><strong>${p.name}</strong><span>${p.depart.time} → 次日 ${p.arrive.time}</span></div>`).join("");
  const scroller=document.createElement("div");scroller.className="scroller";scroller.dataset.direction=direction;
  const canvas=document.createElement("div");canvas.className="canvas";
  const heads=document.createElement("div");heads.className="day-heads";
  const rows=document.createElement("div");rows.className="rows";
  const dayWidth=Number(getComputedStyle(document.documentElement).getPropertyValue("--day-width").replace("px",""))||420;
  for(let d=0;d<WEEK_COPIES*7;d++){
    const head=document.createElement("div");head.className="day-head";head.style.left=(d*dayWidth)+"px";head.textContent=DAY_NAMES[d%7];heads.append(head);
  }
  plans.forEach((p,rowIndex)=>{
    const row=document.createElement("div");row.className="row";row.dataset.planId=p.id;
    for(let w=0;w<WEEK_COPIES;w++){
      p.weekdays.forEach(wd=>{
        const dayIndex=w*7+(wd-1);
        const start=dayIndex*1440+mins(p.depart);
        const end=dayIndex*1440+mins(p.arrive);
        const bar=document.createElement("div");
        bar.className="trip"+(hasTight(p)?" tight":"");
        bar.style.left=((start/1440)*dayWidth)+"px";
        bar.style.width=(((end-start)/1440)*dayWidth)+"px";
        bar.dataset.planId=p.id;
        bar.dataset.instance=`${w}-${wd}`;
        bar.innerHTML=barHTML(p,end-start);
        bar.addEventListener("click",()=>toggleDetails(shell,p,bar));
        row.append(bar);
      })
    }
    rows.append(row);
  });
  canvas.append(heads,rows);scroller.append(canvas);shell.append(labels,scroller);
  const weekWidth=dayWidth*7;
  scroller.addEventListener("scroll",()=>{
    const leftGuard=weekWidth*3;
    const rightGuard=scroller.scrollWidth-scroller.clientWidth-weekWidth*3;
    if(scroller.scrollLeft<leftGuard){
      scroller.scrollLeft+=weekWidth*7;
    }else if(scroller.scrollLeft>rightGuard){
      scroller.scrollLeft-=weekWidth*7;
    }
  },{passive:true});
  return shell;
}
function barHTML(p,total){
  let transfers=p.segments.filter(s=>s.transferAt).map(s=>s.transferAt);
  let summary=`${p.depart.time} ${p.depart.station} → ${transfers.join(" → ")} → ${p.arrive.time} ${p.arrive.station}`;
  let offset=0;let track="";
  for(const s of p.segments){
    if(!s.train) continue;
    const start=s.departDayOffset*1440+hm(s.depart);
    const end=s.arriveDayOffset*1440+hm(s.arrive);
    const left=((start-mins(p.depart))/total)*100;
    const width=((end-start)/total)*100;
    track+=`<span class="seg ${s.sleeper?"sleeper":""}" style="position:absolute;left:${left}%;width:${width}%"></span>`;
  }
  return `<div class="trip-track">${track}</div><div class="trip-summary">${summary}</div>`;
}
function toggleDetails(shell,p,bar){
  const existing=shell.querySelector(".details-panel");
  if(existing && existing.dataset.planId===p.id){existing.remove();return}
  if(existing) existing.remove();
  const panel=document.createElement("div");panel.className="details-panel";panel.dataset.planId=p.id;
  let html=`<div class="details"><strong>${p.depart.station} ${p.depart.time} → 次日 ${p.arrive.station} ${p.arrive.time}</strong>`;
  p.segments.forEach(s=>{
    if(s.train){
      html+=`<div class="leg"><span class="badge ${s.sleeper?"sleep":""}">${s.sleeper?"夜间动卧":"接驳"}</span><span><b>${s.train}</b> · ${s.from} ${s.depart} → ${s.to} ${s.arrive}${s.arriveDayOffset>s.departDayOffset?"（次日）":""}</span><span></span></div>`;
    }else{
      html+=`<div class="transfer ${s.tight?"tight":""}">${s.transferAt} 站内换乘 · 等待 ${s.waitMinutes} 分钟${s.tight?" · 时间偏紧":""}</div>`;
    }
  });
  html+="</div>";panel.innerHTML=html;
  shell.after(panel);
}
function centerAll(){
  document.querySelectorAll(".scroller").forEach(s=>{
    const dayWidth=Number(getComputedStyle(document.documentElement).getPropertyValue("--day-width").replace("px",""))||420;
    s.scrollLeft=(BASE_WEEK_OFFSET*7-1)*dayWidth;
  });
}
hideTight.addEventListener("change",()=>{render();requestAnimationFrame(centerAll)});
collapseBtn.addEventListener("click",()=>document.querySelectorAll(".details-panel").forEach(x=>x.remove()));
todayBtn.addEventListener("click",centerAll);
window.addEventListener("resize",()=>{});
init().catch(err=>planner.innerHTML=`<div class="empty">${err.message}<br>请通过 HTTP 服务打开本页面，而不是直接双击 file://。</div>`);

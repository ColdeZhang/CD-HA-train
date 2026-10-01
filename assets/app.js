const DAY_NAMES=["周一","周二","周三","周四","周五","周六","周日"];
const WEEK_COPIES=21;
const BASE_WEEK_OFFSET=10;

const planner=document.querySelector("#planner");
const hideTight=document.querySelector("#hideTight");
const todayBtn=document.querySelector("#todayBtn");
const modal=document.querySelector("#tripModal");
const modalContent=document.querySelector("#modalContent");
const modalClose=document.querySelector("#modalClose");
const modalBackdrop=modal.querySelector(".modal-backdrop");

const hm=function(t){const parts=t.split(":").map(Number);return parts[0]*60+parts[1];};
const mins=function(obj){return obj.dayOffset*1440+hm(obj.time);};
const hasTight=function(p){return p.segments.some(function(s){return s.tight;});};
const transfersOf=function(p){return p.segments.filter(function(s){return s.transferAt;});};
const sleeperOf=function(p){return p.segments.find(function(s){return s.train&&s.sleeper;});};

function durationText(minutes){
  const h=Math.floor(minutes/60);
  const m=minutes%60;
  return m ? h+"小时"+m+"分" : h+"小时";
}
function segmentDuration(s){
  const start=s.departDayOffset*1440+hm(s.depart);
  const end=s.arriveDayOffset*1440+hm(s.arrive);
  return end-start;
}
function tripDuration(p){return mins(p.arrive)-mins(p.depart);}
function weekdaysText(p){return p.weekdays.map(function(d){return DAY_NAMES[d-1];}).join("、");}
function priceNumber(n){
  return Number.isInteger(n)?String(n):Number(n).toFixed(1).replace(/\.0$/,"");
}
function fareText(fare){
  if(!fare) return "票价待补";
  if(fare.min===fare.max) return "¥"+priceNumber(fare.min);
  return "¥"+priceNumber(fare.min)+"–"+priceNumber(fare.max);
}
function totalFare(p){
  return p.segments.reduce(function(total,s){
    if(!s.train||!s.fare) return total;
    total.min+=s.fare.min;
    total.max+=s.fare.max;
    return total;
  },{min:0,max:0});
}

let DATA;
let lastFocusedBar=null;

async function init(){
  const res=await fetch("./data/train-plans.json",{cache:"no-store"});
  if(!res.ok) throw new Error("无法加载 data/train-plans.json");
  DATA=await res.json();
  render();
  requestAnimationFrame(centerAll);
}

function render(){
  planner.innerHTML="";
  ["成都-海安","海安-成都"].forEach(function(direction){
    const all=DATA.plans.filter(function(p){return p.direction===direction;});
    const plans=all.filter(function(p){return !hideTight.checked||!hasTight(p);});
    const section=document.createElement("section");
    section.className="direction-card";

    const fromTo=direction.split("-");
    section.innerHTML=
      '<header class="direction-head">'+
        '<div class="direction-title">'+
          '<span class="route-dot"></span>'+
          '<div><h2>'+fromTo[0]+' → '+fromTo[1]+'</h2><span>'+plans.length+' 套常态方案</span></div>'+
        '</div>'+
        '<div class="direction-hint">深色区段代表夜间动卧 · 点击方案查看详情</div>'+
      '</header>';

    if(!plans.length){
      section.innerHTML+='<div class="empty">当前筛选下没有方案。</div>';
    }else{
      section.append(buildTimeline(plans,direction));
    }
    planner.append(section);
  });
}

function buildTimeline(plans,direction){
  const shell=document.createElement("div");
  shell.className="timeline-shell";

  const labels=document.createElement("div");
  labels.className="labels";
  let labelHtml=
    '<div class="label-head">'+
      '<div class="label-head-title"><span>方案</span><span>出发 → 到达</span></div>'+
      '<button class="labels-toggle" type="button" aria-label="折叠方案列" title="折叠方案列">'+
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 7l-5 5 5 5"/></svg>'+
      '</button>'+
    '</div>';
  plans.forEach(function(p){
    const tag=hasTight(p)
      ? '<span class="plan-tag warn">换乘偏紧</span>'
      : '<span class="plan-tag">舒适衔接</span>';
    labelHtml+=
      '<div class="plan-label">'+
        '<div class="plan-label-top"><strong>'+p.name+'</strong>'+tag+'</div>'+
        '<div class="plan-time"><b>'+p.depart.time+'</b><i></i><b>次日 '+p.arrive.time+'</b></div>'+
        '<div class="plan-days"><span>开行</span>'+weekdaysText(p)+'</div>'+
      '</div>';
  });
  labels.innerHTML=labelHtml;
  const labelsToggle=labels.querySelector(".labels-toggle");
  const defaultCollapsed=window.matchMedia("(max-width:680px)").matches;
  if(defaultCollapsed) shell.classList.add("labels-collapsed");
  labelsToggle.setAttribute("aria-expanded",defaultCollapsed?"false":"true");
  labelsToggle.setAttribute("aria-label",defaultCollapsed?"展开方案列":"折叠方案列");
  labelsToggle.title=defaultCollapsed?"展开方案列":"折叠方案列";
  labelsToggle.addEventListener("click",function(){
    const collapsed=shell.classList.toggle("labels-collapsed");
    labelsToggle.setAttribute("aria-expanded",collapsed?"false":"true");
    labelsToggle.setAttribute("aria-label",collapsed?"展开方案列":"折叠方案列");
    labelsToggle.title=collapsed?"展开方案列":"折叠方案列";
  });

  const scroller=document.createElement("div");
  scroller.className="scroller";
  scroller.dataset.direction=direction;

  const canvas=document.createElement("div");
  canvas.className="canvas";
  const heads=document.createElement("div");
  heads.className="day-heads";
  const rows=document.createElement("div");
  rows.className="rows";
  const dayWidth=getDayWidth();

  for(let d=0;d<WEEK_COPIES*7;d++){
    const head=document.createElement("div");
    head.className="day-head";
    head.style.left=(d*dayWidth)+"px";
    head.innerHTML=
      '<div class="day-title">'+DAY_NAMES[d%7]+'</div>'+
      '<div class="hour-scale"><span>00</span><span>06</span><span>12</span><span>18</span></div>';
    heads.append(head);
  }

  plans.forEach(function(p){
    const row=document.createElement("div");
    row.className="row";
    row.dataset.planId=p.id;

    for(let w=0;w<WEEK_COPIES;w++){
      p.weekdays.forEach(function(wd){
        const dayIndex=w*7+(wd-1);
        const start=dayIndex*1440+mins(p.depart);
        const end=dayIndex*1440+mins(p.arrive);

        const bar=document.createElement("button");
        bar.type="button";
        bar.className="trip"+(hasTight(p)?" tight":"");
        bar.style.left=((start/1440)*dayWidth)+"px";
        bar.style.width=(((end-start)/1440)*dayWidth)+"px";
        bar.dataset.planId=p.id;
        bar.dataset.instance=w+"-"+wd;
        bar.setAttribute(
          "aria-label",
          p.depart.time+" "+p.depart.station+" 出发，经 "+
          transfersOf(p).map(function(s){return s.transferAt;}).join("、")+
          "，次日 "+p.arrive.time+" 到 "+p.arrive.station+"，点击查看详情"
        );
        bar.innerHTML=barHTML(p,end-start);
        bar.addEventListener("click",function(){openTripModal(p,bar);});
        row.append(bar);
      });
    }
    rows.append(row);
  });

  canvas.append(heads,rows);
  scroller.append(canvas);
  shell.append(labels,scroller);

  const weekWidth=dayWidth*7;
  scroller.addEventListener("scroll",function(){
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
  const transfers=transfersOf(p).map(function(s){return s.transferAt;});
  let track="";

  p.segments.forEach(function(s){
    if(!s.train) return;
    const start=s.departDayOffset*1440+hm(s.depart);
    const end=s.arriveDayOffset*1440+hm(s.arrive);
    const left=((start-mins(p.depart))/total)*100;
    const width=((end-start)/total)*100;
    track+='<span class="seg '+(s.sleeper?"sleeper":"")+'" style="left:'+left+'%;width:'+width+'%"></span>';
  });

  const middle=transfers.length?transfers.join(" · "):"直达";
  return '<div class="trip-track">'+track+'</div>'+
    '<div class="trip-summary">'+
      '<span class="time">'+p.depart.time+'</span>'+
      '<span class="station">'+p.depart.station+'</span>'+
      '<span class="arrow">→</span>'+
      '<span class="station">'+middle+'</span>'+
      '<span class="arrow">→</span>'+
      '<span class="time">'+p.arrive.time+'</span>'+
      '<span class="station">'+p.arrive.station+'</span>'+
    '</div>';
}

function openTripModal(p,bar){
  lastFocusedBar=bar;
  const sleeper=sleeperOf(p);
  const transferCount=transfersOf(p).length;
  const sleeperMinutes=sleeper?segmentDuration(sleeper):0;
  const fareTotal=totalFare(p);
  const tight=hasTight(p);
  let journey="";

  p.segments.forEach(function(s){
    if(s.train){
      const nextDay=s.arriveDayOffset>s.departDayOffset;
      journey+=
        '<div class="leg '+(s.sleeper?"sleeper":"")+'">'+
          '<div class="leg-times">'+
            '<div class="time-point depart">'+
              '<span class="time-kind">发</span>'+
              '<span class="clock">'+s.depart+'</span>'+
            '</div>'+
            '<div class="time-point arrive">'+
              '<span class="time-kind">到</span>'+
              '<span class="clock">'+(nextDay?'<small>次日</small>':'')+s.arrive+'</span>'+
            '</div>'+
          '</div>'+
          '<div class="leg-card">'+
            '<div>'+
              '<div class="leg-route">'+s.from+' → '+s.to+'</div>'+
              '<div class="leg-train"><b>'+s.train+'</b> · '+s.depart+' 出发 · '+(nextDay?"次日 ":"")+s.arrive+' 到达</div>'+
            '</div>'+
            '<div class="leg-side">'+
              '<div class="leg-fare">'+
                '<span>'+s.fare.seat+(s.fare.estimated?" · 估算":"")+'</span>'+
                '<strong>'+fareText(s.fare)+'</strong>'+
              '</div>'+
              '<span class="kind-badge '+(s.sleeper?"sleep":"")+'">'+(s.sleeper?"夜间动卧":"接驳")+'</span>'+
            '</div>'+
          '</div>'+
        '</div>';
    }else{
      journey+=
        '<div class="transfer '+(s.tight?"tight":"")+'">'+
          '<span><strong>'+s.transferAt+'</strong> · 站内换乘'+(s.tight?" · 时间偏紧":"")+'</span>'+
          '<span class="wait">'+s.waitMinutes+' 分钟</span>'+
        '</div>';
    }
  });

  let sleepFocus="";
  if(sleeper){
    sleepFocus=
      '<div class="sleep-focus">'+
        '<div>'+
          '<div class="sleep-focus-label">主要睡眠区段</div>'+
          '<strong>'+sleeper.train+' · '+sleeper.from+' → '+sleeper.to+'</strong>'+
          '<p>'+sleeper.depart+' 上车 · '+(sleeper.arriveDayOffset>sleeper.departDayOffset?"次日 ":"")+sleeper.arrive+' 到达</p>'+
        '</div>'+
        '<span class="sleep-duration">'+durationText(sleeperMinutes)+'</span>'+
      '</div>';
  }

  modalContent.innerHTML=
    '<div class="modal-body">'+
      '<div class="modal-kicker">'+p.direction.replace("-"," → ")+' · '+weekdaysText(p)+'运行</div>'+
      '<div class="modal-heading-row">'+
        '<h2 id="modalTitle" class="modal-title">'+
          p.depart.time+' '+p.depart.station+
          '<span class="muted-arrow">→</span>'+
          '次日 '+p.arrive.time+' '+p.arrive.station+
        '</h2>'+
        '<div class="total-fare">'+
          '<span>参考总票价</span>'+
          '<strong>'+fareText(fareTotal)+'</strong>'+
          '<small>动卧 + 接驳二等座</small>'+
        '</div>'+
      '</div>'+
      '<p class="modal-subtitle">'+p.name+(tight?" · 含紧张换乘，建议购票前再次核对":"")+'</p>'+

      '<div class="modal-stats">'+
        '<div class="stat"><span>总行程</span><strong>'+durationText(tripDuration(p))+'</strong></div>'+
        '<div class="stat"><span>站内换乘</span><strong>'+transferCount+' 次</strong></div>'+
        '<div class="stat"><span>动卧睡眠段</span><strong>'+durationText(sleeperMinutes)+'</strong></div>'+
      '</div>'+

      sleepFocus+
      '<div class="journey-title">完整行程</div>'+
      '<div class="journey">'+journey+'</div>'+
      '<div class="modal-note">'+DATA.meta.fareNote+'<br>时刻表用于长期方案速查，不代表实时余票。铁路调图、节假日或临时加开时，请以购票当天 12306 显示为准。</div>'+
    '</div>';

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(function(){modalClose.focus();});
}

function closeTripModal(){
  if(!modal.classList.contains("is-open")) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
  if(lastFocusedBar){
    const target=lastFocusedBar;
    lastFocusedBar=null;
    setTimeout(function(){target.focus({preventScroll:true});},180);
  }
}

function getDayWidth(){
  return Number(getComputedStyle(document.documentElement).getPropertyValue("--day-width").replace("px",""))||440;
}

function centerAll(){
  document.querySelectorAll(".scroller").forEach(function(s){
    s.scrollLeft=(BASE_WEEK_OFFSET*7-1)*getDayWidth();
  });
}

hideTight.addEventListener("change",function(){
  closeTripModal();
  render();
  requestAnimationFrame(centerAll);
});
todayBtn.addEventListener("click",centerAll);
modalClose.addEventListener("click",closeTripModal);
modalBackdrop.addEventListener("click",closeTripModal);
document.addEventListener("keydown",function(e){
  if(e.key==="Escape") closeTripModal();
});

init().catch(function(err){
  planner.innerHTML='<div class="empty">'+err.message+'<br>请通过 HTTP 服务打开本页面，而不是直接双击 file://。</div>';
});

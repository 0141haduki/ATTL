window.addEventListener('error',function(e){
  const box=document.getElementById('jsError');
  if(box){box.hidden=false;box.textContent='ATTLの読み込みエラー: '+(e.message||'不明なエラー');}
});
function uid(){return 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
const KEY='attl-v0.2';
const defaults={settings:{sleepStart:'12:00',sleepEnd:'19:00',subjects:[{id:'financial',name:'財務会計論',symbol:'○',hasCalc:true},{id:'management',name:'管理会計論',symbol:'●',hasCalc:true},{id:'company',name:'企業法',symbol:'□',hasCalc:false},{id:'audit',name:'監査論',symbol:'△',hasCalc:false},{id:'tax',name:'租税法',symbol:'×',hasCalc:true},{id:'business',name:'経営学',symbol:'▷',hasCalc:true},{id:'english',name:'英語',symbol:'E',hasCalc:false}]},presets:[{id:'p1',name:'都町 夜勤',place:'都町',start:'21:00',end:'08:00',out:60,back:60,transport:'P'}],work:{},days:{}};
const $=id=>document.getElementById(id);const clone=o=>JSON.parse(JSON.stringify(o));let state=load(),selected=new Set(),pending=null,pendingSubject=null;let weekMode='rolling',weekAnchor=null;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(!x)return clone(defaults);return {...clone(defaults),...x,settings:{...clone(defaults.settings),...(x.settings||{}),subjects:(x.settings&&x.settings.subjects)||clone(defaults.settings.subjects)}}}catch{return clone(defaults)}}function save(){localStorage.setItem(KEY,JSON.stringify(state))}

function normalizeHalfWidthText(value){
  if(value==null)return '';
  return String(value)
    .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/：/g,':')
    .replace(/[－ー―‐–—]/g,'-')
    .replace(/[〜～]/g,'~')
    .replace(/　/g,' ');
}
function installNormalizer(){
  ['editMaterial','editDetail','presetName','workPlace'].forEach(id=>{
    let el=$(id);if(!el)return;
    el.addEventListener('blur',()=>{el.value=normalizeHalfWidthText(el.value)})
  });
}
function mondayOf(dateStr){let d=new Date(dateStr+'T00:00:00'),n=d.getDay(),diff=n===0?-6:1-n;d.setDate(d.getDate()+diff);return ds(d)}function ds(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}function addDay(date,n){let d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return ds(d)}function day(date){let d=state.days[date]||(state.days[date]={plan:[],actual:[],note:'',adjust:'',reasons:[]});if(!Array.isArray(d.reasons))d.reasons=[];return d}function tm(t){let[a,b]=t.split(':').map(Number);return a*60+b}function mt(m){m=((Math.round(m)%1440)+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}function dur(a,b){return Math.max(0,tm(b)-tm(a))}function sub(id){return state.settings.subjects.find(s=>s.id===id)||state.settings.subjects[0]}function overlap(date,mode,start,end,ignore){let s=tm(start),e=tm(end);if(e<=s)return true;return day(date)[mode].some(b=>b.id!==ignore&&s<tm(b.end)&&tm(b.start)<e)}
function switchView(id){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  if(id==='week')renderWeek();
  if(id==='day')renderDay();
  if(id==='work')renderCalendar();
  if(id==='settings')renderSubjects();
  if(id==='check')renderCheck();
  if(id==='adjust')renderAdjust();
}
function init(){let today=ds();weekAnchor=mondayOf(today);$('dayDate').value=today;$('workMonth').value=today.slice(0,7);$('sleepStart').value=state.settings.sleepStart;$('sleepEnd').value=state.settings.sleepEnd;['planHours','actualHours'].forEach(id=>{for(let i=0;i<24;i++){let s=document.createElement('span');s.textContent=i;$(id).append(s)}});for(let i=0;i<24;i++){let s=document.createElement('span');s.textContent=i;$('weekHours').append(s)}bind();installNormalizer();autoMigrate();renderPicker();renderWeek();renderDay();renderPresets();renderCalendar();renderSubjects();setInterval(()=>{autoMigrate();if($('day').classList.contains('active'))renderDay();if($('week').classList.contains('active'))renderWeek()},60000)}
function bind(){
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));

if($('openTodayEdit'))$('openTodayEdit').onclick=()=>{$('dayDate').value=ds();switchView('day')};
if($('openWorkSettings'))$('openWorkSettings').onclick=()=>switchView('work');
if($('settingsWorkOpen'))$('settingsWorkOpen').onclick=()=>switchView('work');
if($('settingsSleepJump'))$('settingsSleepJump').onclick=()=>{document.querySelector('#settings .two .panel')?.scrollIntoView({behavior:'smooth'})};
if($('settingsSubjectsJump'))$('settingsSubjectsJump').onclick=()=>{$('subjectSettings')?.scrollIntoView({behavior:'smooth'})};
if($('copyReviewGPT'))$('copyReviewGPT').onclick=async()=>{let t=buildReviewGPTText($('dayDate').value);try{await navigator.clipboard.writeText(t);alert('GPT復習用テキストをコピーしました。')}catch{prompt('このテキストをコピーしてください。',t)}};
if($('copyWeeklyGPT'))$('copyWeeklyGPT').onclick=async()=>{let t=buildWeeklyGPTText();try{await navigator.clipboard.writeText(t);alert('直近7日のGPT分析用テキストをコピーしました。')}catch{prompt('このテキストをコピーしてください。',t)}};
if($('saveWeeklyAdjust'))$('saveWeeklyAdjust').onclick=()=>{state.settings.weeklyAdjust=$('weeklyAdjust').value.trim();save();renderAdjust()};

$('rollingWeekBtn').onclick=()=>{weekMode='rolling';$('rollingWeekBtn').classList.add('activeMode');$('calendarWeekBtn').classList.remove('activeMode');['prevWeekBtn','currentWeekBtn','nextWeekBtn'].forEach(id=>$(id).classList.add('hidden'));renderWeek()};
$('calendarWeekBtn').onclick=()=>{weekMode='calendar';weekAnchor=mondayOf(ds());$('calendarWeekBtn').classList.add('activeMode');$('rollingWeekBtn').classList.remove('activeMode');['prevWeekBtn','currentWeekBtn','nextWeekBtn'].forEach(id=>$(id).classList.remove('hidden'));renderWeek()};
$('prevWeekBtn').onclick=()=>{weekAnchor=addDay(weekAnchor,-7);renderWeek()};
$('nextWeekBtn').onclick=()=>{weekAnchor=addDay(weekAnchor,7);renderWeek()};
$('currentWeekBtn').onclick=()=>{weekAnchor=mondayOf(ds());renderWeek()};
$('todayBtn').onclick=()=>{$('dayDate').value=ds();switchView('day')};
$('backWeek').onclick=()=>switchView('week');
$('dayDate').onchange=renderDay;
$('copyYesterday').onclick=copyYesterdayPlan;
$('addActual').onclick=openNewActualDialog;
$('note').onchange=saveNotes;
$('adjust').onchange=saveNotes;
$('typePicker').querySelectorAll('button').forEach(b=>b.onclick=()=>finishNew(b.dataset.type));
bindSelection();
$('closeDialog').onclick=()=>$('editDialog').close();
$('saveEdit').onclick=saveEdit;
$('deleteBlock').onclick=deleteEdit;
$('migrateBtn').onclick=migrateFromDialog;
$('duplicatePlan').onclick=duplicateCurrentPlan;
$('editSubject').onchange=refreshMaterialSuggestions;
$('workMonth').onchange=()=>{selected.clear();renderCalendar()};
$('clearSelected').onclick=()=>{selected.clear();renderCalendar()};
$('clearWorkSelected').onclick=clearSelectedWork;
$('savePreset').onclick=savePreset;
$('saveSleep').onclick=()=>{state.settings.sleepStart=$('sleepStart').value;state.settings.sleepEnd=$('sleepEnd').value;save();renderWeek();renderDay()};
$('addSubject').onclick=()=>{state.settings.subjects.push({id:uid(),name:'新しい科目',symbol:'・',hasCalc:false});save();renderSubjects();renderPicker()}
}
function saveNotes(){let d=day($('dayDate').value);d.note=$('note').value;d.adjust=$('adjust').value;save()}

const CHECK_REASONS=['計画過大','仕事','睡眠','着手できず','科目回避','体調','その他'];
function renderReasonButtons(){
  let w=$('reasonButtons'),d=day($('dayDate').value);w.innerHTML='';
  CHECK_REASONS.forEach(reason=>{let b=document.createElement('button');b.textContent=reason;if(d.reasons.includes(reason))b.classList.add('selected');b.onclick=()=>{let i=d.reasons.indexOf(reason);if(i>=0)d.reasons.splice(i,1);else d.reasons.push(reason);save();renderReasonButtons()};w.append(b)})
}
function renderWeek(){autoMigrate();let board=$('weekBoard');board.innerHTML='';let today=ds(),wd=['日','月','火','水','木','金','土'];let startDate=weekMode==='rolling'?today:weekAnchor;if(weekMode==='rolling'){$('weekTitle').textContent='今日を含む7日間';$('weekSubtitle').textContent='今日から7日先まで。日付を押すと編集できます。'}else{let ed=addDay(startDate,6),sdObj=new Date(startDate+'T00:00:00'),edObj=new Date(ed+'T00:00:00');$('weekTitle').textContent=`週参照 ${sdObj.getMonth()+1}/${sdObj.getDate()}〜${edObj.getMonth()+1}/${edObj.getDate()}`;$('weekSubtitle').textContent='月曜日〜日曜日のPLAN / DO。過去週も日付から編集できます。'}for(let i=0;i<7;i++){let date=addDay(startDate,i),d=new Date(date+'T00:00:00'),wrap=document.createElement('div');wrap.className='weekDay'+(date===today?' today':'');let label=document.createElement('div');label.className='weekLabel';let p=day(date).plan.reduce((a,b)=>a+dur(b.start,b.end),0),a=day(date).actual.reduce((x,b)=>x+dur(b.start,b.end),0);label.innerHTML=`<strong>${d.getMonth()+1}/${d.getDate()}（${wd[d.getDay()]}）${date===today?' 今日':''}</strong><small>予定 ${(p/60).toFixed(1)}h / 実績 ${(a/60).toFixed(1)}h</small>`;label.onclick=()=>{$('dayDate').value=date;switchView('day')};let lines=document.createElement('div');lines.className='weekLines';for(let mode of ['plan','actual']){let line=document.createElement('div');line.className='weekLine';line.innerHTML=`<span class="tag">${mode==='plan'?'PLAN':'DO'}</span>`;renderDerived(date,line);renderBlocks(date,mode,line,true);lines.append(line)}wrap.append(label,lines);board.append(wrap)}}
function renderDay(){autoMigrate();let date=$('dayDate').value,d=day(date);$('note').value=d.note||'';$('adjust').value=d.adjust||'';for(let [mode,id] of [['plan','planTrack'],['actual','actualTrack']]){let tr=$(id);tr.querySelectorAll('.study,.derived').forEach(n=>n.remove());renderDerived(date,tr);renderBlocks(date,mode,tr,false)}renderPlanDetailList(date);renderActualDetailList(date);renderDiff(date);renderReviewSummary(date);renderReasonButtons();let p=d.plan.reduce((a,b)=>a+dur(b.start,b.end),0),a=d.actual.reduce((x,b)=>x+dur(b.start,b.end),0);$('planMin').textContent=p+'分';$('actualMin').textContent=a+'分';$('rate').textContent=p?Math.round(a/p*100)+'%':'—';hidePickers()}
function renderDerived(date,target){addDerived(target,'sleep',state.settings.sleepStart,state.settings.sleepEnd,'');let ass=state.work[date];if(ass){let p=state.presets.find(x=>x.id===ass.presetId);if(p){let out=mt(tm(p.start)-Number(p.out));addDerived(target,'commute',out,p.start,'通勤 '+p.transport);if(tm(p.end)>tm(p.start)){addDerived(target,'work',p.start,p.end,p.place);addDerived(target,'commute',p.end,mt(tm(p.end)+Number(p.back)),'通勤 '+p.transport)}else addDerived(target,'work',p.start,'23:59',p.place)}}let prev=state.work[addDay(date,-1)];if(prev){let p=state.presets.find(x=>x.id===prev.presetId);if(p&&tm(p.end)<=tm(p.start)){addDerived(target,'work','00:00',p.end,p.place);addDerived(target,'commute',p.end,mt(tm(p.end)+Number(p.back)),'通勤 '+p.transport)}}}
function addDerived(target,kind,start,end,label){let s=tm(start),e=tm(end);if(e<=s)return;let x=document.createElement('div');x.className='derived '+kind;x.style.left=(s/1440*100)+'%';x.style.width=((e-s)/1440*100)+'%';x.textContent=label;target.append(x)}
function renderBlocks(date,mode,target,compact){day(date)[mode].forEach(b=>{let s=tm(b.start),e=tm(b.end),x=document.createElement('div'),sj=sub(b.subjectId);x.className='study '+(mode==='actual'?'actual ':'')+(b.place==='outside'?'outside':'');x.style.left=(s/1440*100)+'%';x.style.width=((e-s)/1440*100)+'%';let full=[sj.name,b.material,b.detail].filter(Boolean).join(' / ');x.title=`${b.start}〜${b.end} ${full}`;x.innerHTML=`<span class="symbol">${sj.symbol}</span>`;if(!compact){let l=document.createElement('div'),r=document.createElement('div');l.className='handle left';r.className='handle right';x.append(l,r);x.onclick=e=>{if(x.dataset.dragging==='1')return;e.stopPropagation();openDialog(mode,b.id)};if(mode==='plan')bindPlanMove(x,b,date)}else{x.onclick=e=>{e.stopPropagation();$('dayDate').value=date;switchView('day');setTimeout(()=>openDialog(mode,b.id),0)}}target.append(x)})}
function renderPlanDetailList(date){let w=$('planDetailList');if(!w)return;w.innerHTML='';let blocks=day(date).plan;if(!blocks.length){w.innerHTML='<span class="muted">予定詳細はありません。</span>';return}blocks.forEach(b=>{let sj=sub(b.subjectId),item=document.createElement('div');item.className='detailItem';let detail=[b.material,b.detail].filter(Boolean).join(' / ')||'詳細なし';item.innerHTML=`<strong>${b.start}〜${b.end}</strong><span class="detailSymbol">${sj.symbol}</span><div class="detailText">${detail}<small>${sj.name} / ${b.type==='calc'?'計算':'理論'}${b.studyKind==='review'?' / 復習':''}${b.place==='outside'?' / 自宅外':''}</small></div>`;item.onclick=()=>openDialog('plan',b.id);w.append(item)})}

function renderActualDetailList(date){
  let w=$('actualDetailList');if(!w)return;w.innerHTML='';let blocks=day(date).actual;
  if(!blocks.length){w.innerHTML='<span class="muted">実績はまだありません。</span>';return}
  blocks.slice().sort((a,b)=>tm(a.start)-tm(b.start)).forEach(b=>{
    let sj=sub(b.subjectId),item=document.createElement('div');item.className='detailItem';
    let detail=[b.material,b.detail].filter(Boolean).join(' / ')||'詳細なし';
    let source=b.sourcePlanId?'':' <span class="actualNewMark">予定外</span>';
    item.innerHTML=`<strong>${b.start}〜${b.end}</strong><span class="detailSymbol">${sj.symbol}</span><div class="detailText">${detail}${source}<small>${sj.name} / ${b.type==='calc'?'計算':'理論'}${b.studyKind==='review'?' / 復習':''}${b.place==='outside'?' / 自宅外':''}</small></div>`;
    item.onclick=()=>openDialog('actual',b.id);w.append(item)
  })
}
function renderDiff(date){
  let d=day(date),pTotal=d.plan.reduce((a,b)=>a+dur(b.start,b.end),0),aTotal=d.actual.reduce((a,b)=>a+dur(b.start,b.end),0),delta=aTotal-pTotal;
  $('diffSummary').textContent=`総時間：予定 ${pTotal}分 → 実績 ${aTotal}分（${delta>=0?'+':''}${delta}分）`;
  let by={};state.settings.subjects.forEach(s=>by[s.id]={p:0,a:0,s});
  d.plan.forEach(b=>{if(!by[b.subjectId])by[b.subjectId]={p:0,a:0,s:sub(b.subjectId)};by[b.subjectId].p+=dur(b.start,b.end)});
  d.actual.forEach(b=>{if(!by[b.subjectId])by[b.subjectId]={p:0,a:0,s:sub(b.subjectId)};by[b.subjectId].a+=dur(b.start,b.end)});
  let sw=$('diffSubjects');sw.innerHTML='';
  Object.values(by).filter(x=>x.p||x.a).forEach(x=>{let e=document.createElement('div');e.className='diffSubject';let dd=x.a-x.p;e.innerHTML=`<strong>${x.s.symbol} ${x.s.name}</strong><small>予定 ${x.p}分 / 実績 ${x.a}分 / 差 ${dd>=0?'+':''}${dd}分</small>`;sw.append(e)});
  let notes=[];
  let today=ds(),nowDate=new Date(),now=nowDate.getHours()*60+nowDate.getMinutes();
  d.plan.forEach(p=>{
    let due=date<today||(date===today&&tm(p.end)<=now);
    if(!due)return;
    let a=d.actual.find(x=>x.sourcePlanId===p.id);
    if(!a){notes.push(`${sub(p.subjectId).symbol} 未着手 ${p.start}〜${p.end}`);return}
    let delay=tm(a.start)-tm(p.start),lenDiff=dur(a.start,a.end)-dur(p.start,p.end);
    if(Math.abs(delay)>=5)notes.push(`${sub(p.subjectId).symbol} 開始 ${delay>0?'+':''}${delay}分`);
    if(Math.abs(lenDiff)>=5)notes.push(`${sub(p.subjectId).symbol} 学習時間 ${lenDiff>0?'+':''}${lenDiff}分`);
    if(a.subjectId!==p.subjectId)notes.push(`${sub(p.subjectId).symbol}→${sub(a.subjectId).symbol} 科目変更`)
  });
  d.actual.filter(a=>!a.sourcePlanId).forEach(a=>notes.push(`${sub(a.subjectId).symbol} 予定外 ${dur(a.start,a.end)}分`));
  let nw=$('diffNotes');nw.innerHTML='';
  if(!notes.length){nw.innerHTML='<span class="muted">現在、目立つ差分はありません。</span>';return}
  notes.forEach(t=>{let c=document.createElement('span');c.className='diffChip';c.textContent=t;nw.append(c)})
}
function renderReviewSummary(date){
  let el=$('reviewSummary');if(!el)return;let d=day(date),p=d.plan.filter(b=>b.studyKind==='review').reduce((a,b)=>a+dur(b.start,b.end),0),a=d.actual.filter(b=>b.studyKind==='review').reduce((x,b)=>x+dur(b.start,b.end),0),total=d.actual.reduce((x,b)=>x+dur(b.start,b.end),0);let ratio=total?Math.round(a/total*100):0;el.innerHTML=`<div><strong>復習PLAN</strong><span>${p}分</span></div><div><strong>復習DO</strong><span>${a}分</span></div><div><strong>実績内比率</strong><span>${ratio}%</span></div>`}
function buildReviewGPTText(date){let d=day(date),items=d.actual.filter(b=>b.studyKind==='review');let lines=[`ATTL 復習セッション ${date}`,'目的：固定間隔のノルマ消化ではなく、検索練習で弱点を確認する。未消化の復習を翌日に借金として繰り越さない。',''];if(!items.length)lines.push('本日の復習実績はまだありません。');else items.forEach(b=>{let s=sub(b.subjectId);lines.push(`・${s.name}（${b.type==='calc'?'計算':'理論'}） ${b.start}-${b.end} ${b.material||''} ${b.detail||''}`.trim())});lines.push('','理論は、まず答えを見せず一問ずつ質問してください。私の回答後に、正しい点・不足・誤りを短く評価し、必要なら追加質問してください。計算は会話だけで習得扱いにせず、再演習が必要な論点を区別してください。');return lines.join('\n')}
function bindSelection(){let tr=$('planTrack'),sel=$('selection'),down=false,start=0,cur=0;function pos(ev){let r=tr.getBoundingClientRect(),x=Math.max(0,Math.min(r.width,ev.clientX-r.left));return Math.min(1410,Math.floor((x/r.width)*48)*30)}function show(){let a=Math.min(start,cur),b=Math.max(start,cur);sel.classList.remove('hidden');sel.style.left=(a/1440*100)+'%';sel.style.width=(Math.max(30,b-a)/1440*100)+'%'}tr.onpointerdown=e=>{if(e.target.closest('.study'))return;down=true;start=pos(e);cur=start+30;tr.setPointerCapture(e.pointerId);show()};tr.onpointermove=e=>{if(!down)return;let m=pos(e);cur=m>=start?Math.min(1440,m+30):m;show()};tr.onpointerup=e=>{if(!down)return;down=false;let a=Math.min(start,cur),b=Math.max(start,cur);if(b-a<30){hidePickers();return}let st=mt(a),en=b===1440?'23:59':mt(b);if(overlap($('dayDate').value,'plan',st,en)){alert('学習予定は重複できません。');hidePickers();return}pending={a,b};$('subjectPicker').classList.remove('hidden')}}

function renderCheck(){
  let p=0,a=0,r=0;
  for(let i=0;i<7;i++){
    let d=day(addDay(ds(),-i));
    p+=d.plan.reduce((s,b)=>s+dur(b.start,b.end),0);
    a+=d.actual.reduce((s,b)=>s+dur(b.start,b.end),0);
    r+=d.actual.filter(b=>b.studyKind==='review').reduce((s,b)=>s+dur(b.start,b.end),0);
  }
  if($('checkPlan7'))$('checkPlan7').textContent=(p/60).toFixed(1)+'h';
  if($('checkActual7'))$('checkActual7').textContent=(a/60).toFixed(1)+'h';
  if($('checkReview7'))$('checkReview7').textContent=(r/60).toFixed(1)+'h';
  if($('checkReviewRatio7'))$('checkReviewRatio7').textContent=(a?Math.round(r/a*100):0)+'%';
}
function buildWeeklyGPTText(){
  let lines=['ATTL 直近7日 CHECK','目的：合格可能性を高めるため、PLAN/DOと復習配分を分析する。復習未消化を借金として扱わない。',''];
  for(let i=6;i>=0;i--){
    let date=addDay(ds(),-i),d=day(date);
    let p=d.plan.reduce((s,b)=>s+dur(b.start,b.end),0);
    let a=d.actual.reduce((s,b)=>s+dur(b.start,b.end),0);
    let r=d.actual.filter(b=>b.studyKind==='review').reduce((s,b)=>s+dur(b.start,b.end),0);
    lines.push(`${date}: PLAN ${p}分 / DO ${a}分 / 復習 ${r}分 / メモ ${d.note||'-'} / 調整 ${d.adjust||'-'}`);
  }
  lines.push('','分析してほしいこと：①最大のボトルネック ②復習過多/不足の兆候 ③次週に試す変更を最大3個。相関だけで因果を断定しない。');
  return lines.join('\\n');
}
function renderAdjust(){
  if(!state.settings.weeklyAdjust)state.settings.weeklyAdjust='';
  if($('weeklyAdjust'))$('weeklyAdjust').value=state.settings.weeklyAdjust;
  if($('weeklyAdjustSaved'))$('weeklyAdjustSaved').textContent=state.settings.weeklyAdjust?'保存済み：次週PLAN作成時に確認する調整があります。':'まだ次週の調整は保存されていません。';
}

function renderPicker(){let p=$('subjectPicker');p.innerHTML='';state.settings.subjects.forEach(s=>{let b=document.createElement('button');b.innerHTML=`${s.symbol}<span class="hint">${s.name}</span>`;let timer;b.onpointerdown=()=>timer=setTimeout(()=>b.classList.add('hinting'),500);b.onpointerup=b.onpointerleave=()=>{clearTimeout(timer);setTimeout(()=>b.classList.remove('hinting'),600)};b.onclick=()=>{pendingSubject=s.id;if(s.hasCalc)$('typePicker').classList.remove('hidden');else finishNew('theory')};p.append(b)})}
function hidePickers(){$('subjectPicker').classList.add('hidden');$('typePicker').classList.add('hidden');$('selection').classList.add('hidden');pending=null;pendingSubject=null}function finishNew(type){if(!pending||!pendingSubject)return;let st=mt(pending.a),en=pending.b===1440?'23:59':mt(pending.b),date=$('dayDate').value;if(overlap(date,'plan',st,en)){alert('学習予定は重複できません。');return}day(date).plan.push({id:uid(),subjectId:pendingSubject,type,start:st,end:en,material:'',detail:'',place:'home',studyKind:'normal',actualGenerated:false});day(date).plan.sort((a,b)=>tm(a.start)-tm(b.start));save();hidePickers();renderDay();renderWeek()}
function bindPlanMove(el,b,date){let tr=$('planTrack'),timer,moving=false,resizing=null,x0=0,s0=0,e0=0;el.onpointerdown=e=>{if(e.target.classList.contains('handle')){resizing=e.target.classList.contains('left')?'left':'right';x0=e.clientX;s0=tm(b.start);e0=tm(b.end);el.setPointerCapture(e.pointerId);e.stopPropagation();return}x0=e.clientX;s0=tm(b.start);e0=tm(b.end);timer=setTimeout(()=>{moving=true;el.dataset.dragging='1';el.setPointerCapture(e.pointerId)},450)};el.onpointermove=e=>{if(!moving&&!resizing)return;let r=tr.getBoundingClientRect(),delta=Math.round(((e.clientX-x0)/r.width)*48)*30;if(moving){let len=e0-s0,ns=Math.max(0,Math.min(1440-len,s0+delta));ns=Math.round(ns/30)*30,ne=ns+len,en=ne===1440?'23:59':mt(ne);if(!overlap(date,'plan',mt(ns),en,b.id))el.style.left=(ns/1440*100)+'%'}else if(resizing==='left'){let ns=Math.round(Math.max(0,Math.min(e0-30,s0+delta))/30)*30;if(!overlap(date,'plan',mt(ns),b.end,b.id)){el.style.left=(ns/1440*100)+'%';el.style.width=((e0-ns)/1440*100)+'%'}}else{let ne=Math.round(Math.max(s0+30,Math.min(1439,e0+delta))/30)*30;ne=Math.min(1439,ne);if(!overlap(date,'plan',b.start,mt(ne),b.id))el.style.width=((ne-s0)/1440*100)+'%'}};el.onpointerup=e=>{clearTimeout(timer);let r=tr.getBoundingClientRect(),delta=Math.round(((e.clientX-x0)/r.width)*48)*30;if(moving){let len=e0-s0,ns=Math.max(0,Math.min(1440-len,s0+delta));ns=Math.round(ns/30)*30,ne=ns+len,en=ne===1440?'23:59':mt(ne);if(!overlap(date,'plan',mt(ns),en,b.id)){b.start=mt(ns);b.end=en}moving=false;setTimeout(()=>el.dataset.dragging='0',50)}else if(resizing){if(resizing==='left'){let ns=Math.round(Math.max(0,Math.min(e0-30,s0+delta))/30)*30;if(!overlap(date,'plan',mt(ns),b.end,b.id))b.start=mt(ns)}else{let ne=Math.round(Math.max(s0+30,Math.min(1439,e0+delta))/30)*30;ne=Math.min(1439,ne);if(!overlap(date,'plan',b.start,mt(ne),b.id))b.end=mt(ne)}resizing=null}save();renderDay();renderWeek()};el.onpointerleave=()=>clearTimeout(timer)}
function fillSubjectSelect(){
  $('editSubject').innerHTML='';
  state.settings.subjects.forEach(s=>{let o=document.createElement('option');o.value=s.id;o.textContent=s.symbol+' '+s.name;$('editSubject').append(o)})
}
function refreshMaterialSuggestions(){
  let sid=$('editSubject').value,materials=[],date=$('dayDate').value;
  Object.keys(state.days).sort().reverse().forEach(k=>{
    let d=day(k);[...(d.plan||[]),...(d.actual||[])].forEach(b=>{if(b.subjectId===sid&&b.material&&!materials.includes(b.material))materials.push(b.material)})
  });
  let dl=$('materialSuggestions');dl.innerHTML='';materials.slice(0,12).forEach(m=>{let o=document.createElement('option');o.value=m;dl.append(o)})
}
function openDialog(mode,id){
  let b=day($('dayDate').value)[mode].find(x=>x.id===id);if(!b)return;
  $('editMode').value=mode;$('editId').value=id;$('dialogTitle').textContent=mode==='plan'?'学習予定の詳細':'学習実績の詳細';
  fillSubjectSelect();$('editSubject').value=b.subjectId;$('editType').value=b.type;$('editStart').value=b.start;$('editEnd').value=b.end;$('editMaterial').value=b.material||'';$('editDetail').value=b.detail||'';$('editPlace').value=b.place||'home';$('editStudyKind').value=b.studyKind||'normal';
  $('migrateBtn').style.display=mode==='plan'?'inline-block':'none';$('duplicatePlan').style.display=mode==='plan'?'inline-block':'none';$('deleteBlock').style.display='inline-block';refreshMaterialSuggestions();$('editDialog').showModal()
}
function openNewActualDialog(){
  let n=new Date(),m=n.getHours()*60+n.getMinutes(),start=Math.max(0,m-30);
  fillSubjectSelect();$('editMode').value='actual-new';$('editId').value='';$('dialogTitle').textContent='予定外実績を追加';
  $('editSubject').value=state.settings.subjects[0]?.id||'';$('editType').value='theory';$('editStart').value=mt(start);$('editEnd').value=mt(m);$('editMaterial').value='';$('editDetail').value='';$('editPlace').value='home';$('editStudyKind').value='normal';
  $('migrateBtn').style.display='none';$('duplicatePlan').style.display='none';$('deleteBlock').style.display='none';refreshMaterialSuggestions();$('editDialog').showModal()
}
function saveEdit(){
  let date=$('dayDate').value,mode=$('editMode').value,id=$('editId').value,st=$('editStart').value,en=$('editEnd').value;
  if(!st||!en||tm(en)<=tm(st)){alert('終了は開始より後にしてください。');return}
  if(mode==='plan'&&(tm(st)%30!==0||tm(en)%30!==0)){alert('予定は30分単位で入力してください。');return}
  let targetMode=mode==='actual-new'?'actual':mode;
  if(overlap(date,targetMode,st,en,mode==='actual-new'?null:id)){alert('学習科目同士は重複できません。');return}
  let data={subjectId:$('editSubject').value,type:$('editType').value,start:st,end:en,material:normalizeHalfWidthText($('editMaterial').value).trim(),detail:normalizeHalfWidthText($('editDetail').value).trim(),place:$('editPlace').value,studyKind:$('editStudyKind').value};
  if(mode==='actual-new'){
    day(date).actual.push({id:uid(),sourcePlanId:null,...data});day(date).actual.sort((a,b)=>tm(a.start)-tm(b.start))
  }else{
    let b=day(date)[mode].find(x=>x.id===id);if(!b)return;Object.assign(b,data)
  }
  save();$('editDialog').close();renderDay();renderWeek()
}
function deleteEdit(){
  let mode=$('editMode').value;if(mode==='actual-new'){$('editDialog').close();return}
  let id=$('editId').value,arr=day($('dayDate').value)[mode],i=arr.findIndex(x=>x.id===id);
  if(i>=0)arr.splice(i,1);save();$('editDialog').close();renderDay();renderWeek()
}
function duplicateCurrentPlan(){
  let date=$('dayDate').value,id=$('editId').value,p=day(date).plan.find(x=>x.id===id);if(!p)return;
  let len=dur(p.start,p.end),start=tm(p.end),found=null;
  for(let s=start;s+len<=1440;s+=30){let e=s+len,en=e===1440?'23:59':mt(e);if(!overlap(date,'plan',mt(s),en)){found={s,e,en};break}}
  if(!found){alert('この日の後ろに同じ長さの空き時間がありません。');return}
  day(date).plan.push({...p,id:uid(),start:mt(found.s),end:found.en,actualGenerated:false});
  day(date).plan.sort((a,b)=>tm(a.start)-tm(b.start));save();$('editDialog').close();renderDay();renderWeek()
}
function copyYesterdayPlan(){
  let date=$('dayDate').value,prev=addDay(date,-1),src=day(prev).plan;
  if(!src.length){alert('昨日の学習予定はありません。');return}
  if(day(date).plan.length&&!confirm('今日の予定を昨日の予定で置き換えますか？'))return;
  day(date).plan=src.map(p=>({...p,id:uid(),actualGenerated:false}));
  save();renderDay();renderWeek()
}
function migrateFromDialog(){let date=$('dayDate').value,id=$('editId').value,p=day(date).plan.find(x=>x.id===id);if(!p)return;if(p.actualGenerated){alert('既に実績へ移行済みです。');return}let en=p.end;if(date===ds()){let n=new Date(),m=n.getHours()*60+n.getMinutes();if(m>tm(p.start)&&m<tm(p.end))en=mt(m)}if(overlap(date,'actual',p.start,en)){alert('実績側で時間が重複します。');return}day(date).actual.push({id:uid(),sourcePlanId:p.id,subjectId:p.subjectId,type:p.type,start:p.start,end:en,material:p.material||'',detail:p.detail||'',place:p.place||'home',studyKind:p.studyKind||'normal'});p.actualGenerated=true;save();$('editDialog').close();renderDay();renderWeek()}
function autoMigrate(){let today=ds(),n=new Date(),now=n.getHours()*60+n.getMinutes();Object.keys(state.days).forEach(date=>day(date).plan.forEach(p=>{if(p.actualGenerated)return;let due=date<today||(date===today&&tm(p.end)<=now);if(!due||overlap(date,'actual',p.start,p.end))return;day(date).actual.push({id:uid(),sourcePlanId:p.id,subjectId:p.subjectId,type:p.type,start:p.start,end:p.end,material:p.material||'',detail:p.detail||'',place:p.place||'home',studyKind:p.studyKind||'normal'});p.actualGenerated=true}));save()}
function clearSelectedWork(){
  if(!selected.size){alert('先に勤務を消したい日を選択してください。');return}
  let count=0;selected.forEach(date=>{if(state.work[date]){delete state.work[date];count++}});
  selected.clear();save();renderCalendar();renderWeek();renderDay();
  if(!count)alert('選択した日には勤務予定がありませんでした。')
}
function renderCalendar(){let month=$('workMonth').value;if(!month)return;let[y,m]=month.split('-').map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0),cal=$('calendar');cal.innerHTML='';['日','月','火','水','木','金','土'].forEach(x=>{let d=document.createElement('div');d.className='dow';d.textContent=x;cal.append(d)});for(let i=0;i<first.getDay();i++)cal.append(document.createElement('div'));for(let n=1;n<=last.getDate();n++){let date=`${y}-${String(m).padStart(2,'0')}-${String(n).padStart(2,'0')}`,c=document.createElement('div');c.className='dayCell'+(selected.has(date)?' selected':'')+(state.work[date]?' assigned':'');let a=state.work[date],txt='';if(a){let p=state.presets.find(x=>x.id===a.presetId);if(p)txt=`${p.name}<br>${p.start}→${p.end}`}c.innerHTML=`<strong>${n}</strong><div class="assignment">${txt}</div>`;c.onclick=()=>{selected.has(date)?selected.delete(date):selected.add(date);renderCalendar()};cal.append(c)}}
function renderPresets(){let w=$('presetList');w.innerHTML='';state.presets.forEach(p=>{let row=document.createElement('div');row.className='presetRow';let b=document.createElement('button');b.className='presetBtn';b.innerHTML=`<strong>${p.name}</strong><small>${p.place} ${p.start}→${p.end} / 往${p.out}分・復${p.back}分 / ${p.transport}</small>`;b.onclick=()=>{if(!selected.size){alert('先に勤務日を選択してください。');return}selected.forEach(d=>state.work[d]={presetId:p.id});selected.clear();save();renderCalendar();renderWeek();renderDay()};let del=document.createElement('button');del.className='presetDelete';del.textContent='消去';del.onclick=()=>{let used=Object.values(state.work).some(a=>a.presetId===p.id);let msg=used?'この勤務セットは既に勤務予定で使われています。セットだけ消去し、登録済み勤務予定は残しますか？':'この勤務セットを消去しますか？';if(!confirm(msg))return;state.presets=state.presets.filter(x=>x.id!==p.id);save();renderPresets()};row.append(b,del);w.append(row)})}
function savePreset(){let name=normalizeHalfWidthText($('presetName').value).trim(),place=normalizeHalfWidthText($('workPlace').value).trim();if(!name||!place){alert('名前と勤務場所を入力してください。');return}state.presets.push({id:uid(),name,place,start:$('workStart').value,end:$('workEnd').value,out:Number($('outMin').value||0),back:Number($('backMin').value||0),transport:$('transport').value});save();renderPresets()}
function renderSubjects(){let w=$('subjectSettings');w.innerHTML='';state.settings.subjects.forEach((s,i)=>{let r=document.createElement('div');r.className='subjectRow',name=document.createElement('input'),sym=document.createElement('input'),lab=document.createElement('label'),cb=document.createElement('input'),del=document.createElement('button');name.value=s.name;sym.value=s.symbol;sym.maxLength=3;lab.className='toggle';cb.type='checkbox';cb.checked=!!s.hasCalc;lab.append(cb,document.createTextNode('理論・計算'));del.textContent='削除';del.className='danger';name.onchange=()=>{s.name=name.value.trim()||'科目';save();renderPicker()};sym.onchange=()=>{s.symbol=sym.value||'・';save();renderPicker();renderDay();renderWeek()};cb.onchange=()=>{s.hasCalc=cb.checked;save()};del.onclick=()=>{let used=Object.values(state.days).some(d=>[...(d.plan||[]),...(d.actual||[])].some(b=>b.subjectId===s.id));if(used){alert('既に記録で使っている科目は削除できません。');return}state.settings.subjects.splice(i,1);save();renderSubjects();renderPicker()};r.append(name,sym,lab,del);w.append(r)})}
init();

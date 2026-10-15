/* =========================================================
   FL Clone v10.4 – Core
   ========================================================= */

const TRACKS = [
  {id:'kick',name:'Kick',color:'#ff8a00',type:'drum',instr:'kick'},
  {id:'snare',name:'Snare',color:'#ffb347',type:'drum',instr:'snare'},
  {id:'hat',name:'Hat',color:'#ffd47a',type:'drum',instr:'hat'},
  {id:'openhat',name:'OpenHat',color:'#e0b040',type:'drum',instr:'openhat'},
  {id:'clap',name:'Clap',color:'#ff6b6b',type:'drum',instr:'clap'},
  {id:'tom',name:'Tom',color:'#ff9f43',type:'drum',instr:'tom'},
  {id:'bass',name:'Bass',color:'#4ecdc4',type:'melodic',instr:'bass',range:[24,48]},
  {id:'lead',name:'Lead',color:'#a78bfa',type:'melodic',instr:'lead',range:[48,72]},
  {id:'piano',name:'Piano',color:'#f7b731',type:'melodic',instr:'piano',range:[48,84]},
  {id:'pad',name:'Pad',color:'#6c5ce7',type:'melodic',instr:'pad',range:[48,84]},
  {id:'pluck',name:'Pluck',color:'#00b894',type:'melodic',instr:'pluck',range:[48,84]},
  {id:'arp',name:'Arp',color:'#fd79a8',type:'melodic',instr:'arp',range:[60,84]},
  {id:'s1',name:'Sample 1',color:'#00d2d3',type:'sample'},
  {id:'s2',name:'Sample 2',color:'#48dbfb',type:'sample'},
  {id:'s3',name:'Sample 3',color:'#c8d6e5',type:'sample'},
  {id:'s4',name:'Sample 4',color:'#8395a7',type:'sample'},
];
TRACKS.forEach(t=>{
  t.volume=0.8;t.pan=0;t.send=0.15;t.mute=false;t.solo=false;
  t.effects=[];t.filter={cutoff:20000,q:0.7};
});
const PATTERN_IDS=['A','B','C','D'];
const BLACK_PC=[1,3,6,8,10];
const PX_PER_STEP=20;
const PX_PER_STEP_AUTO=14;

let bpm=120,master=0.8,reverbAmount=0.35,swing=0;
let stepCount=16,currentPattern='A',currentView='rack';
let playMode='pattern';
let patterns={};
let song={blocks:[],loopStart:0,loopEnd:0};
let automation={lanes:[]};
let samples={};
let soloActive=false;
let songSelectedIds=new Set();
let selectedAutoLaneId=null;
let currentSongStep=0;
let currentFxTrackId=null;
let humanizeTiming=0,humanizeVelocity=0,projectSeed='flclone-default';

/* ---------- Undo/Redo ---------- */
const HISTORY_MAX=80;
let historyStack=[],historyIndex=-1,historySuspended=false;

function snapshotState(){
  return JSON.stringify({patterns,song,automation,tracks:TRACKS.map(t=>({
    id:t.id,volume:t.volume,pan:t.pan,send:t.send,mute:t.mute,solo:t.solo,
    filter:t.filter,effects:t.effects
  }))});
}
function restoreState(json){
  const s=JSON.parse(json);
  patterns=s.patterns; song=s.song; automation=s.automation;
  if(Array.isArray(s.tracks)){
    s.tracks.forEach(st=>{
      const t=TRACKS.find(x=>x.id===st.id); if(!t) return;
      t.volume=st.volume;t.pan=st.pan;t.send=st.send;t.mute=!!st.mute;t.solo=!!st.solo;
      t.filter=st.filter||{cutoff:20000,q:0.7};t.effects=Array.isArray(st.effects)?st.effects:[];
    });
  }
  historySuspended=true;
  rebuildAudioGraphs(); rebuildRack(); rebuildMixer(); rebuildSong(); rebuildAutoView();
  if(prEditor) closePianoRoll();
  historySuspended=false;
}
function pushHistory(){
  if(historySuspended) return;
  const snap=snapshotState();
  if(historyIndex>=0 && historyStack[historyIndex]===snap) return;
  historyStack=historyStack.slice(0,historyIndex+1);
  historyStack.push(snap);
  if(historyStack.length>HISTORY_MAX) historyStack.shift();
  historyIndex=historyStack.length-1;
}
function undoHistory(){
  if(historyIndex<=0) return false;
  historyIndex--; restoreState(historyStack[historyIndex]); autoSave(); toast('Undo','info'); return true;
}
function redoHistory(){
  if(historyIndex>=historyStack.length-1) return false;
  historyIndex++; restoreState(historyStack[historyIndex]); autoSave(); toast('Redo','info'); return true;
}
function initHistory(){ historyStack=[snapshotState()]; historyIndex=0; }

/* ---------- Utility ---------- */
function genId(prefix){
  try{ if(window.crypto&&typeof crypto.randomUUID==='function') return prefix+'_'+crypto.randomUUID(); }catch(e){}
  return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}
function hashToUnit(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return ((h>>>0)/4294967296);
}
function stepRandom(seed,trackId,songStep){ return hashToUnit(seed+'|'+trackId+'|'+songStep); }

/* ---------- Effekte ---------- */
const EFFECT_DEFS={
  eq:{name:'EQ (3-Band)',defaults:{lowFreq:200,lowGain:0,midFreq:1000,midGain:0,midQ:1,highFreq:4000,highGain:0},params:[
    {key:'lowFreq',label:'Low Hz',min:30,max:500,step:1,unit:'Hz'},
    {key:'lowGain',label:'Low dB',min:-24,max:24,step:0.5,unit:'dB'},
    {key:'midFreq',label:'Mid Hz',min:200,max:6000,step:10,unit:'Hz'},
    {key:'midGain',label:'Mid dB',min:-24,max:24,step:0.5,unit:'dB'},
    {key:'midQ',label:'Mid Q',min:0.1,max:10,step:0.1,unit:''},
    {key:'highFreq',label:'High Hz',min:1500,max:16000,step:100,unit:'Hz'},
    {key:'highGain',label:'High dB',min:-24,max:24,step:0.5,unit:'dB'}],
    build(c,p){const lo=c.createBiquadFilter();lo.type='lowshelf';const mi=c.createBiquadFilter();mi.type='peaking';const hi=c.createBiquadFilter();hi.type='highshelf';lo.connect(mi);mi.connect(hi);
      const apply=par=>{lo.frequency.value=par.lowFreq;lo.gain.value=par.lowGain;mi.frequency.value=par.midFreq;mi.gain.value=par.midGain;mi.Q.value=par.midQ;hi.frequency.value=par.highFreq;hi.gain.value=par.highGain;};
      apply(p);
      return{input:lo,output:hi,update:apply,getAudioParam(k){const m={lowFreq:lo.frequency,lowGain:lo.gain,midFreq:mi.frequency,midGain:mi.gain,midQ:mi.Q,highFreq:hi.frequency,highGain:hi.gain};return m[k]||null;},destroy(){try{lo.disconnect();mi.disconnect();hi.disconnect();}catch(e){}}};}},
  delay:{name:'Delay',defaults:{division:'1/8',feedback:0.35,wet:0.3},params:[
    {key:'division',label:'Division',type:'select',options:['1/16','1/8','1/4','1/8.','1/4.','1/8T','1/4T']},
    {key:'feedback',label:'Feedback',min:0,max:0.9,step:0.01,unit:''},
    {key:'wet',label:'Wet',min:0,max:1,step:0.01,unit:''}],
    build(c,p){const inp=c.createGain(),out=c.createGain(),dry=c.createGain(),wet=c.createGain();const dl=c.createDelay(2),fb=c.createGain();const dp=c.createBiquadFilter();dp.type='lowpass';dp.frequency.value=4000;
      inp.connect(dry);dry.connect(out);inp.connect(dl);dl.connect(dp);dp.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(out);
      const sec=(d,b)=>{const t=60/b;switch(d){case '1/16':return t/4;case '1/8':return t/2;case '1/4':return t;case '1/8.':return t*0.75;case '1/4.':return t*1.5;case '1/8T':return t/3;case '1/4T':return t*2/3;}return t/2;};
      const apply=par=>{const t=c.currentTime;dl.delayTime.setTargetAtTime(Math.min(1.9,Math.max(0.01,sec(par.division,bpm))),t,0.01);fb.gain.setTargetAtTime(Math.max(0,Math.min(0.9,par.feedback)),t,0.01);wet.gain.setTargetAtTime(Math.max(0,Math.min(1,par.wet)),t,0.01);dry.gain.setTargetAtTime(1-Math.max(0,Math.min(1,par.wet))*0.5,t,0.01);};
      apply(p);
      return{input:inp,output:out,update:apply,getAudioParam(k){if(k==='feedback')return fb.gain;if(k==='wet')return wet.gain;return null;},destroy(){try{[inp,out,dry,wet,dl,fb,dp].forEach(n=>n.disconnect());}catch(e){}}};}},
  dist:{name:'Distortion',defaults:{drive:0.3,wet:1.0,out:0.8},params:[
    {key:'drive',label:'Drive',min:0,max:1,step:0.01,unit:''},
    {key:'wet',label:'Wet',min:0,max:1,step:0.01,unit:''},
    {key:'out',label:'Out',min:0,max:1.5,step:0.01,unit:''}],
    build(c,p){const inp=c.createGain(),out=c.createGain(),dry=c.createGain(),wet=c.createGain();const sh=c.createWaveShaper();const pre=c.createGain(),post=c.createGain();sh.oversample='4x';
      inp.connect(dry);dry.connect(out);inp.connect(pre);pre.connect(sh);sh.connect(post);post.connect(wet);wet.connect(out);
      const curve=a=>{const k=a*50,n=1024,arr=new Float32Array(n);for(let i=0;i<n;i++){const x=(i*2)/n-1;arr[i]=(1+k)*x/(1+k*Math.abs(x));}return arr;};
      const apply=par=>{const d=Math.max(0,Math.min(1,par.drive));sh.curve=curve(d);pre.gain.value=1+d*8;post.gain.value=1/(1+d*3);wet.gain.value=Math.max(0,Math.min(1,par.wet));dry.gain.value=1-wet.gain.value;out.gain.value=Math.max(0,Math.min(1.5,par.out));};
      apply(p);
      return{input:inp,output:out,update:apply,getAudioParam(k){if(k==='wet')return wet.gain;if(k==='out')return out.gain;return null;},destroy(){try{[inp,out,dry,wet,sh,pre,post].forEach(n=>n.disconnect());}catch(e){}}};}},
  comp:{name:'Compressor',defaults:{threshold:-18,knee:12,ratio:4,attack:0.01,release:0.25,makeup:1.0},params:[
    {key:'threshold',label:'Threshold',min:-60,max:0,step:0.5,unit:'dB'},
    {key:'knee',label:'Knee',min:0,max:40,step:0.5,unit:'dB'},
    {key:'ratio',label:'Ratio',min:1,max:20,step:0.5,unit:':1'},
    {key:'attack',label:'Attack',min:0,max:0.5,step:0.001,unit:'s'},
    {key:'release',label:'Release',min:0.01,max:1.5,step:0.01,unit:'s'},
    {key:'makeup',label:'Makeup',min:0,max:3,step:0.01,unit:''}],
    build(c,p){const cp=c.createDynamicsCompressor(),mu=c.createGain();cp.connect(mu);
      const apply=par=>{cp.threshold.value=Math.max(-100,Math.min(0,par.threshold));cp.knee.value=Math.max(0,Math.min(40,par.knee));cp.ratio.value=Math.max(1,Math.min(20,par.ratio));cp.attack.value=Math.max(0,Math.min(1,par.attack));cp.release.value=Math.max(0,Math.min(1,par.release));mu.gain.value=Math.max(0,Math.min(3,par.makeup));};
      apply(p);
      return{input:cp,output:mu,update:apply,getAudioParam(k){const m={threshold:cp.threshold,knee:cp.knee,ratio:cp.ratio,attack:cp.attack,release:cp.release,makeup:mu.gain};return m[k]||null;},destroy(){try{cp.disconnect();mu.disconnect();}catch(e){}}};}},
  chorus:{name:'Chorus',defaults:{rate:1.5,depth:0.003,wet:0.4,spread:0.005},params:[
    {key:'rate',label:'Rate Hz',min:0.05,max:8,step:0.05,unit:'Hz'},
    {key:'depth',label:'Depth',min:0.0001,max:0.01,step:0.0001,unit:'s'},
    {key:'wet',label:'Wet',min:0,max:1,step:0.01,unit:''},
    {key:'spread',label:'Spread',min:0,max:0.02,step:0.0001,unit:'s'}],
    build(c,p){const inp=c.createGain(),out=c.createGain(),dry=c.createGain(),wet=c.createGain();const dL=c.createDelay(0.1),dR=c.createDelay(0.1);const lfo=c.createOscillator();const gL=c.createGain(),gR=c.createGain();const mg=c.createChannelMerger(2);
      lfo.type='sine';lfo.frequency.value=p.rate;lfo.connect(gL);lfo.connect(gR);gL.gain.value=p.depth;gR.gain.value=-p.depth;
      dL.delayTime.value=0.02;dR.delayTime.value=0.025;gL.connect(dL.delayTime);gR.connect(dR.delayTime);
      inp.connect(dry);dry.connect(out);inp.connect(dL);inp.connect(dR);dL.connect(mg,0,0);dR.connect(mg,0,1);mg.connect(wet);wet.connect(out);lfo.start();
      const apply=par=>{const t=c.currentTime;lfo.frequency.setTargetAtTime(Math.max(0.01,par.rate),t,0.05);const d=Math.max(0.0001,Math.min(0.01,par.depth));gL.gain.setTargetAtTime(d,t,0.05);gR.gain.setTargetAtTime(-d,t,0.05);const sp=Math.max(0,Math.min(0.02,par.spread||0));dL.delayTime.setTargetAtTime(0.02+sp,t,0.05);dR.delayTime.setTargetAtTime(0.025-sp,t,0.05);wet.gain.setTargetAtTime(Math.max(0,Math.min(1,par.wet)),t,0.05);dry.gain.setTargetAtTime(1-Math.max(0,Math.min(1,par.wet))*0.5,t,0.05);};
      apply(p);
      return{input:inp,output:out,update:apply,getAudioParam(k){if(k==='rate')return lfo.frequency;if(k==='depth')return gL.gain;if(k==='wet')return wet.gain;return null;},destroy(){try{lfo.stop();}catch(e){}try{[inp,out,dry,wet,dL,dR,lfo,gL,gR,mg].forEach(n=>n.disconnect());}catch(e){}}};}}
};
function createEffect(type){const d=EFFECT_DEFS[type];if(!d)return null;return{id:genId('fx'),type,enabled:true,params:JSON.parse(JSON.stringify(d.defaults))};}
function buildTrackChain(c,track){
  const built=[],fxMap={};const iG=c.createGain(),oG=c.createGain();let cur=iG;
  (track.effects||[]).forEach(fx=>{if(!fx.enabled)return;const d=EFFECT_DEFS[fx.type];if(!d)return;
    try{const m=d.build(c,fx.params||d.defaults);cur.connect(m.input);built.push(m);fxMap[fx.id]={module:m,def:d,fx};cur=m.output;}catch(e){console.warn('fx',e);}});
  cur.connect(oG);return{input:iG,output:oG,nodes:built,fxMap};
}

/* ---------- Pattern ---------- */
function createEmptyPattern(){
  const p={steps:{},pianoRoll:{}};
  TRACKS.forEach(t=>{
    if(t.type==='melodic'){p.steps[t.id]=new Array(64).fill(0);p.pianoRoll[t.id]=[];}
    else p.steps[t.id]=new Array(64).fill(null);
  });
  return p;
}
function defaultStep(){return{on:true,vel:100,prob:1,ratchet:1,offset:0,accent:false};}
function isStepOn(p,tid,st){const s=p.steps[tid][st];if(s===null||s===undefined||s===0)return false;if(s===1)return true;return !!s.on;}
function getStepData(p,tid,st){const s=p.steps[tid][st];if(s===null||s===undefined||s===0)return null;if(s===1)return defaultStep();return s;}
function repeat16(pat){const o=new Array(64).fill(0);for(let i=0;i<64;i++)o[i]=pat[i%16];return o;}
function toStepArray(b16){const o=new Array(64).fill(null);for(let i=0;i<64;i++)if(b16[i%16])o[i]=defaultStep();return o;}
function syncMelodicSteps(p){
  TRACKS.forEach(t=>{
    if(t.type!=='melodic')return;
    const m=new Array(64).fill(0);
    p.pianoRoll[t.id].forEach(n=>{const s=Math.max(0,Math.min(63,Math.floor(n.start)));m[s]=1;});
    p.steps[t.id]=m;
  });
}
function migrateStepIndexedToFlat(stepArr){
  const notes=[];if(!Array.isArray(stepArr))return notes;
  for(let step=0;step<stepArr.length;step++){
    const a=stepArr[step];if(!Array.isArray(a))continue;
    for(const n of a){
      if(typeof n==='number')notes.push({id:genId('n'),start:step,len:1,midi:n,vel:100});
      else if(n&&typeof n.midi==='number')notes.push({id:genId('n'),start:step,len:Math.max(1,n.len|0||1),midi:n.midi,vel:n.vel|0||100});
    }
  }
  return notes;
}
function initDefaultPatterns(){
  PATTERN_IDS.forEach(id=>patterns[id]=createEmptyPattern());
  const A=patterns.A;
  A.steps.kick=toStepArray([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]);
  A.steps.snare=toStepArray([0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]);
  A.steps.hat=toStepArray([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]);
  A.steps.clap=toStepArray([0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0]);
  A.pianoRoll.bass.push(
    {id:genId('n'),start:0,len:2,midi:36,vel:110},
    {id:genId('n'),start:6,len:2,midi:43,vel:100},
    {id:genId('n'),start:8,len:2,midi:36,vel:110},
    {id:genId('n'),start:14,len:2,midi:41,vel:100});
  A.pianoRoll.piano.push(
    {id:genId('n'),start:0,len:2,midi:60,vel:90},
    {id:genId('n'),start:4,len:2,midi:64,vel:90},
    {id:genId('n'),start:8,len:4,midi:67,vel:95});
  syncMelodicSteps(A);
}

/* ---------- Automation ---------- */
function getAutoTargets(){
  const list=[{id:'master.volume',label:'Master · Volume',min:0,max:1.2,def:0.8,resolve:g=>g.master.gain}];
  TRACKS.forEach(t=>{
    list.push({id:'track.'+t.id+'.volume',label:t.name+' · Volume',min:0,max:1.2,def:t.volume,resolve:g=>g.buses[t.id]?.gain?.gain});
    list.push({id:'track.'+t.id+'.pan',label:t.name+' · Pan',min:-1,max:1,def:t.pan,resolve:g=>g.buses[t.id]?.panner?.pan});
    list.push({id:'track.'+t.id+'.send',label:t.name+' · Send',min:0,max:1,def:t.send,resolve:g=>g.buses[t.id]?.send?.gain});
    list.push({id:'track.'+t.id+'.cutoff',label:t.name+' · Cutoff',min:20,max:20000,def:20000,curveLog:true,resolve:g=>g.buses[t.id]?.filter?.frequency});
    list.push({id:'track.'+t.id+'.q',label:t.name+' · Q',min:0.1,max:20,def:0.7,resolve:g=>g.buses[t.id]?.filter?.Q});
    (t.effects||[]).forEach(fx=>{
      const d=EFFECT_DEFS[fx.type];if(!d)return;
      d.params.forEach(p=>{
        if(p.type==='select')return;
        list.push({id:'fx.'+t.id+'.'+fx.id+'.'+p.key,label:t.name+' · '+d.name+' · '+p.label,min:p.min,max:p.max,def:(fx.params&&fx.params[p.key])??p.min,
          resolve:g=>{const m=g._fxMaps&&g._fxMaps[t.id];if(!m)return null;const e=m[fx.id];if(!e||!e.module.getAudioParam)return null;return e.module.getAudioParam(p.key);}});
      });
    });
  });
  return list;
}
function findAutoTarget(id){return getAutoTargets().find(t=>t.id===id);}
function createAutoLane(tid){
  const t=findAutoTarget(tid);if(!t)return null;
  const dn=(t.def-t.min)/(t.max-t.min);
  return{id:genId('lane'),target:tid,curve:'linear',clips:[{id:genId('ac'),startStep:0,lengthSteps:64,points:[{step:0,value:dn},{step:64,value:dn}]}]};
}
function catmullRom(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);}
function evalAutoLaneFloat(lane,s){
  const tgt=findAutoTarget(lane.target);if(!tgt)return null;
  const clip=lane.clips.find(cl=>s>=cl.startStep&&s<cl.startStep+cl.lengthSteps);if(!clip)return null;
  const local=s-clip.startStep;
  const pts=clip.points.slice().sort((a,b)=>a.step-b.step);if(!pts.length)return null;
  if(local<=pts[0].step)return tgt.min+pts[0].value*(tgt.max-tgt.min);
  if(local>=pts[pts.length-1].step)return tgt.min+pts[pts.length-1].value*(tgt.max-tgt.min);
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];
    if(local>=a.step&&local<=b.step){
      const sp=b.step-a.step;
      if(sp<=0)return tgt.min+b.value*(tgt.max-tgt.min);
      const t=(local-a.step)/sp;let norm;
      if(lane.curve==='hold')norm=a.value;
      else if(lane.curve==='smooth'){const p0=i>0?pts[i-1].value:a.value,p1=a.value,p2=b.value,p3=i<pts.length-2?pts[i+2].value:b.value;norm=catmullRom(p0,p1,p2,p3,t);norm=Math.max(0,Math.min(1,norm));}
      else norm=a.value+(b.value-a.value)*t;
      if(tgt.curveLog){const lo=Math.log(Math.max(1,tgt.min)),hi=Math.log(tgt.max);return Math.exp(lo+norm*(hi-lo));}
      return tgt.min+norm*(tgt.max-tgt.min);
    }
  }
  return null;
}
function applyAutomationForStep(graph,step,time,stepDur){
  const targets=getAutoTargets();
  automation.lanes.forEach(lane=>{
    const tgt=targets.find(t=>t.id===lane.target);if(!tgt)return;
    const param=tgt.resolve(graph);if(!param)return;
    try{param.cancelScheduledValues(time);}catch(e){}
    if(lane.curve==='smooth'){
      const SD=6,subD=stepDur/SD;
      for(let i=0;i<=SD;i++){
        const sf=step+i/SD;const v=evalAutoLaneFloat(lane,sf);const val=v==null?tgt.def:v;
        if(i===0)param.setValueAtTime(val,time);else param.linearRampToValueAtTime(val,time+i*subD);
      }
    } else {
      const v0=evalAutoLaneFloat(lane,step),v1=evalAutoLaneFloat(lane,step+1);
      const a=v0==null?tgt.def:v0,b=v1==null?a:v1;
      param.setValueAtTime(a,time);
      if(stepDur>0)param.linearRampToValueAtTime(b,time+stepDur);
    }
  });
}

/* ---------- Serialize / Migrate ---------- */
function serialize(){
  return{
    version:12,
    transport:{bpm,master,reverbAmount,swing,stepCount,humanizeTiming,humanizeVelocity,projectSeed},
    currentPattern,playMode,
    tracks:TRACKS.map(t=>({id:t.id,volume:t.volume,pan:t.pan,send:t.send,mute:t.mute,solo:t.solo,filter:{cutoff:t.filter.cutoff,q:t.filter.q},effects:(t.effects||[]).map(fx=>({id:fx.id,type:fx.type,enabled:!!fx.enabled,params:JSON.parse(JSON.stringify(fx.params))}))})),
    patterns:PATTERN_IDS.reduce((acc,id)=>{
      const p=patterns[id];const sp={steps:{},pianoRoll:{}};
      TRACKS.forEach(t=>{
        sp.steps[t.id]=p.steps[t.id].slice(0,64).map(v=>{
          if(v===null||v===undefined||v===0||v===1)return v===1?defaultStep():null;
          return{on:!!v.on,vel:v.vel|0||100,prob:(typeof v.prob==='number')?v.prob:1,ratchet:v.ratchet|0||1,offset:(typeof v.offset==='number')?v.offset:0,accent:!!v.accent};
        });
        if(t.type==='melodic')sp.pianoRoll[t.id]=p.pianoRoll[t.id].map(n=>({id:n.id,start:n.start,len:n.len,midi:n.midi,vel:n.vel}));
      });
      acc[id]=sp;return acc;
    },{}),
    song:{blocks:song.blocks.map(b=>({id:b.id,patternId:b.patternId,startStep:b.startStep,lengthSteps:b.lengthSteps,sourceOffsetSteps:b.sourceOffsetSteps||0})),loopStart:song.loopStart,loopEnd:song.loopEnd},
    automation:{lanes:automation.lanes.map(l=>({id:l.id,target:l.target,curve:l.curve,clips:l.clips.map(cl=>({id:cl.id,startStep:cl.startStep,lengthSteps:cl.lengthSteps,points:cl.points.map(pt=>({step:pt.step,value:pt.value}))}))}))},
    samples:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,{id:v.id,name:v.name}])),
    metadata:{createdAt:new Date().toISOString(),app:'fl-clone',appVersion:'10.3.0'}
  };
}
function migrateV5toV6(d){return{version:6,transport:{bpm:d.bpm??120,master:d.master??0.8,reverbAmount:d.reverbAmount??0.35,swing:d.swing??0,stepCount:d.stepCount??16},currentPattern:PATTERN_IDS.includes(d.currentPattern)?d.currentPattern:'A',playMode:'pattern',tracks:d.tracks||[],patterns:d.patterns||{},song:{clips:[],loopStart:0,loopEnd:0},samples:(()=>{const o={};if(d.sampleNames)Object.entries(d.sampleNames).forEach(([id,name])=>{o[id]={id:null,name,missing:true};});return o;})(),metadata:{migratedFrom:5}};}
function migrateV6toV7(d){const o=JSON.parse(JSON.stringify(d));o.version=7;if(o.patterns){PATTERN_IDS.forEach(id=>{const p=o.patterns[id];if(!p||!p.pianoRoll)return;TRACKS.forEach(t=>{if(t.type!=='melodic')return;const a=p.pianoRoll[t.id];if(Array.isArray(a)&&a.length<=64&&a.every(el=>Array.isArray(el)))p.pianoRoll[t.id]=migrateStepIndexedToFlat(a);else if(Array.isArray(a))p.pianoRoll[t.id]=a.map(n=>({id:n.id||genId('n'),start:n.start|0,len:Math.max(1,n.len|0||1),midi:n.midi|0,vel:n.vel|0||100}));else p.pianoRoll[t.id]=[];});});}return o;}
function migrateV7toV8(d){const o=JSON.parse(JSON.stringify(d));o.version=8;if(Array.isArray(o.tracks))o.tracks.forEach(t=>{if(!Array.isArray(t.effects))t.effects=[];});if(!o.automation)o.automation={lanes:[]};return o;}
function migrateV8toV9(d){const o=JSON.parse(JSON.stringify(d));o.version=9;if(Array.isArray(o.tracks))o.tracks.forEach(t=>{if(!t.filter)t.filter={cutoff:20000,q:0.7};});if(o.automation&&Array.isArray(o.automation.lanes))o.automation.lanes.forEach(l=>{if(l.curve!=='hold'&&l.curve!=='smooth')l.curve='linear';});return o;}
function migrateV9toV10(d){const o=JSON.parse(JSON.stringify(d));o.version=10;if(o.patterns){PATTERN_IDS.forEach(id=>{const p=o.patterns[id];if(!p||!p.steps)return;TRACKS.forEach(t=>{if(t.type==='melodic')return;const a=p.steps[t.id];if(!Array.isArray(a))return;p.steps[t.id]=a.map(v=>{if(v===1)return defaultStep();if(v===0||v===null||v===undefined)return null;if(typeof v==='object')return{on:v.on!==false,vel:v.vel|0||100,prob:(typeof v.prob==='number')?Math.max(0,Math.min(1,v.prob)):1,ratchet:Math.max(1,Math.min(8,v.ratchet|0||1)),offset:Math.max(-0.5,Math.min(0.5,(typeof v.offset==='number')?v.offset:0)),accent:!!v.accent};return null;});});});}if(!o.transport)o.transport={};if(typeof o.transport.humanizeTiming!=='number')o.transport.humanizeTiming=0;if(typeof o.transport.humanizeVelocity!=='number')o.transport.humanizeVelocity=0;if(typeof o.transport.projectSeed!=='string')o.transport.projectSeed='flclone-default';return o;}
function migrateV10toV11(d){const o=JSON.parse(JSON.stringify(d));o.version=11;if(o.song&&Array.isArray(o.song.clips))o.song.clips.forEach(c=>{if(typeof c.sourceOffsetSteps!=='number')c.sourceOffsetSteps=0;});return o;}
function migrateV11toV12(d){
  const o=JSON.parse(JSON.stringify(d));o.version=12;
  if(o.song&&Array.isArray(o.song.clips)){
    const map=new Map();
    o.song.clips.forEach(c=>{
      if(!c||!c.patternId)return;
      const key=c.patternId+'|'+(c.startStep|0);
      const ex=map.get(key);
      const len=Math.max(1,c.lengthSteps|0||16);
      const off=Math.max(0,c.sourceOffsetSteps|0||0);
      if(!ex||len>ex.lengthSteps){
        map.set(key,{id:ex?.id||genId('block'),patternId:c.patternId,startStep:c.startStep|0,lengthSteps:len,sourceOffsetSteps:off});
      }
    });
    o.song.blocks=Array.from(map.values());
    delete o.song.clips;
  }
  if(o.song&&!Array.isArray(o.song.blocks))o.song.blocks=[];
  return o;
}
function apply(data){
  if(!data||typeof data!=='object')return{ok:false,msg:'Kein Objekt'};
  let proj=data;
  if(proj.version===5){proj=migrateV5toV6(proj);toast('Migration v5→v6','info');}
  if(proj.version===6){proj=migrateV6toV7(proj);toast('Migration v6→v7','info');}
  if(proj.version===7){proj=migrateV7toV8(proj);toast('Migration v7→v8','info');}
  if(proj.version===8){proj=migrateV8toV9(proj);toast('Migration v8→v9','info');}
  if(proj.version===9){proj=migrateV9toV10(proj);toast('Migration v9→v10','info');}
  if(proj.version===10){proj=migrateV10toV11(proj);toast('Migration v10→v11','info');}
  if(proj.version===11){proj=migrateV11toV12(proj);toast('Migration v11→v12','info');}
  if(proj.version!==12)return{ok:false,msg:'Unbekannte Version: '+data.version};

  const tr=proj.transport||{};
  if(typeof tr.bpm==='number')bpm=tr.bpm;
  if(typeof tr.master==='number')master=tr.master;
  if(typeof tr.reverbAmount==='number')reverbAmount=tr.reverbAmount;
  if(typeof tr.swing==='number')swing=tr.swing;
  if([16,32,64].includes(tr.stepCount))stepCount=tr.stepCount;
  if(typeof tr.humanizeTiming==='number')humanizeTiming=tr.humanizeTiming;
  if(typeof tr.humanizeVelocity==='number')humanizeVelocity=tr.humanizeVelocity;
  if(typeof tr.projectSeed==='string')projectSeed=tr.projectSeed;
  if(PATTERN_IDS.includes(proj.currentPattern))currentPattern=proj.currentPattern;
  if(['pattern','song'].includes(proj.playMode))playMode=proj.playMode;

  if(Array.isArray(proj.tracks)){
    proj.tracks.forEach(t=>{
      const l=TRACKS.find(x=>x.id===t.id);if(!l)return;
      if(typeof t.volume==='number')l.volume=t.volume;
      if(typeof t.pan==='number')l.pan=t.pan;
      if(typeof t.send==='number')l.send=t.send;
      l.mute=!!t.mute;l.solo=!!t.solo;
      if(t.filter){if(typeof t.filter.cutoff==='number')l.filter.cutoff=Math.max(20,Math.min(20000,t.filter.cutoff));if(typeof t.filter.q==='number')l.filter.q=Math.max(0.1,Math.min(20,t.filter.q));}
      if(Array.isArray(t.effects))l.effects=t.effects.filter(fx=>fx&&EFFECT_DEFS[fx.type]).map(fx=>({id:fx.id||genId('fx'),type:fx.type,enabled:fx.enabled!==false,params:Object.assign({},EFFECT_DEFS[fx.type].defaults,fx.params||{})}));
      else l.effects=[];
    });
  }
  if(proj.patterns){
    PATTERN_IDS.forEach(id=>{
      const src=proj.patterns[id];if(!src)return;
      const p=createEmptyPattern();
      TRACKS.forEach(t=>{
        if(src.steps&&Array.isArray(src.steps[t.id])){
          const a=src.steps[t.id];
          for(let i=0;i<64;i++){
            const v=a[i];
            if(t.type==='melodic')p.steps[t.id][i]=v?1:0;
            else if(v===1)p.steps[t.id][i]=defaultStep();
            else if(v===0||v==null)p.steps[t.id][i]=null;
            else if(typeof v==='object')p.steps[t.id][i]={on:v.on!==false,vel:v.vel|0||100,prob:(typeof v.prob==='number')?v.prob:1,ratchet:v.ratchet|0||1,offset:(typeof v.offset==='number')?v.offset:0,accent:!!v.accent};
            else p.steps[t.id][i]=null;
          }
        }
        if(t.type==='melodic'&&src.pianoRoll&&Array.isArray(src.pianoRoll[t.id]))
          p.pianoRoll[t.id]=src.pianoRoll[t.id].map(n=>({id:n.id||genId('n'),start:Math.max(0,n.start|0),len:Math.max(1,n.len|0||1),midi:n.midi|0,vel:n.vel|0||100}));
      });
      syncMelodicSteps(p);patterns[id]=p;
    });
  }
  song={blocks:[],loopStart:0,loopEnd:0};
  if(proj.song){
    if(Array.isArray(proj.song.blocks)){
      song.blocks=proj.song.blocks.filter(b=>b&&typeof b.startStep==='number'&&PATTERN_IDS.includes(b.patternId)).map(b=>({
        id:b.id||genId('block'),patternId:b.patternId,startStep:Math.max(0,b.startStep|0),
        lengthSteps:Math.max(1,b.lengthSteps|0||16),
        sourceOffsetSteps:Math.max(0,typeof b.sourceOffsetSteps==='number'?b.sourceOffsetSteps|0:0)
      }));
    }
    if(typeof proj.song.loopStart==='number')song.loopStart=proj.song.loopStart;
    if(typeof proj.song.loopEnd==='number')song.loopEnd=proj.song.loopEnd;
  }
  songSelectedIds=new Set();
  automation={lanes:[]};
  if(proj.automation&&Array.isArray(proj.automation.lanes)){
    proj.automation.lanes.forEach(l=>{
      if(!l||typeof l.target!=='string')return;
      const c=(l.curve==='hold'||l.curve==='smooth')?l.curve:'linear';
      const lane={id:l.id||genId('lane'),target:l.target,curve:c,clips:[]};
      if(Array.isArray(l.clips))l.clips.forEach(cl=>{
        if(!cl)return;
        lane.clips.push({id:cl.id||genId('ac'),startStep:Math.max(0,cl.startStep|0),lengthSteps:Math.max(1,cl.lengthSteps|0||16),points:Array.isArray(cl.points)?cl.points.filter(p=>p&&typeof p.step==='number'&&typeof p.value==='number').map(p=>({step:Math.max(0,p.step|0),value:Math.max(0,Math.min(1,p.value))})):[]});
      });
      if(findAutoTarget(lane.target))automation.lanes.push(lane);
    });
  }
  samples={};
  if(proj.samples)Object.entries(proj.samples).forEach(([tid,meta])=>{
    if(!meta||!meta.id)return;
    samples[tid]={id:meta.id,name:meta.name||'(unbekannt)',buffer:null,missing:true};
  });
  document.getElementById('bpm').value=bpm;
  document.getElementById('master').value=master;
  document.getElementById('reverbAmount').value=reverbAmount;
  document.getElementById('swing').value=Math.round(swing*100);
  document.getElementById('swingVal').textContent=Math.round(swing*100)+'%';
  document.getElementById('humanize').value=Math.round(humanizeTiming*100);
  document.getElementById('humVal').textContent=Math.round(humanizeTiming*100)+'%';
  document.getElementById('humanizeV').value=Math.round(humanizeVelocity*100);
  document.getElementById('humVVal').textContent=Math.round(humanizeVelocity*100)+'%';
  document.getElementById('loopStart').value=song.loopStart;
  document.getElementById('loopEnd').value=song.loopEnd;
  rebuildAudioGraphs();rebuildRack();rebuildMixer();rebuildSong();rebuildAutoView();
  closePianoRoll();updateSongPlayhead();setView(currentView);setPlayMode(playMode);
  initHistory();
  return{ok:true};
}

/* ---------- IndexedDB ---------- */
const DB_NAME='flclone',DB_VERSION=1,STORE='samples';
let dbPromise=null;
function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
  return dbPromise;
}
async function dbPutSample(id,name,ab){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id,name,data:ab});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
async function dbGetSample(id){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const rq=tx.objectStore(STORE).get(id);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);});}
async function dbDeleteSample(id){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
async function restoreSamplesFromDB(){
  for(const tid of Object.keys(samples)){
    const m=samples[tid];if(!m||!m.id)continue;
    try{const rec=await dbGetSample(m.id);if(!rec||!rec.data){m.missing=true;continue;}if(!ctx)initAudio();const buf=await ctx.decodeAudioData(rec.data.slice(0));m.buffer=buf;m.name=rec.name||m.name;m.missing=false;}catch(e){console.warn(e);m.missing=true;}
  }
  if(currentView==='rack')rebuildRack();
  if(currentView==='mixer')rebuildMixer();
}

/* ---------- Audio ---------- */
let ctx=null,masterGain=null,reverbBus=null,reverbReturn=null;
const buses={};
const ctxRes=new WeakMap();
function getCtxRes(c){if(!ctxRes.has(c)){const len=c.sampleRate;const buf=c.createBuffer(1,len,c.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;ctxRes.set(c,{noiseBuffer:buf});}return ctxRes.get(c);}
function createReverbImpulse(c,dur,decay){const rate=c.sampleRate,length=Math.max(1,Math.floor(rate*dur));const imp=c.createBuffer(2,length,rate);for(let ch=0;ch<2;ch++){const d=imp.getChannelData(ch);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay);}return imp;}
function buildGraph(c,opts){
  const mg=c.createGain();mg.gain.value=opts.master??0.8;mg.connect(c.destination);
  const rb=c.createGain();const conv=c.createConvolver();conv.buffer=createReverbImpulse(c,2.5,2.2);
  const rr=c.createGain();rr.gain.value=opts.reverbAmount??0.35;rb.connect(conv);conv.connect(rr);rr.connect(mg);
  const localBuses={},fxMaps={};
  (opts.tracks||TRACKS).forEach(t=>{
    const ti=c.createGain();
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=Math.max(20,Math.min(20000,t.filter?.cutoff??20000));f.Q.value=Math.max(0.1,Math.min(20,t.filter?.q??0.7));
    const chain=buildTrackChain(c,t);
    const panner=c.createStereoPanner?c.createStereoPanner():null;
    const gain=c.createGain(),send=c.createGain();
    ti.connect(f);f.connect(chain.input);
    if(panner){chain.output.connect(panner);panner.connect(gain);}else chain.output.connect(gain);
    gain.connect(mg);gain.connect(send);send.connect(rb);
    localBuses[t.id]={input:ti,filter:f,output:chain.output,panner,gain,send,_chainNodes:chain.nodes};
    fxMaps[t.id]=chain.fxMap;
    if(panner)panner.pan.value=t.pan||0;
    send.gain.value=t.send??0.15;
  });
  return{master:mg,reverbBus:rb,reverbReturn:rr,buses:localBuses,_fxMaps:fxMaps};
}
function initAudio(){if(ctx)return;ctx=new(window.AudioContext||window.webkitAudioContext)();const g=buildGraph(ctx,{master,reverbAmount,tracks:TRACKS});masterGain=g.master;reverbBus=g.reverbBus;reverbReturn=g.reverbReturn;Object.assign(buses,g.buses);buses._fxMaps=g._fxMaps;TRACKS.forEach(applyTrackGain);}
function disposeLiveGraph(){
  TRACKS.forEach(t=>{const b=buses[t.id];if(b&&b._chainNodes){b._chainNodes.forEach(n=>{try{n.destroy();}catch(e){}});b._chainNodes=null;}});
  if(ctx&&ctx.state!=='closed'){try{ctx.close();}catch(e){}}
  ctx=null;masterGain=null;reverbBus=null;reverbReturn=null;
  Object.keys(buses).forEach(k=>delete buses[k]);
}
function rebuildAudioGraphs(){
  if(ctx){disposeLiveGraph();initAudio();if(ctx.state==='suspended')ctx.resume();if(currentView==='mixer')rebuildMixer();if(currentFxTrackId)renderFxPanel();}
}
function applyTrackGain(t){const b=buses[t.id];if(!b)return;const a=(!soloActive||t.solo)&&!t.mute;b.gain.gain.value=a?t.volume:0;}
function refreshAllGains(){soloActive=TRACKS.some(t=>t.solo);TRACKS.forEach(applyTrackGain);}
function noiseSource(c){const s=c.createBufferSource();s.buffer=getCtxRes(c).noiseBuffer;return s;}
function midiToFreq(m){return 440*Math.pow(2,(m-69)/12);}
function midiToName(m){const n=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return n[m%12]+(Math.floor(m/12)-1);}

/* ---------- Instrumente ---------- */
function playKick(c,t,dest,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+0.12);g.gain.setValueAtTime(1*v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);o.connect(g).connect(dest);o.start(t);o.stop(t+0.4);}
function playSnare(c,t,dest,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));const o=c.createOscillator(),g1=c.createGain();o.type='triangle';o.frequency.value=180;g1.gain.setValueAtTime(0.5*v,t);g1.gain.exponentialRampToValueAtTime(0.001,t+0.15);o.connect(g1).connect(dest);o.start(t);o.stop(t+0.2);const n=noiseSource(c),hp=c.createBiquadFilter(),g2=c.createGain();hp.type='highpass';hp.frequency.value=1200;g2.gain.setValueAtTime(0.7*v,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.2);n.connect(hp).connect(g2).connect(dest);n.start(t);n.stop(t+0.25);}
function playHat(c,t,dest,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));const n=noiseSource(c),hp=c.createBiquadFilter(),g=c.createGain();hp.type='highpass';hp.frequency.value=7000;g.gain.setValueAtTime(0.35*v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.06);n.connect(hp).connect(g).connect(dest);n.start(t);n.stop(t+0.08);}
function playOpenHat(c,t,dest,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));const n=noiseSource(c),hp=c.createBiquadFilter(),g=c.createGain();hp.type='highpass';hp.frequency.value=6000;g.gain.setValueAtTime(0.35*v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);n.connect(hp).connect(g).connect(dest);n.start(t);n.stop(t+0.55);}
function playClap(c,t,dest,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));for(let i=0;i<3;i++){const n=noiseSource(c),bp=c.createBiquadFilter(),g=c.createGain();bp.type='bandpass';bp.frequency.value=1500;bp.Q.value=1.2;const off=i*0.012;g.gain.setValueAtTime(0.6*v,t+off);g.gain.exponentialRampToValueAtTime(0.001,t+off+0.09);n.connect(bp).connect(g).connect(dest);n.start(t+off);n.stop(t+off+0.1);}}
function playTom(c,t,dest,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(80,t+0.25);g.gain.setValueAtTime(0.8*v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);o.connect(g).connect(dest);o.start(t);o.stop(t+0.45);}
function playBass(c,t,dest,freq,vel){const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=800;f.Q.value=6;o.type='sawtooth';o.frequency.value=freq;const v=(vel??100)/127;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.6*v,t+0.01);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.connect(f).connect(g).connect(dest);o.start(t);o.stop(t+0.55);}
function playLead(c,t,dest,freq,vel){const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=freq;const v=(vel??100)/127;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.22*v,t+0.01);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);o.connect(g).connect(dest);o.start(t);o.stop(t+0.35);}
function playPiano(c,t,dest,freq,vel,dur){const v=(vel??100)/127,H=[1,2,3,5],G=[1,0.45,0.2,0.08];const d=Math.max(0.6,Math.min(1.6,(dur||0.5)+0.6));H.forEach((h,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=freq*h;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(G[i]*v,t+0.006);g.gain.exponentialRampToValueAtTime(0.001,t+d);o.connect(g).connect(dest);o.start(t);o.stop(t+d+0.05);});}
function playPad(c,t,dest,freq,vel,dur){const v=(vel??100)/127,sus=Math.max(0.5,dur||0.6);[-8,0,8].forEach(det=>{const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=1500;f.Q.value=1;o.type='sawtooth';o.frequency.value=freq*Math.pow(2,det/1200);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.12*v,t+0.25);g.gain.linearRampToValueAtTime(0.001,t+sus+0.4);o.connect(f).connect(g).connect(dest);o.start(t);o.stop(t+sus+0.5);});}
function playPluck(c,t,dest,freq,vel){const v=(vel??100)/127;const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(4000,t);f.frequency.exponentialRampToValueAtTime(500,t+0.2);o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.5*v,t+0.005);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);o.connect(f).connect(g).connect(dest);o.start(t);o.stop(t+0.35);}
function playArp(c,t,dest,freq,vel){const v=(vel??100)/127;const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();f.type='highpass';f.frequency.value=300;o.type='sawtooth';o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.3*v,t+0.005);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);o.connect(f).connect(g).connect(dest);o.start(t);o.stop(t+0.2);}
function playSampleNode(c,t,dest,buffer,vel){const v=vel==null?1:Math.max(0,Math.min(1,vel));const s=c.createBufferSource();s.buffer=buffer;if(v<1){const g=c.createGain();g.gain.value=v;s.connect(g);g.connect(dest);}else{s.connect(dest);}s.start(t);}
const DRUM_INSTRUMENTS={kick:playKick,snare:playSnare,hat:playHat,openhat:playOpenHat,clap:playClap,tom:playTom};
const MELODIC_INSTRUMENTS={bass:playBass,lead:playLead,piano:playPiano,pad:playPad,pluck:playPluck,arp:playArp};

/* ---------- Scheduler-Support ---------- */
function notesAtStep(p,tid,st){return (p.pianoRoll[tid]||[]).filter(n=>Math.floor(n.start)===st);}
function patternHasNoteAtStep(p,tid,st){return (p.pianoRoll[tid]||[]).some(n=>Math.floor(n.start)===st);}
function scheduleTrackStep(c,busMap,track,patternId,localStep,time,stepDur,absoluteStep){
  const pat=patterns[patternId];
  const absStep=(absoluteStep==null)?localStep:absoluteStep;
  if(track.type==='drum'||track.type==='sample'){
    const sd=getStepData(pat,track.id,localStep);
    if(!sd||!sd.on)return;
    if(sd.prob<1){const r=stepRandom(projectSeed,track.id,absStep);if(r>=sd.prob)return;}
    const off=(sd.offset||0)*stepDur;
    let humT=0;
    if(humanizeTiming>0){const r=stepRandom(projectSeed+'_ht',track.id,absStep);humT=((r-0.5)*2)*humanizeTiming*stepDur*0.5;}
    let vel=(sd.vel==null?100:sd.vel);
    if(sd.accent)vel=Math.min(127,vel*1.25);
    if(humanizeVelocity>0){const r=stepRandom(projectSeed+'_hv',track.id,absStep);vel=Math.max(1,Math.min(127,vel+((r-0.5)*2)*humanizeVelocity*30));}
    const base=time+off+humT;
    const rat=Math.max(1,Math.min(8,sd.ratchet||1));
    const sub=stepDur/rat;
    if(track.type==='drum'){
      const fn=DRUM_INSTRUMENTS[track.instr];if(!fn)return;
      for(let i=0;i<rat;i++){
        const t=base+i*sub;
        const tp=rat>1?(1-(i/rat)*0.4):1;
        const sv=Math.max(1,Math.min(127,vel*tp));
        fn(c,t,busMap[track.id].input,sv/127);
      }
    } else {
      const s=samples[track.id];if(!s||!s.buffer)return;
      for(let i=0;i<rat;i++){
        const t=base+i*sub;
        const tp=rat>1?(1-(i/rat)*0.4):1;
        const sv=Math.max(1,Math.min(127,vel*tp));
        playSampleNode(c,t,busMap[track.id].input,s.buffer,sv/127);
      }
    }
    return;
  }
  const notes=notesAtStep(pat,track.id,localStep);
  const fn=MELODIC_INSTRUMENTS[track.instr];
  if(fn)notes.forEach(n=>{const d=Math.max(0.05,(n.len||1))*stepDur;fn(c,time,busMap[track.id].input,midiToFreq(n.midi),n.vel,d);});
}
function getSongLength(){
  let max=64;
  song.blocks.forEach(b=>max=Math.max(max,b.startStep+b.lengthSteps));
  automation.lanes.forEach(l=>l.clips.forEach(cl=>max=Math.max(max,cl.startStep+cl.lengthSteps)));
  if(song.loopEnd>0)max=Math.max(max,song.loopEnd);
  return max;
}
/* =========================================================
   FL Clone v10.4 – UI
   ========================================================= */

/* ---------- Kontextmenü ---------- */
function showContextMenu(x,y,items){
  hideContextMenu();
  const menu=document.createElement('div');menu.className='ctx-menu';
  items.forEach(item=>{
    if(item==='---'){const s=document.createElement('div');s.className='ctx-sep';menu.appendChild(s);return;}
    if(item.header){const h=document.createElement('div');h.className='ctx-header';h.textContent=item.header;menu.appendChild(h);return;}
    const el=document.createElement('div');
    el.className='ctx-item'+(item.disabled?' disabled':'');
    const lbl=document.createElement('span');lbl.textContent=item.label;el.appendChild(lbl);
    if(item.shortcut){const sc=document.createElement('span');sc.className='ctx-shortcut';sc.textContent=item.shortcut;el.appendChild(sc);}
    if(!item.disabled){
      el.addEventListener('mousedown',ev=>ev.stopPropagation());
      el.addEventListener('click',ev=>{ev.stopPropagation();hideContextMenu();try{item.action();}catch(err){toast('Fehler: '+err.message,'error');}});
    }
    menu.appendChild(el);
  });
  document.body.appendChild(menu);
  const r=menu.getBoundingClientRect();let nx=x,ny=y;
  if(r.right>window.innerWidth-4)nx=x-r.width;
  if(r.bottom>window.innerHeight-4)ny=y-r.height;
  menu.style.left=Math.max(4,nx)+'px';menu.style.top=Math.max(4,ny)+'px';
}
function hideContextMenu(){document.querySelectorAll('.ctx-menu').forEach(m=>m.remove());}
document.addEventListener('click',hideContextMenu,true);
document.addEventListener('contextmenu',e=>{if(e.target.closest('.ctx-menu'))e.preventDefault();},true);
window.addEventListener('blur',hideContextMenu);

/* ---------- Toast / Modal ---------- */
function toast(msg,type){
  const c=document.getElementById('toastContainer');
  const el=document.createElement('div');el.className='toast'+(type?' '+type:'');el.textContent=msg;
  c.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .3s';el.style.opacity='0';setTimeout(()=>el.remove(),320);},2400);
}
const modalOverlay=document.getElementById('modalOverlay');
let micCaptureSession=null;
function showModal(title,content,actions){
  modalOverlay.innerHTML='';
  const m=document.createElement('div');m.className='modal';
  const h=document.createElement('h3');h.textContent=title;m.appendChild(h);m.appendChild(content);
  const w=document.createElement('div');w.className='modal-actions';
  actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;if(a.className)b.className=a.className;b.addEventListener('click',a.onClick);w.appendChild(b);});
  m.appendChild(w);modalOverlay.appendChild(m);modalOverlay.classList.remove('hidden');
}
function releaseMicCaptureSession(){
  const session=micCaptureSession;
  if(!session)return;
  micCaptureSession=null;
  if(session.recorder&&session.recorder.state!=='inactive'){
    try{session.recorder.onstop=null;session.recorder.stop();}catch(e){}
  }
  if(session.stream)session.stream.getTracks().forEach(track=>{try{track.stop();}catch(e){}});
  if(session.previewUrl){try{URL.revokeObjectURL(session.previewUrl);}catch(e){}}
}
function hideModal(){
  releaseMicCaptureSession();
  modalOverlay.classList.add('hidden');modalOverlay.innerHTML='';
}

/* ---------- AutoSave ---------- */
const STORAGE_KEY='flclone_v10';
function autoSave(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(serialize()));}catch(e){}}
async function tryLoadAutoSave(){try{const r=localStorage.getItem(STORAGE_KEY);if(!r)return false;return apply(JSON.parse(r)).ok;}catch(e){return false;}}

/* ---------- Rack ---------- */
const tracksContainer=document.getElementById('tracks');
const stepEls={},ledEls={};

function rebuildRack(){
  if(!tracksContainer)return;
  tracksContainer.innerHTML='';
  Object.keys(stepEls).forEach(k=>delete stepEls[k]);
  Object.keys(ledEls).forEach(k=>delete ledEls[k]);
  const pat=patterns[currentPattern];

  TRACKS.forEach(track=>{
    const row=document.createElement('div');
    row.className='track'+(track.type==='sample'?' sample-track':'');
    row.dataset.trackId=track.id;

    const nameCell=document.createElement('div');
    nameCell.className='track-name';
    const led=document.createElement('div');led.className='led';
    led.style.background=track.color;led.style.opacity=0.25;
    ledEls[track.id]=led;
    const label=document.createElement('span');label.className='name';label.textContent=track.name;
    nameCell.appendChild(led);nameCell.appendChild(label);

    if(track.type==='melodic'){
      const pr=document.createElement('button');pr.className='mini-btn';pr.textContent='🎹';
      pr.addEventListener('click',()=>openPianoRoll(track.id));
      nameCell.appendChild(pr);
    }
    if(track.type==='sample'){
      const s=samples[track.id];
      const fn=document.createElement('span');fn.className='sample-name';
      fn.textContent=s?(s.missing?'⚠ '+s.name:s.name):'(leer)';
      if(s&&s.missing)fn.style.color='#c62828';
      nameCell.appendChild(fn);
      const imp=document.createElement('button');imp.className='mini-btn';imp.textContent='📁';imp.title='Audiodatei importieren';
      imp.setAttribute('aria-label','Audiodatei importieren');
      imp.addEventListener('click',()=>importSample(track.id));
      nameCell.appendChild(imp);
      const rec=document.createElement('button');rec.className='mini-btn';rec.textContent='🎙';
      rec.title='Mit Mikrofon aufnehmen';rec.setAttribute('aria-label','Mit Mikrofon aufnehmen');
      rec.addEventListener('click',()=>showMicRecordModal(track.id));
      nameCell.appendChild(rec);
    }

    nameCell.addEventListener('contextmenu',e=>{
      e.preventDefault();
      showContextMenu(e.clientX,e.clientY,[
        {header:track.name},
        {label:'Filter zurücksetzen',action:()=>{pushHistory();track.filter.cutoff=20000;track.filter.q=0.7;
          if(buses[track.id]?.filter){buses[track.id].filter.frequency.value=20000;buses[track.id].filter.Q.value=0.7;}
          toast('Filter zurückgesetzt','success');autoSave();}},
        {label:'Alle Steps in Pattern '+currentPattern+' löschen',action:()=>{pushHistory();const p=patterns[currentPattern];
          if(track.type==='melodic')p.pianoRoll[track.id]=[];else p.steps[track.id]=new Array(64).fill(null);
          syncMelodicSteps(p);rebuildRack();autoSave();}},
        '---',
        {label:'Effektkette öffnen…',action:()=>{setView('mixer');openFxPanel(track.id);}},
        '---',
        {label:'Mute '+(track.mute?'aus':'an'),action:()=>{pushHistory();track.mute=!track.mute;refreshAllGains();if(currentView==='mixer')rebuildMixer();autoSave();}},
        {label:'Solo '+(track.solo?'aus':'an'),action:()=>{pushHistory();track.solo=!track.solo;refreshAllGains();if(currentView==='mixer')rebuildMixer();autoSave();}},
        {label:'Volume zurücksetzen',action:()=>{pushHistory();track.volume=0.8;applyTrackGain(track);if(currentView==='rack')rebuildRack();if(currentView==='mixer')rebuildMixer();autoSave();}}
      ]);
    });

    const wrap=document.createElement('div');wrap.className='steps-wrap';
    const stepsCell=document.createElement('div');stepsCell.className='steps';
    stepsCell.style.gridTemplateColumns=`repeat(${stepCount}, minmax(14px,1fr))`;
    stepsCell.dataset.trackId=track.id;
    const arr=[];
    const noSample=track.type==='sample'&&(!samples[track.id]||samples[track.id].missing);
    for(let i=0;i<stepCount;i++){
      const s=document.createElement('div');
      s.className='step'+(i%4===0?' beat':'')+(noSample?' empty':'');
      s.dataset.step=i;s.dataset.trackId=track.id;
      const sd=getStepData(pat,track.id,i);
      if(sd){
        s.classList.add('on');
        if(sd.accent)s.classList.add('accent');
        if(sd.ratchet>1)s.classList.add('ratchet');
        if(sd.prob<1)s.classList.add('prob');
        const vr=(sd.vel||100)/127;
        s.style.opacity=(0.5+0.5*vr).toFixed(2);
        if(sd.ratchet>1){const t=document.createElement('span');t.className='ratchet-tag';t.textContent='x'+sd.ratchet;s.appendChild(t);}
        if(sd.prob<1){const t=document.createElement('span');t.className='prob-tag';t.textContent=Math.round(sd.prob*100)+'%';s.appendChild(t);}
      }
      if(!noSample){
        s.addEventListener('mousedown',onStepMouseDown);
        s.addEventListener('contextmenu',e=>{e.preventDefault();if(track.type==='melodic')return;openStepEditor(track,i,e.clientX,e.clientY);});
      }
      stepsCell.appendChild(s);arr.push(s);
    }
    stepEls[track.id]=arr;wrap.appendChild(stepsCell);

    const volCell=document.createElement('div');volCell.className='vol';
    const slider=document.createElement('input');
    slider.type='range';slider.min='0';slider.max='1.2';slider.step='0.01';slider.value=track.volume;
    slider.addEventListener('input',()=>{track.volume=parseFloat(slider.value);applyTrackGain(track);
      const m=document.querySelector(`.strip[data-track="${track.id}"] .fader`);if(m)m.value=track.volume;autoSave();});
    volCell.appendChild(slider);

    row.appendChild(nameCell);row.appendChild(wrap);row.appendChild(volCell);
    tracksContainer.appendChild(row);
  });
  document.querySelectorAll('.step-count').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.count)===stepCount));
  document.querySelectorAll('.pattern').forEach(b=>b.classList.toggle('active',b.dataset.pattern===currentPattern));
}
function toggleMainStep(track,step,el){
  const pat=patterns[currentPattern];
  if(track.type==='melodic'){
    const ex=pat.pianoRoll[track.id].filter(n=>Math.floor(n.start)===step);
    if(ex.length)pat.pianoRoll[track.id]=pat.pianoRoll[track.id].filter(n=>Math.floor(n.start)!==step);
    else{const dm=(track.id==='bass')?36:60;pat.pianoRoll[track.id].push({id:genId('n'),start:step,len:1,midi:dm,vel:100});}
    syncMelodicSteps(pat);
  } else {
    if(isStepOn(pat,track.id,step))pat.steps[track.id][step]=null;
    else pat.steps[track.id][step]=defaultStep();
  }
  rebuildRack();autoSave();
}

/* Steps: plain click toggles. Kein Rubber-Band mehr im Rack. */
function onStepMouseDown(e){
  if(e.button!==0)return;
  const el=e.target.closest('.step');
  if(!el)return;
  const track=TRACKS.find(t=>t.id===el.dataset.trackId);
  if(!track)return;
  pushHistory();
  toggleMainStep(track,parseInt(el.dataset.step),el);
  e.preventDefault();
}

/* ---------- Step-Editor ---------- */
let stepEditorEl=null;
function openStepEditor(track,step,x,y){
  closeStepEditor();
  const pat=patterns[currentPattern];
  const isOn=isStepOn(pat,track.id,step);
  const sd=getStepData(pat,track.id,step)||defaultStep();
  const panel=document.createElement('div');panel.className='step-editor';
  panel.innerHTML=`
    <div class="se-head"><span style="color:${track.color};font-weight:700">${track.name}</span> <span style="color:var(--muted)">· Step ${step+1}</span></div>
    <div class="se-row"><label>Aktiv</label><input type="checkbox" id="se_on" ${isOn?'checked':''}></div>
    <div class="se-row"><label>Velocity</label><input type="range" id="se_vel" min="1" max="127" step="1" value="${sd.vel}"><span class="se-val" id="se_vel_v">${sd.vel}</span></div>
    <div class="se-row"><label>Probability</label><input type="range" id="se_prob" min="0" max="1" step="0.01" value="${sd.prob}"><span class="se-val" id="se_prob_v">${Math.round(sd.prob*100)}%</span></div>
    <div class="se-row"><label>Ratchet</label><select id="se_ratchet"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option><option value="8">8×</option></select></div>
    <div class="se-row"><label>Timing</label><input type="range" id="se_offset" min="-0.5" max="0.5" step="0.01" value="${sd.offset}"><span class="se-val" id="se_offset_v">${(sd.offset*100).toFixed(0)}%</span></div>
    <div class="se-row"><label>Accent</label><input type="checkbox" id="se_accent" ${sd.accent?'checked':''}></div>
    <div class="se-actions"><button id="se_save">Übernehmen</button><button id="se_clear">Löschen</button></div>`;
  document.body.appendChild(panel);
  const r=panel.getBoundingClientRect();let nx=x,ny=y;
  if(r.right>window.innerWidth-4)nx=x-r.width;
  if(r.bottom>window.innerHeight-4)ny=y-r.height;
  panel.style.left=Math.max(4,nx)+'px';panel.style.top=Math.max(4,ny)+'px';
  stepEditorEl=panel;
  const $=id=>panel.querySelector('#'+id);
  $('se_ratchet').value=String(sd.ratchet);
  const sync=()=>{$('se_vel_v').textContent=$('se_vel').value;$('se_prob_v').textContent=Math.round(parseFloat($('se_prob').value)*100)+'%';$('se_offset_v').textContent=(parseFloat($('se_offset').value)*100).toFixed(0)+'%';};
  ['se_vel','se_prob','se_offset'].forEach(id=>$(id).addEventListener('input',sync));
  const collect=()=>({on:$('se_on').checked,vel:parseInt($('se_vel').value),prob:parseFloat($('se_prob').value),ratchet:parseInt($('se_ratchet').value),offset:parseFloat($('se_offset').value),accent:$('se_accent').checked});
  $('se_save').addEventListener('click',()=>{pushHistory();const d=collect();pat.steps[track.id][step]=d.on?d:null;rebuildRack();autoSave();closeStepEditor();});
  $('se_clear').addEventListener('click',()=>{pushHistory();pat.steps[track.id][step]=null;rebuildRack();autoSave();closeStepEditor();});
}
function closeStepEditor(){if(stepEditorEl){stepEditorEl.remove();stepEditorEl=null;}}
document.addEventListener('click',e=>{if(stepEditorEl&&!stepEditorEl.contains(e.target))closeStepEditor();},true);

/* ---------- Sample-Import und Mikrofonaufnahme ---------- */
async function assignSampleToTrack(trackId,name,arrayBuffer,audioBuffer){
  const id=genId('smp');
  const previous=samples[trackId];
  await dbPutSample(id,name,arrayBuffer);
  samples[trackId]={id,name,buffer:audioBuffer,missing:false};
  // Erst den neuen Zustand sichern, dann alte binäre Daten freigeben.
  autoSave();
  if(previous&&previous.id&&previous.id!==id){
    try{await dbDeleteSample(previous.id);}catch(e){console.warn('Altes Sample konnte nicht entfernt werden:',e);}
  }
  rebuildRack();rebuildMixer();
  toast('Sample übernommen: '+name,'success');
}
function importSample(trackId){
  const input=document.createElement('input');
  input.type='file';input.accept='audio/*,.wav,.mp3,.ogg,.m4a,.flac';
  input.addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      initAudio();if(ctx.state==='suspended')await ctx.resume();
      const ab=await file.arrayBuffer();const buf=await ctx.decodeAudioData(ab.slice(0));
      await assignSampleToTrack(trackId,file.name,ab,buf);
    }catch(err){toast('Import fehlgeschlagen: '+err.message,'error');}
  });
  input.click();
}
function showMicRecordModal(trackId){
  const track=TRACKS.find(t=>t.id===trackId&&t.type==='sample');
  if(!track)return;
  if(!navigator.mediaDevices||typeof navigator.mediaDevices.getUserMedia!=='function'){
    toast('Mikrofonzugriff wird von dieser Umgebung nicht unterstützt.','error');return;
  }
  if(typeof MediaRecorder==='undefined'){
    toast('Diese Umgebung unterstützt keine Audioaufnahme (MediaRecorder).','error');return;
  }
  if(micCaptureSession)releaseMicCaptureSession();
  const wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;gap:12px;';
  const description=document.createElement('div');
  description.style.cssText='font-size:12px;color:var(--muted);line-height:1.5;';
  description.textContent='Nimm Audio über dein Mikrofon auf. Nach dem Stoppen kannst du die Aufnahme anhören und direkt als Sample in '+track.name+' übernehmen. Die Aufnahme wird lokal gespeichert.';
  const nameLabel=document.createElement('label');nameLabel.textContent='Sample-Name';nameLabel.style.cssText='font-size:12px;color:var(--muted);';
  const nameInput=document.createElement('input');nameInput.type='text';
  nameInput.value='mic-'+track.id+'-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  nameInput.style.cssText='width:100%;background:#111;color:#ddd;border:1px solid #000;border-radius:4px;padding:8px;';
  nameLabel.appendChild(nameInput);
  const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap;';
  const startBtn=document.createElement('button');startBtn.className='play';startBtn.textContent='● Aufnahme starten';
  const stopBtn=document.createElement('button');stopBtn.className='stop';stopBtn.textContent='■ Aufnahme stoppen';stopBtn.disabled=true;
  const previewBtn=document.createElement('button');previewBtn.textContent='▶ Vorschau';previewBtn.disabled=true;
  controls.append(startBtn,stopBtn,previewBtn);
  const status=document.createElement('div');status.style.cssText='font-size:12px;padding:8px;background:#171717;border:1px solid #333;border-radius:4px;';status.textContent='Bereit. Drücke „Aufnahme starten“ und erlaube den Mikrofonzugriff.';
  const audio=document.createElement('audio');audio.controls=true;audio.style.width='100%';audio.classList.add('hidden');
  wrap.append(description,nameLabel,controls,status,audio);
  const session={trackId,stream:null,recorder:null,chunks:[],blob:null,previewUrl:null,startBtn,stopBtn,previewBtn,status,audio,nameInput,useBtn:null,saving:false};
  micCaptureSession=session;
  const stopStream=()=>{if(session.stream){session.stream.getTracks().forEach(t=>{try{t.stop();}catch(e){}});session.stream=null;}};
  startBtn.addEventListener('click',async()=>{
    if(micCaptureSession!==session||session.saving)return;
    startBtn.disabled=true;stopBtn.disabled=true;previewBtn.disabled=true;
    session.blob=null;session.chunks=[];audio.pause();audio.classList.add('hidden');audio.removeAttribute('src');
    if(session.previewUrl){URL.revokeObjectURL(session.previewUrl);session.previewUrl=null;}
    status.textContent='Mikrofon wird angefordert …';
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      if(micCaptureSession!==session){stream.getTracks().forEach(t=>t.stop());return;}
      session.stream=stream;
      const candidates=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
      const mimeType=candidates.find(type=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(type));
      session.recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
      session.recorder.addEventListener('dataavailable',ev=>{if(ev.data&&ev.data.size>0)session.chunks.push(ev.data);});
      session.recorder.addEventListener('error',ev=>{
        status.textContent='Aufnahmefehler: '+(ev.error?.message||'Unbekannter Fehler');
        stopStream();startBtn.disabled=false;stopBtn.disabled=true;
        if(session.useBtn)session.useBtn.disabled=true;
      });
      session.recorder.addEventListener('stop',()=>{
        stopStream();
        if(micCaptureSession!==session)return;
        if(!session.chunks.length){status.textContent='Keine Audiodaten aufgenommen. Bitte erneut versuchen.';startBtn.disabled=false;stopBtn.disabled=true;return;}
        session.blob=new Blob(session.chunks,{type:session.recorder.mimeType||session.chunks[0].type||'audio/webm'});
        session.previewUrl=URL.createObjectURL(session.blob);audio.src=session.previewUrl;audio.classList.remove('hidden');
        previewBtn.disabled=false;startBtn.disabled=false;stopBtn.disabled=true;
        if(session.useBtn)session.useBtn.disabled=false;
        status.textContent='Aufnahme fertig · '+(session.blob.size/1024).toFixed(1)+' KB. Vorschau anhören oder als Sample übernehmen.';
      });
      session.recorder.start(100);
      stopBtn.disabled=false;status.textContent='● Aufnahme läuft … Sprich oder spiele in dein Mikrofon.';
    }catch(err){
      stopStream();startBtn.disabled=false;stopBtn.disabled=true;
      status.textContent='Mikrofonzugriff fehlgeschlagen: '+(err.message||err.name||'Unbekannter Fehler');
      toast('Mikrofon nicht verfügbar: '+(err.message||err.name||''),'error');
    }
  });
  stopBtn.addEventListener('click',()=>{
    const recorder=session.recorder;
    if(recorder&&recorder.state!=='inactive'){
      stopBtn.disabled=true;status.textContent='Aufnahme wird abgeschlossen …';
      try{recorder.stop();}catch(err){status.textContent='Aufnahme konnte nicht gestoppt werden: '+err.message;stopStream();startBtn.disabled=false;}
    }
  });
  previewBtn.addEventListener('click',()=>{if(session.previewUrl)audio.play().catch(err=>toast('Vorschau fehlgeschlagen: '+err.message,'error'));});
  showModal('🎙 Mikrofonaufnahme · '+track.name,wrap,[
    {label:'Abbrechen',onClick:hideModal},
    {label:'Sample in Kanal übernehmen',className:'play',onClick:async()=>{
      if(micCaptureSession!==session||!session.blob){toast('Bitte zuerst eine Aufnahme erstellen.','error');return;}
      if(session.saving)return;
      session.saving=true;if(session.useBtn)session.useBtn.disabled=true;
      try{
        initAudio();if(ctx.state==='suspended')await ctx.resume();
        const ab=await session.blob.arrayBuffer();
        const decoded=await ctx.decodeAudioData(ab.slice(0));
        const mime=(session.blob.type||'').toLowerCase();
        const ext=mime.includes('ogg')?'ogg':mime.includes('mp4')?'m4a':mime.includes('wav')?'wav':'webm';
        const base=session.nameInput.value.trim().replace(/\.(wav|mp3|ogg|webm|m4a|flac)$/i,'')||('mic-'+track.id);
        await assignSampleToTrack(track.id,base+'.'+ext,ab,decoded);
        hideModal();
      }catch(err){
        session.saving=false;if(session.useBtn)session.useBtn.disabled=!session.blob;
        status.textContent='Sample konnte nicht dekodiert/gespeichert werden: '+(err.message||err.name||'Unbekannter Fehler');
        toast('Aufnahme konnte nicht übernommen werden: '+(err.message||err.name||''),'error');
      }
    }}
  ]);
  session.useBtn=modalOverlay.querySelector('.modal-actions button:last-child');
  if(session.useBtn)session.useBtn.disabled=true;
}

/* ---------- Mixer / FX ---------- */
const mixerView=document.getElementById('mixerView');
const fxPanel=document.getElementById('fxPanel');
function formatPan(p){if(Math.abs(p)<0.01)return 'C';return p<0?'L'+Math.round(-p*100):'R'+Math.round(p*100);}
function fmtHz(hz){if(hz>=1000)return (hz/1000).toFixed(1)+'k';return Math.round(hz)+'';}
function rebuildMixer(){
  if(!mixerView)return;
  mixerView.innerHTML='';
  TRACKS.forEach(track=>{
    const strip=document.createElement('div');
    strip.className='strip'+(track.type==='sample'?' sample-strip':'');
    strip.dataset.track=track.id;
    const name=document.createElement('div');name.className='name';name.textContent=track.name;name.style.color=track.color;
    if(track.type==='sample'){const s=document.createElement('div');s.className='sub';const sm=samples[track.id];s.textContent=sm?(sm.missing?'⚠ '+sm.name:sm.name):'leer';if(sm&&sm.missing)s.style.color='#c62828';strip.appendChild(s);}
    const led=document.createElement('div');led.className='led';led.style.background=track.color;led.style.opacity=0.25;ledEls['mix_'+track.id]=led;
    const cutoffRow=document.createElement('div');cutoffRow.className='small-row';
    const cL=document.createElement('span');cL.textContent='Cut';
    const cS=document.createElement('input');cS.type='range';cS.min='20';cS.max='20000';cS.step='10';cS.value=track.filter.cutoff;
    const cV=document.createElement('span');cV.textContent=fmtHz(track.filter.cutoff);
    cS.addEventListener('input',()=>{track.filter.cutoff=parseFloat(cS.value);cV.textContent=fmtHz(track.filter.cutoff);
      const b=buses[track.id];if(b&&b.filter)b.filter.frequency.setTargetAtTime(track.filter.cutoff,ctx?ctx.currentTime:0,0.01);autoSave();});
    cutoffRow.appendChild(cL);cutoffRow.appendChild(cS);cutoffRow.appendChild(cV);
    const qRow=document.createElement('div');qRow.className='small-row';
    const qL=document.createElement('span');qL.textContent='Q';
    const qS=document.createElement('input');qS.type='range';qS.min='0.1';qS.max='20';qS.step='0.1';qS.value=track.filter.q;
    const qV=document.createElement('span');qV.textContent=track.filter.q.toFixed(1);
    qS.addEventListener('input',()=>{track.filter.q=parseFloat(qS.value);qV.textContent=track.filter.q.toFixed(1);
      const b=buses[track.id];if(b&&b.filter)b.filter.Q.setTargetAtTime(track.filter.q,ctx?ctx.currentTime:0,0.01);autoSave();});
    qRow.appendChild(qL);qRow.appendChild(qS);qRow.appendChild(qV);
    const panRow=document.createElement('div');panRow.className='small-row';
    const pl=document.createElement('span');pl.textContent='Pan';
    const ps=document.createElement('input');ps.type='range';ps.min='-1';ps.max='1';ps.step='0.01';ps.value=track.pan;
    const pv=document.createElement('span');pv.textContent=formatPan(track.pan);
    ps.addEventListener('input',()=>{track.pan=parseFloat(ps.value);pv.textContent=formatPan(track.pan);
      const b=buses[track.id];if(b&&b.panner)b.panner.pan.value=track.pan;autoSave();});
    panRow.appendChild(pl);panRow.appendChild(ps);panRow.appendChild(pv);
    const sendRow=document.createElement('div');sendRow.className='small-row';
    const sl=document.createElement('span');sl.textContent='Send';
    const ss=document.createElement('input');ss.type='range';ss.min='0';ss.max='1';ss.step='0.01';ss.value=track.send;
    const sv=document.createElement('span');sv.textContent=Math.round(track.send*100)+'%';
    ss.addEventListener('input',()=>{track.send=parseFloat(ss.value);sv.textContent=Math.round(track.send*100)+'%';
      const b=buses[track.id];if(b)b.send.gain.value=track.send;autoSave();});
    sendRow.appendChild(sl);sendRow.appendChild(ss);sendRow.appendChild(sv);
    const faderWrap=document.createElement('div');faderWrap.className='fader-wrap';
    const fader=document.createElement('input');fader.type='range';fader.min='0';fader.max='1.2';fader.step='0.01';fader.value=track.volume;fader.className='fader';
    const val=document.createElement('div');val.className='val';val.textContent=Math.round(track.volume*100)+'%';
    fader.addEventListener('input',()=>{track.volume=parseFloat(fader.value);applyTrackGain(track);
      const idx=TRACKS.indexOf(track);const rows=tracksContainer.children;
      if(rows[idx]){const r=rows[idx].querySelector('input[type=range]');if(r)r.value=track.volume;}
      val.textContent=Math.round(track.volume*100)+'%';autoSave();});
    faderWrap.appendChild(fader);
    const btns=document.createElement('div');btns.className='btns';
    const mb=document.createElement('button');mb.textContent='M';mb.className='mute'+(track.mute?' on':'');
    mb.addEventListener('click',()=>{pushHistory();track.mute=!track.mute;mb.classList.toggle('on',track.mute);refreshAllGains();autoSave();});
    const sb=document.createElement('button');sb.textContent='S';sb.className='solo'+(track.solo?' on':'');
    sb.addEventListener('click',()=>{pushHistory();track.solo=!track.solo;sb.classList.toggle('on',track.solo);refreshAllGains();autoSave();});
    btns.appendChild(mb);btns.appendChild(sb);
    const fxBtn=document.createElement('button');fxBtn.className='fx-btn';fxBtn.textContent='FX ('+(track.effects||[]).length+')';
    fxBtn.addEventListener('click',()=>openFxPanel(track.id));
    strip.appendChild(name);strip.appendChild(led);strip.appendChild(cutoffRow);strip.appendChild(qRow);
    strip.appendChild(panRow);strip.appendChild(sendRow);strip.appendChild(faderWrap);strip.appendChild(val);
    strip.appendChild(btns);strip.appendChild(fxBtn);
    mixerView.appendChild(strip);
  });
  const mStrip=document.createElement('div');mStrip.className='strip master-strip';
  const mName=document.createElement('div');mName.className='name';mName.textContent='MASTER';mName.style.color='var(--accent)';
  const mFaderWrap=document.createElement('div');mFaderWrap.className='fader-wrap';
  const mFader=document.createElement('input');mFader.type='range';mFader.min='0';mFader.max='1.2';mFader.step='0.01';mFader.value=master;mFader.className='fader';
  const mVal=document.createElement('div');mVal.className='val';mVal.textContent=Math.round(master*100)+'%';
  mFader.addEventListener('input',()=>{master=parseFloat(mFader.value);if(masterGain)masterGain.gain.value=master;
    document.getElementById('master').value=master;mVal.textContent=Math.round(master*100)+'%';autoSave();});
  mFaderWrap.appendChild(mFader);
  const rRow=document.createElement('div');rRow.className='small-row';
  const rL=document.createElement('span');rL.textContent='Reverb';
  const rS=document.createElement('input');rS.type='range';rS.min='0';rS.max='1';rS.step='0.01';rS.value=reverbAmount;
  rS.addEventListener('input',()=>{reverbAmount=parseFloat(rS.value);if(reverbReturn)reverbReturn.gain.value=reverbAmount;document.getElementById('reverbAmount').value=reverbAmount;autoSave();});
  rRow.appendChild(rL);rRow.appendChild(rS);
  mStrip.appendChild(mName);mStrip.appendChild(rRow);mStrip.appendChild(mFaderWrap);mStrip.appendChild(mVal);
  mixerView.appendChild(mStrip);
}
function openFxPanel(trackId){
  currentFxTrackId=trackId;const t=TRACKS.find(x=>x.id===trackId);if(!t)return;
  fxPanel.classList.remove('hidden');renderFxPanel();fxPanel.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderFxPanel(){
  const track=TRACKS.find(t=>t.id===currentFxTrackId);
  if(!track){fxPanel.classList.add('hidden');return;}
  fxPanel.innerHTML='';
  const head=document.createElement('div');head.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:10px;';
  const h3=document.createElement('h3');h3.textContent='Effektkette: '+track.name;h3.style.margin=0;
  const cb=document.createElement('button');cb.textContent='✖ Schließen';cb.style.marginLeft='auto';
  cb.addEventListener('click',()=>{currentFxTrackId=null;fxPanel.classList.add('hidden');fxPanel.innerHTML='';});
  head.appendChild(h3);head.appendChild(cb);fxPanel.appendChild(head);
  const addRow=document.createElement('div');addRow.className='fx-add';
  const sel=document.createElement('select');
  Object.entries(EFFECT_DEFS).forEach(([k,v])=>{const o=document.createElement('option');o.value=k;o.textContent=v.name;sel.appendChild(o);});
  const addBtn=document.createElement('button');addBtn.textContent='+ Effekt';
  addBtn.addEventListener('click',()=>{const fx=createEffect(sel.value);if(!fx)return;pushHistory();track.effects.push(fx);rebuildAudioGraphs();renderFxPanel();rebuildMixer();autoSave();toast('Effekt: '+EFFECT_DEFS[fx.type].name,'success');});
  addRow.appendChild(sel);addRow.appendChild(addBtn);fxPanel.appendChild(addRow);
  const list=document.createElement('div');list.className='fx-list';
  (track.effects||[]).forEach((fx,idx)=>{
    const def=EFFECT_DEFS[fx.type];if(!def)return;
    const item=document.createElement('div');item.className='fx-item'+(fx.enabled?'':' off');
    const ih=document.createElement('div');ih.className='fx-item-head';
    const ti=document.createElement('span');ti.className='title';ti.textContent=(idx+1)+'. '+def.name;
    const up=document.createElement('button');up.textContent='↑';up.disabled=idx===0;
    up.addEventListener('click',()=>{pushHistory();const a=track.effects;[a[idx-1],a[idx]]=[a[idx],a[idx-1]];rebuildAudioGraphs();renderFxPanel();autoSave();});
    const dn=document.createElement('button');dn.textContent='↓';dn.disabled=idx===track.effects.length-1;
    dn.addEventListener('click',()=>{pushHistory();const a=track.effects;[a[idx+1],a[idx]]=[a[idx],a[idx+1]];rebuildAudioGraphs();renderFxPanel();autoSave();});
    const en=document.createElement('button');en.textContent=fx.enabled?'AN':'AUS';en.className=fx.enabled?'active':'';
    en.addEventListener('click',()=>{pushHistory();fx.enabled=!fx.enabled;rebuildAudioGraphs();renderFxPanel();rebuildMixer();autoSave();});
    const del=document.createElement('button');del.textContent='🗑';del.className='danger';
    del.addEventListener('click',()=>{if(!confirm('Effekt löschen?'))return;pushHistory();track.effects=track.effects.filter(f=>f.id!==fx.id);rebuildAudioGraphs();renderFxPanel();rebuildMixer();autoSave();});
    ih.appendChild(ti);ih.appendChild(up);ih.appendChild(dn);ih.appendChild(en);ih.appendChild(del);item.appendChild(ih);
    const params=document.createElement('div');params.className='fx-params';
    def.params.forEach(p=>{
      const w=document.createElement('div');w.className='fx-param';
      const l=document.createElement('label');l.textContent=p.label;w.appendChild(l);
      if(p.type==='select'){
        const s=document.createElement('select');
        p.options.forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;s.appendChild(opt);});
        s.value=fx.params[p.key];
        s.addEventListener('change',()=>{fx.params[p.key]=s.value;const b=buses[track.id];
          if(b&&b._chainNodes&&b._chainNodes[idx]&&b._chainNodes[idx].update)b._chainNodes[idx].update(fx.params);autoSave();});
        w.appendChild(s);
      } else {
        const inp=document.createElement('input');inp.type='range';inp.min=p.min;inp.max=p.max;inp.step=p.step;inp.value=fx.params[p.key];
        const v=document.createElement('span');v.className='val';
        const fmt=val=>{let n;if(Math.abs(val)>=1000)n=String(Math.round(val));else if(Math.abs(val)>=100)n=val.toFixed(1);else if(Math.abs(val)>=1)n=val.toFixed(2);else n=val.toFixed(4);return n+(p.unit||'');};
        v.textContent=fmt(parseFloat(inp.value));
        inp.addEventListener('input',()=>{const val=parseFloat(inp.value);fx.params[p.key]=val;v.textContent=fmt(val);
          const b=buses[track.id];if(b&&b._chainNodes&&b._chainNodes[idx]&&b._chainNodes[idx].update)b._chainNodes[idx].update(fx.params);autoSave();});
        w.appendChild(inp);w.appendChild(v);
      }
      params.appendChild(w);
    });
    item.appendChild(params);list.appendChild(item);
  });
  fxPanel.appendChild(list);
}

/* =========================================================
   SONG – Pattern-basiert
   ========================================================= */
const songInner=document.getElementById('songInner');
function isBlockSelected(id){return songSelectedIds.has(id);}
function setBlockSelected(id,mode){
  if(mode==='replace')songSelectedIds.clear();
  if(mode==='sub')songSelectedIds.delete(id);else songSelectedIds.add(id);
}
function clearClipSelection(){
  songSelectedIds.clear();
  document.querySelectorAll('.song-clip').forEach(c=>c.classList.remove('selected'));
}
function patternColor(pid){const m={A:'#ff8a00',B:'#4ea3ff',C:'#00b894',D:'#fd79a8'};return m[pid]||'#ff8a00';}

function rebuildSong(){
  if(!songInner)return;
  songInner.innerHTML='';
  const totalSteps=Math.max(64,getSongLength());
  const totalWidth=130+totalSteps*PX_PER_STEP;
  songInner.style.width=totalWidth+'px';
  const ruler=document.createElement('div');ruler.className='song-ruler';ruler.style.width=totalWidth+'px';
  const sp=document.createElement('div');sp.className='spacer';ruler.appendChild(sp);
  for(let s=0;s<totalSteps;s+=16){
    const t=document.createElement('div');t.className='song-tick';t.style.width=(16*PX_PER_STEP)+'px';
    t.textContent='Bar '+(s/16+1);ruler.appendChild(t);
  }
  songInner.appendChild(ruler);
  if(song.loopEnd>song.loopStart){
    const lo=document.createElement('div');lo.className='song-loop-region';
    lo.style.left=(130+song.loopStart*PX_PER_STEP)+'px';
    lo.style.width=((song.loopEnd-song.loopStart)*PX_PER_STEP)+'px';
    songInner.appendChild(lo);
  }
  PATTERN_IDS.forEach(pid=>{
    const row=document.createElement('div');row.className='song-row';
    const label=document.createElement('div');label.className='song-row-label';
    const dot=document.createElement('div');dot.className='led';
    dot.style.background=patternColor(pid);dot.style.opacity=0.7;
    label.appendChild(dot);
    label.appendChild(document.createTextNode('Pattern '+pid));
    label.style.color=patternColor(pid);label.style.fontWeight='700';
    row.appendChild(label);
    const lane=document.createElement('div');lane.className='song-lane';
    lane.style.width=(totalSteps*PX_PER_STEP)+'px';
    lane.style.backgroundSize=(16*PX_PER_STEP)+'px 100%, '+(4*PX_PER_STEP)+'px 100%';
    lane.dataset.patternId=pid;
    song.blocks.filter(b=>b.patternId===pid).forEach(block=>{
      lane.appendChild(makeBlockEl(block));
    });
    lane.addEventListener('mousedown',onSongLaneMouseDown);
    lane.addEventListener('contextmenu',e=>{
      if(e.target!==lane)return;
      e.preventDefault();
      const rect=lane.getBoundingClientRect();
      const px=e.clientX-rect.left+lane.scrollLeft;
      const step=Math.max(0,Math.round(px/PX_PER_STEP));
      showContextMenu(e.clientX,e.clientY,[
        {header:'Pattern '+pid+' @ Step '+step},
        {label:'Pattern hier platzieren',action:()=>{
          pushHistory();
          const b={id:genId('block'),patternId:pid,startStep:step,lengthSteps:stepCount,sourceOffsetSteps:0};
          song.blocks.push(b);songSelectedIds=new Set([b.id]);rebuildSong();autoSave();
        }},
        {label:'Playhead hierher',action:()=>{currentSongStep=step;updateSongPlayhead();updateSongPositionDisplay(step);}},
        '---',
        {label:'Alle '+pid+'-Blöcke löschen',disabled:!song.blocks.some(b=>b.patternId===pid),action:()=>{
          if(!confirm('Alle Pattern-'+pid+'-Blöcke löschen?'))return;
          pushHistory();song.blocks=song.blocks.filter(b=>b.patternId!==pid);rebuildSong();autoSave();
        }}
      ]);
    });
    row.appendChild(lane);songInner.appendChild(row);
  });
  updateSongPlayhead();
}

function makeBlockEl(block){
  const el=document.createElement('div');
  el.className='song-clip'+(isBlockSelected(block.id)?' selected':'');
  el.dataset.blockId=block.id;
  el.style.left=(block.startStep*PX_PER_STEP)+'px';
  el.style.width=(block.lengthSteps*PX_PER_STEP-4)+'px';
  el.textContent='Pattern '+block.patternId+((block.sourceOffsetSteps||0)>0?' (off '+block.sourceOffsetSteps+')':'');
  el.style.background=patternColor(block.patternId);
  el.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    e.stopPropagation();
    const isSel=isBlockSelected(block.id);
    const alt=e.altKey,shift=e.shiftKey;
    if(alt){setBlockSelected(block.id,'sub');
      document.querySelectorAll('.song-clip').forEach(c=>c.classList.toggle('selected',isBlockSelected(c.dataset.blockId)));return;}
    if(ctrl||shift){if(!isSel)setBlockSelected(block.id,'add');}
    else if(!isSel){clearClipSelection();setBlockSelected(block.id,'replace');}
    document.querySelectorAll('.song-clip').forEach(c=>c.classList.toggle('selected',isBlockSelected(c.dataset.blockId)));
    startBlockDrag(e,block);
  });
  el.addEventListener('dblclick',e=>{
    e.stopPropagation();
    if(!confirm('Pattern-Block löschen?'))return;
    pushHistory();song.blocks=song.blocks.filter(b=>b.id!==block.id);songSelectedIds.delete(block.id);
    rebuildSong();autoSave();
  });
  el.addEventListener('contextmenu',e=>{
    e.preventDefault();e.stopPropagation();
    if(!isBlockSelected(block.id)){clearClipSelection();setBlockSelected(block.id,'replace');
      document.querySelectorAll('.song-clip').forEach(c=>c.classList.toggle('selected',isBlockSelected(c.dataset.blockId)));}
    const sc=songSelectedIds.size;
    showContextMenu(e.clientX,e.clientY,[
      {header:sc>1?sc+' Blöcke gewählt':'Pattern '+block.patternId+' @ Step '+block.startStep},
      {label:'Duplizieren',action:duplicateSelectedClips},
      {label:'Löschen',action:deleteSelectedClips},
      '---',
      {label:'Am Mittelpunkt teilen',disabled:sc>1,action:()=>{
        if(block.lengthSteps<2){toast('Block zu kurz','error');return;}
        pushHistory();
        const half=Math.floor(block.lengthSteps/2);
        const off=block.sourceOffsetSteps||0;
        const second={id:genId('block'),patternId:block.patternId,startStep:block.startStep+half,lengthSteps:block.lengthSteps-half,sourceOffsetSteps:off+half};
        block.lengthSteps=half;
        song.blocks.push(second);
        songSelectedIds=new Set([block.id,second.id]);
        rebuildSong();autoSave();
      }},
      {label:'Länge halbieren',disabled:sc>1,action:()=>{pushHistory();block.lengthSteps=Math.max(1,Math.floor(block.lengthSteps/2));rebuildSong();autoSave();}},
      {label:'Länge ändern…',action:()=>{
        const v=prompt('Neue Länge in Steps (1–256):',block.lengthSteps);
        if(v==null)return;const n=parseInt(v);
        if(!isNaN(n)&&n>=1){pushHistory();block.lengthSteps=n;rebuildSong();autoSave();}
      }},
      '---',
      {label:'Pattern wechseln zu…',disabled:sc>1,action:()=>{
        const items=PATTERN_IDS.map(pid=>({label:'Pattern '+pid+(pid===block.patternId?' ✓':''),
          action:()=>{pushHistory();block.patternId=pid;block.sourceOffsetSteps=0;rebuildSong();autoSave();}}));
        showContextMenu(e.clientX,e.clientY,items);
      }},
      {label:'Quelle-Offset zurücksetzen',action:()=>{pushHistory();block.sourceOffsetSteps=0;rebuildSong();autoSave();}}
    ]);
  });
  return el;
}

let songDrag=null;
function onSongLaneMouseDown(e){
  if(e.button!==0)return;
  const clipEl=e.target.closest('.song-clip');
  if(clipEl)return;
  const modifier=e.shiftKey?'add':(e.altKey?'sub':'replace');
  const r=document.createElement('div');
  r.className='pr-rubber';r.style.cssText='position:fixed;z-index:9997;display:none;';
  document.body.appendChild(r);
  songDrag={startX:e.clientX,startY:e.clientY,modifier,rubberEl:r,moved:false};
  document.addEventListener('mousemove',onSongMouseMove);
  document.addEventListener('mouseup',onSongMouseUp);
}
function onSongMouseMove(e){
  if(!songDrag)return;
  const dx=e.clientX-songDrag.startX,dy=e.clientY-songDrag.startY;
  if(!songDrag.moved&&(Math.abs(dx)>4||Math.abs(dy)>4)){songDrag.moved=true;songDrag.rubberEl.style.display='block';}
  if(!songDrag.moved)return;
  const r=songDrag.rubberEl;
  const x1=Math.min(songDrag.startX,e.clientX),y1=Math.min(songDrag.startY,e.clientY);
  const x2=Math.max(songDrag.startX,e.clientX),y2=Math.max(songDrag.startY,e.clientY);
  r.style.left=x1+'px';r.style.top=y1+'px';r.style.width=(x2-x1)+'px';r.style.height=(y2-y1)+'px';
}
function onSongMouseUp(e){
  if(!songDrag)return;
  document.removeEventListener('mousemove',onSongMouseMove);
  document.removeEventListener('mouseup',onSongMouseUp);
  const d=songDrag;songDrag=null;
  if(d.rubberEl)d.rubberEl.remove();
  if(!d.moved){if(d.modifier==='replace')clearClipSelection();return;}
  const x1=Math.min(d.startX,e.clientX),y1=Math.min(d.startY,e.clientY);
  const x2=Math.max(d.startX,e.clientX),y2=Math.max(d.startY,e.clientY);
  const hits=[];
  document.querySelectorAll('.song-clip').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.left+r.width>x1&&r.left<x2&&r.top+r.height>y1&&r.top<y2)hits.push(el.dataset.blockId);
  });
  if(d.modifier==='replace')clearClipSelection();
  hits.forEach(id=>{if(d.modifier==='sub')songSelectedIds.delete(id);else songSelectedIds.add(id);});
  document.querySelectorAll('.song-clip').forEach(el=>el.classList.toggle('selected',songSelectedIds.has(el.dataset.blockId)));
}

function startBlockDrag(e,block){
  const startX=e.clientX;
  const sel=song.blocks.filter(b=>songSelectedIds.has(b.id));
  if(!sel.length){sel.push(block);songSelectedIds.add(block.id);}
  const orig=sel.map(b=>({id:b.id,startStep:b.startStep}));
  const els={};
  orig.forEach(o=>{els[o.id]=document.querySelector(`.song-clip[data-block-id="${o.id}"]`);});
  let moved=false;
  function onMove(ev){
    const dStep=Math.round((ev.clientX-startX)/PX_PER_STEP);
    if(!moved&&dStep!==0)moved=true;
    orig.forEach(o=>{
      const ns=Math.max(0,o.startStep+dStep);
      if(els[o.id])els[o.id].style.left=(ns*PX_PER_STEP)+'px';
      o._liveStart=ns;
    });
  }
  function onUp(){
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    if(!moved)return;
    pushHistory();
    orig.forEach(o=>{const b=song.blocks.find(x=>x.id===o.id);if(b)b.startStep=o._liveStart;});
    rebuildSong();autoSave();
  }
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}

function duplicateSelectedClips(){
  if(!songSelectedIds.size)return;
  pushHistory();
  const sel=song.blocks.filter(b=>songSelectedIds.has(b.id));
  if(!sel.length)return;
  const minStart=Math.min(...sel.map(b=>b.startStep));
  const maxEnd=Math.max(...sel.map(b=>b.startStep+b.lengthSteps));
  const offset=maxEnd-minStart;
  const newIds=new Set();
  sel.forEach(b=>{const c={...b,id:genId('block'),startStep:b.startStep+offset};song.blocks.push(c);newIds.add(c.id);});
  songSelectedIds=newIds;rebuildSong();autoSave();
  toast(sel.length+' Blöcke dupliziert','success');
}
function deleteSelectedClips(){
  if(!songSelectedIds.size)return;
  pushHistory();
  song.blocks=song.blocks.filter(b=>!songSelectedIds.has(b.id));
  const n=songSelectedIds.size;
  clearClipSelection();rebuildSong();autoSave();
  toast(n+' Blöcke gelöscht','success');
}

function updateSongPlayhead(){
  if(!songInner)return;
  let ph=document.getElementById('songPlayhead');
  if(!ph){ph=document.createElement('div');ph.className='song-playhead';ph.id='songPlayhead';songInner.appendChild(ph);}
  const step=(playMode==='song')?currentSongStep:currentStep;
  ph.style.left=(130+step*PX_PER_STEP)+'px';
}
function updateSongPositionDisplay(step){
  const el=document.getElementById('songPos');if(!el)return;
  const bar=Math.floor(step/16)+1;const beat=Math.floor((step%16)/4)+1;
  el.textContent=bar+'.'+beat;
}

/* =========================================================
   AUTOMATION VIEW
   ========================================================= */
const autoInner=document.getElementById('autoInner');
function rebuildAutoView(){
  if(!autoInner)return;
  const sel=document.getElementById('autoTargetSel');sel.innerHTML='';
  getAutoTargets().forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.label;sel.appendChild(o);});
  autoInner.innerHTML='';
  const totalSteps=Math.max(64,getSongLength());
  const totalWidth=170+totalSteps*PX_PER_STEP_AUTO;
  autoInner.style.width=totalWidth+'px';
  const ruler=document.createElement('div');ruler.className='song-ruler';ruler.style.width=totalWidth+'px';
  const sp=document.createElement('div');sp.className='spacer';sp.style.width='170px';ruler.appendChild(sp);
  for(let s=0;s<totalSteps;s+=16){
    const t=document.createElement('div');t.className='song-tick';t.style.width=(16*PX_PER_STEP_AUTO)+'px';
    t.textContent='Bar '+(s/16+1);ruler.appendChild(t);
  }
  autoInner.appendChild(ruler);
  if(song.loopEnd>song.loopStart){
    const lo=document.createElement('div');lo.className='song-loop-region';
    lo.style.left=(170+song.loopStart*PX_PER_STEP_AUTO)+'px';
    lo.style.width=((song.loopEnd-song.loopStart)*PX_PER_STEP_AUTO)+'px';
    autoInner.appendChild(lo);
  }
  if(!automation.lanes.length){
    const e=document.createElement('div');e.style.cssText='padding:20px;color:var(--muted);font-size:12px;';
    e.textContent='Keine Automation-Lanes.';autoInner.appendChild(e);
  }
  automation.lanes.forEach(lane=>{
    const tgt=findAutoTarget(lane.target);if(!tgt)return;
    const laneEl=document.createElement('div');laneEl.className='auto-lane'+(selectedAutoLaneId===lane.id?' selected':'');
    laneEl.dataset.laneId=lane.id;
    const label=document.createElement('div');label.className='auto-lane-label';
    const tn=document.createElement('div');tn.className='tname';tn.textContent=tgt.label;
    const rg=document.createElement('div');rg.className='range';rg.textContent=tgt.min+' … '+tgt.max+' · '+lane.curve;
    label.appendChild(tn);label.appendChild(rg);
    label.addEventListener('contextmenu',e=>{
      e.preventDefault();selectedAutoLaneId=lane.id;document.getElementById('autoCurveSel').value=lane.curve;rebuildAutoView();
      showContextMenu(e.clientX,e.clientY,[
        {header:tgt.label},
        {label:'Linear',action:()=>{pushHistory();lane.curve='linear';rebuildAutoView();autoSave();}},
        {label:'Geglättet',action:()=>{pushHistory();lane.curve='smooth';rebuildAutoView();autoSave();}},
        {label:'Haltewert',action:()=>{pushHistory();lane.curve='hold';rebuildAutoView();autoSave();}},
        '---',
        {label:'Lane löschen',action:()=>{if(!confirm('Lane löschen?'))return;pushHistory();automation.lanes=automation.lanes.filter(l=>l.id!==lane.id);selectedAutoLaneId=null;rebuildAutoView();autoSave();}}
      ]);
    });
    laneEl.appendChild(label);
    const canvas=document.createElement('div');canvas.className='auto-canvas';
    canvas.style.width=(totalSteps*PX_PER_STEP_AUTO)+'px';canvas.style.height='70px';
    canvas.style.backgroundSize=(16*PX_PER_STEP_AUTO)+'px 100%';
    canvas.style.backgroundImage='linear-gradient(to right,#202020 1px,transparent 1px),linear-gradient(to right,#181818 1px,transparent 1px)';
    lane.clips.forEach(clip=>{
      const bg=document.createElement('div');bg.className='auto-clip-bg';
      bg.style.left=(clip.startStep*PX_PER_STEP_AUTO)+'px';
      bg.style.width=(clip.lengthSteps*PX_PER_STEP_AUTO)+'px';
      canvas.appendChild(bg);
      const pts=clip.points.slice().sort((a,b)=>a.step-b.step);
      if(!pts.length)return;
      const svgNS='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('class','auto-curve');
      svg.style.cssText=`position:absolute;left:${clip.startStep*PX_PER_STEP_AUTO}px;top:0;width:${clip.lengthSteps*PX_PER_STEP_AUTO}px;height:70px;overflow:visible;`;
      const poly=[];const yf=v=>70-v*70;
      if(lane.curve==='hold'){
        for(let i=0;i<pts.length;i++){poly.push([pts[i].step*PX_PER_STEP_AUTO,yf(pts[i].value)]);if(i<pts.length-1)poly.push([pts[i+1].step*PX_PER_STEP_AUTO,yf(pts[i].value)]);}
      } else if(lane.curve==='smooth'){
        const total=pts[pts.length-1].step;const SD=3;
        for(let s=0;s<=total;s+=1/SD){
          let val;
          if(s<=pts[0].step)val=pts[0].value;
          else if(s>=pts[pts.length-1].step)val=pts[pts.length-1].value;
          else{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];
            if(s>=a.step&&s<=b.step){const sp=b.step-a.step;const t=sp<=0?0:(s-a.step)/sp;
              const p0=i>0?pts[i-1].value:a.value,p1=a.value,p2=b.value,p3=i<pts.length-2?pts[i+2].value:b.value;
              val=Math.max(0,Math.min(1,catmullRom(p0,p1,p2,p3,t)));break;}}}
          if(val==null)val=0;poly.push([s*PX_PER_STEP_AUTO,yf(val)]);
        }
      } else pts.forEach(p=>poly.push([p.step*PX_PER_STEP_AUTO,yf(p.value)]));
      const pl=document.createElementNS(svgNS,'polyline');
      pl.setAttribute('points',poly.map(p=>p.join(',')).join(' '));
      pl.setAttribute('fill','none');pl.setAttribute('stroke','#ff8a00');pl.setAttribute('stroke-width','2');
      svg.appendChild(pl);canvas.appendChild(svg);
    });
    lane.clips.forEach(clip=>{
      clip.points.forEach(pt=>{
        const el=document.createElement('div');el.className='auto-point';
        el.style.left=((clip.startStep+pt.step)*PX_PER_STEP_AUTO)+'px';
        el.style.top=(70-pt.value*70)+'px';
        el.dataset.laneId=lane.id;el.dataset.clipId=clip.id;el.dataset.ptStep=pt.step;
        canvas.appendChild(el);
      });
    });
    canvas.addEventListener('mousedown',e=>{
      if(e.target.classList.contains('auto-point')){
        if(e.button===2)return;
        const ptEl=e.target;const cid=ptEl.dataset.clipId;const ps=parseFloat(ptEl.dataset.ptStep);
        const cl=lane.clips.find(c=>c.id===cid);if(!cl)return;const pt=cl.points.find(p=>p.step===ps);if(!pt)return;
        selectedAutoLaneId=lane.id;
        const sx=e.clientX,sy=e.clientY,os=pt.step,ov=pt.value;
        function mv(ev){const ds=(ev.clientX-sx)/PX_PER_STEP_AUTO;const dv=-(ev.clientY-sy)/70;
          pt.step=Math.max(0,Math.min(cl.lengthSteps,os+ds));pt.value=Math.max(0,Math.min(1,ov+dv));
          ptEl.style.left=((cl.startStep+pt.step)*PX_PER_STEP_AUTO)+'px';ptEl.style.top=(70-pt.value*70)+'px';}
        function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);cl.points.sort((a,b)=>a.step-b.step);pushHistory();rebuildAutoView();autoSave();}
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);e.stopPropagation();return;
      }
      if(e.button!==0)return;
      selectedAutoLaneId=lane.id;document.getElementById('autoCurveSel').value=lane.curve;
      const rect=canvas.getBoundingClientRect();
      const step=(e.clientX-rect.left)/PX_PER_STEP_AUTO;
      const val=Math.max(0,Math.min(1,1-(e.clientY-rect.top)/70));
      const clip=lane.clips.find(c=>step>=c.startStep&&step<c.startStep+c.lengthSteps);if(!clip)return;
      pushHistory();clip.points.push({step:step-clip.startStep,value:val});clip.points.sort((a,b)=>a.step-b.step);
      rebuildAutoView();autoSave();
    });
    canvas.addEventListener('contextmenu',e=>{
      const ptEl=e.target.closest('.auto-point');
      if(!ptEl){
        e.preventDefault();selectedAutoLaneId=lane.id;
        showContextMenu(e.clientX,e.clientY,[
          {header:tgt.label},
          {label:'Punkt hier einfügen',action:()=>{pushHistory();const rect=canvas.getBoundingClientRect();
            const step=(e.clientX-rect.left)/PX_PER_STEP_AUTO;const val=Math.max(0,Math.min(1,1-(e.clientY-rect.top)/70));
            const clip=lane.clips.find(c=>step>=c.startStep&&step<c.startStep+c.lengthSteps);if(!clip)return;
            clip.points.push({step:step-clip.startStep,value:val});clip.points.sort((a,b)=>a.step-b.step);rebuildAutoView();autoSave();}},
          '---',
          {label:'Lane löschen',action:()=>{pushHistory();automation.lanes=automation.lanes.filter(l=>l.id!==lane.id);selectedAutoLaneId=null;rebuildAutoView();autoSave();}}
        ]);return;
      }
      e.preventDefault();
      const cid=ptEl.dataset.clipId,ps=parseFloat(ptEl.dataset.ptStep);
      const cl=lane.clips.find(c=>c.id===cid);if(!cl)return;
      const pt=cl.points.find(p=>p.step===ps);if(!pt)return;
      showContextMenu(e.clientX,e.clientY,[
        {header:'Punkt @ '+pt.step.toFixed(2)},
        {label:'Wert: '+(tgt.min+pt.value*(tgt.max-tgt.min)).toFixed(2),disabled:true},
        '---',
        {label:'Punkt löschen',action:()=>{pushHistory();cl.points=cl.points.filter(p=>p!==pt);rebuildAutoView();autoSave();}}
      ]);
    });
    laneEl.appendChild(canvas);autoInner.appendChild(laneEl);
  });
  let ph=document.getElementById('autoPlayhead');
  if(!ph){ph=document.createElement('div');ph.className='song-playhead';ph.id='autoPlayhead';autoInner.appendChild(ph);}
  ph.style.left=(170+currentSongStep*PX_PER_STEP_AUTO)+'px';
}
function updateAutoPlayhead(step){
  if(currentView!=='auto')return;
  const ph=document.getElementById('autoPlayhead');if(!ph)return;
  ph.style.left=(170+step*PX_PER_STEP_AUTO)+'px';
}

/* =========================================================
   PIANO ROLL PRO  (v10.4 – Strg-Auswahlrahmen)
   ========================================================= */
const prOverlay=document.getElementById('prOverlay');
let prEditor=null;
const SNAP_MODES={
  'off':{label:'Frei',steps:0},
  '1/4':{label:'1/4',steps:4},
  '1/8':{label:'1/8',steps:2},
  '1/16':{label:'1/16',steps:1},
  '1/32':{label:'1/32',steps:0.5},
  '1/8T':{label:'1/8 T',steps:4/3},
  '1/16T':{label:'1/16 T',steps:2/3}
};
function snapTo(steps,mode){const g=SNAP_MODES[mode]?.steps||0;if(!g)return steps;return Math.round(steps/g)*g;}
function updateUndoButtons(){
  if(!prEditor)return;
  const u=document.getElementById('prUndoBtn'),r=document.getElementById('prRedoBtn');
  if(u)u.disabled=historyIndex<=0;
  if(r)r.disabled=historyIndex>=historyStack.length-1;
}

function openPianoRoll(trackId){
  const track=TRACKS.find(t=>t.id===trackId);
  if(!track||track.type!=='melodic')return;
  closePianoRoll();
  const range=track.range;
  const totalNotes=range[1]-range[0]+1;

  const panel=document.createElement('div');panel.className='pr-panel';
  const head=document.createElement('div');head.className='pr-head';
  const title=document.createElement('div');title.className='pr-title';
  title.textContent='🎹 Piano-Roll Pro · '+track.name;
  const info=document.createElement('div');info.className='pr-info';
  info.textContent='Klick leer = Note · Strg+Ziehen = Auswahlrahmen · Markierte Noten ziehen = gemeinsam verschieben · Strg+C/V = kopieren/einfügen';
  const closeBtn=document.createElement('button');closeBtn.textContent='✖ Schließen';closeBtn.style.marginLeft='auto';
  closeBtn.addEventListener('click',closePianoRoll);
  head.appendChild(title);head.appendChild(info);head.appendChild(closeBtn);

  const toolbar=document.createElement('div');toolbar.className='pr-toolbar';
  const snapLbl=document.createElement('label');snapLbl.textContent='Snap:';
  const snapSel=document.createElement('select');
  Object.entries(SNAP_MODES).forEach(([k,v])=>{const o=document.createElement('option');o.value=k;o.textContent=v.label;snapSel.appendChild(o);});
  snapSel.value='1/16';
  const quantLbl=document.createElement('label');quantLbl.textContent='Q:';
  const quantVal=document.createElement('input');quantVal.type='range';quantVal.min='0';quantVal.max='1';quantVal.step='0.05';quantVal.value='1';quantVal.style.width='70px';
  const quantBox=document.createElement('span');quantBox.style.cssText='font-size:11px;color:var(--accent2);font-family:monospace;width:36px;display:inline-block;text-align:center;';quantBox.textContent='100%';
  quantVal.addEventListener('input',()=>{quantBox.textContent=Math.round(parseFloat(quantVal.value)*100)+'%';});
  const btnQuant=document.createElement('button');btnQuant.textContent='Quantisieren';
  const btnQuantLen=document.createElement('button');btnQuantLen.textContent='Längen Q';
  const btnCopy=document.createElement('button');btnCopy.textContent='Kopieren';
  const btnPaste=document.createElement('button');btnPaste.textContent='Einfügen';
  const btnDup=document.createElement('button');btnDup.textContent='Duplizieren';
  const btnDel=document.createElement('button');btnDel.textContent='Löschen';
  const btnAll=document.createElement('button');btnAll.textContent='Alle';
  const btnUndo=document.createElement('button');btnUndo.id='prUndoBtn';btnUndo.textContent='↶ Undo';
  const btnRedo=document.createElement('button');btnRedo.id='prRedoBtn';btnRedo.textContent='↷ Redo';
  toolbar.appendChild(snapLbl);toolbar.appendChild(snapSel);
  toolbar.appendChild(quantLbl);toolbar.appendChild(quantVal);toolbar.appendChild(quantBox);
  toolbar.appendChild(btnQuant);toolbar.appendChild(btnQuantLen);
  toolbar.appendChild(btnCopy);toolbar.appendChild(btnPaste);toolbar.appendChild(btnDup);toolbar.appendChild(btnDel);
  toolbar.appendChild(btnAll);toolbar.appendChild(btnUndo);toolbar.appendChild(btnRedo);

  const main=document.createElement('div');main.className='pr-main';
  const scroll=document.createElement('div');scroll.className='pr-scroll';
  const content=document.createElement('div');content.className='pr-content';

  const pxPerStep=22,keyH=18,keysW=56;
  const notesH=totalNotes*keyH;
  const gridW=stepCount*pxPerStep;
  content.style.width=(keysW+gridW)+'px';
  content.style.height=notesH+'px';

  const keys=document.createElement('div');keys.className='pr-keys';keys.style.height=notesH+'px';
  for(let row=0;row<totalNotes;row++){
    const midi=range[1]-row;const pc=midi%12;
    const k=document.createElement('div');
    k.className='pr-key'+(BLACK_PC.includes(pc)?' black':'')+(pc===0?' c':'');
    k.textContent=midiToName(midi);keys.appendChild(k);
  }
  content.appendChild(keys);

  const grid=document.createElement('div');grid.className='pr-grid';
  grid.style.left=keysW+'px';grid.style.width=gridW+'px';grid.style.height=notesH+'px';
  for(let r=0;r<totalNotes;r++){
    const ln=document.createElement('div');ln.className='pr-row-line';ln.style.top=(r*keyH+keyH-1)+'px';grid.appendChild(ln);
  }
  for(let s=0;s<=stepCount;s++){
    if(s%16===0){const ln=document.createElement('div');ln.className='pr-bar-line';ln.style.left=(s*pxPerStep)+'px';grid.appendChild(ln);}
    else if(s%4===0){const ln=document.createElement('div');ln.className='pr-beat-line';ln.style.left=(s*pxPerStep)+'px';grid.appendChild(ln);}
  }
  content.appendChild(grid);

  const notesLayer=document.createElement('div');
  notesLayer.style.cssText=`position:absolute;left:${keysW}px;top:0;width:${gridW}px;height:${notesH}px;`;
  content.appendChild(notesLayer);

  const ruler=document.createElement('div');ruler.className='pr-ruler';
  ruler.style.cssText=`position:absolute;left:${keysW}px;top:0;width:${gridW}px;height:22px;`;
  for(let s=0;s<stepCount;s+=16){
    const mk=document.createElement('div');mk.className='pr-ruler-mark';
    mk.style.left=(s*pxPerStep)+'px';mk.textContent='Bar '+(s/16+1);ruler.appendChild(mk);
  }
  content.appendChild(ruler);

  const playhead=document.createElement('div');
  playhead.style.cssText=`position:absolute;left:0;top:0;width:1px;height:${notesH}px;background:#fff;pointer-events:none;z-index:6;display:none;box-shadow:0 0 6px rgba(255,255,255,.5);`;
  notesLayer.appendChild(playhead);

  scroll.appendChild(content);main.appendChild(scroll);
  panel.appendChild(head);panel.appendChild(toolbar);panel.appendChild(main);

  const velo=document.createElement('div');velo.className='pr-velo';
  const vLbl=document.createElement('div');vLbl.className='pr-velo-label';vLbl.textContent='VEL';
  const vContent=document.createElement('div');vContent.className='pr-velo-content';
  vContent.style.width=gridW+'px';
  velo.appendChild(vLbl);velo.appendChild(vContent);
  panel.appendChild(velo);

  prOverlay.innerHTML='';prOverlay.appendChild(panel);
  prOverlay.classList.remove('hidden');

  prEditor={
    trackId,range,pxPerStep,keyH,keysW,gridW,notesH,totalNotes,
    scroll,content,notesLayer,vContent,playhead,
    snap:'1/16',quantStrength:1,
    selectedIds:new Set(),clipboard:null,
    drag:null,noteEls:new Map(),veloEls:new Map()
  };

  redrawNotes();
  updateUndoButtons();

  notesLayer.addEventListener('mousedown',onPianoMouseDown);
  notesLayer.addEventListener('contextmenu',onPianoContextMenu);
  document.addEventListener('mousemove',onPianoMouseMove);
  document.addEventListener('mouseup',onPianoMouseUp);

  snapSel.addEventListener('change',()=>{prEditor.snap=snapSel.value;});
  quantVal.addEventListener('input',()=>{prEditor.quantStrength=parseFloat(quantVal.value);});
  btnQuant.addEventListener('click',()=>quantizeSelected(false));
  btnQuantLen.addEventListener('click',()=>quantizeSelected(true));
  btnCopy.addEventListener('click',()=>copySelected());
  btnPaste.addEventListener('click',()=>pasteClipboard());
  btnDup.addEventListener('click',()=>duplicateSelected());
  btnDel.addEventListener('click',()=>deleteSelected());
  btnAll.addEventListener('click',()=>{prEditor.selectedIds=new Set(patterns[currentPattern].pianoRoll[trackId].map(n=>n.id));redrawNotes();});
  btnUndo.addEventListener('click',performUndo);
  btnRedo.addEventListener('click',performRedo);

  vContent.addEventListener('mousedown',onVeloMouseDown);
}

function redrawNotes(){
  if(!prEditor)return;
  const {trackId,range,pxPerStep,keyH,notesLayer,vContent}=prEditor;
  const notes=patterns[currentPattern].pianoRoll[trackId];
  prEditor.noteEls.forEach(el=>el.remove());prEditor.noteEls.clear();
  prEditor.veloEls.forEach(el=>el.remove());prEditor.veloEls.clear();
  notes.forEach(n=>{
    const top=(range[1]-n.midi)*keyH;
    const left=n.start*pxPerStep;
    const width=Math.max(6,n.len*pxPerStep-1);
    const el=document.createElement('div');
    el.className='pr-note'+(prEditor.selectedIds.has(n.id)?' selected':'');
    el.style.left=left+'px';el.style.top=top+'px';
    el.style.width=width+'px';el.style.height=(keyH-2)+'px';
    el.dataset.id=n.id;
    const eL=document.createElement('div');eL.className='edge l';
    const eR=document.createElement('div');eR.className='edge r';
    el.appendChild(eL);el.appendChild(eR);
    if(width>30)el.appendChild(document.createTextNode(midiToName(n.midi)));
    notesLayer.appendChild(el);
    prEditor.noteEls.set(n.id,el);
    const vb=document.createElement('div');
    vb.className='pr-velo-bar'+(prEditor.selectedIds.has(n.id)?' selected':'');
    vb.style.height=Math.max(3,Math.round((n.vel/127)*80))+'px';
    vb.style.left=(left+width/2-2.5)+'px';
    vb.dataset.id=n.id;
    vContent.appendChild(vb);
    prEditor.veloEls.set(n.id,vb);
  });
}
function updateNoteEl(n){
  if(!prEditor)return;
  const el=prEditor.noteEls.get(n.id);if(!el)return;
  el.style.left=(n.start*prEditor.pxPerStep)+'px';
  el.style.top=((prEditor.range[1]-n.midi)*prEditor.keyH)+'px';
  el.style.width=Math.max(6,n.len*prEditor.pxPerStep-1)+'px';
  const vb=prEditor.veloEls.get(n.id);
  if(vb){
    const left=n.start*prEditor.pxPerStep;
    const width=Math.max(6,n.len*prEditor.pxPerStep-1);
    vb.style.left=(left+width/2-2.5)+'px';
    vb.style.height=Math.max(3,Math.round((n.vel/127)*80))+'px';
  }
}
function updateSelectionVisual(){
  if(!prEditor)return;
  prEditor.noteEls.forEach((el,id)=>el.classList.toggle('selected',prEditor.selectedIds.has(id)));
  prEditor.veloEls.forEach((el,id)=>el.classList.toggle('selected',prEditor.selectedIds.has(id)));
}
function clientToStep(clientX){
  const rect=prEditor.notesLayer.getBoundingClientRect();
  return (clientX-rect.left)/prEditor.pxPerStep;
}
function clientToMidi(clientY){
  const rect=prEditor.notesLayer.getBoundingClientRect();
  const row=(clientY-rect.top)/prEditor.keyH;
  return Math.round(prEditor.range[1]-row);
}

/* === Zentraler Mousedown Handler === */
function onPianoMouseDown(e){
  if(!prEditor)return;
  if(e.button!==0)return;
  const target=e.target;
  const noteEl=target.closest('.pr-note');
  const ctrl=e.ctrlKey||e.metaKey;

  // Strg/Cmd + Linksklick ziehen startet immer eine Bereichsauswahl,
  // auch wenn der Startpunkt auf einer vorhandenen Note liegt.
  if(ctrl){
    const rubber=document.createElement('div');
    rubber.className='pr-rubber';rubber.style.display='none';
    prEditor.notesLayer.appendChild(rubber);
    prEditor.drag={
      mode:'marquee',startX:e.clientX,startY:e.clientY,rubberEl:rubber,moved:false,
      baseIds:new Set(prEditor.selectedIds),additive:e.shiftKey,subtract:e.altKey
    };
    e.preventDefault();e.stopPropagation();return;
  }

  // --- Klick auf leere Fläche ---
  if(!noteEl){
    const startStep=snapTo(clientToStep(e.clientX),prEditor.snap);
    const startMidi=clientToMidi(e.clientY);
    const r=document.createElement('div');
    r.className='pr-rubber';r.style.display='none';
    prEditor.notesLayer.appendChild(r);
    prEditor.drag={
      mode:'empty',
      startX:e.clientX,startY:e.clientY,
      startStep,startMidi,
      rubberEl:r,moved:false
    };
    e.preventDefault();
    return;
  }

  // --- Klick auf Kante ---
  if(target.classList.contains('edge')){
    const edge=target.classList.contains('l')?'l':'r';
    const id=noteEl.dataset.id;
    const note=patterns[currentPattern].pianoRoll[prEditor.trackId].find(n=>n.id===id);
    if(!note)return;
    prEditor.drag={
      mode:'resize-'+edge,
      note,origStart:note.start,origLen:note.len,
      startX:e.clientX,preState:snapshotState()
    };
    e.preventDefault();
    return;
  }

  // --- Klick auf Notenkörper ---
  const id=noteEl.dataset.id;
  const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
  const note=notes.find(n=>n.id===id);
  if(!note)return;

  const isSel=prEditor.selectedIds.has(id);
  const alt=e.altKey,shift=e.shiftKey;
  if(alt){
    prEditor.selectedIds.delete(id);updateSelectionVisual();
    e.preventDefault();return;
  }
  if(ctrl||shift){if(!isSel)prEditor.selectedIds.add(id);}
  else if(!isSel)prEditor.selectedIds=new Set([id]);
  updateSelectionVisual();

  const dragNotes=notes.filter(n=>prEditor.selectedIds.has(n.id));
  prEditor.drag={
    mode:'move',
    startX:e.clientX,startY:e.clientY,
    notes:dragNotes.map(n=>({id:n.id,origStart:n.start,origMidi:n.midi})),
    preState:snapshotState()
  };
  e.preventDefault();
}

function onPianoContextMenu(e){
  if(!prEditor)return;
  const target=e.target;
  const noteEl=target.closest('.pr-note');
  if(!noteEl)return;
  e.preventDefault();
  const id=noteEl.dataset.id;
  const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
  const note=notes.find(n=>n.id===id);
  if(!note)return;
  if(!prEditor.selectedIds.has(id)){
    prEditor.selectedIds=new Set([id]);
    updateSelectionVisual();
  }
  const sc=prEditor.selectedIds.size;
  const trackName=TRACKS.find(t=>t.id===prEditor.trackId)?.name||'';
  showContextMenu(e.clientX,e.clientY,[
    {header:sc>1?sc+' Noten gewählt':midiToName(note.midi)+' @ '+note.start.toFixed(2)},
    {label:'Kopieren',shortcut:'Strg+C',action:copySelected},
    {label:'Duplizieren',shortcut:'Strg+D',action:duplicateSelected},
    {label:'Löschen',shortcut:'Entf',action:deleteSelected},
    '---',
    {label:'Länge halbieren',action:halfSelectedNotes},
    {label:'Am Mittelpunkt teilen',action:splitSelectedNotes},
    '---',
    {label:'Oktave hoch',action:()=>transposeSelected(12)},
    {label:'Oktave runter',action:()=>transposeSelected(-12)},
    {label:'Halbton hoch',action:()=>transposeSelected(1)},
    {label:'Halbton runter',action:()=>transposeSelected(-1)},
    '---',
    {label:'Velocity bearbeiten…',action:()=>{
      const v=prompt('Velocity 1–127:',note.vel);if(v==null)return;
      const n=parseInt(v);if(isNaN(n))return;
      pushHistory();
      notes.forEach(x=>{if(prEditor.selectedIds.has(x.id))x.vel=Math.max(1,Math.min(127,n));});
      redrawNotes();autoSave();
    }},
    {label:'Länge setzen…',action:()=>{
      const v=prompt('Länge in Steps:',note.len);if(v==null)return;
      const n=parseFloat(v);if(isNaN(n)||n<=0)return;
      pushHistory();
      notes.forEach(x=>{if(prEditor.selectedIds.has(x.id))x.len=n;});
      syncMelodicSteps(patterns[currentPattern]);redrawNotes();autoSave();
    }},
    '---',
    {label:'Alle Noten dieser Spur löschen',action:()=>{
      if(!confirm('Alle Noten von '+trackName+' löschen?'))return;
      pushHistory();
      patterns[currentPattern].pianoRoll[prEditor.trackId]=[];
      prEditor.selectedIds.clear();
      syncMelodicSteps(patterns[currentPattern]);redrawNotes();autoSave();
    }}
  ]);
}

function onPianoMouseMove(e){
  if(!prEditor||!prEditor.drag)return;
  const d=prEditor.drag;
  if(d.mode==='empty'||d.mode==='marquee'){
    const dx=e.clientX-d.startX,dy=e.clientY-d.startY;
    if(!d.moved&&(Math.abs(dx)>4||Math.abs(dy)>4)){d.moved=true;d.rubberEl.style.display='block';}
    if(!d.moved)return;
    const rect=prEditor.notesLayer.getBoundingClientRect();
    const x1=Math.min(d.startX,e.clientX)-rect.left;
    const y1=Math.min(d.startY,e.clientY)-rect.top;
    const x2=Math.max(d.startX,e.clientX)-rect.left;
    const y2=Math.max(d.startY,e.clientY)-rect.top;
    d.rubberEl.style.left=x1+'px';d.rubberEl.style.top=y1+'px';
    d.rubberEl.style.width=(x2-x1)+'px';d.rubberEl.style.height=(y2-y1)+'px';
    if(d.mode==='marquee'){
      const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
      const hits=[];
      notes.forEach(n=>{
        const nx1=n.start*prEditor.pxPerStep;
        const ny1=(prEditor.range[1]-n.midi)*prEditor.keyH;
        const nx2=nx1+Math.max(6,n.len*prEditor.pxPerStep-1);
        const ny2=ny1+prEditor.keyH-2;
        if(nx2>x1&&nx1<x2&&ny2>y1&&ny1<y2)hits.push(n.id);
      });
      if(d.subtract){
        prEditor.selectedIds=new Set([...d.baseIds].filter(id=>!hits.includes(id)));
      }else if(d.additive){
        prEditor.selectedIds=new Set([...d.baseIds,...hits]);
      }else{
        prEditor.selectedIds=new Set(hits);
      }
      updateSelectionVisual();
    }
  } else if(d.mode==='move'){
    const ds=(e.clientX-d.startX)/prEditor.pxPerStep;
    const dm=Math.round((d.startY-e.clientY)/prEditor.keyH);
    const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
    d.notes.forEach(o=>{
      const n=notes.find(x=>x.id===o.id);if(!n)return;
      let ns=o.origStart+ds;
      ns=Math.max(0,Math.min(stepCount-0.01,ns));
      if(prEditor.snap!=='off'){
        const g=SNAP_MODES[prEditor.snap].steps;
        const os=Math.round(o.origStart/g)*g;
        const delta=Math.round(ds/g)*g;
        ns=Math.max(0,os+delta);
      }
      n.start=ns;
      let nm=o.origMidi+dm;
      nm=Math.max(prEditor.range[0],Math.min(prEditor.range[1],nm));
      n.midi=nm;
      updateNoteEl(n);
    });
  } else if(d.mode==='resize-r'){
    const ds=(e.clientX-d.startX)/prEditor.pxPerStep;
    let nl=d.origLen+ds;nl=Math.max(0.25,Math.min(64,nl));
    if(prEditor.snap!=='off'){const g=SNAP_MODES[prEditor.snap].steps;nl=Math.max(g,Math.round(nl/g)*g);}
    d.note.len=nl;updateNoteEl(d.note);
  } else if(d.mode==='resize-l'){
    const ds=(e.clientX-d.startX)/prEditor.pxPerStep;
    let ns=d.origStart+ds,nl=d.origLen-ds;
    if(prEditor.snap!=='off'){
      const g=SNAP_MODES[prEditor.snap].steps;
      ns=Math.round(ns/g)*g;nl=d.origStart+d.origLen-ns;
      nl=Math.max(g,Math.round(nl/g)*g);ns=d.origStart+d.origLen-nl;
    } else {nl=Math.max(0.25,nl);ns=Math.max(0,ns);}
    d.note.start=ns;d.note.len=nl;updateNoteEl(d.note);
  } else if(d.mode==='velo'){
    const rect=prEditor.vContent.getBoundingClientRect();
    const relY=e.clientY-rect.top;
    const val=Math.max(1,Math.min(127,Math.round((1-relY/80)*127)));
    const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
    d.noteIds.forEach(id=>{const n=notes.find(x=>x.id===id);if(n){n.vel=val;updateNoteEl(n);}});
  }
}
function onPianoMouseUp(e){
  if(!prEditor||!prEditor.drag)return;
  const d=prEditor.drag;
  if(d.mode==='empty'||d.mode==='marquee'){
    if(d.rubberEl)d.rubberEl.remove();
    if(d.mode==='empty'&&!d.moved){
      // Einfacher Klick auf leere Fläche = Note erstellen.
      const note={
        id:genId('n'),
        start:Math.max(0,Math.min(stepCount-1,d.startStep)),
        len:1,
        midi:Math.max(prEditor.range[0],Math.min(prEditor.range[1],d.startMidi)),
        vel:100
      };
      patterns[currentPattern].pianoRoll[prEditor.trackId].push(note);
      syncMelodicSteps(patterns[currentPattern]);
      prEditor.selectedIds=new Set([note.id]);
      prEditor.drag=null;
      redrawNotes();pushHistory();autoSave();
      return;
    }
    if(d.mode==='empty'&&d.moved){
      // Bisheriges Verhalten bleibt erhalten: Ziehen auf leerer Fläche wählt aus.
      const rect=prEditor.notesLayer.getBoundingClientRect();
      const x1=Math.min(d.startX,e.clientX)-rect.left;
      const y1=Math.min(d.startY,e.clientY)-rect.top;
      const x2=Math.max(d.startX,e.clientX)-rect.left;
      const y2=Math.max(d.startY,e.clientY)-rect.top;
      const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
      const hits=[];
      notes.forEach(n=>{
        const nx1=n.start*prEditor.pxPerStep;
        const ny1=(prEditor.range[1]-n.midi)*prEditor.keyH;
        const nx2=nx1+Math.max(6,n.len*prEditor.pxPerStep-1);
        const ny2=ny1+prEditor.keyH-2;
        if(nx2>x1&&nx1<x2&&ny2>y1&&ny1<y2)hits.push(n.id);
      });
      if(e.shiftKey||e.ctrlKey||e.metaKey)hits.forEach(id=>prEditor.selectedIds.add(id));
      else prEditor.selectedIds=new Set(hits);
    } else if(d.mode==='marquee'&&!d.moved){
      // Strg-Klick ohne Ziehen toggelt die Note unter dem Cursor in der Auswahl.
      const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.pr-note');
      if(hit&&prEditor.notesLayer.contains(hit)){
        const id=hit.dataset.id;
        const next=new Set(d.baseIds);
        if(next.has(id))next.delete(id);else next.add(id);
        if(d.subtract)next.delete(id);
        prEditor.selectedIds=next;
      }else{
        prEditor.selectedIds=new Set(d.baseIds);
      }
    }
    updateSelectionVisual();
  } else if(d.mode==='move'||d.mode==='resize-l'||d.mode==='resize-r'){
    pushHistory();
    syncMelodicSteps(patterns[currentPattern]);
  } else if(d.mode==='velo'){
    pushHistory();
  }
  prEditor.drag=null;
  syncMelodicSteps(patterns[currentPattern]);
  redrawNotes();autoSave();
}
function onVeloMouseDown(e){
  if(!prEditor)return;
  const bar=e.target.closest('.pr-velo-bar');if(!bar)return;
  const id=bar.dataset.id;
  if(!prEditor.selectedIds.has(id)){
    prEditor.selectedIds=new Set([id]);
    updateSelectionVisual();
  }
  prEditor.drag={mode:'velo',noteIds:Array.from(prEditor.selectedIds),preState:snapshotState()};
  e.stopPropagation();
  e.preventDefault();
}

function getSelectedNotes(){return patterns[currentPattern].pianoRoll[prEditor.trackId].filter(n=>prEditor.selectedIds.has(n.id));}
function deleteSelected(){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const tid=prEditor.trackId;
  patterns[currentPattern].pianoRoll[tid]=patterns[currentPattern].pianoRoll[tid].filter(n=>!prEditor.selectedIds.has(n.id));
  prEditor.selectedIds.clear();
  syncMelodicSteps(patterns[currentPattern]);
  redrawNotes();pushHistory();autoSave();
}
function copySelected(){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const sel=getSelectedNotes();
  const ms=Math.min(...sel.map(n=>n.start));
  prEditor.clipboard=sel.map(n=>({start:n.start-ms,len:n.len,midi:n.midi,vel:n.vel}));
  toast(sel.length+' Note(n) kopiert','success');
}
function pasteClipboard(){
  if(!prEditor||!prEditor.clipboard)return;
  const tid=prEditor.trackId;
  const target=(playMode==='song')?(currentSongStep%stepCount):0;
  const newIds=new Set();
  prEditor.clipboard.forEach(c=>{
    const id=genId('n');
    const start=Math.min(stepCount-0.5,target+c.start);
    patterns[currentPattern].pianoRoll[tid].push({id,start,len:c.len,midi:c.midi,vel:c.vel});
    newIds.add(id);
  });
  prEditor.selectedIds=newIds;
  syncMelodicSteps(patterns[currentPattern]);
  redrawNotes();pushHistory();autoSave();
}
function duplicateSelected(){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const tid=prEditor.trackId;
  const sel=getSelectedNotes();
  const maxEnd=Math.max(...sel.map(n=>n.start+n.len));
  const minStart=Math.min(...sel.map(n=>n.start));
  const offset=maxEnd-minStart;
  const newIds=new Set();
  sel.forEach(n=>{
    const id=genId('n');
    patterns[currentPattern].pianoRoll[tid].push({id,start:n.start+offset,len:n.len,midi:n.midi,vel:n.vel});
    newIds.add(id);
  });
  prEditor.selectedIds=newIds;
  syncMelodicSteps(patterns[currentPattern]);
  redrawNotes();pushHistory();autoSave();
}
function quantizeSelected(lengthsOnly){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const g=SNAP_MODES[prEditor.snap]?.steps||1;
  const s=prEditor.quantStrength;
  const tid=prEditor.trackId;
  patterns[currentPattern].pianoRoll[tid].forEach(n=>{
    if(!prEditor.selectedIds.has(n.id))return;
    if(lengthsOnly){
      const sn=Math.max(g,Math.round(n.len/g)*g);
      n.len=n.len+(sn-n.len)*s;
    } else {
      const ss=Math.round(n.start/g)*g;
      n.start=Math.max(0,n.start+(ss-n.start)*s);
    }
  });
  syncMelodicSteps(patterns[currentPattern]);
  redrawNotes();pushHistory();autoSave();
  toast(lengthsOnly?'Längen quantisiert':'Noten quantisiert','success');
}
function halfSelectedNotes(){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const notes=patterns[currentPattern].pianoRoll[prEditor.trackId];
  notes.forEach(n=>{if(prEditor.selectedIds.has(n.id))n.len=Math.max(0.25,(n.len||1)/2);});
  syncMelodicSteps(patterns[currentPattern]);redrawNotes();pushHistory();autoSave();
  toast('Länge halbiert','success');
}
function splitSelectedNotes(){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const tid=prEditor.trackId;
  const arr=patterns[currentPattern].pianoRoll[tid];
  const add=[];let sc=0,sk=0;
  arr.forEach(n=>{
    if(!prEditor.selectedIds.has(n.id))return;
    const len=n.len||1;
    if(len<0.5){sk++;return;}
    const half=len/2;
    const second={id:genId('n'),start:n.start+half,len:len-half,midi:n.midi,vel:n.vel};
    n.len=half;add.push(second);sc++;
  });
  if(!sc){toast('Keine Note lang genug','error');return;}
  arr.push(...add);
  syncMelodicSteps(patterns[currentPattern]);redrawNotes();pushHistory();autoSave();
  toast(sc+' Noten geteilt'+(sk?' ('+sk+' zu kurz)':''),'success');
}
function transposeSelected(semis){
  if(!prEditor||!prEditor.selectedIds.size)return;
  const tid=prEditor.trackId;
  const arr=patterns[currentPattern].pianoRoll[tid];
  const r=prEditor.range;
  arr.forEach(n=>{if(prEditor.selectedIds.has(n.id))n.midi=Math.max(r[0],Math.min(r[1],n.midi+semis));});
  redrawNotes();pushHistory();autoSave();
}
function performUndo(){
  if(prEditor)prEditor.selectedIds.clear();
  undoHistory();
  if(prEditor){redrawNotes();updateUndoButtons();}
}
function performRedo(){
  if(prEditor)prEditor.selectedIds.clear();
  redoHistory();
  if(prEditor){redrawNotes();updateUndoButtons();}
}
function updatePRPlayhead(localStep){
  if(!prEditor)return;
  prEditor.playhead.style.display='block';
  prEditor.playhead.style.left=(localStep*prEditor.pxPerStep)+'px';
}
function closePianoRoll(){
  if(prEditor&&prEditor.notesLayer){
    prEditor.notesLayer.removeEventListener('mousedown',onPianoMouseDown);
    prEditor.notesLayer.removeEventListener('contextmenu',onPianoContextMenu);
  }
  document.removeEventListener('mousemove',onPianoMouseMove);
  document.removeEventListener('mouseup',onPianoMouseUp);
  prOverlay.classList.add('hidden');
  prOverlay.innerHTML='';
  prEditor=null;
}

/* ---------- Save / Load Modal ---------- */
function showSaveModal(){
  const ta=document.createElement('textarea');ta.value=JSON.stringify(serialize(),null,2);ta.readOnly=true;
  const wrap=document.createElement('div');wrap.appendChild(ta);
  const info=document.createElement('div');info.style.cssText='font-size:11px;color:var(--muted);margin-top:8px;';
  const refs=Object.values(samples).filter(s=>s.id);
  info.textContent=refs.length?('Samples: '+refs.map(s=>s.name).join(', ')):'Keine externen Samples.';
  wrap.appendChild(info);
  showModal('💾 Projekt (JSON v12)',wrap,[
    {label:'📋 Kopieren',onClick:async()=>{try{await navigator.clipboard.writeText(ta.value);toast('Kopiert','success');}catch(e){ta.select();document.execCommand('copy');toast('Kopiert','success');}}},
    {label:'⬇ Download',onClick:()=>{
      const blob=new Blob([ta.value],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`flclone-${new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')}.json`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Download','success');
    }},
    {label:'Schließen',onClick:hideModal}
  ]);
  setTimeout(()=>{ta.focus();ta.select();},50);
}
function showLoadModal(){
  const ta=document.createElement('textarea');ta.placeholder='JSON (v5–v12) …';
  const fi=document.createElement('input');fi.type='file';fi.accept='.json,application/json';fi.style.display='none';
  fi.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{ta.value=ev.target.result;};r.readAsText(f);e.target.value='';});
  const wrap=document.createElement('div');wrap.appendChild(ta);wrap.appendChild(fi);
  showModal('📂 Projekt importieren',wrap,[
    {label:'📁 Datei',onClick:()=>fi.click()},
    {label:'✔ Laden',className:'play',onClick:async()=>{
      const t=ta.value.trim();if(!t){toast('Kein JSON','error');return;}
      try{const res=apply(JSON.parse(t));if(res.ok){await restoreSamplesFromDB();autoSave();hideModal();toast('Projekt geladen','success');}else toast('Fehler: '+(res.msg||'?'),'error');}
      catch(err){toast('JSON-Fehler: '+err.message,'error');}
    }},
    {label:'Abbrechen',onClick:hideModal}
  ]);
}

/* ---------- WAV Export ---------- */
function encodeWav(ab,bitDepth){
  const nch=ab.numberOfChannels,sr=ab.sampleRate,len=ab.length,bps=bitDepth/8,ba=nch*bps,ds=len*ba;
  const buffer=new ArrayBuffer(44+ds);const view=new DataView(buffer);let o=0;
  const ws=s=>{for(let i=0;i<s.length;i++)view.setUint8(o++,s.charCodeAt(i));};
  const u32=v=>{view.setUint32(o,v,true);o+=4;};
  const u16=v=>{view.setUint16(o,v,true);o+=2;};
  ws('RIFF');u32(36+ds);ws('WAVE');ws('fmt ');u32(16);u16(1);u16(nch);u32(sr);u32(sr*ba);u16(ba);u16(bitDepth);ws('data');u32(ds);
  const ch=[];for(let c=0;c<nch;c++)ch.push(ab.getChannelData(c));
  if(bitDepth===16){for(let i=0;i<len;i++)for(let c=0;c<nch;c++){let s=Math.max(-1,Math.min(1,ch[c][i]));s=s<0?s*0x8000:s*0x7FFF;view.setInt16(o,s|0,true);o+=2;}}
  else if(bitDepth===24){for(let i=0;i<len;i++)for(let c=0;c<nch;c++){let s=Math.max(-1,Math.min(1,ch[c][i]));s=s<0?s*0x800000:s*0x7FFFFF;const v=s|0;view.setUint8(o,v&0xFF);view.setUint8(o+1,(v>>8)&0xFF);view.setUint8(o+2,(v>>16)&0xFF);o+=3;}}
  return new Blob([buffer],{type:'audio/wav'});
}
async function exportWav(opts){
  const {sampleRate,bitDepth,tailSeconds}=opts;
  const stepDur=(60/bpm)/4;
  const totalSteps=(playMode==='song')?getSongLength():stepCount;
  const duration=totalSteps*stepDur+tailSeconds;
  const numFrames=Math.ceil(duration*sampleRate);
  const offline=new OfflineAudioContext(2,numFrames,sampleRate);
  const graph=buildGraph(offline,{master,reverbAmount,tracks:TRACKS});
  for(let step=0;step<totalSteps;step++){
    const time=step*stepDur;
    if(playMode==='pattern'){
      TRACKS.forEach(track=>{
        const audible=(!soloActive||track.solo)&&!track.mute;if(!audible)return;
        scheduleTrackStep(offline,graph.buses,track,currentPattern,step%stepCount,time,stepDur,step);
      });
    } else {
      applyAutomationForStep(graph,step,time,stepDur);
      song.blocks.forEach(block=>{
        if(step<block.startStep||step>=block.startStep+block.lengthSteps)return;
        const localStep=(step-block.startStep+(block.sourceOffsetSteps||0))%stepCount;
        TRACKS.forEach(track=>{
          const audible=(!soloActive||track.solo)&&!track.mute;if(!audible)return;
          scheduleTrackStep(offline,graph.buses,track,block.patternId,localStep,time,stepDur,step);
        });
      });
    }
  }
  const rendered=await offline.startRendering();
  return encodeWav(rendered,bitDepth);
}
function showExportModal(){
  const wrap=document.createElement('div');
  wrap.innerHTML=`
    <div class="row"><label>Sample Rate</label>
      <select id="expSR" style="background:#111;color:#ddd;border:1px solid #000;padding:4px;">
        <option value="44100" selected>44100 Hz</option>
        <option value="48000">48000 Hz</option>
      </select>
      <label style="margin-left:16px">Bit Depth</label>
      <select id="expBD" style="background:#111;color:#ddd;border:1px solid #000;padding:4px;">
        <option value="16" selected>16 Bit PCM</option>
        <option value="24">24 Bit PCM</option>
      </select>
    </div>
    <div class="row" style="margin-top:10px">
      <label>Tail (s)</label>
      <input id="expTail" type="number" min="0" max="10" step="0.5" value="3" style="width:80px;background:#111;color:#ddd;border:1px solid #000;padding:4px;">
    </div>
    <div class="progress" style="margin-top:14px"><div class="bar" id="expBar"></div></div>
    <div id="expStatus" style="font-size:11px;color:var(--muted);margin-top:6px">
      Modus: ${playMode==='song'?'Song ('+getSongLength()+' Steps)':'Pattern ('+stepCount+' Steps)'}
    </div>`;
  showModal('📤 WAV-Export',wrap,[
    {label:'Abbrechen',onClick:hideModal},
    {label:'Export starten',className:'play',onClick:async()=>{
      const sr=parseInt(document.getElementById('expSR').value);
      const bd=parseInt(document.getElementById('expBD').value);
      const tail=parseFloat(document.getElementById('expTail').value)||0;
      const bar=document.getElementById('expBar'),status=document.getElementById('expStatus');
      bar.style.width='15%';status.textContent='Rendering …';
      try{
        initAudio();
        const blob=await exportWav({sampleRate:sr,bitDepth:bd,tailSeconds:tail});
        bar.style.width='100%';status.textContent='Fertig.';
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download=`flclone-${new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')}.wav`;
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        setTimeout(()=>URL.revokeObjectURL(url),3000);
        toast('WAV exportiert','success');setTimeout(hideModal,400);
      }catch(err){console.error(err);status.textContent='Fehler: '+err.message;toast('Export: '+err.message,'error');}
    }}
  ]);
}
/* =========================================================
   FL Clone v10.4 – Bootstrap
   ========================================================= */

let isPlaying=false,currentStep=0,nextNoteTime=0,timerId=null;
const LOOKAHEAD=25,SCHEDULE_AHEAD=0.1;
function getStepDuration(){return (60/bpm)/4;}

function scheduleLiveStep(step,time){
  const stepDur=getStepDuration();
  const audible=t=>(!soloActive||t.solo)&&!t.mute;
  if(playMode==='pattern'){
    TRACKS.forEach(track=>{
      if(!audible(track))return;
      scheduleTrackStep(ctx,buses,track,currentPattern,step%stepCount,time,stepDur,step);
    });
  } else {
    applyAutomationForStep({master:masterGain,buses,_fxMaps:buses._fxMaps},step,time,stepDur);
    song.blocks.forEach(block=>{
      if(step<block.startStep||step>=block.startStep+block.lengthSteps)return;
      const localStep=(step-block.startStep+(block.sourceOffsetSteps||0))%stepCount;
      TRACKS.forEach(track=>{
        if(!audible(track))return;
        scheduleTrackStep(ctx,buses,track,block.patternId,localStep,time,stepDur,step);
      });
    });
  }
  const delay=Math.max(0,(time-ctx.currentTime)*1000);
  setTimeout(()=>uiTick(step),delay);
}
function uiTick(step){
  if(playMode==='pattern'){
    const pat=patterns[currentPattern];const local=step%stepCount;
    TRACKS.forEach(track=>{
      const arr=stepEls[track.id];
      if(arr)for(let i=0;i<arr.length;i++)arr[i].classList.toggle('playing',i===local);
      let on=false;
      if(track.type==='melodic')on=patternHasNoteAtStep(pat,track.id,local);
      else on=isStepOn(pat,track.id,local);
      if(on)flashLeds(track);
    });
    if(prEditor)updatePRPlayhead(local);
  } else {
    song.blocks.forEach(block=>{
      if(step>=block.startStep&&step<block.startStep+block.lengthSteps){
        TRACKS.forEach(track=>flashLeds(track));
      }
    });
    updateSongPositionDisplay(step);
    updateSongPlayhead();
    updateAutoPlayhead(step);
  }
}
function flashLeds(track){
  const led=ledEls[track.id];
  if(led){led.style.opacity=1;led.style.boxShadow=`0 0 10px ${track.color}`;}
  const ml=ledEls['mix_'+track.id];
  if(ml){ml.style.opacity=1;ml.style.boxShadow=`0 0 10px ${track.color}`;}
  setTimeout(()=>{
    if(led){led.style.opacity=0.25;led.style.boxShadow='none';}
    if(ml){ml.style.opacity=0.25;ml.style.boxShadow='none';}
  },90);
}
function scheduler(){
  while(nextNoteTime<ctx.currentTime+SCHEDULE_AHEAD){
    const S=getStepDuration();
    let advance=S;
    if(swing>0&&playMode==='pattern')advance+=(currentStep%2===0?1:-1)*S*swing/3;
    if(playMode==='pattern'){
      scheduleLiveStep(currentStep,nextNoteTime);
      nextNoteTime+=advance;
      currentStep=(currentStep+1)%stepCount;
    } else {
      scheduleLiveStep(currentSongStep,nextNoteTime);
      nextNoteTime+=advance;
      currentSongStep++;
      if(song.loopEnd>song.loopStart&&currentSongStep>=song.loopEnd)currentSongStep=song.loopStart;
      else if(song.loopEnd<=song.loopStart&&currentSongStep>=getSongLength())currentSongStep=0;
    }
  }
  timerId=setTimeout(scheduler,LOOKAHEAD);
}
function startPlayback(){
  initAudio();if(ctx.state==='suspended')ctx.resume();
  if(isPlaying)return;isPlaying=true;
  if(playMode==='pattern')currentStep=0;
  else if(currentSongStep>=getSongLength())currentSongStep=0;
  nextNoteTime=ctx.currentTime+0.05;scheduler();
}
function stopPlayback(){
  isPlaying=false;
  if(timerId){clearTimeout(timerId);timerId=null;}
  TRACKS.forEach(track=>{
    if(stepEls[track.id])stepEls[track.id].forEach(el=>el.classList.remove('playing'));
    const led=ledEls[track.id];
    if(led){led.style.opacity=0.25;led.style.boxShadow='none';}
    const ml=ledEls['mix_'+track.id];
    if(ml){ml.style.opacity=0.25;ml.style.boxShadow='none';}
  });
}
function setPlayMode(mode){
  playMode=mode;
  document.getElementById('modePatternBtn').classList.toggle('active',mode==='pattern');
  document.getElementById('modeSongBtn').classList.toggle('active',mode==='song');
  document.querySelectorAll('.pattern').forEach(b=>b.style.opacity=mode==='pattern'?'':'0.5');
  document.querySelectorAll('.step-count').forEach(b=>b.style.opacity=mode==='pattern'?'':'0.5');
  updateSongPositionDisplay(mode==='song'?currentSongStep:0);
}
const rackView=document.getElementById('rackView');
const songView=document.getElementById('songView');
const autoView=document.getElementById('autoView');
function setView(v){
  currentView=v;
  const all={rack:rackView,mixer:mixerView,song:songView,auto:autoView};
  Object.entries(all).forEach(([k,el])=>el.classList.toggle('hidden',k!==v));
  document.getElementById('viewRackBtn').classList.toggle('active',v==='rack');
  document.getElementById('viewMixerBtn').classList.toggle('active',v==='mixer');
  document.getElementById('viewSongBtn').classList.toggle('active',v==='song');
  document.getElementById('viewAutoBtn').classList.toggle('active',v==='auto');
  if(v==='song')rebuildSong();
  if(v==='auto')rebuildAutoView();
}

/* ---------- Events ---------- */
document.getElementById('playBtn').addEventListener('click',startPlayback);
document.getElementById('stopBtn').addEventListener('click',stopPlayback);
document.getElementById('bpm').addEventListener('input',e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=40&&v<=300){bpm=v;autoSave();}});
document.getElementById('swing').addEventListener('input',e=>{swing=parseInt(e.target.value)/100;document.getElementById('swingVal').textContent=Math.round(swing*100)+'%';autoSave();});
document.getElementById('humanize').addEventListener('input',e=>{humanizeTiming=parseInt(e.target.value)/100;document.getElementById('humVal').textContent=e.target.value+'%';autoSave();});
document.getElementById('humanizeV').addEventListener('input',e=>{humanizeVelocity=parseInt(e.target.value)/100;document.getElementById('humVVal').textContent=e.target.value+'%';autoSave();});
document.getElementById('master').addEventListener('input',e=>{master=parseFloat(e.target.value);if(masterGain)masterGain.gain.value=master;const mF=document.querySelector('.master-strip .fader');if(mF)mF.value=master;autoSave();});
document.getElementById('reverbAmount').addEventListener('input',e=>{reverbAmount=parseFloat(e.target.value);if(reverbReturn)reverbReturn.gain.value=reverbAmount;autoSave();});
document.querySelectorAll('.step-count').forEach(btn=>btn.addEventListener('click',()=>{
  if(playMode!=='pattern')return;
  stepCount=parseInt(btn.dataset.count);
  if(prEditor)closePianoRoll();
  rebuildRack();autoSave();
}));
document.querySelectorAll('.pattern').forEach(btn=>btn.addEventListener('click',()=>{
  if(playMode!=='pattern')return;
  const id=btn.dataset.pattern;if(id===currentPattern)return;
  currentPattern=id;if(prEditor)closePianoRoll();
  rebuildRack();toast('Pattern '+id);autoSave();
}));
document.getElementById('modePatternBtn').addEventListener('click',()=>setPlayMode('pattern'));
document.getElementById('modeSongBtn').addEventListener('click',()=>setPlayMode('song'));
document.getElementById('viewRackBtn').addEventListener('click',()=>setView('rack'));
document.getElementById('viewMixerBtn').addEventListener('click',()=>setView('mixer'));
document.getElementById('viewSongBtn').addEventListener('click',()=>setView('song'));
document.getElementById('viewAutoBtn').addEventListener('click',()=>setView('auto'));
document.getElementById('saveBtn').addEventListener('click',showSaveModal);
document.getElementById('loadBtn').addEventListener('click',showLoadModal);
document.getElementById('exportBtn').addEventListener('click',showExportModal);
document.getElementById('songAddClipBtn').addEventListener('click',()=>{
  pushHistory();
  const block={id:genId('block'),patternId:currentPattern,startStep:Math.max(0,currentSongStep),lengthSteps:stepCount,sourceOffsetSteps:0};
  song.blocks.push(block);songSelectedIds=new Set([block.id]);
  rebuildSong();autoSave();toast('Pattern-Block hinzugefügt','success');
});
document.getElementById('songDupBtn').addEventListener('click',duplicateSelectedClips);
document.getElementById('songDelBtn').addEventListener('click',deleteSelectedClips);
document.getElementById('loopSetBtn').addEventListener('click',()=>{
  const a=Math.max(0,parseInt(document.getElementById('loopStart').value)||0);
  const b=Math.max(0,parseInt(document.getElementById('loopEnd').value)||0);
  if(b<=a){toast('Loop-Ende > Start nötig','error');return;}
  song.loopStart=a;song.loopEnd=b;rebuildSong();rebuildAutoView();autoSave();toast(`Loop ${a}–${b}`,'success');
});
document.getElementById('loopClearBtn').addEventListener('click',()=>{
  song.loopStart=0;song.loopEnd=0;
  document.getElementById('loopStart').value=0;document.getElementById('loopEnd').value=64;
  rebuildSong();rebuildAutoView();autoSave();
});
document.getElementById('autoAddLaneBtn').addEventListener('click',()=>{
  const tid=document.getElementById('autoTargetSel').value;
  if(automation.lanes.some(l=>l.target===tid)){toast('Ziel existiert bereits','error');return;}
  const lane=createAutoLane(tid);if(!lane)return;
  pushHistory();automation.lanes.push(lane);selectedAutoLaneId=lane.id;
  rebuildAutoView();autoSave();toast('Lane hinzugefügt','success');
});
document.getElementById('autoDelLaneBtn').addEventListener('click',()=>{
  if(!selectedAutoLaneId){toast('Keine Lane gewählt','error');return;}
  if(!confirm('Automation-Lane löschen?'))return;
  pushHistory();automation.lanes=automation.lanes.filter(l=>l.id!==selectedAutoLaneId);
  selectedAutoLaneId=null;rebuildAutoView();autoSave();
});
document.getElementById('autoCurveSel').addEventListener('change',e=>{
  if(!selectedAutoLaneId)return;
  const lane=automation.lanes.find(l=>l.id===selectedAutoLaneId);if(!lane)return;
  pushHistory();lane.curve=e.target.value;rebuildAutoView();autoSave();
});
let clearArmed=false,clearTimer=null;
const clearBtn=document.getElementById('clearBtn');
clearBtn.addEventListener('click',()=>{
  if(!clearArmed){
    clearArmed=true;clearBtn.classList.add('armed');clearBtn.textContent='⚠';
    clearTimer=setTimeout(()=>{clearArmed=false;clearBtn.classList.remove('armed');clearBtn.textContent='✖';},3000);
    return;
  }
  clearTimeout(clearTimer);clearArmed=false;clearBtn.classList.remove('armed');clearBtn.textContent='✖';
  pushHistory();patterns[currentPattern]=createEmptyPattern();
  if(prEditor)closePianoRoll();
  rebuildRack();autoSave();toast('Pattern '+currentPattern+' geleert','success');
});
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(prEditor){
    if(ctrl&&e.key.toLowerCase()==='z'){e.preventDefault();performUndo();return;}
    if(ctrl&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();performRedo();return;}
    if(ctrl&&e.key.toLowerCase()==='c'){e.preventDefault();copySelected();return;}
    if(ctrl&&e.key.toLowerCase()==='v'){e.preventDefault();pasteClipboard();return;}
    if(ctrl&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();return;}
    if(ctrl&&e.key.toLowerCase()==='a'){e.preventDefault();prEditor.selectedIds=new Set(patterns[currentPattern].pianoRoll[prEditor.trackId].map(n=>n.id));updateSelectionVisual();return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();return;}
    if(e.code==='Escape'){e.preventDefault();prEditor.selectedIds.clear();updateSelectionVisual();return;}
    return;
  }
  if(ctrl&&e.key.toLowerCase()==='z'){e.preventDefault();undoHistory();return;}
  if(ctrl&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();redoHistory();return;}
  if(e.code==='Space'){e.preventDefault();isPlaying?stopPlayback():startPlayback();}
  if(e.code==='Escape'){
    if(!modalOverlay.classList.contains('hidden'))hideModal();
    hideContextMenu();closeStepEditor();clearClipSelection();
  }
  if(e.key==='Delete'||e.key==='Backspace'){
    if(currentView==='song'&&songSelectedIds.size){e.preventDefault();deleteSelectedClips();return;}
  }
  if(e.key>='1'&&e.key<='4'&&playMode==='pattern'){
    const id=PATTERN_IDS[parseInt(e.key)-1];
    if(id&&id!==currentPattern){currentPattern=id;rebuildRack();toast('Pattern '+id);autoSave();}
  }
  if(e.key==='m'||e.key==='M')setView('mixer');
  if(e.key==='r'||e.key==='R')setView('rack');
  if(e.key==='s'&&!e.shiftKey)setView('song');
  if(e.key==='a'||e.key==='A')setView('auto');
  if(e.key==='S'&&e.shiftKey)setPlayMode(playMode==='song'?'pattern':'song');
});
prOverlay.addEventListener('click',e=>{if(e.target===prOverlay)closePianoRoll();});
modalOverlay.addEventListener('click',e=>{if(e.target===modalOverlay)hideModal();});
window.addEventListener('error',ev=>{try{toast('Fehler: '+(ev.message||'?'),'error');}catch(e){}});

/* ---------- Init ---------- */
(async function init(){
  try{await openDB();}catch(e){console.warn('IndexedDB n/a',e);}
  initDefaultPatterns();
  document.getElementById('bpm').value=bpm;
  document.getElementById('humanize').value=Math.round(humanizeTiming*100);
  document.getElementById('humVal').textContent=Math.round(humanizeTiming*100)+'%';
  document.getElementById('humanizeV').value=Math.round(humanizeVelocity*100);
  document.getElementById('humVVal').textContent=Math.round(humanizeVelocity*100)+'%';
  document.getElementById('loopStart').value=0;document.getElementById('loopEnd').value=64;
  const loaded=await tryLoadAutoSave();
  if(!loaded){
    rebuildRack();rebuildMixer();rebuildSong();rebuildAutoView();
    setPlayMode('pattern');initHistory();
  } else {
    toast('Letzter Zustand wiederhergestellt','info');
    await restoreSamplesFromDB();
  }
})(); 
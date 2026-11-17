'use strict';
let sequenceCanvasHome=null,sequenceCanvasNext=null,sequenceHadFullscreen=false;
function openSequencePreview(){
 const dialog=document.getElementById('sequencePreview');
 const surface=document.getElementById('preview');
 if(!dialog.open){
  sequenceCanvasHome=surface.parentNode;sequenceCanvasNext=surface.nextSibling;
  document.getElementById('sequenceStage').append(surface);
  dialog.showModal();
  // iPhone browsers without element fullscreen still get a viewport-filling dialog.
  if(dialog.requestFullscreen){
   try{Promise.resolve(dialog.requestFullscreen()).then(()=>{
    if(!dialog.open){if(document.fullscreenElement===dialog)void document.exitFullscreen().catch(()=>{});return;}
    sequenceHadFullscreen=document.fullscreenElement===dialog;
   }).catch(()=>{});}catch(e){}
  }
 }
 document.getElementById('sequenceReplay').hidden=true;
 document.getElementById('sequenceProgress').textContent='미리보기 준비 중…';
 document.getElementById('sequenceClose').focus({preventScroll:true});
}
function closeSequencePreview(){
 const dialog=document.getElementById('sequencePreview');
 if(!dialog.open)return;
 cancelled=true;
 dialog.close();
 sequenceHadFullscreen=false;
 if(document.fullscreenElement===dialog)void document.exitFullscreen().catch(()=>{});
 if(sequenceCanvasHome){
  sequenceCanvasHome.insertBefore(document.getElementById('preview'),sequenceCanvasNext?.parentNode===sequenceCanvasHome?sequenceCanvasNext:null);
  sequenceCanvasHome=null;sequenceCanvasNext=null;
 }
 // A running sequence unlocks controls in its finally block.
 if(!busy)document.getElementById('play').focus({preventScroll:true});
}
document.getElementById('sequenceClose').onclick=closeSequencePreview;
document.getElementById('sequencePreview').addEventListener('cancel',e=>{e.preventDefault();closeSequencePreview();});
document.getElementById('sequenceReplay').onclick=()=>sequence(false);
document.addEventListener('fullscreenchange',()=>{
 if(sequenceHadFullscreen&&document.fullscreenElement!==document.getElementById('sequencePreview'))closeSequencePreview();
});

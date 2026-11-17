const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(fullscreen=false){
 const nodes={};let focused;
 const events={};
 function node(id){return nodes[id]={id,hidden:false,open:false,children:[],append(child){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(x=>x!==child);this.children.push(child);child.parentNode=this;},insertBefore(child,next){this.append(child);this.children.pop();this.children.splice(next?this.children.indexOf(next):this.children.length,0,child);},showModal(){this.open=true;},close(){this.open=false;},focus(){focused=id;},addEventListener(type,fn){events[id+type]=fn;}};}
 for(const id of ['sequencePreview','preview','sequenceStage','sequenceReplay','sequenceProgress','sequenceClose','play','viewer','camera'])node(id);
 nodes.viewer.append(nodes.preview);nodes.viewer.append(nodes.camera);nodes.preview.nextSibling=nodes.camera;
 const document={getElementById:id=>nodes[id],fullscreenElement:null,addEventListener(type,fn){events[type]=fn;},async exitFullscreen(){this.fullscreenElement=null;}};
 if(fullscreen)nodes.sequencePreview.requestFullscreen=async()=>{document.fullscreenElement=nodes.sequencePreview;};
 const context=vm.createContext({document,cancelled:false,busy:false,sequence(){}});
 vm.runInContext(fs.readFileSync('preview.js','utf8'),context);
 return {context,nodes,events,document,focused:()=>focused};
}
test('iPhone fallback opens at viewport size, moves original canvas and restores it on close',()=>{
 const {context,nodes,focused}=setup();context.openSequencePreview();
 assert.equal(nodes.sequencePreview.open,true);assert.equal(nodes.preview.parentNode,nodes.sequenceStage);assert.equal(nodes.sequenceReplay.hidden,true);
 context.closeSequencePreview();assert.equal(nodes.sequencePreview.open,false);assert.equal(context.cancelled,true);assert.equal(nodes.preview.parentNode,nodes.viewer);assert.deepEqual(nodes.viewer.children.map(x=>x.id),['preview','camera']);assert.equal(focused(),'play');
 context.openSequencePreview();context.closeSequencePreview();assert.equal(nodes.viewer.children.length,2);
});
test('Escape cancels playback and restores gallery while playback is busy',()=>{
 const {context,nodes,events}=setup();context.openSequencePreview();context.busy=true;let prevented=false;
 events.sequencePreviewcancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(context.cancelled,true);assert.equal(nodes.preview.parentNode,nodes.viewer);
});
test('native fullscreen exit closes preview and restores canvas',async()=>{
 const {context,nodes,events,document}=setup(true);context.openSequencePreview();await new Promise(resolve=>setImmediate(resolve));
 document.fullscreenElement=null;events.fullscreenchange();assert.equal(nodes.sequencePreview.open,false);assert.equal(nodes.preview.parentNode,nodes.viewer);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function context(fail=false){
 let revoked=0,paused=0;
 const video={duration:64.5,videoWidth:1080,videoHeight:1920,pause(){paused++;},load(){},removeAttribute(){},play:async()=>{},set src(value){queueMicrotask(()=>fail?this.onerror():this.onloadeddata());}};
 const ctx=vm.createContext({cancelled:false,seekDecodedFrame:async(v,t)=>{v.currentTime=t;},loadVideoFile:async()=>{if(fail){revoked++;paused++;throw Error("영상 형식");}let disposed=false;return {video,dispose(){if(!disposed){disposed=true;revoked++;paused++;}}};},document:{createElement:()=>video},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){revoked++;}},crypto:{randomUUID:()=> 'test'},$:()=>({}),setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync('imported.js','utf8'),ctx);
 return {ctx,video,revoked:()=>revoked,paused:()=>paused};
}
test('edited imports preserve full length and video file without duplicate captions or collage',()=>{
 const {ctx,video}=context();const file={name:'edited.mp4'};const clip=ctx.importedClip(file,video,'thumbnail');
 assert.equal(clip.seconds,64.5);assert.equal(clip.sourceBlob,file);assert.equal(clip.caption,'');assert.equal(clip.time,'');assert.equal(clip.collage,false);assert.equal(clip.frames.length,3);assert.equal(clip.mode,'imported');
});
test('prepared imported video cleans up media URL once on completion or cancellation',async()=>{
 const {ctx,video,revoked,paused}=context();const media=await ctx.prepareImportedClip({sourceBlob:{}});
 await media.start(12);assert.equal(video.currentTime,12);assert.equal(await media.frame(0),video);assert.equal(await media.frame(2),video);
 media.dispose();media.dispose();assert.equal(revoked(),1);assert.equal(paused(),1);
});
test('unreadable import releases its URL without leaving a video decoder alive',async()=>{
 const {ctx,revoked,paused}=context(true);await assert.rejects(ctx.openImportedVideo({}),/영상 형식/);assert.equal(revoked(),1);assert.equal(paused(),1);
});

test('diagnostics distinguish early EOF from paused playback without exposing file URLs',()=>{const {ctx}=context();const report=ctx.playbackDiagnostic({currentTime:1.5,duration:1.5,paused:true,ended:true,readyState:4});assert.match(report,/위치 1.50 \/ 파일 1.50초/);assert.match(report,/paused=true/);assert.match(report,/ended=true/);assert.doesNotMatch(report,/blob:/);});

test('short encoded clips keep native speed and expose actual duration',async()=>{
 const {ctx,video}=context();video.duration=1.99;ctx.collageFrames=()=>[];ctx.image=async()=>({});
 const clip={seconds:4.67,playbackBlob:{}},media=await ctx.prepareRecordedClip(clip);
 await media.start(0);assert.equal(video.playbackRate,1);assert.equal(media.duration,1.99);
 video.currentTime=1.99;assert.equal(media.position(),1.99);
 await media.start(1);assert.equal(video.currentTime,1);
 assert.equal(clip.seconds,4.67);media.dispose();
});

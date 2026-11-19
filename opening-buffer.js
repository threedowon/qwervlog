'use strict';
// Decode opening snippets before playback. Only one video decoder is used at a time;
// compressed JPEGs and a small image window bridge cuts without video startup waits.
async function prepareOpeningMedia(plan,exporting){
 const prepared=new Map();let bytes=0;
 try{
  for(const segment of plan.filter(s=>s.intro)){
   if(cancelled)throw Error('미리보기를 중단했어요.');
   const clip=segment.clip,frames=[],count=Math.max(1,Math.ceil(segment.seconds*30));
   let source=null,surface=null;
   try{
    if(clip.playbackBlob||clip.sourceBlob){
     source=await openImportedVideo(clip.playbackBlob||clip.sourceBlob);
     surface=document.createElement('canvas');surface.width=exporting?1080:540;surface.height=exporting?1920:960;
     const context=surface.getContext('2d');
     for(let i=0;i<count;i++){
      if(cancelled||document.hidden)throw Error('오프닝 준비를 중단했어요.');
      await seekDecodedFrame(source.video,(segment.start||0)+i/30,()=>cancelled);
      context.drawImage(source.video,0,0,surface.width,surface.height);
      const frame=surface.toDataURL('image/jpeg',.92);bytes+=frame.length*2;
      // Never risk a Safari reload by growing the temporary cache without bound.
      if(bytes>64*1024*1024)throw Error('오프닝 준비 용량이 커요. 선택한 컷 수나 컷 길이를 줄여 주세요.');
      frames.push(frame);
     }
    }else{
     for(let i=0;i<count;i++)frames.push(clip.frames[Math.min(clip.frames.length-1,Math.floor(((segment.start||0)+i/30)/clip.seconds*clip.frames.length))]);
    }
   }finally{source?.dispose();if(surface){surface.width=surface.height=1;}}
   const photos=await Promise.all(collageFrames(clip).map(image)),cache=new Map();let disposed=false;
   const get=i=>{if(!cache.has(i))cache.set(i,image(frames[i]));return cache.get(i);};
   const media={photos,frame:()=>get(0),async frameAt(seconds){
    const i=Math.max(0,Math.min(frames.length-1,Math.floor((seconds-(segment.start||0))*30)));
    const result=await get(i);
    for(const key of cache.keys())if(key<i||key>i+3)cache.delete(key);
    if(!disposed)for(let j=i+1;j<Math.min(frames.length,i+4);j++)get(j).catch(()=>{});
    return result;
   },dispose(){disposed=true;cache.clear();frames.length=0;photos.forEach(p=>p.src='');photos.length=0;}};
   prepared.set(segment,media);await get(0);
   status(`오프닝 준비 중 · ${prepared.size} / ${plan.filter(s=>s.intro).length}컷`);
  }
  return prepared;
 }catch(error){for(const media of prepared.values())media.dispose();throw error;}
}

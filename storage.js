'use strict';
// Keep the existing database; migrate the legacy array atomically on first save.
class ClipStore {
 constructor(db){this.db=db;this.ids=new Set();this.migrated=false;this.queue=Promise.resolve();}
 read(key){return new Promise((resolve,reject)=>{const r=this.db.transaction('story').objectStore('story').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 write(action){const task=this.queue.then(()=>new Promise((resolve,reject)=>{const tx=this.db.transaction('story','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);try{action(tx.objectStore('story'));}catch(e){tx.abort();reject(e);}}));this.queue=task.catch(()=>{});return task;}
 async load(){
  const order=await this.read('clip-order');this.migrated=Array.isArray(order);
  const clips=this.migrated?(await Promise.all(order.map(id=>this.read('clip:'+id)))).filter(Boolean):(await this.read('clips')||[]);
  if(this.migrated)this.ids=new Set(clips.map(c=>c.id));
  const pending=await this.read('pending-id');
  if(pending&&!clips.some(c=>c.id===pending)){const clip=await this.read('clip:'+pending);if(clip){clips.push(clip);this.ids.add(clip.id);this.recovered=true;}}
  return clips;
 }
 async checkpoint(clip){await this.write(s=>{s.put(clip,'clip:'+clip.id);s.put(clip.id,'pending-id');});this.ids.add(clip.id);}
 async discard(id){await this.write(s=>{s.delete('pending-id');s.delete('clip:'+id);s.delete('edit:'+id);});this.ids.delete(id);}
 async save(clips){
  const snapshot=clips.slice();
  await this.write(s=>{
   for(const clip of snapshot)if(!this.ids.has(clip.id))s.put(clip,'clip:'+clip.id);
   // Metadata stays small, even when a clip was checkpointed before editing.
   for(const clip of snapshot)s.put({caption:clip.caption,time:clip.time,collage:clip.collage},'edit:'+clip.id);
   const ids=new Set(snapshot.map(c=>c.id));for(const id of this.ids)if(!ids.has(id)){s.delete('clip:'+id);s.delete('edit:'+id);}
   s.put(snapshot.map(c=>c.id),'clip-order');s.delete('pending-id');s.delete('clips');
  });
  this.ids=new Set(snapshot.map(c=>c.id));this.migrated=true;
 }
}

const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
test('normal duration accepts tenths, applies only on save, and rejects invalid values',()=>{
 const nodes={clipSeconds:{value:'1.5'},duration:{value:30},durationSummary:{}};
 const c={mode:'normal',clipLengths:{normal:2,timelapse:6},$:id=>nodes[id],updateDurationLabels(){}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function validClipSeconds'),app.indexOf('function openDuration')),c);
 assert.ok(c.validClipSeconds(1.5));assert.ok(c.validClipSeconds(2.3));
 for(const n of [NaN,Infinity,0,30.1,1.55])assert.equal(c.validClipSeconds(n),false);
 assert.equal(c.clipLengths.normal,2);c.saveDurations();assert.equal(c.clipLengths.normal,1.5);
 c.mode='timelapse';assert.equal(c.validClipSeconds(1.5),false);assert.ok(c.validClipSeconds(6));
});

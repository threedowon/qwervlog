const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('time.js','utf8'),c);
test('video time uses suffix and handles noon midnight and missing metadata',()=>{for(const [input,expected] of [['03:00','3:00 am'],['00:05','12:05 am'],['12:00','12:00 pm'],['23:09','11:09 pm'],['','']])assert.equal(c.videoClock(input),expected);});

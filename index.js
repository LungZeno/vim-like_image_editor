var worldCanvas = document.getElementById("world");
var turtleCanvas = document.getElementById("turtle");
var worldCtx = worldCanvas.getContext("2d");
var turtleCtx = turtleCanvas.getContext("2d");
var statusline = document.getElementById("statusline");
var xCor=0, yCor=0, angle=0;
var lastStatusline = "";
var lastTimestamp;
function updateStatusline(event){
  if(event.delta === 0)
    return;
  var statusText = `[${xCor},${yCor}],${angle}`;
  statusText += "," + keysBuffer;
  if(macroRecording)
    statusText += ",Recording";
  if(lastStatusline === statusText)
    return;
  lastStatusline = statusText;
  drawStatusline(statusText);
}
paper.setup("world");
var worldProject = paper.project;
var uiProject = new paper.Project("ui");
var statusPointText = new paper.PointText({
  point: [0, paper.project.view.viewSize.height - 24],
  content: 'test',
  fillColor: 'black',
  fontFamily: 'Courier New',
//  fontWeight: 'bold',
  fontSize: 24
});
worldProject.activate();
paper.view.on("frame", updateStatusline);
function drawStatusline(text){
//  statusline.textContent = text;
  var orginalProject = paper.project;
  uiProject.activate();
  statusPointText.content = text;
  orginalProject.activate();
}
var v = {
  count:0,
  count1:1,
  operator:""
};
var motions = [
// + 8 - 8 get out round up error
  ["j", ()=>({y:yCor+v.count1*Math.cos(angle/180*Math.PI) + 8 - 8,x:xCor-v.count1*Math.sin(angle/180*Math.PI) + 8 - 8})],
  ["k", ()=>({y:yCor-v.count1*Math.cos(angle/180*Math.PI) + 8 - 8,x:xCor+v.count1*Math.sin(angle/180*Math.PI) + 8 - 8})],
  ["H", ()=>({y:+v.count})],
  ["L", ()=>({y:worldCanvas.height-v.count})],
  ["gc", ()=>({x:worldCanvas.width/2, y:worldCanvas.height/2})],
  ["o", ()=>({x:xCor-v.count1})],
  ["p", ()=>({x:xCor+v.count1})]
];
var operators = [
  ["f", (motion)=>{
    worldProject.activate();
    var path = new paper.Path();
    path.strokeColor = 'black';
//    path.moveTo(new paper.Point(xCor, yCor));
    path.add(new paper.Point(xCor, yCor));
    setPos(motion[1]());
//    path.lineTo(new paper.Point(xCor, yCor));
    path.add(new paper.Point(xCor, yCor));
//    worldCtx.lineTo(xCor, yCor);
//    worldCtx.stroke();
  }]
];
var commands = [
  ["h", ()=>{angle=(angle+360-v.count1) % 360}],
  ["l", ()=>{angle=(angle+360+v.count1) % 360}]
];
var registers = "abcdefghijklmnopqrstuvwxyz".split("").map(_=>[_,,]);
var registerNameForMacroRecoding = "";
var registerIndexForMacroRecoding = -1;
var macroRecodingBuffer = null;
registers.forEach((_,i)=>{
  commands.push(["q"+_[0],()=>{
    macroRecodingBuffer = [];
    registerNameForMacroRecoding = _[0];
    registerIndexForMacroRecoding = i;
    macroRecording = true;
  }]);
});
function qCommand() {
  if(macroRecodingBuffer[macroRecodingBuffer.length - 1] === 'q')
    macroRecodingBuffer.pop();
  registers[registerIndexForMacroRecoding][1] = KeysBuffer.from(macroRecodingBuffer).toString();
  macroRecodingBuffer = null;
  registerNameForMacroRecoding = "";
  registerIndexForMacroRecoding = -1;
  macroRecording = false;
}
registers.forEach((_,i)=>{
  commands.push(["@"+_[0],()=>{
    var keysBuffer = new KeysBuffer();
    var count1 = v.count1;
    var registersKeys = KeysBuffer.fromString(registers[i][1]);
    for(let j=0; j < count1; ++j)
      for(let k=0; k < registersKeys.length; ++k) {
        [keysBuffer, interpretFail] = consumeFull(registersKeys[k], keysBuffer.clone());
        if(interpretFail)
          return;
      }
  }]);
});
class KeysBuffer extends Array {
  index = 0;
  toString(){
    return this.map(key=>KeysBuffer.escapeOne(key)).join("");
  }
  clone(){
    var that = this.slice(0);
    that.index = this.index;
    return that;
  }
  static numOfKeys(string) {
    return (string.match(/<[^<>]+>|[\d\D]/g)||[]).length;
  }
  static fromString(string) {
    return KeysBuffer.from(string.matchAll(/<([^<>]+)>|[\d\D]/g)).map(_=>(_[1]||_[0]));
  }
  static escapeOne(key) {
    return key.length>1?'<'+key+'>':(key==='<'?'<Lt>':key);
  }
}
var keysBuffer = new KeysBuffer();
var keysBufferIndex = 0;
var macroRecording = false;
function setPos(pos) {
  if("x" in pos)
    xCor = pos.x;
  if("y" in pos)
    yCor = pos.y;
  if("angle" in pos)
    angle = pos.angle;
}
function move(motion) {
  setPos(motion[1]());
//  worldCtx.moveTo(xCor, yCor);
}
function consumeCount(key, keysBuffer){
  var count = keysBuffer.slice(keysBuffer.index).toString();
  if(count !== "") {
    count = count.match(/^(?:0|[1-9]\d*)(?:\.\d*)?/);
    if(count === null)
      return [false, "", keysBuffer];
    if(keysBuffer.index + count[0].length < keysBuffer.length)
      return [false, count[0], keysBuffer];
    count = count[0];
  }
  if(count === "0" && key === "0") {
    ;
  } else if( (count === "" ? /^\d$/ : (count.includes(".") ? /^\d$/ : /^[\d.]$/)).test(key) ) {
    count += key;
    keysBuffer.push(key);
  } else if(count !== "" && key === "Delete"){
    count = count.substring(0, count.length-1);
    keysBuffer.pop();
  } else
    return [false, count, keysBuffer];
  return [true, count, keysBuffer];
}
function setCount(count, count1){
  if(!count && !count1) {
    v.count = 0;
    v.count1 = 1;
  } else
    v.count = v.count1 = (count || 1) * (count1 || 1);
}
function mustConsumeName(key, list, keysBuffer) {
  var keys = keysBuffer.slice(keysBuffer.index).toString();
  var i = 1, items = [], maybeItems = [];
  if(keys !== "")
    maybeItems = list.filter(_=>_[0].startsWith(keys.substring(0,i)))
  for(; i <= keys.length && maybeItems.length > 0; ++i, maybeItems = list.filter(_=>_[0].startsWith(keys.substring(0,i))))
    items = maybeItems;
  if(i - 1 === keys.length) { // consumed all characters in keys. including keys is ""
    maybeItems = list.filter(_=>_[0].startsWith(keys + KeysBuffer.escapeOne(key)));
    if(maybeItems.length > 0) {  // partial match to tail or full match to tail
      keysBuffer.push(key);
      return [true, false, keys + KeysBuffer.escapeOne(key), maybeItems, keysBuffer];
    }
  }
  var name = keys.substring(0,i-1);
  if(list.some(_=>_[0]===name))  // full match at middle
    return [false, false, name, items, keysBuffer];
  return [false, true, name, items, keysBuffer];   // mismatch
}
var interpretFail = false;
function consumeFull(key, keysBuffer){
  keysBuffer.index = 0;
  var interpretFail = false;
  if(key.length > 1 && !["escape","delete"].includes(key))
    return [keysBuffer, interpretFail];
  if(key === "escape") {
    keysBuffer.length = 0;
    return [keysBuffer, interpretFail];
  }
  var [consumedForKey, count, keysBuffer] = consumeCount(key, keysBuffer.clone());
  if(consumedForKey) 
    return [keysBuffer, interpretFail];
  keysBuffer.index += count.length;
  var mismatch, name, items;
  var _commands = macroRecording ? commands.filter(_=>!_[0].match(/^q[a-z]$/)).concat([['q', qCommand]]) : commands;
  [consumedForKey, mismatch, name, items, keysBuffer] = mustConsumeName(key, operators.concat(motions).concat(_commands), keysBuffer.clone());
  if(mismatch)  // partial match in middle. including no match at all neither at key. sure no full match
    return [new KeysBuffer(), true];
  if(!items.find(_=>_[0]===name) && consumedForKey) // partial match to tail. consuming key only in this case
    return [keysBuffer, interpretFail];
  keysBuffer.index += KeysBuffer.numOfKeys(name);
  var operator = operators.find(_=>_[0]===name);
  var command;
  var count1, motionName, _motions, motion;
  if(operator) {
    if(consumedForKey) 
      return [keysBuffer, interpretFail];
    [consumedForKey, count1, keysBuffer] = consumeCount(key, keysBuffer.clone());
    if(consumedForKey) 
      return [keysBuffer, interpretFail];
    keysBuffer.index += count1.length;
    [consumedForKey, mismatch, motionName, _motions, keysBuffer] = mustConsumeName(key, motions, keysBuffer.clone());
    if(mismatch)
      return [new KeysBuffer(), true];
    if(_motions.filter(_=>_[0]===motionName).length === 0 && consumedForKey)
      return;
    motion = motions.find(_=>_[0]===motionName);
    keysBuffer.index +=  KeysBuffer.numOfKeys(motionName);
  } else {
    command = _commands.find(_=>_[0]===name);
    if(!command)
      motion = motions.find(_=>_[0]===name);
  }
  if(operator) {
    setCount(count, count1);
    operator[1](motion);
  } else if(motion) {
    setCount(count, count1);
    move(motion);
  } else {
    setCount(count, count1);
    command[1]();
  }
  if(!consumedForKey)
    keysBuffer.push(key);
  keysBuffer = keysBuffer.slice(keysBuffer.index);
  keysBuffer.index = 0;
  return [keysBuffer, interpretFail];
}
function interpreterMain(event){
  var key = event.key;
  if(macroRecording)
    macroRecodingBuffer.push(key);
  [keysBuffer, interpretFail] = consumeFull(key, keysBuffer.clone());
}
//document.body.addEventListener("keydown", interpreterMain);
new paper.Tool().on("keydown", interpreterMain);
var worldCanvas = document.getElementById("world");
var turtleCanvas = document.getElementById("turtle");
var worldCtx = worldCanvas.getContext("2d");
var turtleCtx = turtleCanvas.getContext("2d");
//var statusline = document.getElementById("statusline");
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
  statusText += ",[mode=" + mode +"]";
  if(lastStatusline === statusText)
    return;
  lastStatusline = statusText;
  drawStatusline(statusText);
}
var errorline = "";
var lastErrorline = "";
function updateErrorline(event){
  if(event.delta === 0)
    return;
  if(lastErrorline === errorline)
    return;
  lastErrorline = errorline;
  if(mode !== "c"){
    cmdlineBuffer = new KeysBuffer();
    cmdline = "";
    drawCmdline(cmdline);
  }
  drawErrorline(errorline);
}
var cmdline = "";
var lastCmdline = "";
function updateCmdline(event){
  if(event.delta === 0)
    return;
  if(mode !== "c")
    return;
  cmdline = ":" + cmdlineBuffer;
  if(lastCmdline === cmdline)
    return;
  lastCmdline = cmdline;
  errorline = "";
  drawCmdline(cmdline);
}
paper.setup("world");
var worldProject = paper.project;
var uiProject = new paper.Project("ui");
var statusPointText = new paper.PointText({
  point: [0, 0],
  content: '',
  fillColor: 'black',
  fontFamily: 'Courier New',
//  fontWeight: 'bold',
  fontSize: 24
});
statusPointText.bounds.top = paper.project.view.viewSize.height - statusPointText.bounds.height * 2;
var errorPointText = new paper.PointText({
  point: [0, 0],
  content: '',
  fillColor: 'red',
  fontFamily: 'Courier New',
  fontSize: 24
});
errorPointText.bounds.top = paper.project.view.viewSize.height - errorPointText.bounds.height;
var cmdPointText = new paper.PointText({
  point: [0, 0],
  content: '',
  fillColor: 'black',
  fontFamily: 'Courier New',
  fontSize: 24
});
cmdPointText.bounds.top = paper.project.view.viewSize.height - cmdPointText.bounds.height;
worldProject.activate();
paper.view.on("frame", updateStatusline);
paper.view.on("frame", updateErrorline);
paper.view.on("frame", updateCmdline);
function drawStatusline(text){
  var orginalProject = paper.project;
  uiProject.activate();
  statusPointText.content = text;
  orginalProject.activate();
}
function drawErrorline(text){
  var orginalProject = paper.project;
  uiProject.activate();
  errorPointText.content = text;
  orginalProject.activate();
}
function drawCmdline(text){
  var orginalProject = paper.project;
  uiProject.activate();
  cmdPointText.content = text;
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
  ["f", (pos)=>{
    worldProject.activate();
    var path = new paper.Path();
    path.strokeColor = 'black';
//    path.moveTo(new paper.Point(xCor, yCor));
    path.add(new paper.Point(xCor, yCor));
    setPos(pos);
//    path.lineTo(new paper.Point(xCor, yCor));
    path.add(new paper.Point(xCor, yCor));
//    worldCtx.lineTo(xCor, yCor);
//    worldCtx.stroke();
  }]
];
var commands = [
  ["h", ()=>{angle=(angle+360-v.count1) % 360}],
  ["l", ()=>{angle=(angle+360+v.count1) % 360}],
  [":", startCmdline],
  ["v", visualSelect]
];
var vmotions = [];
var voperators = [];
var vcommands = [
  ["s", scale]
];
var selectedSet = [];
function scale(){
  var factor = v.count !== v.count1 ? 0.5 : v.count;
  selectedSet.forEach(i=>i.scale(factor));
}
function visualSelect(){
  if(worldProject.layers.length === 0)
    throw new VimError("no item. Nothing is selected.");
  worldProject.layers[0].selected = true;
  selectedSet.push(worldProject.layers[0]);
  previousMode = mode;
  mode = "v";
}
function consumeFullVisual(key, keysBuffer){
  keysBuffer.index = 0;
  var interpretFail = false;
  if(key.length > 1 && !["Escape","Delete"].includes(key))
    return [keysBuffer, interpretFail];
  if(key === "Escape") {
    if(keysBuffer.length === 0){
      selectedSet.forEach(i=>i.selected = false);
      selectedSet.length = 0;
      mode = previousMode;
      previousMode = null;
    } else
      keysBuffer.length = 0;
    return [keysBuffer, interpretFail];
  }
  var [consumedForKey, count, keysBuffer] = consumeCount(key, keysBuffer.clone());
  if(consumedForKey) 
    return [keysBuffer, interpretFail];
  keysBuffer.index += count.length;
  var mismatch, name, items;
  [consumedForKey, mismatch, name, items, keysBuffer] = mustConsumeName(key, voperators.concat(vmotions).concat(vcommands), keysBuffer.clone());
  if(mismatch)  // partial match in middle. including no match at all neither at key. sure no full match
    return [new KeysBuffer(), true];
  if(!items.find(_=>_[0]===name) && consumedForKey) // partial match to tail. consuming key only in this case
    return [keysBuffer, interpretFail];
  keysBuffer.index += KeysBuffer.numOfKeys(name);
  var operator = voperators.find(_=>_[0]===name);
  var command;
  var count1, motionName, _motions, motion;
  if(operator) {
    if(consumedForKey) 
      return [keysBuffer, interpretFail];
    [consumedForKey, count1, keysBuffer] = consumeCount(key, keysBuffer.clone());
    if(consumedForKey) 
      return [keysBuffer, interpretFail];
    keysBuffer.index += count1.length;
    [consumedForKey, mismatch, motionName, _motions, keysBuffer] = mustConsumeName(key, vmotions, keysBuffer.clone());
    if(mismatch)
      return [new KeysBuffer(), true];
    if(_motions.filter(_=>_[0]===motionName).length === 0 && consumedForKey)
      return [keysBuffer, interpretFail];
    motion = vmotions.find(_=>_[0]===motionName);
    keysBuffer.index +=  KeysBuffer.numOfKeys(motionName);
  } else {
    command = vcommands.find(_=>_[0]===name);
    if(!command)
      motion = vmotions.find(_=>_[0]===name);
  }
  if(operator) {
    setCount(count, count1);
    var orginalMode = mode;
    mode = "vo";
    var pos = motion[1]();
    mode = orginalMode;
    operator[1](pos);
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
class VimError extends Error {
}
function startCmdline(){
  if(mode === "n" && v.count === v.count1)
    throw new VimError("not implement range yet");
  if(mode === "no")
    throw new VimError("not implement cmdline as a motion yet");
  previousMode = mode;
  mode = "c";
  cmdlineBuffer = new KeysBuffer();
}
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
registers.push([":",":"]);
commands.push(["@:",repeatCmdline]);
function repeatCmdline(){
}
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
    return key.length>1?'<'+key+'>':(key==='<'?'<lt>':key);
  }
}
var keysBuffer = new KeysBuffer();
var cmdlineBuffer = new KeysBuffer();
var mode = null;
var previousMode = null;
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
  if(key.length > 1 && !["Escape","Delete"].includes(key))
    return [keysBuffer, interpretFail];
  if(key === "Escape") {
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
      return [keysBuffer, interpretFail];
    motion = motions.find(_=>_[0]===motionName);
    keysBuffer.index +=  KeysBuffer.numOfKeys(motionName);
  } else {
    command = _commands.find(_=>_[0]===name);
    if(!command)
      motion = motions.find(_=>_[0]===name);
  }
  if(operator) {
    setCount(count, count1);
    var orginalMode = mode;
    mode = "no";
    var pos = motion[1]();
    mode = orginalMode;
    operator[1](pos);
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
function consumeCmdline(key, keysBuffer){
  if(key === "Control+V"){
    cmdlineBuffer = cmdlineBuffer.concat(KeysBuffer.fromString(document.getElementById("clipboard").value));
  } else if(key === "Escape" || key === "Backspace" && cmdlineBuffer.length === 0){
    cmdlineBuffer.length = 0;
    mode = previousMode;
    previousMode = null;
    cmdline = "";
    drawCmdline(cmdline);
  } else if(key === "Backspace"){
    cmdlineBuffer.pop();
  } else if(key.length > 1 && !["Enter"].includes(key)){
  } else if(key === "Enter" || key === "\x0d"){
    var cmdParts = cmdlineBuffer.toString().match(/^\s*([a-zA-Z]+)\s+(.*)$/);
    if(cmdParts === null || cmdParts[1] !== "importSVG")
      throw new VimError("unknow command");
    try {
      worldProject.importSVG(cmdParts[2]);
    } catch(e) {
      throw new VimError(e.message);
    }
    mode = previousMode;
    previousMode = null;
  } else
    cmdlineBuffer.push(key);
  return [keysBuffer, false]
}
var modeFunctions = {
  n : consumeFull,
  c : consumeCmdline,
  v : consumeFullVisual
};
function consumeBranchExchange(key, keysBuffer){
  var modeFunction = modeFunctions[mode];
  try {
    return modeFunction(key, keysBuffer.clone());
  } catch (e) {
    if(e instanceof VimError){
      if(mode === "c"){
        mode = previousMode;
        previousMode = null;
      }
      errorline = "error: " + e.message;
      return [new KeysBuffer(), true];
    } else
      throw e;
  }
}
function interpreterMain(event){
  var key = event.key;
//console.log(event);
//  var key = event.character || event.key;
  if(event.ctrlKey && key !== "Control")
    key = "Control+" + key.replace(/^\w/, match=>match.toUpperCase());
  if(macroRecording)
    macroRecodingBuffer.push(key);
  [keysBuffer, interpretFail] = consumeBranchExchange(key, keysBuffer.clone());
}
mode = "n";
//new paper.Tool().on("keydown", interpreterMain); //cannot detect control-v but all control and no v
document.addEventListener("keydown", interpreterMain);
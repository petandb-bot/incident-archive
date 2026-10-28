"use strict";

window.IA_SCRIPT_LOADED = true;

const APP = {
  version: '0.3.2',
  mode: 'SOLAR',
  // Per-mode state. Switching modes never mutates another engine's recipe/settings.
  params: { amount: 88, chance: 80, preserve: 22 },
  modeParams: {
    SOLAR:{amount:88,chance:80,preserve:22},
    CHEMICAL:{amount:88,chance:80,preserve:22},
    REGISTER:{amount:88,chance:80,preserve:22},
    LEAK:{amount:88,chance:80,preserve:22}
  },
  modeRecipes: Object.create(null),
  recipe: null,
  history: [],
  source: null,
  sourceName: '',
  shaders: {},
  ready: false,
  busy: false,
  preparedExport: null,
  sourceObjectURL: null
};

const IDS = ['openPhotoTop','openPhotoPrimary','photoInput','canvasMount','emptyState','mutateButton','backButton','editToggle','editChevron','editPanel','saveButton','amountSlider','amountValue','chanceSlider','chanceValue','preserveSlider','preserveValue','exportSize','renderOverlay','renderLabel','originalOverlay','exportReady','readyDownload','readyShare','readyStatus','statusText','variationMeta','errorPanel','errorDetail'];

const VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewProjectionMatrix;
varying vec2 vTexCoord;
void main(){vTexCoord=aTexCoord;gl_Position=uModelViewProjectionMatrix*vec4(aPosition,1.0);} `;

// All GLSL programs now live in independent engines/*.js files.

let ui = {};
let previewHold = { fitW: 960, fitH: 720, offsetX: 0, offsetY: 0 };

function setup(){
  try{
    ui = bindUI();
    const c = createCanvas(960, 720, WEBGL);
    c.parent('canvasMount');
    c.elt.style.position='absolute';
    c.elt.style.inset='0';
    pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    noStroke();
    APP.shaders.SOLAR = createShader(VERT, window.IAEngines.SOLAR.fragment);
    APP.shaders.CHEMICAL = createShader(VERT, window.IAEngines.CHEMICAL.fragment);
    APP.shaders.REGISTER = createShader(VERT, window.IAEngines.REGISTER.fragment);
    APP.shaders.LEAK = createShader(VERT, window.IAEngines.LEAK.fragment);
    APP.params = APP.modeParams[APP.mode];
    APP.recipe = makeRecipe(APP.mode);
    APP.modeRecipes[APP.mode] = APP.recipe;
    APP.ready = true;
    wireUI();
    syncControls();
    setMode(APP.mode, false);
    background(0,0);
    noLoop();
  }catch(err){ showError(err); }
}

function bindUI(){
  const out={};
  for(const id of IDS){
    const el=document.getElementById(id);
    if(!el) throw new Error('UI ERROR / '+id);
    out[id]=el;
  }
  out.modeButtons=[...document.querySelectorAll('.mode')];
  return out;
}

function wireUI(){
  ui.openPhotoTop.addEventListener('click',()=>ui.photoInput.click());
  ui.openPhotoPrimary.addEventListener('click',()=>ui.photoInput.click());
  ui.photoInput.addEventListener('change',handleFile);
  ui.modeButtons.forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode,true)));
  ui.mutateButton.addEventListener('click',mutate);
  ui.backButton.addEventListener('click',goBack);
  ui.editToggle.addEventListener('click',toggleEdit);
  ui.saveButton.addEventListener('click',saveHighRes);
  ui.readyShare.addEventListener('click',sharePreparedImage);
  installOriginalCompare();
  ui.exportSize.addEventListener('change',discardPreparedExport);
  bindSlider(ui.amountSlider,ui.amountValue,'amount');
  bindSlider(ui.chanceSlider,ui.chanceValue,'chance');
  bindSlider(ui.preserveSlider,ui.preserveValue,'preserve');
}

// Hold the preview to inspect the actual file being processed.
// A DOM <img> intentionally bypasses all four GLSL shaders and the WebGL renderer.
function installOriginalCompare(){
  const stage=ui.canvasMount;
  const raw=ui.originalOverlay;
  if(!stage||!raw)return;
  const end=()=>{raw.hidden=true;};
  stage.addEventListener('pointerdown',()=>{
    if(!APP.sourceObjectURL)return;
    raw.hidden=false;
  });
  window.addEventListener('pointerup',end);
  window.addEventListener('pointercancel',end);
  window.addEventListener('blur',end);
  stage.addEventListener('pointerleave',end);
  // Ensure the overlay never intercepts touch/pointer events.
  raw.style.pointerEvents='none';
}

function bindSlider(input, output, key){
  input.addEventListener('input',()=>{
    APP.params[key]=Number(input.value);
    output.value=input.value;
    renderPreview();
  });
}

function syncControls(){
  for(const key of ['amount','chance','preserve']){
    ui[key+'Slider'].value=APP.params[key];
    ui[key+'Value'].value=APP.params[key];
  }
}

function handleFile(e){
  const file=e.target.files&&e.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ showError(new Error('Please choose an image file.')); return; }
  setBusy(true,'OPENING');
  const url=URL.createObjectURL(file);
  loadImage(url,img=>{
    // Keep this exact unmodified input URL for diagnostic 2D display.
    // Do not use the processed WebGL canvas for the ORIGINAL comparison.
    if(APP.sourceObjectURL) URL.revokeObjectURL(APP.sourceObjectURL);
    APP.sourceObjectURL=url;
    ui.originalOverlay.src=url;
    ui.originalOverlay.hidden=true;
    APP.source=img;
    APP.sourceName=file.name||'photo';
    updatePhotoMeta(file);
    APP.history=[];
    APP.modeRecipes=Object.create(null);
    APP.recipe=makeRecipe(APP.mode);
    APP.modeRecipes[APP.mode]=APP.recipe;
    fitPreviewCanvas(img.width,img.height);
    ui.emptyState.hidden=true;
    ui.saveButton.disabled=false;
    ui.backButton.disabled=true;
    ui.statusText.textContent='READY / '+APP.mode;
    updateVariation();
    renderPreview();
    setBusy(false);
  },err=>{
    URL.revokeObjectURL(url);
    setBusy(false);
    showError(err||new Error('Image could not be opened.'));
  });
}

function computePreviewFit(srcW, srcH){
  const mount = ui.canvasMount;
  const mountW = Math.max(320, (mount && mount.clientWidth) ? mount.clientWidth : window.innerWidth - 48);
  const mountH = Math.max(320, (mount && mount.clientHeight) ? mount.clientHeight : Math.round(window.innerHeight * 0.62));
  const maxTex = window.innerWidth < 821 ? 1400 : 1800;
  const scale = Math.min(mountW / srcW, mountH / srcH, maxTex / Math.max(srcW, srcH), 1);
  const fitW = Math.max(2, Math.round(srcW * scale));
  const fitH = Math.max(2, Math.round(srcH * scale));
  return {
    fitW,
    fitH,
    offsetX: (mountW - fitW) * 0.5,
    offsetY: (mountH - fitH) * 0.5
  };
}

function updatePhotoMeta(file){
  const fileMeta=document.getElementById('fileMeta');
  const dateMeta=document.getElementById('dateMeta');
  if(fileMeta) fileMeta.textContent=(file.name||'PHOTO').toUpperCase();
  if(dateMeta){
    const d=new Date(file.lastModified||Date.now());
    const two=n=>String(n).padStart(2,'0');
    dateMeta.textContent=`${d.getFullYear()}.${two(d.getMonth()+1)}.${two(d.getDate())}  ${two(d.getHours())}:${two(d.getMinutes())}`;
  }
}

function fitPreviewCanvas(w,h){
  previewHold = computePreviewFit(w, h);
  resizeCanvas(previewHold.fitW, previewHold.fitH);
  const elt = canvas && canvas.elt ? canvas.elt : document.querySelector('#canvasMount canvas');
  if(elt){
    elt.style.width = previewHold.fitW + 'px';
    elt.style.height = previewHold.fitH + 'px';
    elt.style.position = 'absolute';
    elt.style.left = Math.round(previewHold.offsetX) + 'px';
    elt.style.top = Math.round(previewHold.offsetY) + 'px';
  }
}

function setMode(mode,push=true){
  if(!APP.shaders[mode]) return;
  if(push&&APP.source&&APP.mode!==mode) pushHistory();
  APP.mode=mode;
  APP.params=APP.modeParams[mode];
  if(!APP.modeRecipes[mode]) APP.modeRecipes[mode]=makeRecipe(mode);
  APP.recipe=APP.modeRecipes[mode];
  syncControls();
  document.documentElement.dataset.mode=mode.toLowerCase();
  ui.modeButtons.forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});
  ui.statusText.textContent=APP.source?'READY / '+mode:'READY / ADD A PHOTO';
  updateVariation();
  renderPreview();
}

function mutate(){
  if(!APP.source){ ui.photoInput.click(); return; }
  pushHistory();
  APP.recipe=makeRecipe(APP.mode, APP.recipe);
  APP.modeRecipes[APP.mode]=APP.recipe;
  updateVariation();
  ui.mutateButton.animate([{transform:'translateX(0)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:180,easing:'ease-out'});
  renderPreview();
}

function pushHistory(){
  APP.history.push({mode:APP.mode,params:{...APP.params},recipe:JSON.parse(JSON.stringify(APP.recipe))});
  if(APP.history.length>20) APP.history.shift();
  ui.backButton.disabled=APP.history.length===0;
}

function goBack(){
  if(!APP.history.length) return;
  const prev=APP.history.pop();
  APP.mode=prev.mode;
  APP.modeParams[prev.mode]={...prev.params};
  APP.params=APP.modeParams[prev.mode];
  APP.modeRecipes[prev.mode]=prev.recipe;
  APP.recipe=APP.modeRecipes[prev.mode];
  syncControls();
  document.documentElement.dataset.mode=APP.mode.toLowerCase();
  ui.modeButtons.forEach(b=>{const on=b.dataset.mode===APP.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});
  ui.backButton.disabled=APP.history.length===0;
  updateVariation();
  renderPreview();
}

function toggleEdit(){
  const open=ui.editPanel.hidden;
  ui.editPanel.hidden=!open;
  ui.editToggle.setAttribute('aria-expanded',open?'true':'false');
  ui.editChevron.textContent=open?'−':'＋';
}

function makeRecipe(mode,previous=null){
  const engine=window.IAEngines && window.IAEngines[mode];
  if(!engine) throw new Error('ENGINE MISSING / '+mode);
  return engine.makeRecipe(previous);
}

function updateVariation(){
  ui.variationMeta.textContent='INCIDENT / '+APP.mode+' / '+APP.recipe.family+' / '+APP.recipe.palette;
}

function shaderSourceFor(mode){
  return window.IAEngines[mode].fragment;
}

function applyModeUniforms(target,mode,w,h){
  // Every engine controls its shader uniforms; shared canvas retains no mode-specific state.
  window.IAEngines[mode].setUniforms(target,APP.source,w,h,APP.modeParams[mode],APP.modeRecipes[mode]);
}

function renderPreview(){
  discardPreparedExport();
  if(!APP.ready||!APP.source) return;
  try{
    const sh=APP.shaders[APP.mode];
    shader(sh);
    /* gl_FragCoord is expressed in drawing-buffer pixels. On Retina/iPhone
       the preview buffer can be 2x the p5 logical canvas size, so pass the
       physical resolution here. Export already uses pixelDensity(1). */
    const d=pixelDensity();
    applyModeUniforms(sh,APP.mode,width*d,height*d);
    clear();
    plane(width,height,1,1);
    resetShader();
  }catch(err){ showError(err); }
}

function setBusy(on,label='MUTATING'){
  APP.busy=on;
  ui.renderOverlay.hidden=!on;
  ui.renderLabel.textContent=label;
  ui.saveButton.disabled=on||!APP.source;
}

// 後から押せるダウンロードリンクを保持。変異・モード変更時は古い画像を破棄。
function discardPreparedExport(){
  if(!ui.exportReady) return;
  if(APP.preparedExport && APP.preparedExport.url){
    URL.revokeObjectURL(APP.preparedExport.url);
  }
  APP.preparedExport=null;
  ui.exportReady.hidden=true;
  ui.readyDownload.removeAttribute('href');
  ui.readyDownload.removeAttribute('download');
  ui.readyShare.hidden=true;
}

// 生成処理と保存操作を分ける。Safariのユーザー操作権限はawait後に失われやすい。
async function saveHighRes(){
  if(!APP.source||APP.busy) return;
  discardPreparedExport();
  setBusy(true,'RENDERING');
  let g=null;
  let capture=null;
  try{
    const longSide=Number(ui.exportSize.value)||2600;
    const ratio=APP.source.width/APP.source.height;
    let outW,outH;
    if(ratio>=1){outW=longSide;outH=Math.max(2,Math.round(longSide/ratio));}
    else{outH=longSide;outW=Math.max(2,Math.round(longSide*ratio));}

    g=createGraphics(outW,outH,WEBGL);
    g.pixelDensity(1);
    g.noStroke();
    const sh=g.createShader(VERT,shaderSourceFor(APP.mode));
    g.shader(sh);
    applyModeUniforms(sh,APP.mode,outW,outH);
    g.clear();
    g.plane(outW,outH,1,1);
    g.resetShader();

    // WebGLバッファの破棄を避けるため、イベントループに戻る前に2Dへコピー。
    const gl=g.drawingContext;
    if(gl && typeof gl.finish==='function') gl.finish();
    capture=document.createElement('canvas');
    capture.width=outW;
    capture.height=outH;
    const ctx=capture.getContext('2d',{alpha:false});
    if(!ctx) throw new Error('PNG capture canvas unavailable.');
    ctx.drawImage(g.canvas,0,0,outW,outH);
    g.remove();g=null;

    const blob=await canvasToBlob(capture,'image/png');
    const baseName=(APP.sourceName||'incident-archive').replace(/\.[^.]+$/,'')
      .replace(/[^a-z0-9_-]+/gi,'_');
    const filename=`${baseName}_${APP.mode.toLowerCase()}_${Date.now()}.png`;
    const url=URL.createObjectURL(blob);
    // ダウンロードが拒否された場合もリンクを残す。共有時も生成後の直接タップが必要。
    let file=null;
    let canShareFiles=false;
    try{
      file=new File([blob],filename,{type:'image/png'});
      canShareFiles=typeof navigator.share==='function' &&
        typeof navigator.canShare==='function' && navigator.canShare({files:[file]});
    }catch(_){ canShareFiles=false; }
    APP.preparedExport={url,blob,file,filename};
    ui.readyDownload.href=url;
    ui.readyDownload.download=filename;
    ui.readyShare.hidden=!canShareFiles;
    ui.readyStatus.textContent=`PNG READY · ${outW} × ${outH}`;
    ui.exportReady.hidden=false;

    // PCブラウザは従来通り自動ダウンロードを試す。
    // iPhone Safariは自動shareが失敗しやすいので、ユーザーが直接ボタンを押す。
    if(!(/iPad|iPhone|iPod/i.test(navigator.userAgent) ||
         (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1))){
      ui.readyDownload.click();
    }
  }catch(err){showError(err);}
  finally{
    if(g) g.remove();
    if(capture){capture.width=0;capture.height=0;}
    setBusy(false);
  }
}

async function sharePreparedImage(){
  const prepared=APP.preparedExport;
  if(!prepared||!prepared.file||typeof navigator.share!=='function') return;
  // navigator.share()を押下イベントの同期処理内で開始し、ジェスチャーを維持する。
  try{
    await navigator.share({files:[prepared.file],title:'Incident Archive'});
  }catch(err){
    // 共有メニューを閉じた場合はエラーとみなさない。ダウンロードリンクは維持。
    if(err && err.name!=='AbortError') showError(err);
  }
}

function canvasToBlob(canvas,type){
  return new Promise((resolve,reject)=>{
    if(typeof canvas.toBlob!=='function'){
      reject(new Error('This browser cannot export PNG.'));return;
    }
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Export failed.')),type);
  });
}

function showError(err){
  const msg=err&&err.message?err.message:String(err);
  console.error(msg);
  if(ui.errorDetail){ ui.errorDetail.textContent=msg; ui.errorPanel.hidden=false; }
  else alert(msg);
}

function windowResized(){
  if(APP.source){
    fitPreviewCanvas(APP.source.width, APP.source.height);
  }
  renderPreview();
}

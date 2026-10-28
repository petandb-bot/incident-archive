"use strict";

window.IA_SCRIPT_LOADED = true;

const APP = {
  version: '0.3.0',
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
  preparedExport: null
};

const IDS = ['openPhotoTop','openPhotoPrimary','photoInput','canvasMount','emptyState','mutateButton','backButton','editToggle','editChevron','editPanel','saveButton','amountSlider','amountValue','chanceSlider','chanceValue','preserveSlider','preserveValue','exportSize','renderOverlay','renderLabel','exportReady','readyDownload','readyShare','readyStatus','statusText','variationMeta','errorPanel','errorDetail'];

const VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewProjectionMatrix;
varying vec2 vTexCoord;
void main(){vTexCoord=aTexCoord;gl_Position=uModelViewProjectionMatrix*vec4(aPosition,1.0);} `;

const COMMON = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uChance;
uniform float uPreserve;
uniform float uSeed;
uniform vec4 uH0;
uniform vec4 uH1;
uniform vec4 uH2;
uniform vec4 uR0;
uniform vec4 uR1;
uniform vec4 uR2;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;

float sat(float x){return clamp(x,0.0,1.0);} 
vec3 sat3(vec3 x){return clamp(x,0.0,1.0);} 
float lum(vec3 c){return dot(c, vec3(0.2126,0.7152,0.0722));}
vec2 clampUV(vec2 uv){return clamp(uv, vec2(0.0), vec2(1.0));} 
float outside(vec2 uv){vec2 c=clampUV(uv);return max(abs(uv.x-c.x),abs(uv.y-c.y));} 
vec3 texM(vec2 uv){return texture2D(uTex, clampUV(uv)).rgb;} 
vec2 screenUV(){vec2 uv=gl_FragCoord.xy/max(uResolution,vec2(1.0));uv.y=1.0-uv.y;return uv;} 
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);} 
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);} 
float fbm4(vec2 p){float v=0.0,a=0.52;mat2 m=mat2(1.57,1.11,-1.11,1.57);for(int i=0;i<4;i++){v+=a*noise2(p);p=m*p+13.71;a*=0.5;}return v;} 
float fbm6(vec2 p){float v=0.0,a=0.54;mat2 m=mat2(1.72,1.20,-1.20,1.72);for(int i=0;i<6;i++){v+=a*noise2(p);p=m*p+17.31;a*=0.52;}return v;} 
float ridge(float x){return 1.0-abs(2.0*x-1.0);} 
vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;} 
vec3 screenBlend(vec3 a, vec3 b){return 1.0-(1.0-a)*(1.0-b);} 
vec3 softLight(vec3 a, vec3 b){return mix(sqrt(max(a,0.0))*(2.0*b-1.0)+2.0*a*(1.0-b),2.0*a*b+a*a*(1.0-2.0*b),step(b,vec3(0.5)));}

vec3 satAdjust(vec3 c, float s){float y=lum(c);return mix(vec3(y), c, s);} 
vec3 hueRotate(vec3 c, float a){
  float s=sin(a), co=cos(a);
  mat3 m = mat3(
    0.213+0.787*co-0.213*s, 0.715-0.715*co-0.715*s, 0.072-0.072*co+0.928*s,
    0.213-0.213*co+0.143*s, 0.715+0.285*co+0.140*s, 0.072-0.072*co-0.283*s,
    0.213-0.213*co-0.787*s, 0.715-0.715*co+0.715*s, 0.072+0.928*co+0.072*s
  );
  return clamp(m*c,0.0,1.5);
}
vec3 splitTone(vec3 c, vec3 shad, vec3 high, float strength){
  float y=lum(c);
  float shadowMask = 1.0-smoothstep(0.16,0.66,y);
  float highMask = smoothstep(0.42,1.0,y);
  vec3 outc = c;
  outc = mix(outc, outc * mix(vec3(1.0), shad, 0.68), strength * shadowMask);
  outc = screenBlend(outc, high * highMask * strength * 0.28);
  return outc;
}
vec3 paletteWash(vec3 c, vec3 a, vec3 b, vec3 d, float strength){
  float y=lum(c);
  vec3 tint = mix(a, b, smoothstep(0.12,0.72,y));
  tint = mix(tint, d, smoothstep(0.72,1.0,y));
  vec3 washed = c * mix(vec3(1.0), tint, 0.42*strength) + tint * (0.04 + 0.06*strength);
  return mix(c, washed, strength);
}
vec3 contrastSat(vec3 c, float contrast, float satBoost){
  c = clamp((c-0.5)*(1.0+contrast)+0.5,0.0,1.2);
  return satAdjust(c, satBoost);
}
vec3 preserveSource(vec3 base, vec3 processed){float k=sat(uPreserve);k=k*k*(3.0-2.0*k);float yp=max(lum(processed),0.002), yb=max(lum(base),0.016);vec3 src=clamp(base*(yp/yb),0.0,1.3);vec3 pc=processed-vec3(yp);vec3 sc=src-vec3(lum(src));return clamp(vec3(yp)+mix(pc,sc,k),0.0,1.35);} 
vec3 softShoulder(vec3 c){return c/(vec3(1.0)+max(c-vec3(0.72),vec3(0.0))*0.96);} 
float edge(vec2 uv,float px){vec2 dx=vec2(px,0.0), dy=vec2(0.0,px);float ex=abs(lum(texM(uv+dx))-lum(texM(uv-dx)));float ey=abs(lum(texM(uv+dy))-lum(texM(uv-dy)));return sat((ex+ey)*2.2);} 
float subjectGuard(vec2 uv, vec3 base){vec2 p=uv-0.5;float center=exp(-dot(p*vec2(1.06,1.28),p*vec2(1.06,1.28))*3.6);float detail=edge(uv,1.2/max(min(uResolution.x,uResolution.y),1.0));float mid=smoothstep(0.06,0.46,lum(base))*(1.0-smoothstep(0.62,0.98,lum(base)));return sat(center*(0.30+0.70*detail)*mid);} 
vec3 triPalette(float t){return clamp(0.56+0.44*cos(6.2831853*(fract(t)+vec3(0.0,0.33,0.67))),0.0,1.0);} 
float lineGlow(vec2 p, float angle, float offset, float width){vec2 q=rot2(p, angle);return exp(-pow(abs(q.y-offset)/(width+0.0001), 1.45));}
float ringField(vec2 uv, vec2 c, float radius, float thickness){float d=abs(length(uv-c)-radius);return exp(-d*d/max(thickness*thickness,0.00001));}
vec3 hsvShiftLike(vec3 c, float shift){
  float y = lum(c);
  vec3 a = vec3(y);
  vec3 b = triPalette(y + shift);
  return mix(c, mix(a,b,0.72), 0.35);
}
`;

const SOLAR_FRAG = COMMON + `
void main(){
  vec2 uv=screenUV();
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount, ch=uChance;

  float y=lum(base);
  float n0=fbm6(rot2(p,(uR0.x-0.5)*1.4)*2.0 + vec2(uSeed*0.013,12.0));
  float n1=fbm4(rot2(p,(uR0.y-0.5)*2.0)*4.7 + vec2(22.0,uSeed*0.017));
  float cloud=fbm4(p*3.1 + vec2(uSeed*0.021,55.0));
  float e=edge(uv,1.2/max(min(uResolution.x,uResolution.y),1.0));

  // Tonal reversal with continuous threshold drift, like a sabattier print.
  float threshold = mix(0.36,0.74,uR0.z) + (n0-0.5)*(0.06+0.12*ch) + (cloud-0.5)*0.05;
  float rev = smoothstep(threshold-(0.10+0.08*amt), threshold+(0.02+0.04*ch), y + (n1-0.5)*0.08);
  vec3 inv = vec3(1.0)-base;
  vec3 outc = mix(base, inv, rev*(0.34+0.34*amt));

  // Metallic rim and silver bloom around edges and bright zones.
  float rim = smoothstep(0.04,0.30, e + rev*0.14 + (n0-0.5)*0.04);
  vec3 rimTint = mix(mix(uC0,uC1,0.52), vec3(1.0,0.985,0.95), 0.34);
  outc = screenBlend(outc, rimTint * rim * (0.12+0.18*amt));

  float highlight = smoothstep(0.58,0.98, y + n0*0.08 + cloud*0.06);
  vec3 bloomTint = mix(uC2, vec3(1.0), 0.76);
  outc = screenBlend(outc, bloomTint * highlight * (0.08+0.16*amt));

  // Diffuse veil rather than geometric flare.
  float veil = smoothstep(0.18,0.88, n0*0.66 + n1*0.34);
  outc = mix(outc, outc * mix(vec3(1.0), mix(uC1,uC2,0.5), 0.20), veil*(0.08+0.16*ch));

  // White clipping where reversal and highlights collide.
  float clip = rev*highlight*(0.12+0.24*amt) + rim*0.05*amt;
  outc = mix(outc, vec3(1.0), clip*(1.0-y*0.32));

  outc = mix(outc, hsvShiftLike(outc,uR2.y*0.34 + (n0-0.5)*0.08), 0.10+0.12*ch);
  outc += vec3((hash21(floor(uv*uResolution)+uSeed*19.0)-0.5) * (0.006+0.007*amt));
  outc = preserveSource(base,outc);

  vec3 solarTone = splitTone(outc, mix(uC0,uC2,0.50), mix(uC1,vec3(1.0,0.985,0.96),0.44), 0.18+0.22*amt);
  solarTone = paletteWash(solarTone, uC0, mix(uC1,vec3(1.0),0.28), uC2, 0.16+0.18*ch);
  solarTone = hueRotate(solarTone, (uR2.y-0.5)*0.18 + (n0-0.5)*0.06);
  solarTone = contrastSat(solarTone, 0.05+0.08*amt, 1.08+0.10*amt);
  outc = mix(outc, solarTone, 0.34+0.18*amt);
  outc = softShoulder(outc);
  gl_FragColor=vec4(clamp(outc,0.0,1.0),1.0);
}`;

const REGISTER_FRAG = COMMON + `
void main(){
  vec2 uv=screenUV();
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount, ch=uChance;

  // Analog transport instability: weave, directional drag, channel delay.
  float gate = fbm4(vec2(uv.y*2.4, uSeed*0.017) + vec2(13.0,0.0));
  float weave = fbm4(rot2(p,(uR0.x-0.5)*1.2)*3.2 + vec2(uSeed*0.013,9.0));
  float ripple = fbm4(vec2(uv.y*8.0, uv.x*1.4) + vec2(17.0,uSeed*0.021));
  float e=edge(uv,1.6/max(min(uResolution.x,uResolution.y),1.0));

  float a0=mix(-3.0,3.0,uR0.x);
  float a1=a0+mix(0.18,1.10,uR0.y);
  vec2 dir0=vec2(cos(a0),sin(a0));
  vec2 dir1=vec2(cos(a1),sin(a1));
  vec2 px=vec2(1.0)/uResolution;

  float d0 = mix(3.0,24.0,uR0.z)*(0.24+amt)*(0.76+0.24*gate);
  float d1 = mix(2.0,18.0,uR0.w)*(0.18+ch)*(0.78+0.22*ripple);
  vec2 offR = dir0*px*(d0*(0.65+0.40*weave)) + vec2(0.0,px.y*(ripple-0.5)*7.0*amt);
  vec2 offG = -dir1*px*(d1*(0.55+0.35*gate)) + vec2(px.x*(weave-0.5)*5.0*ch,0.0);
  vec2 offB = dir1*px*(d1*(0.45+0.50*ripple)) + vec2(-px.x*(gate-0.5)*4.0*amt, px.y*(weave-0.5)*4.0);

  vec3 mis = vec3(texM(uv+offR).r, texM(uv+offG).g, texM(uv+offB).b);

  // Directional smear / print drag without hard cells.
  vec2 dragDir = normalize(dir0 + dir1*0.35);
  vec3 smear1 = texM(uv + dragDir*px*(4.0+16.0*weave)*(0.10+0.30*amt));
  vec3 smear2 = texM(uv - dragDir*px*(3.0+12.0*gate)*(0.08+0.24*ch));
  vec3 drag = mix(smear1, smear2, 0.42+0.18*ripple);

  float band = smoothstep(0.22,0.82, gate*0.62 + ripple*0.38);
  vec3 outc = mix(base, mis, 0.34 + 0.38*amt);
  outc = mix(outc, drag, band*(0.12+0.24*amt));

  // Registration marks become soft edge echoes, not polygons.
  float echo = smoothstep(0.05,0.28,e) * (0.56+0.44*band);
  vec3 echoTint = mix(mix(uC0,uC2,0.50), vec3(1.0), 0.18);
  outc = screenBlend(outc, echoTint * echo * (0.08+0.18*amt));
  outc = mix(outc, vec3(1.0), echo*(0.04+0.10*amt));

  // Subtle slit-like instability as a tone disturbance, not a geometric cut.
  float slit = smoothstep(0.60,0.98, sin(uv.y*mix(18.0,56.0,uR1.y) + weave*4.0 + gate*3.0)*0.5+0.5);
  outc = mix(outc, hsvShiftLike(outc, uR1.x*0.36 + ripple*0.12), slit*(0.04+0.12*ch));

  outc += vec3((hash21(floor(uv*uResolution)+uSeed*23.0)-0.5) * (0.006+0.008*amt));
  outc = preserveSource(base, outc);

  vec3 regTone = splitTone(outc, mix(uC2,uC0,0.54), mix(uC1,vec3(1.0),0.30), 0.14+0.16*amt);
  regTone = paletteWash(regTone, mix(uC0,uC2,0.36), uC1, vec3(1.0), 0.14+0.14*ch);
  regTone = hueRotate(regTone, (weave-ripple)*0.08 + (uR1.z-0.5)*0.14);
  regTone = contrastSat(regTone, 0.04+0.08*amt, 1.06+0.10*amt);
  outc = mix(outc, regTone, 0.30+0.16*amt);
  outc = softShoulder(outc);
  gl_FragColor = vec4(clamp(outc,0.0,1.0),1.0);
}`;

const PALETTES = [
  {name:'EMBER FILM', c0:[0.95,0.58,0.32], c1:[1.00,0.85,0.55], c2:[0.98,0.48,0.66]},
  {name:'MINT BATH', c0:[0.55,0.84,0.67], c1:[0.74,0.92,0.88], c2:[0.90,0.98,0.96]},
  {name:'LILAC SHIFT', c0:[0.64,0.56,0.88], c1:[0.82,0.72,0.98], c2:[0.96,0.90,1.00]},
  {name:'SODIUM GLASS', c0:[0.90,0.66,0.30], c1:[0.94,0.82,0.55], c2:[0.74,0.88,0.96]},
  {name:'CYAN DUST', c0:[0.48,0.76,0.92], c1:[0.78,0.84,1.00], c2:[0.96,0.76,0.98]},
  {name:'PALE SILVER', c0:[0.72,0.76,0.80], c1:[0.90,0.92,0.95], c2:[0.99,0.97,0.94]}
];

const FAMILIES = {
  SOLAR:['SABATTIER','METALLIC','FLASHLINE','PARTIAL NEGATIVE','OVEREXPOSE'],
  REGISTER:['OFFSET','SLIT','DOUBLE', 'MISALIGN', 'PLATE SHIFT']
};

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
    APP.shaders.SOLAR = createShader(VERT, SOLAR_FRAG);
    APP.shaders.CHEMICAL = createShader(VERT, window.IAEngines.CHEMICAL.fragment);
    APP.shaders.REGISTER = createShader(VERT, REGISTER_FRAG);
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
  ui.exportSize.addEventListener('change',discardPreparedExport);
  bindSlider(ui.amountSlider,ui.amountValue,'amount');
  bindSlider(ui.chanceSlider,ui.chanceValue,'chance');
  bindSlider(ui.preserveSlider,ui.preserveValue,'preserve');
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
    URL.revokeObjectURL(url);
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

function makeRecipe(mode, previous=null){
  // CHEMICAL and LEAK use separate shader programs and randomization code.
  if(mode==='CHEMICAL'||mode==='LEAK'){
    const engine=window.IAEngines && window.IAEngines[mode];
    if(!engine) throw new Error('ENGINE MISSING / '+mode);
    return engine.makeRecipe(previous);
  }
  const rnd=()=>Math.random();
  const p=PALETTES[Math.floor(rnd()*PALETTES.length)];
  const familyIndex=Math.floor(rnd()*FAMILIES[mode].length);
  const fam=FAMILIES[mode][familyIndex];
  const recipe={
    seed:rnd()*99,
    h0:[rnd(),rnd(),rnd(),rnd()],h1:[rnd(),rnd(),rnd(),rnd()],h2:[rnd(),rnd(),rnd(),rnd()],
    r0:[rnd(),rnd(),rnd(),rnd()],r1:[rnd(),rnd(),rnd(),rnd()],r2:[rnd(),rnd(),rnd(),rnd()],
    c0:p.c0,c1:p.c1,c2:p.c2,palette:p.name,family:fam,id:Math.floor(1+rnd()*98)
  };
  if(mode==='SOLAR') recipe.r2[3]=fam==='FLASHLINE'?0.96+rnd()*0.04:rnd()*0.72;
  return recipe;
}

function updateVariation(){
  ui.variationMeta.textContent='INCIDENT / '+APP.mode+' / '+APP.recipe.family+' / '+APP.recipe.palette;
}

function setUniforms(target, w, h){
  target.setUniform('uTex', APP.source);
  target.setUniform('uResolution', [w,h]);
  target.setUniform('uAmount', APP.params.amount/100);
  target.setUniform('uChance', APP.params.chance/100);
  target.setUniform('uPreserve', APP.params.preserve/100);
  target.setUniform('uSeed', APP.recipe.seed);
  target.setUniform('uH0', APP.recipe.h0);
  target.setUniform('uH1', APP.recipe.h1);
  target.setUniform('uH2', APP.recipe.h2);
  target.setUniform('uR0', APP.recipe.r0);
  target.setUniform('uR1', APP.recipe.r1);
  target.setUniform('uR2', APP.recipe.r2);
  target.setUniform('uC0', APP.recipe.c0);
  target.setUniform('uC1', APP.recipe.c1);
  target.setUniform('uC2', APP.recipe.c2);
}

function shaderSourceFor(mode){
  if(mode==='CHEMICAL'||mode==='LEAK') return window.IAEngines[mode].fragment;
  return mode==='SOLAR' ? SOLAR_FRAG : REGISTER_FRAG;
}

function applyModeUniforms(target, mode, w, h){
  if(mode==='CHEMICAL'||mode==='LEAK'){
    // Only the selected engine controls its own uniforms.
    window.IAEngines[mode].setUniforms(target, APP.source, w, h, APP.modeParams[mode], APP.modeRecipes[mode]);
  }else{
    setUniforms(target,w,h);
  }
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

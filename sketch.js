"use strict";

window.IA_SCRIPT_LOADED = true;

const APP = {
  version: '0.2.1',
  mode: 'SOLAR',
  params: { amount: 82, chance: 76, preserve: 34 },
  recipe: null,
  history: [],
  source: null,
  sourceName: '',
  shaders: {},
  ready: false,
  busy: false
};

const IDS = ['openPhotoTop','openPhotoPrimary','photoInput','canvasMount','emptyState','mutateButton','backButton','editToggle','editChevron','editPanel','saveButton','amountSlider','amountValue','chanceSlider','chanceValue','preserveSlider','preserveValue','exportSize','renderOverlay','renderLabel','statusText','variationMeta','errorPanel','errorDetail'];

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
vec2 mirrorUV(vec2 uv){vec2 q=mod(uv,2.0);return 1.0-abs(q-1.0);} 
vec3 texM(vec2 uv){return texture2D(uTex, mirrorUV(uv)).rgb;} 
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);} 
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);} 
float fbm4(vec2 p){float v=0.0,a=0.52;mat2 m=mat2(1.57,1.11,-1.11,1.57);for(int i=0;i<4;i++){v+=a*noise2(p);p=m*p+13.71;a*=0.5;}return v;} 
float fbm6(vec2 p){float v=0.0,a=0.54;mat2 m=mat2(1.72,1.20,-1.20,1.72);for(int i=0;i<6;i++){v+=a*noise2(p);p=m*p+17.31;a*=0.52;}return v;} 
float ridge(float x){return 1.0-abs(2.0*x-1.0);} 
vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;} 
vec3 screenBlend(vec3 a, vec3 b){return 1.0-(1.0-a)*(1.0-b);} 
vec3 softLight(vec3 a, vec3 b){return mix(sqrt(max(a,0.0))*(2.0*b-1.0)+2.0*a*(1.0-b),2.0*a*b+a*a*(1.0-2.0*b),step(b,vec3(0.5)));}
vec3 preserveSource(vec3 base, vec3 processed){float k=sat(uPreserve);k=k*k*(3.0-2.0*k);float yp=max(lum(processed),0.002), yb=max(lum(base),0.016);vec3 src=clamp(base*(yp/yb),0.0,1.3);vec3 pc=processed-vec3(yp);vec3 sc=src-vec3(lum(src));return clamp(vec3(yp)+mix(pc,sc,k),0.0,1.35);} 
vec3 softShoulder(vec3 c){return c/(vec3(1.0)+max(c-vec3(0.72),vec3(0.0))*0.96);} 
float edge(vec2 uv,float px){vec2 dx=vec2(px,0.0), dy=vec2(0.0,px);float ex=abs(lum(texM(uv+dx))-lum(texM(uv-dx)));float ey=abs(lum(texM(uv+dy))-lum(texM(uv-dy)));return sat((ex+ey)*2.2);} 
vec3 triPalette(float t){return clamp(0.56+0.44*cos(6.2831853*(fract(t)+vec3(0.0,0.33,0.67))),0.0,1.0);} 
float lineGlow(vec2 p, float angle, float offset, float width){vec2 q=rot2(p, angle);return exp(-pow(abs(q.y-offset)/(width+0.0001), 1.45));}
vec3 hsvShiftLike(vec3 c, float shift){
  float y = lum(c);
  vec3 a = vec3(y);
  vec3 b = triPalette(y + shift);
  return mix(c, mix(a,b,0.72), 0.35);
}
`;

const SOLAR_FRAG = COMMON + `
void main(){
  vec2 uv=vTexCoord;
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount, ch=uChance;

  float n0=fbm6(rot2(p,(uR0.x-0.5)*1.9)*2.2 + vec2(uSeed*0.013,12.0));
  float n1=fbm4(rot2(p,(uR0.y-0.5)*2.4)*5.2 + vec2(22.0,uSeed*0.017));
  float e=edge(uv,1.4/uResolution.x);
  float y=lum(base);

  float threshold = mix(0.38,0.74,uR0.z) + (n0-0.5)*(0.10+0.18*ch);
  float reverseBand = smoothstep(threshold-0.08-0.10*amt, threshold+0.06, y + (n1-0.5)*0.12);
  vec3 inv = vec3(1.0)-base;
  vec3 sabattier = mix(base, inv, reverseBand*(0.52+0.42*amt));

  float edgeRim = smoothstep(0.05,0.35,e + reverseBand*0.25);
  vec3 rimTint = mix(triPalette(uR1.x + y*0.6), mix(uC0,uC1,0.5), 0.45);
  sabattier = mix(sabattier, vec3(1.0), edgeRim*(0.12+0.55*amt)*(0.45+0.55*ch));
  sabattier = screenBlend(sabattier, rimTint * edgeRim * (0.12+0.24*amt));

  float ang0=mix(-1.2,1.2,uR1.y);
  float ang1=ang0+mix(0.18,0.9,uR1.z);
  float ray0=lineGlow(p,ang0,mix(-0.18,0.18,uH0.x),mix(0.010,0.045,uH0.y));
  float ray1=lineGlow(p,ang1,mix(-0.16,0.16,uH0.z),mix(0.012,0.055,uH0.w));
  float rayField = sat(ray0*0.72+ray1*0.56) * smoothstep(0.54,0.94,n0+0.18*n1+0.08);
  vec3 rayTint = mix(mix(uC1,vec3(1.0,0.98,0.94),0.45), triPalette(uR2.x + n1*0.4), 0.38);
  sabattier = screenBlend(sabattier, rayTint * rayField * (0.16+0.30*amt));

  float clipLift = reverseBand*(0.16+0.55*amt)*(0.62+0.38*ch) + rayField*(0.04+0.12*amt);
  sabattier = mix(sabattier, vec3(1.0), clipLift*(1.0-y*0.35));
  sabattier = mix(sabattier, hsvShiftLike(sabattier, uR2.y*0.6+n0*0.1), 0.22+0.22*ch);

  float grain = (hash21(floor(uv*uResolution)+uSeed*19.0)-0.5) * (0.010+0.010*amt);
  sabattier += vec3(grain);
  sabattier = preserveSource(base, sabattier);
  sabattier = softShoulder(sabattier);
  gl_FragColor = vec4(clamp(sabattier,0.0,1.0),1.0);
}`;

const CHEMICAL_FRAG = COMMON + `
void main(){
  vec2 uv=vTexCoord;
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount, ch=uChance;

  vec2 drift = vec2(fbm4(p*1.8+uSeed*0.01)-0.5, fbm4(rot2(p,1.1)*1.7+uSeed*0.013)-0.5);
  vec3 rS=texM(uv+drift*0.014*(0.3+amt)*vec2(1.0,0.8));
  vec3 gS=texM(uv+drift*0.011*(0.3+amt)*vec2(-0.7,1.0));
  vec3 bS=texM(uv+drift*0.018*(0.2+ch)*vec2(0.9,-0.6));
  vec3 layer = vec3(rS.r, gS.g, bS.b);

  float chem0=fbm6(rot2(p,(uR0.x-0.5)*2.2)*3.0+vec2(7.0,uSeed*0.017));
  float chem1=fbm4(rot2(p,(uR0.y-0.5)*1.6)*6.0+vec2(uSeed*0.02,19.0));
  float bath = smoothstep(0.28,0.82,chem0*(0.75+0.55*chem1));
  float bleach = smoothstep(0.55,0.90,chem1 + chem0*0.4);
  float dyeFail = smoothstep(0.42,0.86,fbm4(p*4.0+vec2(31.0,uSeed*0.02)));

  vec3 cross = vec3(layer.g*0.80+layer.r*0.22, layer.b*0.74+layer.g*0.26, layer.r*0.82+layer.b*0.20);
  vec3 spectral = mix(triPalette(chem0*0.8+uR1.x), mix(uC0,uC2,0.55), 0.32);
  vec3 chem = mix(base, cross, bath*(0.38+0.58*amt));
  chem = mix(chem, spectral * vec3(0.85+lum(layer)*0.35), dyeFail*(0.14+0.36*ch));
  chem = mix(chem, vec3(1.0), bleach*(0.05+0.35*amt)*(1.0-lum(base)*0.4));

  float edgeField=edge(uv,1.4/uResolution.x);
  chem = screenBlend(chem, mix(vec3(1.0,0.98,0.94), uC1, 0.35) * (edgeField*bath) * (0.08+0.26*amt));

  vec3 lowShift = mix(vec3(lum(chem)), chem.bgr, 0.38+0.22*uR1.y);
  chem = mix(chem, lowShift, smoothstep(0.0,0.42,1.0-lum(base))*(0.12+0.25*ch));
  chem = mix(chem, hsvShiftLike(chem, chem1*0.28 + uR1.z*0.4), 0.18+0.22*amt);

  float sediment = pow(hash21(floor(uv*uResolution*0.12)+uSeed*11.0), 15.0) * bath * 0.10 * amt;
  chem = mix(chem, vec3(0.96,0.93,0.86), sediment);
  chem += vec3((hash21(floor(uv*uResolution)+uSeed*31.0)-0.5) * (0.008+0.010*amt));
  chem = preserveSource(base, chem);
  chem = softShoulder(chem);
  gl_FragColor = vec4(clamp(chem,0.0,1.0),1.0);
}`;

const REGISTER_FRAG = COMMON + `
void main(){
  vec2 uv=vTexCoord;
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount, ch=uChance;

  float z0=fbm4(rot2(p,(uH0.x-0.5)*2.4)*2.1+vec2(uSeed*0.013,9.0));
  float z1=fbm4(rot2(p,(uH1.x-0.5)*3.0)*4.0+vec2(17.0,uSeed*0.016));
  float zone=smoothstep(0.28,0.86, z0*0.8+z1*0.5 + length(p)*(0.2+0.2*uH0.y));
  float e=edge(uv,1.8/uResolution.x);

  float a0=mix(-3.0,3.0,uR0.x);
  float a1=a0+mix(0.28,1.4,uR0.y);
  vec2 dir0=vec2(cos(a0),sin(a0));
  vec2 dir1=vec2(cos(a1),sin(a1));
  float d0=mix(6.0,42.0,uR0.z)*(0.35+amt);
  float d1=mix(4.0,28.0,uR0.w)*(0.25+ch);
  vec2 px=vec2(1.0)/uResolution;

  vec3 rA=texM(uv+dir0*px*d0*(0.4+zone));
  vec3 gA=texM(uv-dir1*px*d1*(0.6+zone*0.5));
  vec3 bA=texM(uv+dir1*px*d1*(0.3+e));
  vec3 mis=vec3(rA.r,gA.g,bA.b);

  vec3 lumaLift = vec3(lum(texM(uv+dir0*px*d0*0.45)));
  vec3 incident = mix(mis, mix(mis,lumaLift,0.45), e*(0.25+0.45*ch));
  incident = mix(incident, hsvShiftLike(incident, uR1.x*0.5+z1*0.14), 0.10+0.20*amt);

  float slit = pow(ridge(0.5+0.5*sin(dot(rot2(p,a0),vec2(1.0,0.18))*mix(24.0,90.0,uR1.y)+z1*5.0)), 13.0);
  incident = mix(incident, texM(uv+dir0*px*d0*0.75).bgr, slit*zone*(0.10+0.28*amt));

  vec3 outc = mix(base, incident, zone*(0.52+0.36*amt));
  outc = screenBlend(outc, triPalette(uR1.z+z0*0.3) * e * zone * (0.08+0.24*amt));
  outc = mix(outc, vec3(1.0), e*zone*(0.06+0.16*amt));
  outc += vec3((hash21(floor(uv*uResolution)+uSeed*23.0)-0.5) * (0.007+0.009*amt));
  outc = preserveSource(base, outc);
  outc = softShoulder(outc);
  gl_FragColor = vec4(clamp(outc,0.0,1.0),1.0);
}`;

const CONTACT_FRAG = COMMON + `
void main(){
  vec2 uv=vTexCoord;
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount, ch=uChance;

  vec2 wa = vec2(fbm4(rot2(p, uR0.x*2.5-1.2)*2.2 + vec2(8.0,uSeed*0.012))-0.5,
                 fbm4(rot2(p,-uR0.y*2.3+1.1)*2.0 + vec2(uSeed*0.014,21.0))-0.5);
  vec2 wb = vec2(fbm4(rot2(p, uR0.z*2.8-1.4)*3.8 + vec2(27.0,uSeed*0.016))-0.5,
                 fbm4(rot2(p,-uR0.w*2.4+1.0)*3.4 + vec2(uSeed*0.018,37.0))-0.5);

  vec2 q0 = rot2(p + wa*0.18, mix(-1.1,1.1,uH0.x));
  vec2 q1 = rot2(p + wb*0.16, mix(-1.4,1.4,uH0.y));
  q0 *= vec2(mix(0.9,1.6,uH1.x), mix(1.3,2.4,uH1.y));
  q1 *= vec2(mix(1.2,2.2,uH1.z), mix(0.8,1.9,uH1.w));

  float n0 = fbm6(q0*2.2 + vec2(uSeed*0.011, 5.0));
  float n1 = fbm4(q0*5.8 + vec2(14.0, uSeed*0.015));
  float n2 = fbm6(q1*2.8 + vec2(33.0, uSeed*0.013));
  float n3 = fbm4(q1*6.2 + vec2(uSeed*0.017, 41.0));

  float m0 = smoothstep(0.50,0.82, n0*0.82 + n1*0.24 - length(q0)*0.28);
  float m1 = smoothstep(0.54,0.84, n2*0.78 + n3*0.26 - dot(abs(q1),vec2(0.24,0.16)));

  float strand0 = lineGlow(q0, mix(-1.5,1.5,uR1.x), (n1-0.5)*0.22, mix(0.006,0.026,uR1.y));
  float strand1 = lineGlow(q1, mix(-1.2,1.2,uR1.z), (n3-0.5)*0.18, mix(0.004,0.022,uR1.w));
  float threadField = sat(strand0*0.62 + strand1*0.58) * smoothstep(0.34,0.84,n0+n2*0.3);

  float shadow = sat(max(m0*0.88, m1*0.82) + threadField*0.26);
  float edgeBand = max(0.0, smoothstep(0.34,0.60,shadow) - smoothstep(0.60,0.88,shadow));
  float exposureFog = smoothstep(0.26,0.88, fbm4(rot2(p,0.35)*2.0 + vec2(uSeed*0.02,71.0)) + (1.0-shadow)*0.24 - length(p)*0.10);
  float paperLift = smoothstep(0.44,0.92, exposureFog + edgeBand*0.42);

  vec3 exposed = mix(base, hsvShiftLike(base, uH2.x*0.68 + n2*0.18), 0.12 + 0.28*amt);
  exposed = mix(exposed, exposed.bgr, (0.05+0.12*ch) * smoothstep(0.0,0.45,1.0-lum(base)));

  vec3 shadowTint = mix(vec3(0.10,0.10,0.11), mix(uC0,uC1,0.5), 0.18);
  vec3 paperTint = mix(vec3(1.0,0.985,0.95), mix(uC1,uC2,0.5), 0.16);
  vec3 contact = exposed;

  contact = mix(contact, contact*mix(0.20,0.70,uH2.y) + shadowTint*0.08, shadow*(0.34+0.40*amt));
  contact = screenBlend(contact, paperTint * edgeBand * (0.16+0.34*amt));
  contact = mix(contact, vec3(1.0), edgeBand*(0.06+0.14*amt)*(1.0-lum(base)*0.32));
  contact = screenBlend(contact, paperTint * paperLift * (0.08+0.18*ch) * (1.0-shadow*0.68));

  float powder = pow(hash21(floor(uv*uResolution*0.16)+uSeed*13.0), 12.0) * (0.04+0.10*amt) * (shadow + edgeBand);
  contact = mix(contact, vec3(0.96,0.94,0.88), powder);
  contact += vec3((hash21(floor(uv*uResolution)+uSeed*43.0)-0.5) * (0.006+0.008*amt));
  contact = mix(contact, hsvShiftLike(contact, uH2.z*0.54 + exposureFog*0.12), 0.10+0.18*ch);
  contact = preserveSource(base, contact);
  contact = softShoulder(contact);
  gl_FragColor = vec4(clamp(contact,0.0,1.0),1.0);
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
  CHEMICAL:['BLEACH BATH','DYE FAILURE','DEVELOPER SURGE','CROSS BATH','SILVER RESIDUE'],
  REGISTER:['OFFSET','SLIT','DOUBLE', 'MISALIGN', 'PLATE SHIFT'],
  CONTACT:['CONTACT BURN','SHADOW TRACE','PHOTOGRAM','PAPER GHOST','EXPOSURE IMPRINT']
};

let ui = {};

function setup(){
  try{
    ui = bindUI();
    const c = createCanvas(960, 720, WEBGL);
    c.parent('canvasMount');
    pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    noStroke();
    APP.shaders.SOLAR = createShader(VERT, SOLAR_FRAG);
    APP.shaders.CHEMICAL = createShader(VERT, CHEMICAL_FRAG);
    APP.shaders.REGISTER = createShader(VERT, REGISTER_FRAG);
    APP.shaders.CONTACT = createShader(VERT, CONTACT_FRAG);
    APP.recipe = makeRecipe(APP.mode);
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
    APP.history=[];
    APP.recipe=makeRecipe(APP.mode);
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

function fitPreviewCanvas(w,h){
  const maxDim=window.innerWidth<821?1180:1500;
  const s=Math.min(1,maxDim/Math.max(w,h));
  resizeCanvas(Math.max(2,Math.round(w*s)),Math.max(2,Math.round(h*s)));
}

function setMode(mode,push=true){
  if(!APP.shaders[mode]) return;
  if(push&&APP.source) pushHistory();
  APP.mode=mode;
  APP.recipe=makeRecipe(mode);
  document.documentElement.dataset.mode=mode.toLowerCase();
  ui.modeButtons.forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});
  ui.statusText.textContent=APP.source?'READY / '+mode:'READY / ADD A PHOTO';
  updateVariation();
  renderPreview();
}

function mutate(){
  if(!APP.source){ ui.photoInput.click(); return; }
  pushHistory();
  APP.recipe=makeRecipe(APP.mode);
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
  APP.params={...prev.params};
  APP.recipe=prev.recipe;
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

function makeRecipe(mode){
  const rnd=()=>Math.random();
  const p=PALETTES[Math.floor(rnd()*PALETTES.length)];
  const fam=FAMILIES[mode][Math.floor(rnd()*FAMILIES[mode].length)];
  return {
    seed:rnd()*99,
    h0:[rnd(),rnd(),rnd(),rnd()], h1:[rnd(),rnd(),rnd(),rnd()], h2:[rnd(),rnd(),rnd(),rnd()],
    r0:[rnd(),rnd(),rnd(),rnd()], r1:[rnd(),rnd(),rnd(),rnd()], r2:[rnd(),rnd(),rnd(),rnd()],
    c0:p.c0, c1:p.c1, c2:p.c2, palette:p.name, family:fam, id:Math.floor(1+rnd()*98)
  };
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
  if(mode==='SOLAR') return SOLAR_FRAG;
  if(mode==='CHEMICAL') return CHEMICAL_FRAG;
  if(mode==='REGISTER') return REGISTER_FRAG;
  return CONTACT_FRAG;
}

function renderPreview(){
  if(!APP.ready||!APP.source) return;
  try{
    const sh=APP.shaders[APP.mode];
    shader(sh);
    setUniforms(sh,width,height);
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

async function saveHighRes(){
  if(!APP.source||APP.busy) return;
  setBusy(true,'RENDERING');
  let g;
  try{
    const longSide=Number(ui.exportSize.value)||2600;
    const ratio=APP.source.width/APP.source.height;
    let outW,outH;
    if(ratio>=1){ outW=longSide; outH=Math.max(2,Math.round(longSide/ratio)); }
    else { outH=longSide; outW=Math.max(2,Math.round(longSide*ratio)); }
    g=createGraphics(outW,outH,WEBGL);
    g.pixelDensity(1);
    g.noStroke();
    const sh=g.createShader(VERT, shaderSourceFor(APP.mode));
    g.shader(sh);
    setUniforms(sh,outW,outH);
    g.clear();
    g.plane(outW,outH,1,1);
    g.resetShader();
    await new Promise(r=>setTimeout(r,80));
    const blob=await canvasToBlob(g.canvas,'image/png');
    const base=(APP.sourceName||'incident-archive').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'_');
    const file=new File([blob],`${base}_${APP.mode.toLowerCase()}_${Date.now()}.png`,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'Incident Archive'});
    }else{
      const a=document.createElement('a');
      const objectURL=URL.createObjectURL(blob);
      a.href=objectURL;
      a.download=file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectURL),1200);
    }
  }catch(err){ showError(err); }
  finally { if(g) g.remove(); setBusy(false); }
}

function canvasToBlob(canvas, type){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Export failed.')),type));
}

function showError(err){
  const msg=err&&err.message?err.message:String(err);
  console.error(msg);
  if(ui.errorDetail){ ui.errorDetail.textContent=msg; ui.errorPanel.hidden=false; }
  else alert(msg);
}

function windowResized(){
  if(APP.source&&window.innerWidth<821) fitPreviewCanvas(APP.source.width,APP.source.height);
  renderPreview();
}

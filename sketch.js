'use strict';

window.IA_SCRIPT_LOADED=true;

const APP={
  version:'0.1.2',
  mode:'SPECIMEN',
  params:{amount:82,chance:78,preserve:42},
  recipe:null,
  history:[],
  source:null,
  sourceName:'',
  shaders:{},
  ready:false,
  busy:false
};

const IDS=['openPhotoTop','openPhotoPrimary','photoInput','canvasMount','emptyState','mutateButton','backButton','editToggle','editChevron','editPanel','saveButton','amountSlider','amountValue','chanceSlider','chanceValue','preserveSlider','preserveValue','exportSize','renderOverlay','renderLabel','statusText','variationMeta','errorPanel','errorDetail'];

const VERT=`
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewProjectionMatrix;
varying vec2 vTexCoord;
void main(){vTexCoord=aTexCoord;gl_Position=uModelViewProjectionMatrix*vec4(aPosition,1.0);}`;

const COMMON=`
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
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec2 mirrorUV(vec2 uv){vec2 q=mod(uv,2.0);return 1.0-abs(q-1.0);} 
vec3 texM(vec2 uv){return texture2D(uTex,mirrorUV(uv)).rgb;}
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);} 
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);} 
float fbm4(vec2 p){float v=0.0,a=.52;mat2 m=mat2(1.57,1.11,-1.11,1.57);for(int i=0;i<4;i++){v+=a*noise2(p);p=m*p+13.71;a*=.48;}return v;}
float ridge(float x){return 1.0-abs(2.0*x-1.0);} 
vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;} 
float blob(vec2 uv,vec2 c,vec2 size,float a){vec2 q=rot2(uv-c,a)/max(size,vec2(.001));return exp(-dot(q,q)*2.1);} 
float edge(vec2 uv,float px){vec2 dx=vec2(px,0),dy=vec2(0,px);float ex=abs(lum(texM(uv+dx))-lum(texM(uv-dx)));float ey=abs(lum(texM(uv+dy))-lum(texM(uv-dy)));return sat((ex+ey)*2.0);} 
vec3 screenBlend(vec3 a,vec3 b){return 1.0-(1.0-a)*(1.0-b);} 
vec3 satAdjust(vec3 c,float amount){float y=lum(c);return mix(vec3(y),c,amount);} 
float grain(vec2 uv){return hash21(floor(uv*uResolution)+uSeed*19.0)-.5;} 
vec3 preserveSource(vec3 base,vec3 processed){float k=sat(uPreserve);k=k*k*(3.0-2.0*k);float yp=max(lum(processed),.002),yb=max(lum(base),.016);vec3 src=clamp(base*(yp/yb),0.0,1.25);vec3 pc=processed-vec3(yp);vec3 sc=src-vec3(lum(src));return clamp(vec3(yp)+mix(pc,sc,k),0.0,1.25);} 
vec3 softShoulder(vec3 c){return c/(vec3(1.0)+max(c-vec3(.76),vec3(0.0))*.92);} 
float lineSDF(vec2 p,vec2 a,vec2 b,float w){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return exp(-dot(pa-ba*h,pa-ba*h)/max(w*w,.000001));}
vec3 triPalette(float t){t=fract(t);vec3 c=.58+.42*cos(6.2831853*(t+vec3(0.0,.67,.33)));return clamp(c,0.0,1.0);} 
`;

const SPECIMEN_FRAG=COMMON+`
float organicTrace(vec2 uv,vec2 c,float a,float scale,float phase){
  vec2 p=rot2(uv-c,-a)/scale;
  float yGate=smoothstep(-1.05,-.78,p.y)*(1.0-smoothstep(.78,1.05,p.y));
  float sway=sin(p.y*3.1+phase)*.12+(fbm4(vec2(p.y*.82,phase*1.7)+7.0)-.5)*.20;
  float d=abs(p.x-sway);
  float core=exp(-(d*d)/.0032)*yGate;
  float aura=exp(-(d*d)/.028)*yGate;
  float nodes=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i);float yy=-.62+fi*.31;
    float side=mod(fi,2.0)<1.0?-1.0:1.0;
    vec2 cc=vec2(sway+side*(.14+.025*sin(fi*2.3+phase)),yy);
    vec2 q=(p-cc)/vec2(.22,.085);
    nodes=max(nodes,exp(-dot(q,q)*2.7));
  }
  return sat(max(core*.92,max(nodes*.68,aura*.18)));
}
float membraneTrace(vec2 uv,vec2 c,float a,float scale,float phase){
  vec2 p=rot2(uv-c,-a)/scale;
  vec2 q=p/vec2(.76,.34);
  float shell=exp(-dot(q,q)*2.0);
  float n=fbm4(p*1.18+vec2(phase*3.1,11.0));
  float holes=smoothstep(.54,.82,fbm4(p*2.45+vec2(27.0,phase*2.2)));
  float veins=pow(ridge(.5+.5*sin((p.x*.45+p.y)*13.0+n*4.8+phase)),12.0);
  return sat(shell*(.58+.32*n)*(1.0-holes*.46)+veins*shell*.28);
}
float sporeTrace(vec2 uv,vec2 c,float scale,float phase){
  float m=0.0;
  for(int i=0;i<7;i++){
    float fi=float(i);float ang=fi*.897+phase;
    float rad=scale*(.32+.28*sin(fi*1.73+phase));
    vec2 cc=c+vec2(cos(ang),sin(ang))*rad;
    vec2 q=rot2(uv-cc,-ang)/vec2(scale*.16,scale*.055);
    m=max(m,exp(-dot(q,q)*2.6));
  }
  return m;
}
void main(){
  vec2 uv=vTexCoord;vec3 base=texM(uv);vec3 outc=base;float amt=uAmount;float ch=uChance;
  float m0=organicTrace(uv,vec2(mix(.12,.88,uH0.x),mix(.14,.86,uH0.y)),mix(-2.7,2.7,uH0.z),mix(.18,.36,uH0.w),uSeed*.11);
  float m1=membraneTrace(uv,vec2(mix(.10,.90,uH1.x),mix(.12,.88,uH1.y)),mix(-2.3,2.3,uH1.z),mix(.18,.34,uH1.w),uSeed*.17+2.0);
  float m2=sporeTrace(uv,vec2(mix(.12,.88,uH2.x),mix(.14,.86,uH2.y)),mix(.11,.23,uH2.z),uH2.w*6.2831);
  vec2 p=rot2(uv-.5,mix(-1.4,1.4,uR0.x));
  float fiberNoise=fbm4(p*1.45+vec2(uSeed*.013,19.0));
  float fibers=pow(ridge(.5+.5*sin((p.y+p.x*.16)*mix(17.0,33.0,uR0.y)+fiberNoise*7.0)),18.0);
  fibers*=smoothstep(.50,.84,fbm4(p*.92+31.0));
  float choose0=step(.14,ch);float choose1=step(.34,ch+uR1.x*.20);float choose2=step(.56,ch+uR1.y*.24);float choose3=step(.74,ch+uR1.z*.18);
  float contact=sat((m0*1.12*choose0+m1*1.02*choose1+m2*.86*choose2+fibers*.62*choose3)*(1.0+.24*amt+.18*ch));
  float soft=smoothstep(.015,.66,contact);float core=smoothstep(.34,.86,contact);float rim=sat(soft-core);
  float y=lum(base);vec3 inv=vec3(1.0)-base;
  vec3 paper=mix(vec3(.96,.95,.91),uC2,.10+.10*uR2.x);
  vec3 silver=mix(vec3(y),paper,.66+.18*uR2.y);
  vec3 ghost=mix(base,inv,.12+.22*uR1.w);
  float family=floor(uR2.z*4.0);vec3 incident=silver;
  if(family<1.0) incident=mix(paper,ghost,.22);
  else if(family<2.0) incident=mix(vec3(y),paper,.74);
  else if(family<3.0) incident=base*mix(.72,.42,uR2.y)+paper*.08;
  else incident=mix(silver,uC1,.08+.12*uR2.w);
  outc=mix(outc,incident,core*amt*(.62+.46*ch));
  outc=screenBlend(outc,mix(vec3(1.0),uC2,.12)*rim*amt*(.14+.24*ch));
  float exposure=soft*amt*(.045+.130*ch)*(1.0-y*.48);outc=mix(outc,vec3(1.0),exposure);
  float dust=pow(hash21(floor(uv*uResolution*.085)+uSeed*7.0),25.0)*ch*.15;outc=mix(outc,vec3(.94,.93,.89),dust*amt);
  outc=preserveSource(base,outc);outc+=vec3(grain(uv)*(.005+.006*amt));
  gl_FragColor=vec4(clamp(outc,0.0,1.0),1.0);
}`;

const TRANSFER_FRAG=COMMON+`
float transferField(vec2 uv){
  vec2 c0=vec2(mix(.08,.92,uH0.x),mix(.08,.92,uH0.y));vec2 c1=vec2(mix(.08,.92,uH1.x),mix(.08,.92,uH1.y));vec2 c2=vec2(mix(.10,.90,uH2.x),mix(.10,.90,uH2.y));
  float b0=blob(uv,c0,vec2(mix(.16,.44,uH0.z),mix(.09,.30,uH0.w)),mix(-2.2,2.2,uR0.x));
  float b1=blob(uv,c1,vec2(mix(.12,.36,uH1.z),mix(.08,.24,uH1.w)),mix(-2.0,2.0,uR0.y));
  float b2=blob(uv,c2,vec2(mix(.10,.30,uH2.z),mix(.07,.22,uH2.w)),mix(-2.0,2.0,uR0.z));
  float n=fbm4(rot2(uv-.5,(uR0.w-.5)*1.5)*1.35+uSeed*.017);float tears=smoothstep(.42,.76,n);
  return sat((b0*.95+b1*.82+b2*.70)*(.64+.52*tears));
}
void main(){
  vec2 uv=vTexCoord;vec2 px=vec2(1.0)/uResolution;vec3 base=texM(uv);float amt=uAmount,ch=uChance;
  float field=transferField(uv);float n0=fbm4(uv*2.2+vec2(uSeed*.013,7.0));float n1=fbm4(rot2(uv-.5,1.1)*4.1+vec2(17.0,uSeed*.01));
  float torn=smoothstep(.16,.78,field*(.65+.58*n0));float edgeBand=sat(smoothstep(.18,.46,torn)-smoothstep(.56,.86,torn));
  float a=mix(-2.6,2.6,uR1.x);vec2 dir=vec2(cos(a),sin(a));float dist=mix(12.0,88.0,uR1.y)*(1.0+.82*ch);vec2 off=dir*px*dist;
  vec3 shifted=texM(uv+off*(.68+.44*n0));vec3 shifted2=texM(uv-off*(.32+.28*n1));
  vec3 ghost=mix(shifted,shifted2,.36+.28*uR1.z);float yg=lum(ghost);
  vec3 ink=mix(vec3(yg),ghost,.34+.32*uR1.w);ink=mix(ink,vec3(1.0)-ink,.10+.30*uR2.x);
  float smear=pow(ridge(.5+.5*sin(dot(rot2(uv-.5,a),vec2(1.0,0.18))*mix(34.0,96.0,uR2.y)+n1*5.0)),10.0)*torn;
  vec3 outc=base;
  float lift=torn*amt*(.58+.42*ch);outc=mix(outc,ink,lift);
  vec3 paper=mix(vec3(.92,.87,.78),uC0,.22+.18*uR2.z);outc=mix(outc,paper,edgeBand*amt*(.14+.23*ch));
  outc=mix(outc,ghost,smear*amt*(.19+.34*ch));
  float abrasion=pow(ridge(n1),12.0)*torn*ch;outc=mix(outc,vec3(1.0),abrasion*amt*.16);
  float contactDark=edgeBand*(1.0-smoothstep(.3,.8,n0))*amt;outc*=1.0-contactDark*(.07+.14*uR2.w);
  outc=preserveSource(base,outc);outc+=vec3(grain(uv)*(.006+.009*ch));outc=softShoulder(outc);
  gl_FragColor=vec4(clamp(outc,0.0,1.0),1.0);
}`;

const ECHO_FRAG=COMMON+`
void main(){
  vec2 uv=vTexCoord;vec2 px=vec2(1.0)/uResolution;vec3 base=texM(uv);float amt=uAmount,ch=uChance;
  vec2 c0=vec2(mix(.10,.90,uH0.x),mix(.12,.88,uH0.y));vec2 c1=vec2(mix(.10,.90,uH1.x),mix(.12,.88,uH1.y));vec2 c2=vec2(mix(.10,.90,uH2.x),mix(.12,.88,uH2.y));
  float z0=blob(uv,c0,vec2(mix(.18,.42,uH0.z),mix(.10,.28,uH0.w)),mix(-2.0,2.0,uR0.x));
  float z1=blob(uv,c1,vec2(mix(.14,.36,uH1.z),mix(.09,.24,uH1.w)),mix(-2.0,2.0,uR0.y));
  float z2=blob(uv,c2,vec2(mix(.12,.30,uH2.z),mix(.08,.22,uH2.w)),mix(-2.0,2.0,uR0.z));
  float zone=sat(z0*.95+z1*.78+z2*.66);float e=edge(uv,1.5/uResolution.x);
  float a0=mix(-3.0,3.0,uR1.x);vec2 d0=vec2(cos(a0),sin(a0))*px*mix(12.0,84.0,uR1.y)*(1.0+.82*ch);
  float a1=a0+mix(.35,1.5,uR1.z);vec2 d1=vec2(cos(a1),sin(a1))*px*mix(8.0,48.0,uR1.w);
  vec3 q0=texM(uv+d0);vec3 q1=texM(uv-d0*.72);vec3 q2=texM(uv+d1);
  vec3 echoA=vec3(q0.r,q1.g,q2.b);vec3 echoB=mix(q1,q2,.44+.26*uR2.x);
  float contour=sat(e*(.55+.85*ch)+smoothstep(.62,.92,fbm4(uv*2.4+uSeed*.017))*zone*.24);
  float family=floor(uR2.y*4.0);vec3 incident=echoA;
  if(family<1.0) incident=mix(echoA,echoB,.28);
  else if(family<2.0) incident=mix(vec3(lum(echoA)),echoA,.54);
  else if(family<3.0) incident=mix(echoA,vec3(1.0)-echoB,.24+.18*uR2.z);
  else incident=mix(echoA,uC1,.10+.18*uR2.w);
  vec3 outc=mix(base,incident,zone*amt*(.42+.50*ch));
  vec3 rimCol=mix(uC0,uC2,.5+.5*sin(uSeed*.31));outc=screenBlend(outc,rimCol*contour*zone*amt*(.16+.28*ch));
  float slit=pow(ridge(.5+.5*sin((uv.y+fbm4(uv*1.7+13.0)*.08)*mix(28.0,74.0,uH2.w)+uSeed)),18.0)*zone*step(.62,ch);
  outc=mix(outc,texM(uv+d0*1.85),slit*amt*.34);
  outc=preserveSource(base,outc);outc+=vec3(grain(uv)*(.004+.008*ch));outc=softShoulder(outc);
  gl_FragColor=vec4(clamp(outc,0.0,1.0),1.0);
}`;

const BLOOMCAST_FRAG=COMMON+`
float ringField(vec2 uv,vec2 c,float radius,float width){
  float d=abs(length(uv-c)-radius);
  return exp(-(d*d)/max(width*width,.00002));
}
void main(){
  vec2 uv=vTexCoord;vec2 px=vec2(1.0)/uResolution;vec3 base=texM(uv);float amt=uAmount,ch=uChance;
  vec2 c0=vec2(mix(.10,.90,uH0.x),mix(.12,.88,uH0.y));
  vec2 c1=vec2(mix(.10,.90,uH1.x),mix(.12,.88,uH1.y));
  float r0=ringField(uv,c0,mix(.12,.38,uH0.z),mix(.009,.030,uH0.w));
  float r1=ringField(uv,c1,mix(.09,.31,uH1.z),mix(.007,.024,uH1.w));
  float b0=blob(uv,c0,vec2(mix(.18,.42,uR0.x),mix(.13,.31,uR0.y)),mix(-1.8,1.8,uR0.z));
  float b1=blob(uv,c1,vec2(mix(.15,.34,uR1.x),mix(.10,.26,uR1.y)),mix(-1.8,1.8,uR1.z));
  vec2 rp=rot2(uv-.5,(uR2.x-.5)*1.25);
  float n0=fbm4(rp*1.30+vec2(uSeed*.014,5.0));
  float n1=fbm4(rp*2.65+vec2(21.0,uSeed*.011));
  float reaction=pow(ridge(n1),7.0)*smoothstep(.30,.78,n0);
  float field=sat(((b0*.72+b1*.64)*(.70+.50*n0)+(r0*.82+r1*.72)*(.62+.52*ch)+reaction*.28*ch)*(1.0+.18*amt));
  vec2 flow=vec2(noise2(uv*3.1+vec2(uSeed,4.0))-.5,noise2(uv*2.9+vec2(17.0,uSeed))-.5);
  vec2 disp=flow*px*mix(2.5,14.0,amt)*field;
  vec3 warped=texM(uv+disp);
  float phase=fract(n0*1.36+n1*.42+r0*.18-r1*.15+uR2.y);
  vec3 spectral=triPalette(phase+uR2.z*.22);
  vec3 tint=mix(vec3(1.0),mix(uC0,spectral,.28),field*(.08+.18*ch));
  vec3 treated=warped*tint;
  float yt=max(lum(treated),.002),yw=max(lum(warped),.002);treated*=mix(1.0,yw/yt,.72);
  vec3 outc=mix(base,treated,field*amt*(.38+.40*ch));
  float edgeBloom=sat((r0+r1)*(.34+.36*ch)+reaction*.12)*amt;
  outc=screenBlend(outc,mix(vec3(1.0,.99,.97),uC1,.16)*edgeBloom*(.14+.22*ch));
  float bleach=field*amt*(.024+.075*ch)*(1.0-lum(base)*.36);outc=mix(outc,vec3(1.0),bleach);
  outc=preserveSource(base,outc);outc+=vec3(grain(uv)*(.004+.006*ch));outc=softShoulder(outc);
  gl_FragColor=vec4(clamp(outc,0.0,1.0),1.0);
}`;

const PALETTES=[
  {name:'HERBARIUM',c0:[.62,.72,.48],c1:[.86,.76,.52],c2:[.95,.91,.78]},
  {name:'SILVER CONTACT',c0:[.58,.62,.68],c1:[.78,.82,.88],c2:[.96,.97,.98]},
  {name:'BRUISED CYAN',c0:[.42,.68,.72],c1:[.68,.86,.88],c2:[.90,.98,.95]},
  {name:'LILAC ASH',c0:[.58,.50,.70],c1:[.78,.70,.88],c2:[.96,.91,.98]},
  {name:'OXIDE ROSE',c0:[.66,.46,.42],c1:[.84,.62,.54],c2:[.96,.87,.78]},
  {name:'PALE MINT',c0:[.50,.72,.63],c1:[.72,.88,.78],c2:[.93,.98,.90]},
  {name:'PAPER BLUE',c0:[.46,.58,.74],c1:[.68,.76,.90],c2:[.92,.95,1.00]},
  {name:'BONE LIGHT',c0:[.72,.68,.60],c1:[.88,.83,.72],c2:[1.00,.96,.86]}
];

const FAMILIES={
  SPECIMEN:['TRACE','CONTACT','MEMBRANE','SPORE','FIBER'],
  TRANSFER:['GEL','LIFT','OFFSET','ABRASION','PRESS'],
  ECHO:['AFTERIMAGE','SLIT','DOUBLE','CONTOUR','DELAY'],
  BLOOMCAST:['RING','PRESSURE','REACTION','MEMBRANE','BLEACH']
};

let ui={};

function setup(){
  try{
    ui=bindUI();
    const c=createCanvas(960,720,WEBGL);c.parent('canvasMount');pixelDensity(Math.min(window.devicePixelRatio||1,2));noStroke();
    APP.shaders.SPECIMEN=createShader(VERT,SPECIMEN_FRAG);
    APP.shaders.TRANSFER=createShader(VERT,TRANSFER_FRAG);
    APP.shaders.ECHO=createShader(VERT,ECHO_FRAG);
    APP.shaders.BLOOMCAST=createShader(VERT,BLOOMCAST_FRAG);
    APP.recipe=makeRecipe(APP.mode);APP.ready=true;wireUI();syncControls();setMode(APP.mode,false);background(0,0);noLoop();
  }catch(err){showError(err);}
}

function bindUI(){const out={};for(const id of IDS){const el=document.getElementById(id);if(!el)throw new Error('UI ERROR / '+id);out[id]=el;}out.modeButtons=[...document.querySelectorAll('.mode')];return out;}
function wireUI(){ui.openPhotoTop.addEventListener('click',()=>ui.photoInput.click());ui.openPhotoPrimary.addEventListener('click',()=>ui.photoInput.click());ui.photoInput.addEventListener('change',handleFile);ui.modeButtons.forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode,true)));ui.mutateButton.addEventListener('click',mutate);ui.backButton.addEventListener('click',goBack);ui.editToggle.addEventListener('click',toggleEdit);ui.saveButton.addEventListener('click',saveHighRes);bindSlider(ui.amountSlider,ui.amountValue,'amount');bindSlider(ui.chanceSlider,ui.chanceValue,'chance');bindSlider(ui.preserveSlider,ui.preserveValue,'preserve');}
function bindSlider(input,output,key){input.addEventListener('input',()=>{APP.params[key]=Number(input.value);output.value=input.value;renderPreview();});}
function syncControls(){for(const key of ['amount','chance','preserve']){ui[key+'Slider'].value=APP.params[key];ui[key+'Value'].value=APP.params[key];}}

function handleFile(e){const file=e.target.files&&e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')){showError(new Error('Please choose an image file.'));return;}setBusy(true,'OPENING');const url=URL.createObjectURL(file);loadImage(url,img=>{URL.revokeObjectURL(url);APP.source=img;APP.sourceName=file.name||'photo';APP.history=[];APP.recipe=makeRecipe(APP.mode);fitPreviewCanvas(img.width,img.height);ui.emptyState.hidden=true;ui.saveButton.disabled=false;ui.backButton.disabled=true;ui.statusText.textContent='READY / '+APP.mode;renderPreview();setBusy(false);},err=>{URL.revokeObjectURL(url);setBusy(false);showError(err||new Error('Image could not be opened.'));});}
function fitPreviewCanvas(w,h){const maxDim=window.innerWidth<821?1180:1500;const s=Math.min(1,maxDim/Math.max(w,h));resizeCanvas(Math.max(2,Math.round(w*s)),Math.max(2,Math.round(h*s)));}
function setMode(mode,push=true){if(!APP.shaders[mode])return;if(push&&APP.source)pushHistory();APP.mode=mode;APP.recipe=makeRecipe(mode);document.documentElement.dataset.mode=mode.toLowerCase();ui.modeButtons.forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});ui.statusText.textContent=APP.source?'READY / '+mode:'READY / ADD A PHOTO';updateVariation();renderPreview();}
function mutate(){if(!APP.source){ui.photoInput.click();return;}pushHistory();APP.recipe=makeRecipe(APP.mode);updateVariation();ui.mutateButton.animate([{transform:'translateX(0)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:180,easing:'ease-out'});renderPreview();}
function pushHistory(){APP.history.push({mode:APP.mode,params:{...APP.params},recipe:JSON.parse(JSON.stringify(APP.recipe))});if(APP.history.length>20)APP.history.shift();ui.backButton.disabled=APP.history.length===0;}
function goBack(){if(!APP.history.length)return;const prev=APP.history.pop();APP.mode=prev.mode;APP.params={...prev.params};APP.recipe=prev.recipe;syncControls();document.documentElement.dataset.mode=APP.mode.toLowerCase();ui.modeButtons.forEach(b=>{const on=b.dataset.mode===APP.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});ui.backButton.disabled=APP.history.length===0;updateVariation();renderPreview();}
function toggleEdit(){const open=ui.editPanel.hidden;ui.editPanel.hidden=!open;ui.editToggle.setAttribute('aria-expanded',open?'true':'false');ui.editChevron.textContent=open?'−':'＋';}

function makeRecipe(mode){const rnd=()=>Math.random(),r=(a,b)=>a+(b-a)*rnd();const p=PALETTES[Math.floor(rnd()*PALETTES.length)];const fam=FAMILIES[mode][Math.floor(rnd()*FAMILIES[mode].length)];return{seed:rnd()*99,h0:[rnd(),rnd(),rnd(),rnd()],h1:[rnd(),rnd(),rnd(),rnd()],h2:[rnd(),rnd(),rnd(),rnd()],r0:[rnd(),rnd(),rnd(),rnd()],r1:[rnd(),rnd(),rnd(),rnd()],r2:[rnd(),rnd(),rnd(),rnd()],c0:p.c0,c1:p.c1,c2:p.c2,palette:p.name,family:fam,id:Math.floor(r(1,99))};}
function updateVariation(){ui.variationMeta.textContent='INCIDENT / '+APP.mode+' / '+APP.recipe.family+' / '+APP.recipe.palette;}
function setUniforms(sh,w,h){sh.setUniform('uTex',APP.source);sh.setUniform('uResolution',[w,h]);sh.setUniform('uAmount',APP.params.amount/100);sh.setUniform('uChance',APP.params.chance/100);sh.setUniform('uPreserve',APP.params.preserve/100);sh.setUniform('uSeed',APP.recipe.seed);sh.setUniform('uH0',APP.recipe.h0);sh.setUniform('uH1',APP.recipe.h1);sh.setUniform('uH2',APP.recipe.h2);sh.setUniform('uR0',APP.recipe.r0);sh.setUniform('uR1',APP.recipe.r1);sh.setUniform('uR2',APP.recipe.r2);sh.setUniform('uC0',APP.recipe.c0);sh.setUniform('uC1',APP.recipe.c1);sh.setUniform('uC2',APP.recipe.c2);}
function renderPreview(){if(!APP.ready||!APP.source)return;try{const sh=APP.shaders[APP.mode];shader(sh);setUniforms(sh,width,height);clear();plane(width,height,1,1);resetShader();}catch(err){showError(err);}}
function setBusy(on,label='MUTATING'){APP.busy=on;ui.renderOverlay.hidden=!on;ui.renderLabel.textContent=label;ui.saveButton.disabled=on||!APP.source;}

async function saveHighRes(){if(!APP.source||APP.busy)return;setBusy(true,'RENDERING');let g;try{const longSide=Number(ui.exportSize.value)||2600;const ratio=APP.source.width/APP.source.height;let outW,outH;if(ratio>=1){outW=longSide;outH=Math.max(2,Math.round(longSide/ratio));}else{outH=longSide;outW=Math.max(2,Math.round(longSide*ratio));}g=createGraphics(outW,outH,WEBGL);g.pixelDensity(1);g.noStroke();const sh=g.createShader(VERT,shaderSourceFor(APP.mode));g.shader(sh);setUniforms(sh,outW,outH);g.clear();g.plane(outW,outH,1,1);g.resetShader();await new Promise(r=>setTimeout(r,80));const blob=await canvasToBlob(g.canvas,'image/png');const base=(APP.sourceName||'incident-archive').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'_');const file=new File([blob],`${base}_${APP.mode.toLowerCase()}_${Date.now()}.png`,{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:'Incident Archive'});else{const a=document.createElement('a');const objectURL=URL.createObjectURL(blob);a.href=objectURL;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),1200);}}catch(err){showError(err);}finally{if(g)g.remove();setBusy(false);}}
function shaderSourceFor(mode){return mode==='SPECIMEN'?SPECIMEN_FRAG:mode==='TRANSFER'?TRANSFER_FRAG:mode==='ECHO'?ECHO_FRAG:BLOOMCAST_FRAG;}
function canvasToBlob(c,type){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Export failed.')),type));}
function showError(err){const msg=err&&err.message?err.message:String(err);console.error(msg);if(ui.errorDetail){ui.errorDetail.textContent=msg;ui.errorPanel.hidden=false;}else alert(msg);}
function windowResized(){if(APP.source&&window.innerWidth<821)fitPreviewCanvas(APP.source.width,APP.source.height);renderPreview();}

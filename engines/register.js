"use strict";
// REGISTER: isolated original image-processing program.
// Its GLSL is byte-for-byte equivalent to the v0.3.1 shader.
(() => {
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
const FRAGMENT = COMMON + `
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
window.IAEngines = window.IAEngines || Object.create(null);
const PALETTES = [
  {name:'EMBER FILM', c0:[0.95,0.58,0.32], c1:[1.00,0.85,0.55], c2:[0.98,0.48,0.66]},
  {name:'MINT BATH', c0:[0.55,0.84,0.67], c1:[0.74,0.92,0.88], c2:[0.90,0.98,0.96]},
  {name:'LILAC SHIFT', c0:[0.64,0.56,0.88], c1:[0.82,0.72,0.98], c2:[0.96,0.90,1.00]},
  {name:'SODIUM GLASS', c0:[0.90,0.66,0.30], c1:[0.94,0.82,0.55], c2:[0.74,0.88,0.96]},
  {name:'CYAN DUST', c0:[0.48,0.76,0.92], c1:[0.78,0.84,1.00], c2:[0.96,0.76,0.98]},
  {name:'PALE SILVER', c0:[0.72,0.76,0.80], c1:[0.90,0.92,0.95], c2:[0.99,0.97,0.94]}
];
const FAMILIES = ["OFFSET", "SLIT", "DOUBLE", "MISALIGN", "PLATE SHIFT"];
function makeRecipe(){
  const rnd=()=>Math.random();
  const p=PALETTES[Math.floor(rnd()*PALETTES.length)];
  const familyIndex=Math.floor(rnd()*FAMILIES.length);
  const fam=FAMILIES[familyIndex];
  const recipe={seed:rnd()*99,
    h0:[rnd(),rnd(),rnd(),rnd()],h1:[rnd(),rnd(),rnd(),rnd()],h2:[rnd(),rnd(),rnd(),rnd()],
    r0:[rnd(),rnd(),rnd(),rnd()],r1:[rnd(),rnd(),rnd(),rnd()],r2:[rnd(),rnd(),rnd(),rnd()],
    c0:p.c0,c1:p.c1,c2:p.c2,palette:p.name,family:fam,id:Math.floor(1+rnd()*98)};
  
  return recipe;
}
function setUniforms(target,source,width,height,params,recipe){
  target.setUniform('uTex',source);
  target.setUniform('uResolution',[width,height]);
  target.setUniform('uAmount',params.amount/100);
  target.setUniform('uChance',params.chance/100);
  target.setUniform('uPreserve',params.preserve/100);
  target.setUniform('uSeed',recipe.seed);
  for(const key of ['h0','h1','h2','r0','r1','r2'])target.setUniform('u'+key.toUpperCase(),recipe[key]);
  for(const key of ['c0','c1','c2'])target.setUniform('u'+key.toUpperCase(),recipe[key]);
}
window.IAEngines.REGISTER = Object.freeze({fragment:FRAGMENT,makeRecipe,setUniforms});
})();

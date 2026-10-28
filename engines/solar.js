"use strict";
// SOLAR: isolated original image-processing program.
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
window.IAEngines = window.IAEngines || Object.create(null);
const PALETTES = [
  {name:'EMBER FILM', c0:[0.95,0.58,0.32], c1:[1.00,0.85,0.55], c2:[0.98,0.48,0.66]},
  {name:'MINT BATH', c0:[0.55,0.84,0.67], c1:[0.74,0.92,0.88], c2:[0.90,0.98,0.96]},
  {name:'LILAC SHIFT', c0:[0.64,0.56,0.88], c1:[0.82,0.72,0.98], c2:[0.96,0.90,1.00]},
  {name:'SODIUM GLASS', c0:[0.90,0.66,0.30], c1:[0.94,0.82,0.55], c2:[0.74,0.88,0.96]},
  {name:'CYAN DUST', c0:[0.48,0.76,0.92], c1:[0.78,0.84,1.00], c2:[0.96,0.76,0.98]},
  {name:'PALE SILVER', c0:[0.72,0.76,0.80], c1:[0.90,0.92,0.95], c2:[0.99,0.97,0.94]}
];
const FAMILIES = ["SABATTIER", "METALLIC", "FLASHLINE", "PARTIAL NEGATIVE", "OVEREXPOSE"];
function makeRecipe(){
  const rnd=()=>Math.random();
  const p=PALETTES[Math.floor(rnd()*PALETTES.length)];
  const familyIndex=Math.floor(rnd()*FAMILIES.length);
  const fam=FAMILIES[familyIndex];
  const recipe={seed:rnd()*99,
    h0:[rnd(),rnd(),rnd(),rnd()],h1:[rnd(),rnd(),rnd(),rnd()],h2:[rnd(),rnd(),rnd(),rnd()],
    r0:[rnd(),rnd(),rnd(),rnd()],r1:[rnd(),rnd(),rnd(),rnd()],r2:[rnd(),rnd(),rnd(),rnd()],
    c0:p.c0,c1:p.c1,c2:p.c2,palette:p.name,family:fam,id:Math.floor(1+rnd()*98)};
  if(fam==='FLASHLINE') recipe.r2[3]=0.96+rnd()*0.04; else recipe.r2[3]=rnd()*0.72;
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
window.IAEngines.SOLAR = Object.freeze({fragment:FRAGMENT,makeRecipe,setUniforms});
})();

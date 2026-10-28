"use strict";
// CHEMICAL: intentional small-scale polygonal dye failures, localized color shifts.
(() => {
const UTILS = `
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
vec3 texM(vec2 uv){return texture2D(uTex, clampUV(uv)).rgb;} 
vec2 screenUV(){vec2 uv=gl_FragCoord.xy/max(uResolution,vec2(1.0));uv.y=1.0-uv.y;return uv;} 
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);} 
vec2 hash22(vec2 p){float n=hash21(p);float m=hash21(p+19.19);return vec2(n,m);} 
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);} 
float fbm4(vec2 p){float v=0.0,a=0.52;mat2 m=mat2(1.57,1.11,-1.11,1.57);for(int i=0;i<4;i++){v+=a*noise2(p);p=m*p+13.71;a*=0.5;}return v;} 
float fbm6(vec2 p){float v=0.0,a=0.54;mat2 m=mat2(1.72,1.20,-1.20,1.72);for(int i=0;i<6;i++){v+=a*noise2(p);p=m*p+17.31;a*=0.52;}return v;} 
vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;} 
vec3 screenBlend(vec3 a, vec3 b){return 1.0-(1.0-a)*(1.0-b);} 
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
vec3 triPalette(float t){return clamp(0.56+0.44*cos(6.2831853*(fract(t)+vec3(0.0,0.33,0.67))),0.0,1.0);} 
vec3 hsvShiftLike(vec3 c, float shift){float y = lum(c); vec3 a = vec3(y); vec3 b = triPalette(y + shift); return mix(c, mix(a,b,0.72), 0.35);} 

void voronoiInfo(vec2 x, out float d1, out float d2, out vec2 cid, out vec2 bestR){
  vec2 n=floor(x), f=fract(x);
  d1=10.0; d2=10.0; cid=vec2(0.0); bestR=vec2(0.0);
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 g=vec2(float(i),float(j));
      vec2 o=hash22(n+g+uSeed*0.071);
      vec2 r=g+o-f;
      float d=dot(r,r);
      if(d<d1){d2=d1; d1=d; cid=n+g; bestR=r;}
      else if(d<d2){d2=d;}
    }
  }
}
`;
const FRAGMENT = UTILS + `
void main(){
  vec2 uv = screenUV();
  vec2 p = uv - 0.5;
  vec3 base = texM(uv);
  float amt = uAmount, ch = uChance;

  // Two crystalline scales: medium facets and smaller grains.
  float scaleA = mix(22.0, 35.0, uH0.x);
  float scaleB = mix(37.0, 61.0, uH0.y);
  vec2 aspect = vec2(uResolution.x/max(uResolution.y,1.0), 1.0);
  vec2 vpA = rot2(uv*aspect, (uR0.x-0.5)*1.1) * scaleA;
  vec2 vpB = rot2(uv*aspect, (uR0.y-0.5)*1.4) * scaleB;

  float d1A,d2A,d1B,d2B; vec2 cidA,cidB,rA,rB;
  voronoiInfo(vpA,d1A,d2A,cidA,rA);
  voronoiInfo(vpB,d1B,d2B,cidB,rB);

  float edgeA = sqrt(max(d2A-d1A,0.0));
  float edgeB = sqrt(max(d2B-d1B,0.0));
  float borderA = 1.0 - smoothstep(0.06, 0.18, edgeA);
  float borderB = 1.0 - smoothstep(0.05, 0.14, edgeB);
  float cellA = hash21(cidA + 9.7);
  float cellB = hash21(cidB + 23.1);
  float grainA = smoothstep(0.18,0.82,cellA);
  float grainB = smoothstep(0.12,0.88,cellB);

  float bathA = fbm6(rot2(p,(uR1.x-0.5)*0.8)*2.4 + vec2(uSeed*0.013,17.0));
  float bathB = fbm4(rot2(p,0.93)*5.2 + vec2(31.0,uSeed*0.019));
  float wash = fbm4(p*3.7 + vec2(uSeed*0.021,57.0));
  float chemistry = smoothstep(0.24,0.86,0.48*bathA + 0.27*bathB + 0.25*wash);

  // Facets are now smaller and layered, so they read as crystalline emulsion,
  // not a few large coarse polygons.
  float mosaic = grainA*(0.42+0.45*amt) + grainB*(0.16+0.30*ch);
  float seam = borderA*(0.18+0.32*amt) + borderB*(0.08+0.18*ch);
  float crystal = sat(mosaic*0.74 + chemistry*0.42);

  vec2 drift = normalize(rA + 0.6*rB + vec2(0.001)) * (0.004 + 0.020*crystal);
  vec3 samp1 = texM(uv + drift*vec2(1.0,0.8));
  vec3 samp2 = texM(uv - drift*vec2(0.8,1.0));
  vec3 layer = vec3(samp1.r, samp2.g, mix(samp1.b,samp2.b,0.5));

  vec3 dye1 = mix(uC0, uC1, grainA);
  vec3 dye2 = mix(uC2, uC0, grainB);
  vec3 chemTint = mix(dye1, dye2, 0.38 + 0.26*bathB);
  chemTint = mix(chemTint, triPalette(cellA*0.4 + bathA*0.5 + uR2.x*0.4), 0.18);

  vec3 outc = mix(base, layer, crystal*(0.18+0.26*amt));
  outc = mix(outc, outc*mix(vec3(1.0), chemTint, 0.73), crystal*(0.32+0.38*amt));

  // Effective polygon seams: not huge blocks, but a web of developer edges.
  vec3 seamTint = mix(mix(uC1, vec3(1.0,0.96,0.88), 0.44), chemTint, 0.30);
  outc = screenBlend(outc, seamTint * seam * (0.10 + 0.16*amt));

  // Local bleaching and dye residues collect around cell borders and a few cells.
  float bleach = seam*(0.28+0.42*chemistry) + borderB*grainB*0.16;
  outc = mix(outc, vec3(0.98,0.97,0.92), bleach*(0.05+0.14*amt)*(1.0-lum(base)*0.32));
  float residue = crystal*(0.12+0.18*ch)*(0.55+0.45*grainA);
  outc = mix(outc, hsvShiftLike(outc, cellB*0.25 + bathB*0.17), residue);

  // Smaller sparkling sediment to enrich the chemical feel.
  float speck = pow(hash21(floor(uv*uResolution*0.26)+uSeed*15.0), 20.0) * (0.18+0.42*chemistry) * amt;
  outc = mix(outc, vec3(0.98,0.95,0.86), speck*0.12);
  outc += vec3((hash21(floor(uv*uResolution)+uSeed*37.0)-0.5) * (0.006 + 0.010*amt));

  outc = preserveSource(base, outc);
  vec3 tone = paletteWash(outc, mix(uC0,vec3(0.90,0.84,0.76),0.24), mix(uC1,uC2,0.46), vec3(1.0,0.99,0.96), 0.26+0.30*amt);
  tone = splitTone(tone, mix(uC0,uC2,0.52), mix(uC1,vec3(1.0),0.35), 0.16+0.22*ch);
  tone = hueRotate(tone, (uR1.z-0.5)*0.20 + (bathB-0.5)*0.12);
  tone = contrastSat(tone, 0.06+0.10*amt, 1.08+0.16*amt);
  outc = mix(outc, tone, 0.40+0.24*amt);
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
const FAMILIES = ['CRYSTAL BLEACH','EMULSION CELLS','CHEMICAL FACETS','DEVELOPER MESH','SILVER GRAIN'];
function makeRecipe(){
 const r=Math.random;
 const p=PALETTES[Math.floor(r()*PALETTES.length)];
 const family=FAMILIES[Math.floor(r()*FAMILIES.length)];
 return {seed:r()*99,h0:[r(),r(),r(),r()],h1:[r(),r(),r(),r()],h2:[r(),r(),r(),r()],
  r0:[r(),r(),r(),r()],r1:[r(),r(),r(),r()],r2:[r(),r(),r(),r()],
  c0:p.c0,c1:p.c1,c2:p.c2,palette:p.name,family,id:Math.floor(1+r()*98)};
}
function setUniforms(target, source, width, height, params, recipe){
  target.setUniform('uTex', source);
  target.setUniform('uResolution', [width,height]);
  target.setUniform('uAmount', params.amount/100);
  target.setUniform('uChance', params.chance/100);
  target.setUniform('uPreserve', params.preserve/100);
  target.setUniform('uSeed', recipe.seed);
  for (const key of ['h0','h1','h2','r0','r1','r2']) target.setUniform('u'+key.toUpperCase(), recipe[key]);
  target.setUniform('uC0', recipe.c0);
  target.setUniform('uC1', recipe.c1);
  target.setUniform('uC2', recipe.c2);
}
window.IAEngines = window.IAEngines || Object.create(null);
window.IAEngines.CHEMICAL = Object.freeze({fragment:FRAGMENT,makeRecipe,setUniforms});
})();

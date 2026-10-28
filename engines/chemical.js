"use strict";
// CHEMICAL only: gritty darkroom / harsh chemical process. No large ugly polygons.
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
float lum(vec3 c){return dot(c, vec3(0.2126,0.7152,0.0722));}
vec2 clampUV(vec2 uv){return clamp(uv, vec2(0.0), vec2(1.0));}
vec3 texM(vec2 uv){return texture2D(uTex, clampUV(uv)).rgb;}
vec2 screenUV(){vec2 uv=gl_FragCoord.xy/max(uResolution,vec2(1.0));uv.y=1.0-uv.y;return uv;}
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
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
vec3 preserveSource(vec3 base, vec3 processed){
  float k=sat(uPreserve);k=k*k*(3.0-2.0*k);
  float yp=max(lum(processed),0.002), yb=max(lum(base),0.016);
  vec3 src=clamp(base*(yp/yb),0.0,1.3);
  vec3 pc=processed-vec3(yp);
  vec3 sc=src-vec3(lum(src));
  return clamp(vec3(yp)+mix(pc,sc,k),0.0,1.35);
}
vec3 softShoulder(vec3 c){return c/(vec3(1.0)+max(c-vec3(0.72),vec3(0.0))*0.96);} 
vec3 contrastSat(vec3 c, float contrast, float satBoost){c = clamp((c-0.5)*(1.0+contrast)+0.5,0.0,1.2); return satAdjust(c, satBoost);} 
float edge(vec2 uv,float px){vec2 dx=vec2(px,0.0), dy=vec2(0.0,px);float ex=abs(lum(texM(uv+dx))-lum(texM(uv-dx)));float ey=abs(lum(texM(uv+dy))-lum(texM(uv-dy)));return sat((ex+ey)*2.2);} 
vec3 paletteWash(vec3 c, vec3 a, vec3 b, vec3 d, float strength){
  float y=lum(c);
  vec3 tint = mix(a, b, smoothstep(0.12,0.72,y));
  tint = mix(tint, d, smoothstep(0.72,1.0,y));
  vec3 washed = c * mix(vec3(1.0), tint, 0.42*strength) + tint * (0.04 + 0.06*strength);
  return mix(c, washed, strength);
}
`;

const FRAGMENT = UTILS + `
void main(){
  vec2 uv = screenUV();
  vec2 p = uv - 0.5;
  vec3 base = texM(uv);
  float amt = uAmount;
  float ch  = uChance;
  float y   = lum(base);
  float px  = 1.4 / max(min(uResolution.x,uResolution.y), 1.0);

  // Wet chemical fields: developer, bleach cloud, dye wash.
  float bathA = fbm6(rot2(p,(uR0.x-0.5)*1.0)*2.2 + vec2(uSeed*0.013,17.0));
  float bathB = fbm4(rot2(p,(uR0.y-0.5)*1.5)*5.0 + vec2(31.0,uSeed*0.019));
  float bathC = fbm4(vec2(uv.y*6.2, uv.x*1.2) + vec2(7.0,uSeed*0.027));
  float bathD = fbm4(p*3.6 + vec2(uSeed*0.021,57.0));

  vec2 drift = vec2(
    fbm4(p*2.4 + vec2(uSeed*0.031, 9.0)) - 0.5,
    fbm4(rot2(p,1.02)*2.9 + vec2(21.0, uSeed*0.037)) - 0.5
  );
  drift *= (0.004 + 0.018*amt);
  drift += vec2(0.0, 1.0) * (bathC-0.5) * (0.002 + 0.008*ch);

  float developer = smoothstep(0.20,0.82, bathA*0.48 + bathB*0.28 + bathD*0.24);
  float bleach    = smoothstep(0.48,0.96, bathB*0.24 + bathC*0.38 + bathD*0.38);
  float dyeWash   = smoothstep(0.24,0.82, bathA*0.30 + bathC*0.20 + bathD*0.50);
  float stain     = smoothstep(0.28,0.86, bathA*0.42 + bathB*0.18 + bathC*0.40);

  vec3 srcR = texM(uv + drift*vec2( 1.0, 0.7));
  vec3 srcG = texM(uv + drift*vec2(-0.5, 1.0));
  vec3 srcB = texM(uv + drift*vec2( 0.8,-0.6));
  vec3 shifted = vec3(srcR.r, srcG.g, srcB.b);

  vec3 harshCool = mix(uC2, vec3(0.70,0.88,1.00), 0.46);
  vec3 harshWarm = mix(uC0, vec3(1.00,0.78,0.54), 0.42);
  vec3 chemTint  = mix(harshCool, harshWarm, 0.28 + 0.30*bathB);
  vec3 flashTint = mix(vec3(0.98,0.96,0.92), uC1, 0.18);

  vec3 outc = base;

  // Main chemical misregistration / bath shift.
  outc = mix(outc, shifted, developer*(0.16 + 0.24*amt));
  outc = mix(outc, outc * mix(vec3(1.0), chemTint, 0.44), dyeWash*(0.18 + 0.22*amt));

  // Harsh chemical contrast: darker lows, lifted hard highs.
  float darkField = stain * (1.0 - smoothstep(0.26,0.72,y));
  outc = mix(outc, outc * mix(vec3(1.0), harshCool, 0.24), darkField*(0.18+0.22*amt));
  float highField = bleach * smoothstep(0.40,0.94,y + bathD*0.10);
  outc = mix(outc, flashTint, highField*(0.08+0.16*amt));

  // Slight contour/chemical edge build-up.
  float e = edge(uv, px);
  outc = screenBlend(outc, mix(harshCool, flashTint, 0.52) * e * (0.05 + 0.10*ch));

  // Grit: coarse silver grain + finer grain, like pushed film / chemical roughness.
  float coarse = hash21(floor(uv*uResolution*0.22) + uSeed*11.0) - 0.5;
  float fine   = hash21(floor(uv*uResolution*1.00) + uSeed*29.0) - 0.5;
  float clump  = smoothstep(0.52,0.90, bathA*0.46 + bathD*0.54);
  outc += vec3(coarse*(0.030 + 0.040*amt) * (0.55 + 0.45*clump));
  outc += vec3(fine*(0.010 + 0.012*amt));

  // Streaky residue / development drag.
  float drag = smoothstep(0.62,0.98, sin(uv.y*mix(10.0,28.0,uR1.y) + bathC*3.6 + bathA*2.2)*0.5+0.5);
  outc = mix(outc, outc * mix(vec3(1.0), harshWarm, 0.16), drag*(0.04+0.10*ch)*stain);

  // Occasional pale chemical bloom.
  float bloom = pow(hash21(floor(uv*uResolution*0.12)+uSeed*5.0), 12.0) * bleach * (0.08+0.16*amt);
  outc = mix(outc, vec3(1.0,0.98,0.92), bloom*0.22);

  outc = preserveSource(base, outc);
  outc = paletteWash(outc, mix(uC2,vec3(0.78,0.86,0.94),0.30), mix(uC1,harshCool,0.40), vec3(0.98,0.96,0.92), 0.16+0.18*amt);
  outc = hueRotate(outc, (bathB-0.5)*0.10 + (uR2.z-0.5)*0.08);
  outc = contrastSat(outc, 0.12+0.12*amt, 1.06+0.12*amt);
  outc = softShoulder(outc);
  gl_FragColor = vec4(clamp(outc,0.0,1.0),1.0);
}`;

const PALETTES = [
  {name:'HARSH CYAN', c0:[0.94,0.62,0.40], c1:[0.90,0.94,0.96], c2:[0.48,0.76,0.94]},
  {name:'COLD SILVER', c0:[0.84,0.68,0.52], c1:[0.90,0.92,0.95], c2:[0.68,0.78,0.88]},
  {name:'CHEM BLUE', c0:[0.96,0.58,0.44], c1:[0.82,0.90,0.98], c2:[0.42,0.70,0.96]},
  {name:'DIRTY MINT', c0:[0.84,0.72,0.54], c1:[0.74,0.90,0.84], c2:[0.54,0.80,0.86]},
  {name:'PALE FLASH', c0:[0.98,0.68,0.44], c1:[0.98,0.96,0.92], c2:[0.72,0.86,0.98]},
  {name:'NIGHT BATH', c0:[0.92,0.56,0.34], c1:[0.82,0.88,0.94], c2:[0.34,0.60,0.86]}
];
const FAMILIES = ['PUSHED FILM','CHEMICAL DRAG','BLEACH PUSH','SILVER GRAIN','DYE WASH'];
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

"use strict";
// LEAK: isolated engine with organic light intrusion and no polygon/facet treatment.
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
vec3 preserveSource(vec3 base, vec3 processed){float k=sat(uPreserve);k=k*k*(3.0-2.0*k);float yp=max(lum(processed),0.002), yb=max(lum(base),0.016);vec3 src=clamp(base*(yp/yb),0.0,1.3);vec3 pc=processed-vec3(yp);vec3 sc=src-vec3(lum(src));return clamp(vec3(yp)+mix(pc,sc,k),0.0,1.35);} 
vec3 softShoulder(vec3 c){return c/(vec3(1.0)+max(c-vec3(0.72),vec3(0.0))*0.96);} 
vec3 contrastSat(vec3 c, float contrast, float satBoost){ c = clamp((c-0.5)*(1.0+contrast)+0.5,0.0,1.2); return satAdjust(c, satBoost);} 
float softScene(vec2 uv){
  vec2 px=vec2(1.0)/max(uResolution,vec2(1.0));
  float a=lum(texM(uv+px*vec2(2.0,0.0)));
  float b=lum(texM(uv-px*vec2(2.0,0.0)));
  float c=lum(texM(uv+px*vec2(0.0,2.0)));
  float d=lum(texM(uv-px*vec2(0.0,2.0)));
  return (a+b+c+d)*0.25;
}
float leakCurve(float x){ return exp(-1.20*pow(max(x,0.0),1.46)); }
`;
const FRAGMENT = UTILS + `
void main(){
  vec2 uv=screenUV();
  vec2 p=uv-0.5;
  vec3 base=texM(uv);
  float amt=uAmount;
  float chance=uChance;
  float family=floor(uR2.w*5.0);

  vec2 anchor, tangent, inward;
  if(family<1.0){
    anchor=vec2(mix(0.25,0.75,uH0.x),-0.08); tangent=vec2(1.0,0.0); inward=vec2(0.0,1.0);
  }else if(family<2.0){
    anchor=vec2(mix(0.25,0.75,uH0.x),1.08); tangent=vec2(1.0,0.0); inward=vec2(0.0,-1.0);
  }else if(family<3.0){
    anchor=vec2(-0.08,mix(0.25,0.75,uH0.x)); tangent=vec2(0.0,1.0); inward=vec2(1.0,0.0);
  }else if(family<4.0){
    anchor=vec2(1.08,mix(0.25,0.75,uH0.x)); tangent=vec2(0.0,1.0); inward=vec2(-1.0,0.0);
  }else{
    anchor=vec2(mix(0.10,0.48,uH0.x),-0.08); tangent=normalize(vec2(0.92,0.39)); inward=normalize(vec2(-0.39,0.92));
  }

  vec2 rel=uv-anchor;
  float depth=dot(rel,inward);
  float sideways=dot(rel,tangent);

  // Fully continuous organic field: only broad noise and smooth drift.
  float broad=fbm6(rot2(p,(uR0.x-0.5)*0.70)*1.7 + vec2(uSeed*0.013,11.0));
  float medium=fbm4(rot2(p,0.83)*3.7 + vec2(23.0,uSeed*0.021));
  float detail=fbm4(p*6.1 + vec2(uSeed*0.029,41.0));
  float ribbon=fbm4(vec2(sideways*2.0, depth*3.2) + vec2(uSeed*0.037, 73.0));

  float reach=mix(0.55,0.92,uH0.y);
  float drift=(broad-0.52)*(0.26+0.16*chance) + (medium-0.50)*(0.11+0.09*chance) + (ribbon-0.5)*0.08;
  float travel=depth + drift;
  float exposure=leakCurve(travel/max(reach,0.2));
  exposure*=0.92 + 0.22*broad + 0.12*medium;
  exposure*=1.0 - 0.16*smoothstep(0.50,1.12,abs(sideways)+(detail-0.5)*0.22);
  exposure=clamp(exposure*(0.85+0.72*amt),0.0,1.45);

  float l0=lum(base);
  float ls=softScene(uv);
  float sceneLight=smoothstep(0.18,0.88,0.58*l0+0.42*ls);

  // Chromatic stain strongest near entry, but never a flat opaque block.
  float stain=smoothstep(0.06,0.92,exposure) * (0.84+0.16*detail);
  float midReveal=smoothstep(0.18,0.52,exposure) * (1.0-smoothstep(0.65,1.08,exposure));
  float hotZone=smoothstep(0.42,0.88,exposure) * (0.34+0.66*sceneLight);

  vec3 dyeDeep = mix(uC0, uC1, 0.46 + 0.30*broad);
  vec3 dyeLight = mix(uC1, uC2, 0.42 + 0.34*medium);
  vec3 dye = mix(dyeDeep, dyeLight, 0.30 + 0.34*sceneLight);

  vec3 dyed = base * (0.56 + 0.26*l0) + dye * (0.22 + 0.54*stain);
  dyed = mix(dyed, dye * (0.38 + 0.36*l0), 0.22 + 0.26*amt);

  vec3 outc = mix(base, dyed, clamp(stain*(0.52+0.38*amt), 0.0, 0.96));

  // The image reappears within the leak instead of being buried by a single fill.
  vec3 revealed = contrastSat(base, 0.02 + 0.05*amt, 1.02 + 0.08*amt);
  revealed = mix(revealed, revealed * mix(vec3(1.0), dyeLight, 0.22), 0.36);
  outc = mix(outc, revealed, midReveal*(0.18+0.30*chance));

  // White breakouts and halation follow the same incoming light field and scene brightness.
  float brightBand = exp(-pow((depth - mix(0.24,0.62,uH1.x) + (broad-0.5)*0.14)/mix(0.15,0.32,uH1.y),2.0));
  float hotBreak = brightBand * smoothstep(0.20,0.62,exposure) * (0.36+0.56*sceneLight) * (0.42+0.48*amt);
  vec3 pale = mix(dyeLight, vec3(1.0), 0.72 + 0.18*sceneLight);
  outc = mix(outc, pale, clamp(hotBreak,0.0,0.72));

  float halo = hotZone * sceneLight * (0.04+0.14*amt) * (0.70+0.30*medium);
  outc = screenBlend(outc, pale * halo);

  float recovery = (1.0-stain) * smoothstep(0.32,0.78,medium) * (0.10+0.16*chance);
  outc = mix(outc, base, recovery);
  outc += vec3((hash21(floor(uv*uResolution)+uSeed*37.0)-0.5) * (0.004 + 0.008*amt));
  outc = mix(base, outc, smoothstep(0.0,0.08,amt));
  outc = preserveSource(base, outc);
  outc = softShoulder(outc);
  gl_FragColor = vec4(clamp(outc,0.0,1.0),1.0);
}`;
const PALETTES = [
  {name:'SCARLET FLOOD', c0:[0.42,0.010,0.016], c1:[0.98,0.025,0.018], c2:[1.00,0.68,0.44]},
  {name:'COBALT FLOOD', c0:[0.012,0.030,0.32], c1:[0.035,0.20,1.00], c2:[0.57,0.75,1.00]},
  {name:'VIRIDIAN FLOOD', c0:[0.005,0.20,0.095], c1:[0.015,0.79,0.32], c2:[0.62,1.00,0.64]},
  {name:'VIOLET FLOOD', c0:[0.24,0.012,0.34], c1:[0.70,0.035,0.97], c2:[0.95,0.61,1.00]},
  {name:'CYAN FLOOD', c0:[0.006,0.24,0.28], c1:[0.00,0.82,0.96], c2:[0.58,0.97,1.00]},
  {name:'AMBER FLOOD', c0:[0.46,0.13,0.006], c1:[1.00,0.49,0.012], c2:[1.00,0.88,0.48]},
  {name:'MAGENTA FLOOD', c0:[0.36,0.004,0.17], c1:[1.00,0.04,0.48], c2:[1.00,0.63,0.77]},
  {name:'ACID FLOOD', c0:[0.28,0.32,0.008], c1:[0.84,0.96,0.015], c2:[0.99,1.00,0.57]}
];
const FAMILIES = ['UPPER FLOOD','LOWER FLOOD','LEFT FLOOD','RIGHT FLOOD','DOUBLE FLOOD'];
function makeRecipe(previous){
 const r=Math.random;
 let pi=Math.floor(r()*PALETTES.length);
 if(previous && PALETTES[pi].name === previous.palette)
   pi=(pi+1+Math.floor(r()*(PALETTES.length-1)))%PALETTES.length;
 const p=PALETTES[pi];
 const fi=Math.floor(r()*FAMILIES.length);
 const result={seed:r()*99,h0:[r(),r(),r(),r()],h1:[r(),r(),r(),r()],h2:[r(),r(),r(),r()],
  r0:[r(),r(),r(),r()],r1:[r(),r(),r(),r()],r2:[r(),r(),r(),r()],
  c0:p.c0,c1:p.c1,c2:p.c2,palette:p.name,family:FAMILIES[fi],id:Math.floor(1+r()*98)};
 result.r2[3]=(fi+0.18+r()*0.54)/FAMILIES.length;
 return result;
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
window.IAEngines.LEAK = Object.freeze({fragment:FRAGMENT,makeRecipe,setUniforms});
})();

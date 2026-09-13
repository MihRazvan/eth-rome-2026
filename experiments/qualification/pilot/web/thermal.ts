// Shader adapted from the user-supplied Deaddrop visual reference.
// Decorative only: cooling wells are not tasks, leases, or network events.
const fragment = `precision highp float;
uniform float u_t; uniform vec2 u_r; uniform float u_amp;
uniform vec3 w0,w1,w2,w3,w4,w5,w6,w7;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hs(i),hs(i+vec2(1.0,0.0)),f.x),mix(hs(i+vec2(0.0,1.0)),hs(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*nz(p);p*=2.03;a*=0.5;}return s;}
vec3 ramp(float x){ x=clamp(x,0.0,1.0);
 vec3 c=mix(vec3(0.02,0.0,0.03), vec3(0.35,0.02,0.14), smoothstep(0.0,0.32,x));
 c=mix(c, vec3(0.85,0.16,0.05), smoothstep(0.28,0.58,x));
 c=mix(c, vec3(1.0,0.60,0.10), smoothstep(0.55,0.80,x));
 c=mix(c, vec3(1.0,0.96,0.86), smoothstep(0.78,1.0,x));
 return c;}
vec3 chillramp(float x){ x=clamp(x,0.0,1.0);
 vec3 c=mix(vec3(0.008,0.020,0.038), vec3(0.043,0.153,0.290), smoothstep(0.0,0.40,x));
 c=mix(c, vec3(0.118,0.435,0.851), smoothstep(0.36,0.70,x));
 return mix(c, vec3(0.600,0.878,1.000), smoothstep(0.70,1.0,x));}
float well(vec3 w, vec2 uv){
 if(w.z<=0.001) return 0.0;
 float d=length(uv-w.xy);
 float core=w.z*exp(-d*d*34.0);
 float ring=w.z*exp(-pow((d-0.055-0.035*w.z)*15.0,2.0))*0.42;
 return core+ring;}
void main(){
 vec2 uv=(gl_FragCoord.xy-0.5*u_r)/u_r.y;
 float t=u_t*0.11;
 float v=fbm(uv*1.7+vec2(t,t*0.6));
 v+=0.55*smoothstep(0.55,0.0,length(uv-vec2(sin(t*1.7)*0.5,-0.12)));
 v+=0.40*smoothstep(0.42,0.0,length(uv-vec2(-0.55+cos(t*1.1)*0.2,0.16)));
 v+=0.30*smoothstep(0.34,0.0,length(uv-vec2(0.62,0.26)));
 v*=0.92+0.16*fbm(uv*9.0-t*5.0);
 v*=u_amp;
 float chill=0.0;
 chill+=well(w0,uv); chill+=well(w1,uv); chill+=well(w2,uv); chill+=well(w3,uv);
 chill+=well(w4,uv); chill+=well(w5,uv); chill+=well(w6,uv); chill+=well(w7,uv);
 chill=clamp(chill,0.0,1.3)*u_amp;
 v=max(v-chill*1.7,0.0);
 float sweep=smoothstep(0.06,0.0,abs(fract(uv.y*0.35-u_t*0.06)-0.5))*u_amp;
 vec3 col=ramp(v)+sweep*vec3(0.16,0.07,0.02);
 col=mix(col, chillramp(chill*0.95+v*0.2), clamp(chill*1.3,0.0,1.0));
 col*=0.93+0.07*hs(gl_FragCoord.xy+u_t);
 gl_FragColor=vec4(col,1.0);
}`;
export function mountThermalField() {
  const canvas = document.getElementById("dd-field") as HTMLCanvasElement;
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  if (!gl) return;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(
    gl.VERTEX_SHADER,
    "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}",
  );
  const pixel = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vertex || !pixel) return;
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixel);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const time = gl.getUniformLocation(program, "u_t"),
    size = gl.getUniformLocation(program, "u_r"),
    amp = gl.getUniformLocation(program, "u_amp");
  const locations = Array.from({ length: 8 }, (_, i) =>
    gl.getUniformLocation(program, `w${i}`),
  );
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let wells: { x: number; y: number; born: number }[] = [],
    frameId = 0,
    last = 0,
    disposed = false;
  const start = performance.now();
  function draw(now: number) {
    const ratio = Math.min(devicePixelRatio || 1, 1, 1200 / innerWidth);
    const width = Math.max(1, Math.round(innerWidth * ratio)),
      height = Math.max(1, Math.round(innerHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl!.viewport(0, 0, width, height);
    }
    wells = wells.filter((w) => now - w.born < 12000);
    locations.forEach((location, i) => {
      const w = wells[i];
      const strength = w ? Math.min(1, (12000 - now + w.born) / 1800) : 0;
      gl!.uniform3f(location, w?.x || 0, w?.y || 0, strength);
    });
    gl!.uniform1f(time, motion.matches ? 5.2 : (now - start) / 1000 + 5.2);
    gl!.uniform2f(size, width, height);
    gl!.uniform1f(amp, 1);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
  function tick(now: number) {
    frameId = 0;
    if (
      disposed ||
      document.hidden ||
      document.body.dataset.view !== "home" ||
      motion.matches
    )
      return;
    if (now - last > 33) {
      draw(now);
      last = now;
    }
    frameId = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (disposed || document.hidden) return;
    draw(performance.now());
    if (!motion.matches && document.body.dataset.view === "home")
      frameId = requestAnimationFrame(tick);
  }
  function cool(x: number, y: number) {
    wells.push({
      x: (x - innerWidth / 2) / innerHeight,
      y: (innerHeight / 2 - y) / innerHeight,
      born: performance.now(),
    });
    wells = wells.slice(-8);
    draw(performance.now());
  }
  const home = document.getElementById("dd-home")!;
  const pointer = (event: PointerEvent) => {
    if (!(event.target as Element).closest("button,a"))
      cool(event.clientX, event.clientY);
  };
  home.addEventListener("pointerdown", pointer);
  document.getElementById("dd-cool")!.onclick = () =>
    cool(innerWidth * 0.72, innerHeight * 0.45);
  window.addEventListener("resize", refresh);
  window.addEventListener("deaddrop:view", refresh);
  document.addEventListener("visibilitychange", refresh);
  motion.addEventListener("change", refresh);
  canvas.addEventListener("webglcontextlost", () => {
    disposed = true;
    cancelAnimationFrame(frameId);
  });
  window.addEventListener("pageshow", refresh);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) {
      cancelAnimationFrame(frameId);
      return;
    }
    disposed = true;
    cancelAnimationFrame(frameId);
    window.removeEventListener("pageshow", refresh);
    window.removeEventListener("resize", refresh);
    window.removeEventListener("deaddrop:view", refresh);
    document.removeEventListener("visibilitychange", refresh);
    motion.removeEventListener("change", refresh);
    home.removeEventListener("pointerdown", pointer);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(pixel);
  });
  refresh();
}

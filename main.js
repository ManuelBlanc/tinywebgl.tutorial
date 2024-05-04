"use strict";
const ASSERT = (cond) => {
	if (!cond) throw new Error("assertion failed!");
};
const createOffscreenCanvas = (w, h) => {
	if (window.OffscreenCanvas) {
		return new OffscreenCanvas(w, h);
	}
	const e = document.createElement("canvas");
	e.width = w; e.height = h;
	return e;
};
const ShaderType = {
	FRAGMENT: WebGL2RenderingContext.prototype.FRAGMENT_SHADER,
	VERTEX: WebGL2RenderingContext.prototype.VERTEX_SHADER,
};
const UniformTypeName = (() => {
	const t = ["FLOAT","FLOAT_VEC2","FLOAT_VEC3","FLOAT_VEC4","INT","INT_VEC2","INT_VEC3","INT_VEC4","BOOL","BOOL_VEC2","BOOL_VEC3","BOOL_VEC4","FLOAT_MAT2","FLOAT_MAT3","FLOAT_MAT4","SAMPLER_2D","SAMPLER_CUBE","UNSIGNED_INT","UNSIGNED_INT_VEC2","UNSIGNED_INT_VEC3","UNSIGNED_INT_VEC4","FLOAT_MAT2x3","FLOAT_MAT2x4","FLOAT_MAT3x2","FLOAT_MAT3x4","FLOAT_MAT4x2","FLOAT_MAT4x3","SAMPLER_3D","SAMPLER_2D_SHADOW","SAMPLER_2D_ARRAY","SAMPLER_2D_ARRAY_SHADOW","SAMPLER_CUBE_SHADOW","INT_SAMPLER_2D","INT_SAMPLER_3D","INT_SAMPLER_CUBE","INT_SAMPLER_2D_ARRAY","UNSIGNED_INT_SAMPLER_2D","UNSIGNED_INT_SAMPLER_3D","UNSIGNED_INT_SAMPLER_CUBE","UNSIGNED_INT_SAMPLER_2D_ARRAY"];
	return new Map(t.map((n) => [WebGL2RenderingContext.prototype[n], n]));
})();
class WebGL {
	constructor(element, width, height, scaling=1) {
		this.element = element
		this.width  = this.element.width  = 0|(width/scaling);
		this.height = this.element.height = 0|(height/scaling);
		element.style.width  = `${scaling * this.width }px`;
		element.style.height = `${scaling * this.height}px`;
		element.style.backgroundColor = "black";
		element.style.imageRendering = "pixelated";
		this.scaling = scaling;
		this.context = this.element.getContext("2d");
		this.debugShow = true;
		this.debugFontSize = 22;
		this.debugTexts = [];
		this.debugAvgDt = 0;
		this.debugDts = new Array(120).fill(0);
		this.backbuffer = createOffscreenCanvas(this.width, this.height);
		this.gl = this.backbuffer.getContext("webgl2");
		ASSERT(this.gl);
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		//this.gl.enable(this.gl.CULL_FACE);
		//this.gl.cullFace(this.gl.BACK);
	}
	program(shaders) {
		const program = this.gl.createProgram();
		for (const shader of shaders) {
			this.gl.attachShader(program, shader);
		}
		this.gl.linkProgram(program);
		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
			throw new Error(this.gl.getProgramInfoLog(program));
		}
		return program;
	}
	state(chunk) {
		const state = this.gl.createVertexArray();
		this.gl.bindVertexArray(state);
		chunk();
		return state;
	}
	shader(type, source) {
		const shader = this.gl.createShader(type);
		this.gl.shaderSource(shader, "#version 300 es\n" + source);
		this.gl.compileShader(shader);
		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			throw new Error(this.gl.getShaderInfoLog(shader));
		}
		const ext = this.gl.getExtension("WEBGL_debug_shaders");
		const translated = ext ? ext.getTranslatedShaderSource(shader) : "";
		console.log(translated);
		return shader;
	}
	buffer(program, name, size, data) {
		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		const location = this.gl.getAttribLocation(program, name);
		this.gl.enableVertexAttribArray(location);
		this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, 0, 0);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
		return buffer;
	}
	uniform(program, name, setter, value) {
		this.gl.useProgram(program);
		const location = this.gl.getUniformLocation(program, name);
		if (!location) return;
		//ASSERT(location !== null);
		if (setter.startsWith("uniformMatrix")) {
			this.gl[setter](location, false, value);
		} else {
			this.gl[setter](location, value);
		}
	}
	draw(program, state, count, start=0, mode=this.gl.TRIANGLES) {
		this.gl.useProgram(program);
		this.gl.bindVertexArray(state);
		this.gl.drawArrays(mode, start, count);
	}
	clear() {
		this.gl.clearColor(0, 0, 0, 0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		this.context.fillStyle = "#000";
		this.context.fillRect(0, 0, this.width, this.height);
		this.context.clearRect(0, 0, self.width, self.height);
	}
	present(t, dt) {
		this.debugAvgDt = 0.9*this.debugAvgDt + 0.1*dt;
		this.debugDts.pop();
		this.debugDts.unshift(dt);
		this.context.drawImage(this.backbuffer, 0, 0);
		if (this.debugShow) {
			for (let i=0; i < this.debugDts.length; ++i) {
				const dt = this.debugDts[i]/1000;
				const v = Math.max(0, Math.min(1, (dt-1/60)/(1/30-1/60)));
				const j = Math.floor(1000*dt);
				this.context.fillStyle = `rgb(${255*v},${255*(1-v)},${255-255/30*j})`;
				this.context.fillRect(this.width-10-i, 10, 1, j)
			}
			const fps = 1000 / this.debugAvgDt;
			this.debugText(`${fps.toFixed(0).padStart(3)} FPS`);
			this.debugText(`${this.debugAvgDt.toFixed(3).padStart(6)} ms`);
		}
		if (this.debugTexts.length > 0) {
			this.context.fillStyle = "#00ff00";
			this.context.font = `${this.debugFontSize/this.scaling}px monospace`;
			for (let i=0; i < this.debugTexts.length; ++i) {
				const x = 10, y = 5 + (1+i)*this.debugFontSize;
				const text = this.debugTexts[i];
				this.context.fillText(text, x/this.scaling, y/this.scaling);
			}
			this.debugTexts.length = 0;
		}
	}
	debugText(text) {
		this.debugTexts.push(text);
	}
	debugInfo(program) {
		const precisionTypes = ["LOW_FLOAT", "MEDIUM_FLOAT", "HIGH_FLOAT", "LOW_INT", "MEDIUM_INT", "HIGH_INT"];
		for (const type of precisionTypes) {
			const {rangeMin, rangeMax, precision} = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl[type]);
			console.log(`${type.padStart(12)} := WebGLShaderPrecisionFormat { min: -${rangeMin}, max: ${rangeMax}, precision: ${precision} }`);
		}
		console.log(`Renderer: ${this.gl.getParameter(this.gl.RENDERER)}`);
		const ext = this.gl.getExtension("WEBGL_debug_renderer_info");
		if (ext) {
			console.log(`Unmasked Vendor: ${this.gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}`);
			console.log(`Unmasled Renderer: ${this.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`);
		}

		console.log("Uniforms:")
		const uniformCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
		for (let i = 0; i < uniformCount; ++i) {
			const info = this.gl.getActiveUniform(program, i);
			ASSERT(info != this.gl.INVALID_VALUE);
			const typeName = UniformTypeName.get(info.type) ?? `?unknown: ${info.type}?`;
			console.log(`  WebGLActiveInfo {name: ${info.name}, size: ${info.size}, type: ${typeName} }`);
		}
	}
}
const animate = (webgl, chunk) => {
	return new Promise((_, reject) => {
		let dt = 1000/60;
		requestAnimationFrame(function tick() {
			try {
				const t = performance.now();
				webgl.clear();
				chunk(t/1000, dt/1000);
				webgl.present(t/1000, dt);
				requestAnimationFrame(tick);
				dt = performance.now() - t;
			} catch (err) {
				reject(err);
			}
		});
	});
};

const element = document.getElementById("renderer");
const webgl = new WebGL(element, 1200, 600, 1);
const vertexShader = webgl.shader(ShaderType.VERTEX, `
	uniform vec2 u_screenScale;
	in vec4 a_position;
	in vec4 a_color;
	out vec4 v_position;
	out vec4 v_color;
	void main() {
		gl_Position = v_position = a_position;
		v_position.xy *= u_screenScale.xy * vec2(1.2,1.2);
		v_color = a_color;
	}
`);
const pixelShader = webgl.shader(ShaderType.FRAGMENT, `
	precision highp float;
	uniform vec2 u_mouse;
	uniform float u_time;
	uniform float u_scale;
	uniform vec2 u_offset;
	out vec4 o_color;
	in vec4 v_color;
	in vec4 v_position;

	#define PI (3.141592653589793)
	#define c_mul(a,b) vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x)

	vec3 oklab(float L, float a, float b) {
		float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
		float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
		float s_ = L - 0.0894841775 * a - 1.2914855480 * b;
		float l = l_*l_*l_;
		float m = m_*m_*m_;
		float s = s_*s_*s_;
		return vec3(
			+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
		);
	}
	vec3 oklch(float l, float c, float h) {
		h *= 2.0*PI;
		return oklab(l, c*cos(h), c*sin(h));
	}
	float hue2rgb(float p, float q, float t) {
		t = fract(1.0 + t); // Wrap between 0.0 and 1.0.
		if (t < 1.0/6.0) {
			return p + (q - p) * 6.0 * t;
		} else if (t < 1.0/2.0) {
			return q;
		} else if (t < 2.0/3.0) {
			return p + (q - p) * 6.0 * (2.0/3.0 - t);
		} else {
			return p;
		}
	}
	vec3 hsl(float h, float s, float l) {
		if (s > 0.001) {
			float q = l < 0.5 ? l*(1.0 + s) : s + l*(1.0 - s);
			float p = 2.0*l - q;
			float r = hue2rgb(p, q, h + 1.0/3.0);
			float g = hue2rgb(p, q, h);
			float b = hue2rgb(p, q, h - 1.0/3.0);
			return vec3(r,g,b);
		} else {
			return vec3(l,l,l);
		}
	}

	void main() {
		vec2 pos = v_position.xy / u_scale + u_offset;
		vec2 z = pos;
		int limit = max(30, int(20.0*log(u_scale)));
		int i = limit;
		for (; i > 0; --i) {
			z = c_mul(z, z) + pos;
			if (dot(z, z) > 999999.0) {
				float d = log(float(i) / float(limit));
				o_color = vec4(hsl(d, 0.75, 0.5), 1.0);
				return;
			}
		}
		discard;

		/*
		float t = v_position.x / PI / 2.0;
		if (v_position.y < 0.0) {
			o_color = vec4(oklch(0.8, 0.25, t), 1.0);
		} else {
			o_color = vec4(hsl(t, 0.75, 0.5), 1.0);
		}
		// o_color = pow(o_color, vec4(1.0/2.2)); // Gamma.
		*/
	}
`);
const program = webgl.program([pixelShader, vertexShader]);
const state = webgl.state(() => {
	webgl.buffer(program, "a_position", 2, new Float32Array([
		-1, -1,
		1, -1,
		-1, 1,
		1, 1,
	]));
	webgl.buffer(program, "a_color", 3, new Float32Array([
		1, 1, 0,
		0, 1, 1,
		1, 0, 1,
		1, 1, 1,
	]));
});

webgl.debugInfo(program);

const mouse = [0,0];
const delta = [0,0];
element.onmousemove = (evt) => {
	delta[0] = evt.movementX;
	delta[1] = -evt.movementY;
	if (document.pointerLockElement !== element) {
		mouse[0] = -1 + 2*((evt.offsetX) / evt.target.width);
		mouse[1] = 1 - 2*((evt.offsetY) / evt.target.height);
	}
};

element.addEventListener("click", async (evt) => {
	evt.preventDefault();
	if (document.fullscreenElement !== element) {
		await element.requestFullscreen(); 
	} else {
		await document.exitFullscreen();
	}
});


let t0 = null;
let scale = 1.0;
let offset = [-0.75,0.1];

window.addEventListener("keydown", async (evt) => {
	if (evt.key === " ") {
		t0 = null;
		scale = 1.0;
		offset = [-0.75,0.1];
	}
}, true);

const fmtInt = (x) => x.toFixed(2).padStart(6);
animate(webgl, (t, dt) => {
	t0 ??= t;
	t -= t0;
//	webgl.debugText(`mouse = ${fmtInt(mouse[0])} ${fmtInt(mouse[1])}`)
//	webgl.debugText(`delta = ${fmtInt(delta[0])} ${fmtInt(delta[1])}`)
	webgl.uniform(program, "u_mouse", "uniform2fv", mouse);
	webgl.uniform(program, "u_screenScale", "uniform2fv", [2,1]);
	webgl.uniform(program, "u_time", "uniform1f", t);
	scale = 0.5 * Math.exp(0.5*t);
	offset[0] += mouse[0] * 4 * dt / scale;
	offset[1] += mouse[1] * 4 * dt / scale;
	webgl.uniform(program, "u_scale", "uniform1f", scale);
	webgl.uniform(program, "u_offset", "uniform2fv", offset);
	webgl.draw(program, state, 4, 0, WebGL2RenderingContext.prototype.TRIANGLE_STRIP);
});

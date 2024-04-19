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
		ASSERT(location !== null);
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
		this.context.drawImage(this.backbuffer, 0, 0);
		const fps = 1000 / this.debugAvgDt;
		this.debugAvgDt = 0.9*this.debugAvgDt + 0.1*dt;
		this.debugDts.pop();
		this.debugDts.unshift(dt);
		if (this.debugShow) {
			for (let i=0; i < this.debugDts.length; ++i) {
				const dt = this.debugDts[i]/1000;
				const v = Math.max(0, Math.min(1, (dt-1/60)/(1/30-1/60)));
				const j = Math.floor(1000*dt);
				this.context.fillStyle = `rgb(${255*v},${255*(1-v)},${255-255/30*j})`;
				this.context.fillRect(this.width-10-i, 10, 1, j)
			}
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
	debugInfo() {
		const precisionTypes = ["LOW_FLOAT", "MEDIUM_FLOAT", "HIGH_FLOAT", "LOW_INT", "MEDIUM_INT", "HIGH_INT"];
		for (const type of precisionTypes) {
			const {rangeMin, rangeMax, precision} = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl[type]);
			console.log(`${type.padStart(12)} := WebGLShaderPrecisionFormat { -${rangeMin}, ${rangeMax}, ${precision} }`);
		}
		console.log(`Renderer: ${this.gl.getParameter(this.gl.RENDERER)}`);
		const ext = this.gl.getExtension("WEBGL_debug_renderer_info");
		if (ext) {
			console.log(`Unmasked Vendor: ${this.gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}`);
			console.log(`Unmasled Renderer: ${this.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`);
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
				chunk(t/1000, dt);
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
const webgl = new WebGL(element, 600, 600, 1);
const vertexShader = webgl.shader(ShaderType.VERTEX, `
	uniform mat4 transform;
	in vec4 a_position;
	in vec4 a_color;
	out vec4 v_color;
	void main() {
		gl_Position = transform * a_position;
		v_color = a_color;
	}
`);
const pixelShader = webgl.shader(ShaderType.FRAGMENT, `
	precision highp float;
	out vec4 o_color;
	in vec4 v_color;
	void main() {
		o_color = v_color;
	}
`);
const program = webgl.program([pixelShader, vertexShader]);
const state = webgl.state(() => {
	const rho = (-1/6)*Math.sqrt(3);
	webgl.buffer(program, "a_position", 2, new Float32Array([
		0, -2*rho,
		-0.5, rho,
		0.5, rho,
	]));
	webgl.buffer(program, "a_color", 3, new Float32Array([
		1, 0, 0,
		0, 1, 0,
		0, 0, 1,
	]));
});

webgl.debugInfo();

let N = 1;
element.onclick = () => ++N;

animate(webgl, (t, dt) => {
	t *= 0.5;
	const c3 = Math.cos(3*t), s3 = Math.sin(3*t);
	const c5 = Math.cos(5*t), s5 = Math.sin(5*t);
	for (let i=0; i<N*N; ++i) {
		webgl.uniform(program, "transform", "uniformMatrix4fv", [
			c3,s3,0,0,
			-s3,c3*c5,s5,0,
			0,-s5,c5,0,
			i%N-0.5*(N-1),((i/N)|0)-0.5*(N-1),0,0.5+0.5*N,
		]);
		webgl.draw(program, state, 3);
	}
});

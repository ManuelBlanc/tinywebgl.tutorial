"use strict";
const ASSERT = (cond) => {
	if (!cond) throw new Error("assertion failed!");
};
class WebGL {
	constructor(element, width, height, scaling=1) {
		this.element = element
		this.width  = this.element.width  = 0|(width/scaling);
		this.height = this.element.height = 0|(height/scaling);
		element.style.width  = `${scaling * this.width }px`;
		element.style.height = `${scaling * this.height}px`;
		element.style.backgroundColor = "black";
		this.scaling = scaling;
		this.preserveDrawingBuffer = false; // To be able to Save Image As...
		this.gl = this.element.getContext("webgl2", {
			preserveDrawingBuffer: this.preserveDrawingBuffer,
		});
		ASSERT(this.gl);
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		const vertexShader = this.shader(this.gl.VERTEX_SHADER, `
			uniform mat4 transform;
			in vec4 in_position;
			in vec4 in_color;
			out vec4 color;
			void main() {
				gl_Position = transform * in_position;
				color = in_color;
			}
		`);
		const pixelShader = this.shader(this.gl.FRAGMENT_SHADER, `
			precision highp float;
			out vec4 FragColor;
			in vec4 color;
			void main() {
				FragColor = color;
			}
		`);
		this.program([
			pixelShader,
			vertexShader,
		]);
		const cos60 = -0.5, sin60 = -0.5*Math.sqrt(3);
		this.buffer("in_position", 2, new Float32Array([
			0, sin60 -sin60*1/3,
			cos60, -sin60*1/3,
			-cos60, -sin60*1/3,
		]));
		this.buffer("in_color", 3, new Float32Array([
			1, 0, 0,
			0, 1, 0,
			0, 0, 1,
		]));
	}
	program(shaders) {
		const program = this.program = this.gl.createProgram();
		for (const shader of shaders) {
			this.gl.attachShader(program, shader);
		}
		this.gl.linkProgram(program);
		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
			throw new Error(this.gl.getProgramInfoLog(program));
		}
		this.gl.useProgram(program);
		this.vao = this.gl.createVertexArray();
		this.gl.bindVertexArray(this.vao);
		return program;
	}
	shader(type, source) {
		const shader = this.gl.createShader(type);
		this.gl.shaderSource(shader, "#version 300 es\n" + source);
		this.gl.compileShader(shader);
		return shader;
	}
	buffer(name, size, data) {
		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		const location = this.gl.getAttribLocation(this.program, name);
		this.gl.enableVertexAttribArray(location);
		this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, 0, 0);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
		return buffer;
	}
	clear() {
		if (this.preserveDrawingBuffer) {
			this.gl.clearColor(0, 0, 0, 0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		}
	}
	set() { // Todo.
	}
	present(t) {
		t *= 0.5;
		const transform = this.gl.getUniformLocation(this.program, "transform");
		const c = Math.cos(t), s = Math.sin(t);
		this.gl.uniformMatrix4fv(transform, false,
			[
				c,s,0,0,
				-s,c,0,0,
				0,0,1,0,
				0,0,0,1,
			]);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
	}
	debugText() { // Todo. 
	}
}

const element = document.getElementById("renderer");
const webgl = new WebGL(element, 600, 600, 1);

const animate = (chunk) => {
	return new Promise((_, reject) => {
		let dt = 1000/60;
		requestAnimationFrame(function tick() {
			try {
				const t = performance.now();
				webgl.clear();
				chunk(t/1000, dt);
				webgl.present(t/1000);
				requestAnimationFrame(tick);
				dt = performance.now() - t;
			} catch (err) {
				reject(err);
			}
		});
	});
};

let avgDT = 0;
const dts = new Array(120).fill(0);
animate((_, dt) => {
	const fps = 1000 / avgDT;
	avgDT = 0.9*avgDT + 0.1*dt;
	dts.pop();
	dts.unshift(dt);
	for (let i=0; i < dts.length; ++i) {
		const dt = dts[i]/1000;
		const v = Math.max(0, Math.min(1, (dt-1/60)/(1/30-1/60)));
		let j = Math.floor(1000*dt);
		while (j --> 0) webgl.set(webgl.width-10-i, 10+j, [255*v,255*(1-v),255-255/30*j,255]);
	}
	webgl.debugText(`${fps.toFixed(0).padStart(3)} FPS`);
	webgl.debugText(`${avgDT.toFixed(3).padStart(6)} ms`);
});

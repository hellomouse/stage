// Stage - text adventure game engine
// Copyright (C) 2023  tceo
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

let scene_stack = [];
let action_stack = [];
let scenes = {};
let current_scene;
let stop = false;
let play;
let action_depth = 0;
let container;
let output;
let variables = {}

 // this is a bit bad.
let current_index
let subscene_change
let subscene_return = []

// DEBUGGER HOOKS START
let subscene_change_hook = (ind) => {}
let scene_process_start_hook = (ind) => {}
// DEBUGGER HOOKS END

/* ------ */
/* SCENES */
/* ------ */

function process_scene(ind) {
	// DEBUGGER HOOK
	scene_process_start_hook(ind)
	var sc = 0
	var si = -1
	out:
	for (var i = ind; (i <= play.length || subscene_change) && !stop; i++) {
		if (subscene_change) {
			// DEBUGGER HOOK
			subscene_change_hook(subscene_change)
			i = subscene_change
			subscene_change = 0
		}
		var c = play[i]
		if (sc) {
			if (c == '}') sc--
			else if (c == '{') sc++
			continue
		}
		switch (c) {
			case ']': i = text(i); break
			case '>': i = action(i, si + 1); si = -1; break
			case '?': i = evaluate(i, si + 1); si = -1; break
			case ':': i = check(i, si + 1); si = -1; break
			case '!': i = execute(i); break
			case '/': i = comment(i); break
			case '@': action_stack.push(i + 1); break
			case '{': sc++; si = i; break
			case '}': case '.':
				if (subscene_return.length) { i = subscene_return.pop(); break; }
				break out
		}
	}
	container.scrollTop = container.scrollHeight;
}

function text(i) {
	var text = ""
	while (play[++i] != '\n' && play[i]) text += play[i]
	insert_text(text)
	return i
}

function insert_text(text) {
	var p = document.createElement("p")
	p.innerText = text
	output.appendChild(p)
}

function action(i, si) {
	var text = ""
	while (play[++i] != '\n' && play[i]) text += play[i]
	var a = document.createElement("a")
	a.classList.add("action")
	if (!si) { // blocking action.
		a.href = `javascript:execute_action(${i}, ${action_depth}, true)`
		stop = true
	} else {
		a.href = `javascript:execute_action(${si}, ${action_depth})`
	}
	a.innerText = text
	output.appendChild(a)
	return i
}

function evaluate(i, si) {
	var expr = ""
	while (play[++i] && play[i] != '\n') expr += play[i]
	current_index = i
	var node = parse_expression(expr)
	var result
	for (var n of node.children)
		result = eval_func([n.val, n.children])
	if (si && !!get_value(result, 'any')) enter_subscene(si)
	else if (!si) functions["set"](['symbol', 'status'], result)
	return i
}

function check(i, si) {
	var t = ""
	while (play[++i] && play[i] != '\n') t += play[i]
	current_index = i
	var result = get_value(functions["="](token(t), ['symbol', 'status']), 'bool')
	if (result) enter_subscene(si)
	return i
}

function execute(i) {
	var expr = ""
	while (play[++i] && play[i] != '\n') expr += play[i]
	current_index = i
	var node = parse_expression(expr)
	for (var n of node.children)
		eval_func([n.val, n.children])
	return i
}
function comment(i) {
	if (play[i + 1] == '*') {
		while (!(play[++i] == '*' && play[i + 1] == '/')) continue
		return i + 1
	} else {
		while (play[++i] != '\n') continue
		return i
	}
}

function enter_subscene(si) {
	subscene_return.push(current_index)
	subscene_change = si
}

function enter_scene(si) {
	stop = true
	Promise.resolve().then(() => {
		stop = false
		current_scene = si
		action_stack = [si]
		subscene_return = []
		current_index = 0
		subscene_change = 0
		process_scene(si)
	});
}

function execute_action(si, depth, blocking = false) {
	if (depth != action_depth)
		return
	action_depth++
	output.appendChild(document.createElement("hr"))
	stop = false
	if (!blocking) action_stack.push(si)
	process_scene(si)
}

/* ----------- */
/* EXPRESSIONS */
/* ----------- */

function list_recurse(v) {
	return ['list', v.map(x => {
		if (x.type == 'function') return eval_func([x.val, x.children])
		else if (x.type == 'list') return list_recurse(x.children)
		return x
	})]
}

function eval_func(v) {
	var children = v[1]
	var args = []
	for (var n of children) {
		if (n.type == 'function') {
			args.push(['function', [n.val, n.children]])
			continue
		} else if (n.type == 'list') {
			args.push(list_recurse(n.children))
			continue
		}
		args.push(n)
	}
	return functions[v[0]](...args)
}

function token(token) {
	const string_re = /^('.*')|(".*")$/
	const bool_re = /^(yes|no|true|false|t|f)$/
	if (Array.isArray(token))
		return ["list", token]
	if (string_re.exec(token))
		return ["string", token]
	if (!isNaN(token) && !isNaN(parseFloat(token)))
		return ["number", Number(token)]
	if (bool_re.exec(token)) {
		if (typeof token == "boolean")
			return ["bool", token]
		return ["bool", token.startsWith("t") || token.startsWith("y")]
	}
	return ["symbol", token]
}

function get_value(v, type) {
	if (!v)
		return null
	if (type != 'symbol' || v[0] == 'function')
		v = resolve_token(resolve_token(v))
	var vt = v[0]
	var vv = v[1]
	if (vt != type && type != 'any')
		console.log("WARN: Incorrect value type.")
	if (vt == 'string')
		return vv.slice(1, -1)
	return vv
}

function get_token(v) {
	if (!v)
		return null
	if (v[0] == 'function')
		v = eval_func(v[1])
	return v
}

function resolve_token(v) {
	if (!v)
		return null
	if (v[0] == 'reference')
		v = resolve_token(v[1][0])[1][v[1][1]]
	if (v[0] == 'symbol')
		v = variables[v[1]] ? variables[v[1]] : ['number', 0]
	if (v[0] == 'function')
		v = eval_func(v[1])
	return v
}

function humanify_token(v) {
	if (v.type == 'function')
		return humanify_token(['function', [v.val, v.children]])
	switch (v[0]) {
		case 'reference':
			return `ref ${humanify_token(v[1][0])}[${v[1][1]}]`
		case 'symbol':
			return `${v[1]}`
		case 'function':
			return `(${v[1][0]} ${v[1][1].map(x => humanify_token(x)).join(" ")})`
		case 'list':
			return `#(${v[1].map(x => humanify_token(x)).join(" ")})`
		case 'bool':
 		case 'string':
		case 'number':
			return v[1]
	}
}

const functions = {
	"+": (...args) => {
		var r = 0
		for (var a of args) r += get_value(a, 'number')
		return token(r)
	},
	"-": (...args) => {
		var r = get_value(args[0], 'number')
		for (var i = 1; i < args.length; i++) r -= get_value(args[i], 'number')
		return token(r)
	},
	"*": (...args) => {
		var r = 1
		for (var a of args) r *= get_value(a, 'number')
		return token(r)
	},
	"/": (...args) => {
		var r = get_value(args[0], 'number')
		for (var i = 1; i < args.length; i++) r /= get_value(args[i], 'number')
		return token(r)
	},
	">": (...args) => {
		return token(get_value(args[0], 'number') > get_value(args[1], 'number'))
	},
	"<": (...args) => {
		return token(get_value(args[0], 'number') < get_value(args[1], 'number'))
	},
	"get": (...args) => {
		return resolve_token(get_token(args[0]))
	},
	"do": (...args) => {
		for (var a of args) {
			var val = get_value(a, 'any')
			if (Array.isArray(val)) functions["do"](...val)
		}
		return token(true)
	},
	"set": (...args) => {
		var sym = get_token(args[0])
		if (sym[0] == 'reference')
			return resolve_token(sym[1][0])[1][sym[1][1]] = resolve_token(args[1])
		return variables[get_value(sym, "symbol")] = resolve_token(args[1])
	},
	"sym": (...args) => {
		return args[0]
	},
	"=": (...args) => {
		var v1 = get_value(args[0], 'any')
		var v2 = get_value(args[1], 'any')
		return token(v1 == v2)
	},
	"reset": (...args) => {
		restart()
		return token(true)
	},
	"return": (...args) => {
		enter_scene(current_scene)
		return token(true)
	},
	"back": (...args) => {
		var val = get_value(args[0], 'number')
		for (var i = 0; i < (val ? val : 1); i++)
			action_stack.pop()
		subscene_change = action_stack[action_stack.length - 1]
		return token(true)
	},
	"not": (...args) => {
		return token(!get_value(args[0], 'any'))
	},
	"and": (...args) => {
		var r = 1
		for (var a of args) {
			r = r && get_value(a, 'any')
			if (!r) break
		}
		return token(r)
	},
	"or": (...args) => {
		var r = false
		for (var a of args) {
			r = r || get_value(a, 'any')
			if (r) break
		}
		return token(r)
	},
	"+1": (...args) => {
		var val = functions["+"](args[0], token(1))
		return functions["set"](args[0], val)
	},
	"-1": (...args) => {
		var val = functions["-"](args[0], token(1))
		return functions["set"](args[0], val)
	},
	"print": (...args) => {
		var out = ""
		for (var a of args) out += String(get_value(a, 'any'))
		insert_text(out)
		return token(true)
	},
	"concat": (...args) => {
		var out = ""
		for (var a of args) out += String(get_value(a, 'any'))
		return token(out)
	},
	"if": (...args) => {
		var condition = get_value(args[0], 'any')
		return condition ? resolve_token(args[1]) : resolve_token(args[2])
	},
	"list": (...args) => {
		return token(args.map(x => resolve_token(x)))
	},
	"push": (...args) => {
		var list = get_value(args[0], 'list')
		for (var i = 1; i < args.length; i++)
			list.push(resolve_token(args[i]))
		return functions["set"](args[0], token(list))
	},
	"pop": (...args) => {
		var list = get_value(args[0], 'list')
		var ret = list.pop()
		functions["set"](args[0], token(list))
		return ret ? ret : token(false)
	},
	"rand": (...args) => {
		var a = resolve_token(args[0])
		if (a[0] == 'list') {
			var l = get_value(args[0], 'list')
			return resolve_token(l[Math.floor(Math.random() * l.length)])
		}
		var min = get_value(a, 'number')
		var max = get_value(args[1], 'number')
		return token(Math.floor(Math.random() * (max - min + 1) + min))
	},
	"first": (...args) => {
		var l = get_token(args[0])
		return ['reference', [l, 0]]
	},
	"last": (...args) => {
		var l = get_token(args[0])
		var lst = resolve_token(l)
		if (!lst.length) return token(false)
		return ['reference', [l, lst.length - 1]]
	},
	"rest": (...args) => {
		var lst = get_value(args[0], 'list')
		return token(lst.slice(1))
	},
	"index": (...args) => {
		var l = get_token(args[0])
		var lst = resolve_token(l)
		var i = Math.min(Math.max(get_value(args[1], 'number'), 0), lst[1].length - 1)
		return ['reference', [l, i]]
	},
	"length": (...args) => {
		var l = get_value(args[0], 'any')
		if (l.length) return token(l.length)
		return token(false)
	},
	"stop": (...args) => {
		subscene_change = 0
		subscene_return = []
		stop = true
		return token(true)
	},
	"clear": (...args) => {
		output.replaceChildren()
		return token(true)
	},
	"scene-pop": (...args) => {
		var scene = scene_stack.pop()
		if (scene) enter_scene(scene)
		else console.log("WARN: tried to pop without scenes in stack.")
		return token(true)
	},
	"scene-push": (...args) => {
		scene_stack.push(current_scene)
		var scene = scenes[get_value(args[0], 'string')]
		if (!scene) console.log("WARN: Invalid scene", get_value(args[0], 'string'))
		enter_scene(scene)
		return token(true)
	},
	"scene-jump": (...args) => {
		var scene = scenes[get_value(args[0], 'string')]
		if (!scene) console.log("WARN: Invalid scene", get_value(args[0], 'string'))
		if (subscene_change) {
			// scene change already in same expression
			subscene_return.push(scene)
		} else {
			// bit of a hack.
			if (subscene_return[subscene_return.length - 1] != current_index)
				subscene_return.push(current_index)
			subscene_change = scene
		}
		return token(true)
	},
	"scene-change": (...args) => {
		var scene = scenes[get_value(args[0], 'string')]
		if (!scene) console.log("WARN: Invalid scene", get_value(args[0], 'string'))
		scene_stack = []
		enter_scene(scene)
		return token(true)
	},
}

function parse_expression(expr) {
	var node = {parent: null, type: null, val: null, children: []}
	var string
	var sym
	var lst
	var buffer = ""
	for (var c of expr) {
		if (string) {
			if (c == string) string = null
			buffer += c
			continue
		}
		switch (c) {
			case '(':
				var n = {parent: node, type: 'function', val: null, children: []}
				if (lst) {n.type = n.val = 'list'; lst = false}
				else if (sym) {n.type = 'fsym'; sym = false}
				else if (functions[buffer]) n.val = buffer
				buffer = ""
				node = n
				break
			case ')':
				if (buffer) {
					if (!node.val) {
						node.val = buffer
						if (!functions[node.val]) console.log("WARN: Unknown function", node.val)
					} else {
						var id = token(buffer)
						if (sym) {
							var s = {parent: node, type: 'function', val: 'sym', children: [id]}
							node.children.push(s)
							sym = false
						} else {
							node.children.push(id)
						}
					}
					buffer = ""
				}
				if (node.type == 'fsym') {
					node.type = 'function'
					var s = {parent: node.parent, type: 'function', val: 'sym', children: [node]}
					node.parent = s
					node = s
				}
				node.parent.children.push(node)
				node = node.parent
				break
			case ' ': case '\t': case '\n':
				if (!buffer) break
				if (!node.val) {
					node.val = buffer
					if (!functions[node.val]) console.log("WARN: Unknown function", node.val)
				} else {
					var id = token(buffer)
					if (sym) {
						var s = {parent: node, type: 'function', val: 'sym', children: [id]}
						node.children.push(s)
						sym = false
					} else {
						node.children.push(id)
					}
				}
				buffer = ""
				break
			case "'": sym = true; break
			case "#": lst = true; break
			case '"': string = c
			default:
				buffer += c
		}
	}
	return node
}

function restart() {
	variables = {}
	action_depth = 0
	output.replaceChildren()
	scene_stack = []
	enter_scene(scenes["start"] ? scenes["start"] : 0)
}

/* -------------- */
/* FRONT HANDLING */
/* -------------- */

function file_drop(e) {
	e.preventDefault();
	if (e.dataTransfer.files[0])
		play_file(e.dataTransfer.files[0])
}

function drag_over(e) {
	e.preventDefault()
}

function submit_file(e) {
	play_file(e.target.files[0])
}

function parse_play() {
	var index = -1
	variables = {}
	action_depth = 0
	output.replaceChildren()
	scene_stack = []
	while ((index = play.indexOf("START ", index + 1)) != -1) {
		var buffer = ""
		index += 5
		while (play[++index] != '\n') buffer += play[index]
		scenes[buffer] = index;
	}
	document.getElementById("load")?.remove()
	enter_scene(scenes["start"] ? scenes["start"] : 0)
}

function play_file(file) {
	var reader = new FileReader()
	reader.readAsText(file)
	reader.onload = readerEvent => {
		play = readerEvent.target.result
		parse_play()
	}
}

window.onload = e => {
	container = document.getElementById("container")
	output = document.getElementById("output")
	var params = new URLSearchParams(window.location.search);
	var load = params.get('load')
	if (load) {
		fetch(load, {cache: "no-cache"})
			.then(function(response) { return response.text(); })
			.then(function(text) { play = text; parse_play(); })
	}
}
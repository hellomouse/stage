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
let action_container;
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
			case '[': i = input(i); break
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
	while (play[++i] != '\n' && play[i]) {
		text += play[i]
	}
	insert_text(text)
	return i
}

function input(i) {
	var label = ""
	while (play[++i] != '\n' && play[i]) label += play[i]
	var input = document.createElement("input")
	input.classList.add("text-input")
	input.type = "text"
	input.placeholder = label
	input.setAttribute("onkeydown", `input_check(event, ${i}, ${action_depth})`)
	action_container.appendChild(input)
	stop = true // blocking
	return i
}

function text_format(text, parent_element) {
	var c = parent_element
	var fsc = 0
	var i = -1
	while (text[++i]) {
		if (text[i + 1] == "<") {
			var nw
			switch (text[i]) {
				case 'b': nw = document.createElement("b"); break
				case 'i': nw = document.createElement("i"); break
				case 'c': nw = document.createElement("code"); break
				case '$':
					var sym = ""
					// <
					i++
					while (text[++i] && text[i] != '>') sym += text[i]
					var ret
					for (var tok of parse_expression(sym + '\n'))
						ret = get_value(tok, 'string')
					c.innerHTML += ret
					continue
				case '\\': default: continue
			}

			c.appendChild(nw)
			c = nw
			i++
			fsc++
			continue
		}
		if (fsc && text[i] == '>') {
			fsc--
			c = c.parentNode
			continue
		}
		c.innerHTML += text[i]
	}
}

function insert_text(text) {
	var p = document.createElement("p")
	text_format(text, p)
	action_container.appendChild(p)
}

function action(i, si) {
	var a = document.createElement("a")
	var text = ""
	while (play[++i] != '\n' && play[i]) text += play[i]	
	text_format(text, a)

}

function action(i, si) {
	var text = ""
	var a = document.createElement("div")
	while (play[++i] != '\n' && play[i]) text += play[i]	
	text_format(text, a)
	a.classList.add("action")
	if (!si) { // blocking action.
		a.setAttribute("onclick", `execute_action(event, ${i}, true)`)
		stop = true
	} else {
		a.setAttribute("onclick", `execute_action(event, ${si})`)
	}
	action_container.appendChild(a)
	return i
}

function evaluate(i, si) {
	var expr = ""
	while (play[++i] && play[i] != '\n') expr += play[i]
	expr += '\n'
	current_index = i
	var node = parse_expression(expr)
	var result
	for (var n of node)
		result = resolve_token(n)
	if (si && get_value(result)) enter_subscene(si)
	else if (!si) set_var("status", result)
	return i
}

function check(i, si) {
	var t = ""
	while (play[++i] && play[i] != '\n') t += play[i]
	current_index = i
	var result = get_value(execute_function("=", [["symbol", "status"], token(t)]), 'bool')
	if (result) enter_subscene(si)
	return i
}

function execute(i) {
	var expr = ""
	var pc = 0
	var str = ""
	while (play[++i]) {
		if (play[i] == str) {
			str = ""
		} else if (!str) {
			if (play[i] == '(') pc++;
			else if (play[i] == ')') pc--;
			else if (play[i] == '"' || play[i] == "'") str = play[i];
			else if (play[i] == '\n' && !pc) break;
		}
		expr += play[i]
	}
	expr += '\n'
	current_index = i
	var node = parse_expression(expr)
	for (var n of node)
		get_value(n, 'any')
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

function execute_action(e, si, blocking = false) {
	var depth = e.target.parentElement.attributes["adepth"].value
	if (depth != action_depth)
		return
	action_depth++
	output.appendChild(document.createElement("hr"))
	new_action_container()
	output.appendChild(action_container)
	stop = false
	if (!blocking) action_stack.push(si)
	process_scene(si)
}

function input_check(e, si) {
	var depth = e.target.parentElement.attributes["adepth"].value
	if (depth != action_depth) {
		e.preventDefault()
		return
	}
	if (e.key == "Enter") {
		e.preventDefault()
		set_var("status", ['string', e.target.value])
		action_depth++
		output.appendChild(document.createElement("hr"))
		new_action_container()
		output.appendChild(action_container)
		stop = false
		process_scene(si)
	}
}

/* ----------- */
/* EXPRESSIONS */
/* ----------- */

function token(tok) {
	const string_re = /(^'.*'$)|(^".*"$)/
	const pair_re = /^.+:.+$/
	const bool_re = /^(yes|no|true|false|t|f)$/
	if (Array.isArray(tok))
		return ["list", tok]
	if (string_re.exec(tok))
		return ["string", tok.slice(1, -1)]
	if (pair_re.exec(tok))
		return ["pair", tok.split(":").map(token)]
	if (!isNaN(tok) && !isNaN(parseFloat(tok)))
		return ["number", Number(tok)]
	if (bool_re.exec(tok)) {
		if (typeof tok == "boolean")
			return ["bool", tok]
		return ["bool", tok.startsWith("t") || tok.startsWith("y")]
	}
	return ["symbol", tok]
}

const coercion_functions = {
	"number": {
		"string": (num) => { return ["string", num.toString()] }
	},
	"string": {
		"number": (str) => { return ["number", Number(str)] },
		"symbol": (str) => { return ["symbol", str] }
	}
}

function coerce_token(v, type) {
	if (v[0] == type) // v already type
		return v
	var coerce = v
	if (coercion_functions[v[0]] && coercion_functions[v[0]][type])
		coerce = coercion_functions[v[0]][type](v[1])
	if (coerce[0] != type)
		console.log("WARN: Unable to coerce", coerce[0], "to type", type)
	return coerce
}

function get_value(v, type) {
	if (!v)
		return null
	if (type == 'token')
		return v
	var vt = v[0]
	if (type != 'symbol' || vt == 'function')
		v = resolve_token(resolve_token(v))
	if (vt != type && type != 'any')
		v = coerce_token(v, type)
	return v[1]
}

function get_token(v) {
	if (!v)
		return null
	if (v[0] == 'function')
		v = execute_function(v[1][0], v[1][1])
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
		v = execute_function(v[1][0], v[1][1])
	return v
}

function humanify_token(v) {
	switch (v[0]) {
		case 'reference':
			return `ref ${humanify_token(v[1][0])}[${v[1][1]}]`
		case 'symbol':
			return `sym ${v[1]}`
		case 'function':
			return `(${v[1][0]} ${v[1][1].map(x => humanify_token(x)).join(" ")})`
		case 'list':
			return `#(${v[1].map(x => humanify_token(x)).join(" ")})`
		case 'pair':
			return `${humanify_token(v[1][0])}:${humanify_token(v[1][0])}`
		case 'bool':
 		case 'string':
		case 'number':
			return v[1]
	}
}

function set_var(variable, value) {
	return variables[variable] = value
}

const funcs = {
	"+": [[["first", "number"], ["rest", "#number"]], (args, first, rest) => {
		for (var num of rest) first += num
		return ['number', first]
	}],
	"-": [[["first", "number"], ["rest", "#number"]], (args, first, rest) => {
		for (var num of rest) first -= num
		return ['number', first]
	}],
	"*": [[["first", "number"], ["rest", "#number"]], (args, first, rest) => {
		for (var num of rest) first *= num
		return ['number', first]
	}],
	"/": [[["dividend", "number"], ["divisor", "#number"]], (args, dividend, divisor) => {
		for (var num of divisor) dividend /= num
		return ['number', dividend]
	}],
	"%": [[["dividend", "number"], ["divisor", "#number"]], (args, dividend, divisor) => {
		return ['number', ((dividend % divisor) + divisor) % divisor]
	}],
	">": [[["first","number"], ["rest", "#number"]], (args, first, rest) => {
		for (var n of rest) {
			if (first <= n) return ['bool', false]
			first = n
		}
		return ['bool', true]
	}],
	"<": [[["first","number"], ["rest", "#number"]], (args, first, rest) => {
		for (var n of rest) {
			if (first >= n) return ['bool', false]
			first = n
		}
		return ['bool', true]
	}],
	"=": [[["first","number"], ["rest", "#number"]], (args, first, rest) => {
		for (var n of rest)
			if (first != n) return ['bool', false]
		return ['bool', true]
	}],
	"rem": [[["dividend", "number"], ["divisor", "number"]], (args, dividend, divisor) => {
		return ['number', dividend % divisor]
	}],
	"get": [[], (args) => {
		var result
		for (var a of args)
			res = resolve_token(get_token(a))
		return res
	}],
	"do": [[], (args) => {
		for (var a of args) {
			val = get_value(a, 'any')
			if (Array.isArray(val)) execute_function("do", val)
		}
		return ['bool', true]
	}],
	"abs": [[["num", "number"]], (args, num) => {
		return ['number', Math.abs(num)]
	}],
	"floor": [[["num", "number"]], (args, num) => {
		return ['number', Math.floor(num)]
	}],
	"set": [[["sym", "token"], ["val", "token"]], (args, sym, val) => {
		sym = get_token(sym)
		val = resolve_token(val)
		if (sym[0] == 'reference')
			return resolve_token(sym[1][0])[1][sym[1][1]] = val
		return set_var(sym[1], val)
	}],
	"sym": [[["token", "token"]], (args, token) => {
		return token
	}],
	"reset": [[], (args) => {
		restart()
		return ['bool', true]
	}],
	"return": [[], (args) => {
		enter_scene(current_scene)
		return ['bool', true]
	}],
	"back": [[["count", "number"]], (args, count) => {
		for (var i = 0; i < (count ? count : 1); i++)
			action_stack.pop()
		subscene_change = action_stack[action_stack.length - 1]
		return ['bool', true]
	}],
	"not": [[["value", "any"]], (args, value) => {
		return ['bool', !value]
	}],
	"and": [[], (args) => {
		for (var n of args)
			if (!(1 && get_value(n, 'any'))) return ['bool', false]
		return ['bool', true]
	}],
	"or": [[], (args) => {
		for (var n of args)
			if (0 || get_value(n, 'any')) return ['bool', true]
		return ['bool', false]
	}],
	"print": [[["values", "#any"]], (args, values) => {
		var out = ""
		for (var v of values) out += String(v)
		insert_text(out)
		return ['bool', true]
	}],
	"rewind": [[["count", "number"]], (args, count) => {
		count = count ? count : 1
		var act_cont = document.getElementById(`adepth_${action_depth - count}`)
		if (act_cont) {
			for (var child of act_cont.children)
				action_container.appendChild(child.cloneNode(true))
			return ['bool', true]
		}
		return ['bool', false]
	}],
	"concat": [[["strings", "#string"]], (args, strings) => {
		var out = ""
		for (var s of strings) out += s
		return ['string', out]
	}],
	"if": [[["expr", "any"],["t", "token"],["f", "token"]], (args, expr, t, f) => {
		return expr ? resolve_token(t) : resolve_token(f)
	}],
	"list": [[], (args) => {
		return ['list', args.map(x => resolve_token(x))]
	}],
	"def-fun": [[["name", "symbol"], ["args", "list"], ["func", "#token"]], (_, name, args, func) => {
		define_function(name, args, func)
		return ['bool', true]
	}],
	"push": [[["list", "'list"],["values", "#token"]], (args, list, values) => {
		for (var v of values) list.push(resolve_token(v))
		return set_var(args[0], list)
	}],
	"pop": [[["list", "list"]], (args, list) => {
		var ret = list.pop()
		return ret ? ret : ['bool', false]
	}],
	"first": [[["list", "'list"]], (args, list) => {
		return ['reference', [get_token(args[0]), 0]]
	}],
	"last": [[["list", "'list"]], (args, list) => {
		if (!list.length) return ['bool', false]
		return ['reference', [get_token(args[0]), list.length - 1]]
	}],
	"rest": [[["list", "list"]], (args, list) => {
		return ['list', list.slice(1)]
	}],
	"index": [[["list", "'list"], ["index", "number"]], (args, list, index) => {
		var i = Math.min(Math.max(index, 0), list.length - 1)
		return ['reference', [get_token(args[0]), i]]
	}],
	"stop": [[], (args) => {
		subscene_change = 0
		subscene_return = []
		stop = true
		return ['bool', true]
	}],
	"clear": [[], (args) => {
		output.replaceChildren()
		return ['bool', true]
	}],
	"scene-pop": [[], (args) => {
		var scene = scene_stack.pop()
		if (scene != undefined) enter_scene(scene)
		else console.log("WARN: tried to pop without scenes in stack.")
		return ['bool', true]
	}],
	"scene-push": [[["scene-name", "string"]], (args, scene_name) => {
		scene_stack.push(current_scene)
		var scene = scenes[scene_name]
		if (!scene) console.log("WARN: Invalid scene", scene_name)
		enter_scene(scene)
		return ['bool', true]
	}],
	"scene-jump": [[["scene-name", "string"]], (args, scene_name) => {
		var scene = scenes[scene_name]
		if (!scene) console.log("WARN: Invalid scene", scene_name, 'string')
		if (subscene_change) {
			// scene change already in same expression
			subscene_return.push(scene)
		} else {
			// bit of a hack.
			if (subscene_return[subscene_return.length - 1] != current_index)
				subscene_return.push(current_index)
			subscene_change = scene
		}
		return ['bool', true]
	}],
	"scene-change": [[["scene-name", "string"]], (args, scene_name) => {
		var scene = scenes[scene_name]
		if (!scene) console.log("WARN: Invalid scene", scene_name, 'string')
		scene_stack = []
		enter_scene(scene)
		return ['bool', true]
	}],
	"rand": [[], (args) => {
		var a = resolve_token(args[0])
		if (a[0] == 'list') {
			var l = get_value(args[0], 'list')
			return ['reference', [get_token(args[0]), Math.floor(Math.random() * l.length)]]
		}
		var min = get_value(a, 'number')
		var max = get_value(args[1], 'number')
		return ['number', Math.floor(Math.random() * (max - min + 1) + min)]
	}],
	"length": [[], (args) => {
		var l = get_value(args[0], 'any')
		if (l.length) return ['number', l.length]
		return ['bool', false]
	}],
	"del": [[], (args) => {
		var tok = get_token(args[0])
		if (tok[0] == 'reference') {
			var lst = resolve_token(tok[1][0])[1]
			lst.splice(tok[1][1], 1)
			return ['bool', true]
		} else if (tok[0] == 'symbol') {
			var reslv = resolve_token(tok)
			if (reslv[0] == 'reference') {
				var lst = resolve_token(reslv[1][0])[1]
				lst.splice(reslv[1][1], 1)
				return token(true)
			} else if (reslv[0] == 'symbol') {
				tok = reslv
			}
			delete variables[tok[1]]
			return ['bool', true]
		}
		return ['bool', false]
	}],
	"rewind": [[["count", "number"]], (args, count) => {
		count = count ? count : 1
		var act_cont = document.getElementById(`adepth_${action_depth - count}`)
		if (act_cont) {
			var clone = act_cont.cloneNode(true)
			action_depth++
			clone.id = `adepth_${action_depth}`
			clone.setAttribute("adepth", action_depth)
			output.appendChild(clone)
			return ['bool', true]
		}
		return ['bool', false]
	}],
}

define_function("+1", "var:symbol", parse_expression("(set var (+ var 1))"))
define_function("-1", "var:symbol", parse_expression("(set var (- var 1))"))

function recursive_find_args(func, args) {
	var out = {}
	for (var i in func) {
		var e = func[i]
		var et = e[0]
		var o
		switch (et) {
			case 'symbol':
				if (args.includes(e[1])) {
					if (out[e[1]]) out[e[1]].push([func, i])
					else out[e[1]] = [[func, i]]
				}
				break
			case 'function':
				o = recursive_find_args(e[1][1], args)
				break
			case 'list':
				o = recursive_find_args(e[1], args)
				break
		}
		if (o) {
			for (var k in o) {
				if (out[k]) out[k] = out[k].concat(o[k])
				else out[k] = o[k]
			}
		}
	}
	return out
}

function define_function(name, args, func) {
	var args = args instanceof Array ? args : parse_expression(args + '\n')
	var definition_args = []
	for (var p of args) definition_args.push([p[1][0][1], p[1][1][1]])
	if (func instanceof Array) {
		funcs[name] = [definition_args, func, recursive_find_args(func, definition_args.map((a) => {return a[0]}))]
	} else {
		funcs[name] = [definition_args, func]
	}
}

function execute_function(name, args) {
	var func = funcs[name]
	if (!func) return null
	// internal
	if (func[1] instanceof Function) {
		var ia = []
		for (var i in func[0]) {
			if (func[0][i][1][0] == '#') {
				var il = []
				var lt = func[0][i][1].slice(1)
				if (i == func[0].length - 1) {
					if (args.length == func[0].length && lt != 'token') {
						var l = resolve_token(args[i])
						if (l[0] == 'list') {
							var el = []
							for (var e of l[1])
								el.push(get_value(e, lt))
							ia.push(el)
							continue
						}
					}
					for (var j = i; j < args.length; j++)
						il.push(get_value(args[j], lt))
				} else {
					var l = get_value(args[i], 'list')
					for (var e of l[1]) il.push(get_value(e, lt))
				}
				ia.push(il)
				continue
			} else if (func[0][i][1][0] == '\'') {
				var tk = get_token(args[i])
				if (tk[0] != 'symbol') console.log("WARN: Invalid variable argument for function", name)
				var tt = func[0][i][1].slice(1)
				ia.push(get_value(tk, tt))
				continue
			}
			ia.push(get_value(args[i], func[0][i][1]))
		}
		return func[1](args, ...ia)
	} else {
		var ia = {}
		for (var i in func[0]) {
			if (func[0][i][1][0] == '#') {
				var il = []
				var lt = func[0][i][1].slice(1)
				if (i == func[0].length - 1) {
					if (args.length == func[0].length && lt != 'token') {
						var l = resolve_token(args[i])
						if (l[0] == 'list') {
							ia[func[0][i][0]] = l
							continue
						}
					}
					for (var j = i; j < args.length; j++)
						il.push([lt, get_value(args[j], lt)])
				} else {
					var l = get_value(args[i], 'list')
					for (var e of l[1]) il.push([lt, get_value(e, lt)])
				}
				ia[func[0][i][0]] = ['list', il]
				continue
			} else if (func[0][i][1][0] == '\'') {
				var tk = get_token(args[i])
				if (tk[0] != 'symbol') console.log("WARN: Invalid variable argument for function", name)
				var tt = func[0][i][1].slice(1)
				if (resolve_token(tk)[0] != tt) console.log("WARN: Invalid variable argument for function", name)
				ia[func[0][i][0]] = tk
				continue
			}
			ia[func[0][i][0]] = [func[0][i][1], get_value(args[i], func[0][i][1])]
		}
		for (var e in ia)
		for (var i of func[2][e])
			i[0][i[1]] = ia[e]
		var res
		for (var n of func[1])
			res = resolve_token(n)
		return res
	}
}

/*
const functions = {
}
*/

function parse_expression(expr) {
	var parents = []
	var parent_stack = []
	var current_node
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
				var n
				if (lst)
					n = ['list', []]
				else
					n = ['function', [funcs[buffer] ? buffer : "", []]]
				lst = false
				if (current_node) {
					parent_stack.push(current_node)
					switch (current_node[0]) {
						case 'function': current_node[1][1].push(sym ? ['function', ['sym', [n]]] : n); break
						case 'list': current_node[1].push(sym ? ['function', ['sym', [n]]] : n); break
						default: console.log("WARN: Invalid parent type", current_node[0])
					}
				} else {
					parents.push(n)
				}
				current_node = n
				buffer = ""
				break
			case ')':
				if (buffer) {
					if (current_node[0] == 'function' && !current_node[1][0]) {
						current_node[1][0] = buffer
						if (!funcs[buffer]) console.log("WARN: Invalid function", buffer)
					} else {
						var tk = token(buffer)
						if (sym) {
							tk = ['function', ['sym', [tk]]]
							sym = false
						}
						switch (current_node[0]) {
							case 'function': current_node[1][1].push(tk); break
							case 'list': current_node[1].push(tk); break
						}
					}
				}
				current_node = parent_stack.pop()
				buffer = ""
				break
			case ' ': case '\t': case '\n':
				if (!buffer) break
				var tk = token(buffer)
				if (sym) {
					tk = ['function', ['sym', [tk]]]
					sym = false
				}

				if (!current_node) {
					parents.push(tk)
				} else {
					switch (current_node[0]) {
						case 'function':
							if (!current_node[1][0]) {
								current_node[1][0] = buffer
								if (!funcs[buffer]) console.log("WARN: Invalid function", buffer)
							} else {
								current_node[1][1].push(tk)
							}
							break
						case 'list':
							current_node[1].push(tk)
							break
					}
				}
				buffer = ""
				break
			case "'": sym = true; break
			case "#": lst = true; break
			case '"': string = c
			default: if (lst) { buffer += '#'; lst = false }
				buffer += c
		}
	}
	return parents
}

function restart() {
	variables = {}
	action_depth = 0
	new_action_container()
	output.replaceChildren(action_container)
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

function new_action_container() {
	action_container = document.createElement("div")
	action_container.id = `adepth_${action_depth}`
	action_container.classList.add("action-container")
	action_container.setAttribute("adepth", action_depth)
}

function parse_play() {
	var index = -1
	variables = {}
	action_depth = 0
	new_action_container()
	output.replaceChildren(action_container)
	scene_stack = []
	scenes = []
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
	var l = params.get('gist')
	if (l) {
		fetch(`https://api.github.com/gists/${l}`, {cache: "no-cache"})
			.then(function(response) { return response.json() })
			.then(function(json) { play = Object.values(json.files)[0].content; parse_play() })
		return
	}

	l = params.get('load')
	if (l) {
		fetch(l, {cache: "no-cache"})
			.then(function(response) { return response.text() })
			.then(function(text) { play = text; parse_play() })
		return
	}
}
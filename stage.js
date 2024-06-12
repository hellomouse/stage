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

const Type = {
	token:      0,
	symbol:     1,
	function:   2,
	reference:  3,
	number:     4,
	string:     5,
	boolean:    6,
	list:       7,
	pair:       8,
	any:        127 // DO NOT INCREASE WITHOUT CHANGING TYPEMODS
}

const TypeMod = {
	list:   (1 << 7),
	symbol: (1 << 8)
}

const stage_version = "20240612";
let play_chunks = {
	"STGE": {},
	"INFO": {},
	"SCNE": {},
	"EXTS": {}
};

let sources = {};
let current_source;

let scene_stack = [];
let action_stack = [];
let scenes = {};
let current_scene;
let stop = false;
let play;
let action_depth = 0;
let container;
let output;
let text_output;
let action_output;
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
	play = sources[current_source]
	// DEBUGGER HOOK
	scene_process_start_hook(ind)
	var sc = 0
	var si = -1
	out:
	for (var i = ind; (i <= play.length || subscene_change) && !stop; i++) {
		if (subscene_change) {
			// DEBUGGER HOOK
			subscene_change_hook(subscene_change)
			i = subscene_change.index
			current_source = subscene_change.source
			play = sources[current_source]
			subscene_change = null
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
			case '@': action_stack.push({source: current_source, index: i + 1}); break
			case '{': sc++; si = i; break
			case '}': case '.':
				if (subscene_return.length) {
					var s = subscene_return.pop();
					i = s.index;
					current_source = s.source
					play = sources[current_source]
					break;
				}
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
	input.setAttribute("onkeydown", `input_check(event, ${i}, ${action_depth}, "${current_source}")`)
	action_output.appendChild(input)
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
						ret = get_value(tok, Type.string)
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
	text_output.appendChild(p)
}

function action(i, si) {
	var a = document.createElement("a")
	var text = ""
	while (play[++i] != '\n' && play[i]) text += play[i]	
	text_format(text, a)
	a.classList.add("action")
	if (!si) { // blocking action.
		a.href = `javascript:execute_action(${i}, ${action_depth}, "${current_source}", true)`
		stop = true
	} else {
		a.href = `javascript:execute_action(${si}, ${action_depth}, "${current_source}")`
	}
	action_output.appendChild(a)
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
	if (si && get_value(result, Type.any)) enter_subscene(si)
	else if (!si) {
		set_var("status", result)
		if (checks.length) {
			for (var c of checks) {
				var val = c[0]
				if (!get_value(execute_function("=", [result, val]), Type.boolean))
					continue
				enter_subscene(c[1].index, c[1].source)
				break
			}
		}
	}
	return i
}

let checks = []

function check(i, si) {
	var t = ""
	while (play[++i] && play[i] != '\n') t += play[i]
	current_index = i
	if (t) checks.push([token(t), {source: current_source, index: si}])
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
			else if (play[i] == '"') str = play[i];
			else if (play[i] == '\n' && !pc) break;
		}
		expr += play[i]
	}
	expr += '\n'
	current_index = i
	var node = parse_expression(expr)
	for (var n of node)
		get_value(n, Type.any)
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

function enter_subscene(si, source) {
	subscene_return.push({source: current_source, index: current_index})
	subscene_change = {source: source ?? current_source, index: si}
}

function enter_scene(s) {
	stop = true
	Promise.resolve().then(() => {
		var si = s.index
		current_source = s.source
		stop = false
		current_scene = s
		action_stack = [{source: s.source, index: si}]
		subscene_return = []
		current_index = 0
		subscene_change = 0
		process_scene(si)
	});
}

function increment_action_depth() {
	action_depth++
	if (play_chunks.STGE["action-clear"]) {
		clear_output()
	} else {
		output.appendChild(document.createElement("hr"))
		if (play_chunks.STGE["action-separation"]) {
			output.appendChild(text_output = document.createElement("div"))
			output.appendChild(action_output = document.createElement("div"))
		}
	}
}

function execute_action(si, depth, source, blocking = false) {
	if (depth != action_depth)
		return
	increment_action_depth()
	stop = false
	current_source = source
	if (!blocking) action_stack.push({source: source, index: si})
	process_scene(si)
}

function input_check(e, si, depth, source) {
	if (depth != action_depth) {
		e.preventDefault()
		return
	}
	if (e.key == "Enter") {
		e.preventDefault()
		current_source = source
		set_var("status", [Type.string, e.target.value])
		increment_action_depth()
		output.appendChild(document.createElement("hr"))
		stop = false
		process_scene(si)
	}
}

/* ----------- */
/* EXPRESSIONS */
/* ----------- */

// Used in STGE chunk parsing.
const bool_re = /^(yes|no|true|false|t|f)$/
function token(tok) {
	const string_re = /(^".*"$)/
	const pair_re = /^.+:.+$/
	if (Array.isArray(tok))
		return [Type.list, tok]
	if (string_re.exec(tok))
		return [Type.string, tok.slice(1, -1)]
	if (pair_re.exec(tok))
		return [Type.pair, tok.split(":").map(token)]
	if (!isNaN(tok) && !isNaN(parseFloat(tok)))
		return [Type.number, Number(tok)]
	if (bool_re.exec(tok)) {
		if (typeof tok == "boolean")
			return [Type.boolean, tok]
		return [Type.boolean, tok.startsWith("t") || tok.startsWith("y")]
	}
	return [Type.symbol, tok]
}

const coercion_functions = {
	[Type.list]: {
		[Type.boolean]: (list) => { return [Type.boolean, !!list.length] }
	},
	[Type.number]: {
		[Type.string]: (num) => { return [Type.string, num.toString()] },
		[Type.boolean]: (num) => { return [Type.boolean, num != 0] }
	},
	[Type.string]: {
		[Type.number]: (str) => { return !isNaN(str) && !isNaN(parseFloat(str)) ? [Type.string, Number(str)] : null },
		[Type.symbol]: (str) => { return [Type.symbol, str] }
	},
	[Type.boolean]: {
		[Type.number]: (bool) => { return [Type.number, +bool] }
	}
}

function coerce_token(v, type) {
	if (v[0] == type) // v already type
		return v
	if (v[0] == Type.reference)
		v = resolve_token(v)
	var coerce = v
	if (coercion_functions[v[0]] && coercion_functions[v[0]][type]) {
		coerce = coercion_functions[v[0]][type](v[1])
		coerce = coerce ? coerce : v
	}
	if (coerce[0] != type)
		console.log("WARN: Unable to coerce", coerce[0], "to type", type)
	return coerce
}

function get_token_type(v, type) {
	if (!v)
		return null
	if (type == Type.token)
		return v
	if (type != Type.symbol || v[0] == Type.function) {
		v = resolve_token(v)
		// this is some abyssmal dogshit garbage right here.
		// the entire function is fucking r******* and the person who made it should suffer
		// oh wait that person is me, and I sure am suffering.
		// WHAT THE FUCK WAS THE POINT WITH MAKING ALL THESE FUCKING DUMB FUNCTIONS
		// What I am trying to say is that these functions are all dumb and should be thrown out
		// and replaced with hopefully something better :)
		if (v[0] == Type.reference && (type != Type.reference && type != Type.symbol))
			v = resolve_token(v)
	}
	if (v[0] != type && type != Type.any)
		v = coerce_token(v, type)
	return v
}

function get_value(v, type) {
	if (type == Type.token)
		return v
	v = get_token_type(v, type)
	return v && v[1]
}

function get_token(v) {
	if (!v)
		return null
	if (v[0] == Type.function)
		v = execute_function(v[1][0], v[1][1])
	return v
}

function resolve_token(v) {
	if (!v)
		return null
	if (v[0] == Type.reference)
		v = resolve_token(v[1][0])[1][v[1][1]]
	if (v[0] == Type.symbol)
		v = variables[v[1]] ? variables[v[1]] : [Type.number, 0]
	if (v[0] == Type.function)
		v = execute_function(v[1][0], v[1][1])
	return v
}

function humanify_token(v) {
	switch (v[0]) {
		case Type.reference:
			return `ref ${humanify_token(v[1][0])}[${v[1][1]}]`
		case Type.symbol:
			return `sym ${v[1]}`
		case Type.function:
			return `(${v[1][0]} ${v[1][1].map(x => humanify_token(x)).join(" ")})`
		case Type.list:
			return `#(${v[1].map(x => humanify_token(x)).join(" ")})`
		case Type.pair:
			return `${humanify_token(v[1][0])}:${humanify_token(v[1][1])}`
		case Type.boolean:
 		case Type.string:
		case Type.number:
			return v[1]
	}
}

function set_var(variable, value) {
	return variables[variable] = value
}

function set_ref(ref, value) {
	return resolve_token(ref[1][0])[1][ref[1][1]] = value
}

const funcs = {
	"+": [[["first", Type.number], ["rest", Type.number|TypeMod.list]], (args, first, rest) => {
		for (var num of rest) first += num
		return [Type.number, first]
	}],
	"-": [[["first", Type.number], ["rest", Type.number|TypeMod.list]], (args, first, rest) => {
		for (var num of rest) first -= num
		return [Type.number, first]
	}],
	"*": [[["first", Type.number], ["rest", Type.number|TypeMod.list]], (args, first, rest) => {
		for (var num of rest) first *= num
		return [Type.number, first]
	}],
	"/": [[["dividend", Type.number], ["divisor", Type.number|TypeMod.list]], (args, dividend, divisor) => {
		for (var num of divisor) dividend /= num
		return [Type.number, dividend]
	}],
	"%": [[["dividend", Type.number], ["divisor", Type.number|TypeMod.list]], (args, dividend, divisor) => {
		return [Type.number, ((dividend % divisor) + divisor) % divisor]
	}],
	">": [[["first", Type.number], ["rest", Type.number|TypeMod.list]], (args, first, rest) => {
		for (var n of rest) {
			if (first <= n) return [Type.boolean, false]
			first = n
		}
		return [Type.boolean, true]
	}],
	"<": [[["first", Type.number], ["rest", Type.number|TypeMod.list]], (args, first, rest) => {
		for (var n of rest) {
			if (first >= n) return [Type.boolean, false]
			first = n
		}
		return [Type.boolean, true]
	}],
	"=": [[["first", Type.token], ["rest", Type.token|TypeMod.list]], (args, first, rest) => {
		for (var n of rest) {
			n = coerce_token(n, first[0])
			if (first[1] != n[1]) return [Type.boolean, false]
		}
		return [Type.boolean, true]
	}],
	"==": [[["first", Type.any], ["rest", Type.any|TypeMod.list]], (args, first, rest) => {
		for (var n of rest) {
			if (first != n) return [Type.boolean, false]
		}
		return [Type.boolean, true]
	}],
	"rem": [[["dividend", Type.number], ["divisor", Type.number]], (args, dividend, divisor) => {
		return [Type.number, dividend % divisor]
	}],
	"get": [[], (args) => {
		var result
		for (var a of args)
			res = resolve_token(get_token(a))
		return res
	}],
	"do": [[], (args) => {
		for (var a of args) {
			val = get_value(a, Type.any)
			if (Array.isArray(val)) execute_function("do", val)
		}
		return [Type.boolean, true]
	}],
	"abs": [[["num", Type.number]], (args, num) => {
		return [Type.number, Math.abs(num)]
	}],
	"floor": [[["num", Type.number]], (args, num) => {
		return [Type.number, Math.floor(num)]
	}],
	"set": [[["sym", Type.token], ["val", Type.token]], (args, sym, val) => {
		sym = get_token(sym)
		val = resolve_token(val)
		if (sym[0] == Type.reference)
			return set_ref(sym, val)
		return set_var(sym[1], val)
	}],
	"sym": [[["token", Type.token]], (args, token) => {
		return token
	}],
	"reset": [[], (args) => {
		restart()
		return [Type.boolean, true]
	}],
	"return": [[], (args) => {
		enter_scene(current_scene)
		return [Type.boolean, true]
	}],
	"back": [[["count", Type.number]], (args, count) => {
		for (var i = 0; i < (count ? count : 1); i++)
			action_stack.pop()
		subscene_change = action_stack[action_stack.length - 1]
		return [Type.boolean, true]
	}],
	"not": [[["value", Type.any]], (args, value) => {
		return [Type.boolean, !value]
	}],
	"and": [[], (args) => {
		for (var n of args)
			if (!(1 && get_value(n, Type.any))) return [Type.boolean, false]
		return [Type.boolean, true]
	}],
	"or": [[], (args) => {
		for (var n of args)
			if (0 || get_value(n, Type.any)) return [Type.boolean, true]
		return [Type.boolean, false]
	}],
	"print": [[["values", Type.any|TypeMod.list]], (args, values) => {
		var out = ""
		for (var v of values) out += String(v)
		insert_text(out)
		return [Type.boolean, true]
	}],
	"concat": [[["strings", Type.string|TypeMod.list]], (args, strings) => {
		var out = ""
		for (var s of strings) out += s
		return [Type.string, out]
	}],
	"if": [[["expr", Type.any],["t", Type.token],["f", Type.token]], (args, expr, t, f) => {
		return expr ? resolve_token(t) : resolve_token(f)
	}],
	"list": [[], (args) => {
		return [Type.list, args.map(x => resolve_token(x))]
	}],
	"def-fun": [[["name", Type.symbol], ["args", Type.list], ["func", Type.token|TypeMod.list]], (_, name, args, func) => {
		define_function(name, args, func)
		return [Type.boolean, true]
	}],
	"push": [[["list", Type.list|TypeMod.symbol],["values", Type.token|TypeMod.list]], (args, list, values) => {
		for (var v of values) list.push(resolve_token(v))
		return set_var(args[0], list)
	}],
	"pop": [[["list", Type.list]], (args, list) => {
		var ret = list.pop()
		return ret ? ret : [Type.boolean, false]
	}],
	"first": [[["list", Type.list|TypeMod.symbol]], (args, list) => {
		return [Type.reference, [get_token(args[0]), 0]]
	}],
	"last": [[["list", Type.list|TypeMod.symbol]], (args, list) => {
		if (!list.length) return [Type.boolean, false]
		return [Type.reference, [get_token(args[0]), list.length - 1]]
	}],
	"rest": [[["list", Type.list]], (args, list) => {
		return [Type.list, list.slice(1)]
	}],
	"index": [[["list", Type.list|TypeMod.symbol], ["index", Type.number]], (args, list, index) => {
		var i = Math.min(Math.max(index, 0), list.length - 1)
		return [Type.reference, [get_token(args[0]), i]]
	}],
	"stop": [[], (args) => {
		subscene_change = 0
		subscene_return = []
		stop = true
		return [Type.boolean, true]
	}],
	"clear": [[], (args) => {
		clear_output()
		return [Type.boolean, true]
	}],
	"scene-pop": [[], (args) => {
		var scene = scene_stack.pop()
		if (scene != undefined) enter_scene(scene)
		else return [Type.boolean, false]
		return [Type.boolean, true]
	}],
	"scene-push": [[["scene-name", Type.string]], (args, scene_name) => {
		scene_stack.push(current_scene)
		var scene = scenes[scene_name]
		if (!scene) return [Type.boolean, false]
		enter_scene(scene)
		return [Type.boolean, true]
	}],
	"scene-jump": [[["scene-name", Type.string]], (args, scene_name) => {
		var scene = scenes[scene_name]
		if (!scene) return [Type.boolean, false]
		if (subscene_change) {
			// scene change already in same expression
			subscene_return.push(scene)
		} else {
			// bit of a hack.
			var ss = subscene_return[subscene_return.length - 1]
			if (!ss || ss.index != current_index)
				subscene_return.push({source: current_source, index: current_index})
			subscene_change = scene
		}
		return [Type.boolean, true]
	}],
	"scene-change": [[["scene-name", Type.string]], (args, scene_name) => {
		var scene = scenes[scene_name]
		if (!scene) return [Type.boolean, false]
		scene_stack = []
		enter_scene(scene)
		return [Type.boolean, true]
	}],
	"rand": [[], (args) => {
		var a = resolve_token(args[0])
		if (a[0] == Type.list) {
			var l = get_value(args[0], Type.list)
			return [Type.reference, [get_token(args[0]), Math.floor(Math.random() * l.length)]]
		}
		var min = get_value(a, Type.number)
		var max = get_value(args[1], Type.number)
		return [Type.number, Math.floor(Math.random() * (max - min + 1) + min)]
	}],
	"length": [[], (args) => {
		var l = get_value(args[0], Type.any)
		if (l.length) return [Type.number, l.length]
		return [Type.boolean, false]
	}],
	"del": [[], (args) => {
		var tok = get_token(args[0])
		if (tok[0] == Type.reference) {
			var lst = resolve_token(tok[1][0])[1]
			lst.splice(tok[1][1], 1)
			return [Type.boolean, true]
		} else if (tok[0] == Type.symbol) {
			var reslv = resolve_token(tok)
			if (reslv[0] == Type.reference) {
				var lst = resolve_token(reslv[1][0])[1]
				lst.splice(reslv[1][1], 1)
				return token(true)
			} else if (reslv[0] == Type.symbol) {
				tok = reslv
			}
			delete variables[tok[1]]
			return [Type.boolean, true]
		}
		return [Type.boolean, false]
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
			case Type.symbol:
				if (args.includes(e[1])) {
					if (out[e[1]]) out[e[1]].push([func, i])
					else out[e[1]] = [[func, i]]
				}
				break
			case Type.function:
				o = recursive_find_args(e[1][1], args)
				break
			case Type.list:
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
	for (var p of args) {
		var to = 0
		var t = p[1][1][1]
		switch (t[0]) {
			// unfortunately due to this being a pair, ' would get converted to sym().
			// need to think about this, but for now poip.
			case "|": to = TypeMod.symbol; break
			case "#": to = TypeMod.list; break
		}
		if (to) t = t.substring(1)
		to |= Type[t]
		definition_args.push([p[1][0][1], to])
	}
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
			if (func[0][i][1] & TypeMod.list) {
				var il = []
				var lt = func[0][i][1] ^ TypeMod.list
				if (i == func[0].length - 1) {
					if (args.length == func[0].length && lt != Type.token) {
						var l = resolve_token(args[i])
						if (l[0] == Type.list) {
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
					var l = get_value(args[i], Type.list)
					for (var e of l[1]) il.push(get_value(e, lt))
				}
				ia.push(il)
				continue
			} else if (func[0][i][1] & TypeMod.symbol) {
				var tk = get_token(args[i])
				if (tk[0] != Type.symbol) console.log("WARN: Invalid variable argument for function", name)
				var tt = func[0][i][1] ^ TypeMod.symbol
				ia.push(get_value(tk, tt))
				continue
			}
			ia.push(get_value(args[i], func[0][i][1]))
		}
		return func[1](args, ...ia)
	} else {
		var ia = {}
		for (var i in func[0]) {
			if (func[0][i][1] & TypeMod.list) {
				var il = []
				var lt = func[0][i][1] ^ TypeMod.list
				if (i == func[0].length - 1) {
					if (args.length == func[0].length && lt != Type.token) {
						var l = resolve_token(args[i])
						if (l[0] == Type.list) {
							ia[func[0][i][0]] = l
							continue
						}
					}
					for (var j = i; j < args.length; j++)
						il.push(get_token_type(args[j], lt))
				} else {
					var l = get_value(args[i], Type.list)
					for (var e of l[1]) il.push(get_token_type(e, lt))
				}
				ia[func[0][i][0]] = [Type.list, il]
				continue
			} else if (func[0][i][1] & TypeMod.symbol) {
				var tk = get_token(args[i])
				if (tk[0] != Type.symbol) console.log("WARN: Invalid variable argument for function", name)
				var tt = func[0][i][1] ^ TypeMod.symbol
				if (resolve_token(tk)[0] != tt) console.log("WARN: Invalid variable argument for function", name)
				ia[func[0][i][0]] = tk
				continue
			}
			ia[func[0][i][0]] = get_token_type(args[i], func[0][i][1])
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

function flatten_expression_tree(tree) {
	switch (tree[0]) {
		case Type.function:
			console.log(Type.function + ":" +tree[1][0])
			console.log(Type.list + ":" + tree[1][1].length)
			tree[1][1].forEach((x) => flatten_expression_tree(x))
			break
		case Type.symbol:
			console.log(Type.symbol + ":" + tree[1])
			break
		case Type.number:
			console.log(Type.number + ":" + tree[1])
			break
		default: console.log("Unknown type: " + tree[0])
	}
}

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
					n = [Type.list, []]
				else
					n = [Type.function, [funcs[buffer] ? buffer : "", []]]
				lst = false
				if (current_node) {
					parent_stack.push(current_node)
					switch (current_node[0]) {
						case Type.function: current_node[1][1].push(sym ? [Type.function, ['sym', [n]]] : n); break
						case Type.list: current_node[1].push(sym ? [Type.function, ['sym', [n]]] : n); break
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
					if (current_node[0] == Type.function && !current_node[1][0]) {
						current_node[1][0] = buffer
						if (!funcs[buffer]) console.log("WARN: Invalid function", buffer)
					} else {
						var tk = token(buffer)
						if (sym) {
							tk = [Type.function, ['sym', [tk]]]
							sym = false
						}
						switch (current_node[0]) {
							case Type.function: current_node[1][1].push(tk); break
							case Type.list: current_node[1].push(tk); break
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
					tk = [Type.function, ['sym', [tk]]]
					sym = false
				}

				if (!current_node) {
					parents.push(tk)
				} else {
					switch (current_node[0]) {
						case Type.function:
							if (!current_node[1][0]) {
								current_node[1][0] = buffer
								if (!funcs[buffer]) console.log("WARN: Invalid function", buffer)
							} else {
								current_node[1][1].push(tk)
							}
							break
						case Type.list:
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
	clear_output()
	scene_stack = []
	enter_scene(scenes["start"])
}

/* -------------- */
/* FRONT HANDLING */
/* -------------- */

function clear_output() {
	output.replaceChildren()
	if (play_chunks.STGE["action-separation"]) {
		output.appendChild(text_output = document.createElement("div"))
		output.appendChild(action_output = document.createElement("div"))
	} else {
		text_output = output
		action_output = output
	}
}

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
	play_chunks = {
		"STGE": {},
		"INFO": {},
		"SCNE": {},
		"EXTS": {}
	}
	var sind = 0
	var eind = play.indexOf("\n")
	var line = play.substring(sind, eind)
	sind = eind + 1
	if (line != "STAGE PLAY") {
		console.log(`ERR: 'STAGE PLAY' is not 'STAGE PLAY': ${line}`)
		return
	}
	var chunk = ""
	var chunk_end = ""
	while (line != "END") {
		eind = play.indexOf("\n", sind)
		line = play.substring(sind, eind).trim()
		sind = eind + 1
		if (chunk) {
			if (line == chunk_end) {
				chunk = ""
				continue
			}
			line = line.split(":")
			var f = line[0]
			var v = line[1]
			play_chunks[chunk][f] = v.trim()
		} else {
			if (play_chunks[line]) {
				chunk = line
				chunk_end = line.split("").reverse().join("") // replace with something better.
			}
		}
	}
	
	for (var k of Object.keys(play_chunks.STGE)) {
		var val = play_chunks.STGE[k]
		if (bool_re.exec(val))
			play_chunks.STGE[k] = val.startsWith("t") || val.startsWith("y")
	}

	if (play_chunks.STGE?.version) {
		// version check
	}

	play_chunks.STGE["action-clear"] = play_chunks.STGE["action-clear"] ?? false
	play_chunks.STGE["action-separation"] = play_chunks.STGE["action-separation"] ?? false

	sources["play"] = play
	if (Object.keys(play_chunks.SCNE).length <= 0) {
		console.log("WARN: SCNE chunk missing or empty, starting from zero.")
		scenes["start"] = sind
	} else {
		for (var k of Object.keys(play_chunks.SCNE)) {
			var i = parseInt(play_chunks.SCNE[k]) + sind
			scenes[k] = {source: "play", index: i}
			console.log(`INFO: Scene ${k} at ${i} in 'play'.`)
		}
	}
}

function parse_legacy_play() {
	console.log("WARN: Legacy play format is deprecated and may be removed in a future version.")
	var index = -1
	variables = {}
	action_depth = 0
	clear_output()
	scene_stack = []
	scenes = []
	sources["play"] = play
	while ((index = play.indexOf("START ", index + 1)) != -1) {
		var buffer = ""
		index += 5
		while (play[++index] != '\n') buffer += play[index]
		scenes[buffer] = {source: "play", index: index};
	}
	if (!scenes["start"]) {
		scenes["start"] = {source: "play", index: 0}
		return true
	}
	return false
}

function play_determine() {
	var magic = play.substring(0, 10)
	if (magic == "STAGE PLAY") parse_play()
	else parse_legacy_play()
	document.getElementById("load")?.remove()
	restart()
}

function play_file(file) {
	var reader = new FileReader()
	reader.readAsText(file)
	reader.onload = readerEvent => {
		play = readerEvent.target.result
		play_determine()
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
			.then(function(json) { play = Object.values(json.files)[0].content; play_determine() })
		return
	}

	l = params.get('load')
	if (l) {
		fetch(l, {cache: "no-cache"})
			.then(function(response) { return response.text() })
			.then(function(text) { play = text; play_determine() })
		return
	}
}
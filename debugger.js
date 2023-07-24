let editor
let debug_vars
let variable_track = {}

function run() {
	for (var v in variable_track)
		variable_track[v].remove()
	variable_track = {}
	play = editor.value
	parse_play()
}

// loop detection
let subscene_changes = {}
let loop_max = 1000
subscene_change_hook = (ind) => {
	if (subscene_changes[ind]) {
		var c = subscene_changes[ind]++
		if (c > loop_max) {
			stop = true;
			insert_text("STOPPING, POSSIBLE INFINITE LOOP.")
			insert_text("Use (set loop_max num) to change maximum loop count.")
			insert_text("Current: " + loop_max)
		}
	} else {
		subscene_changes[ind] = 1
	}
}

scene_process_start_hook = (ind) => {
	subscene_changes = {}
}

functions["set"] = (...args) => {
	var ret
	var sym = get_token(args[0])
	if (sym[0] == 'reference') {
		ret = resolve_token(sym[1][0])[1][sym[1][1]] = resolve_token(args[1])
		sym = sym[1][0]
	} else {
		ret = variables[get_value(sym, "symbol")] = resolve_token(args[1])
	}

	var v = sym[1]
	var s = variables[sym[1]]
	if (v == 'loop_max')
		loop_max = get_value(sym, 'number')
	if (!variable_track[v]) {
		var d = document.createElement("div")
		d.className = "variable"
		d.innerText = `${v}: ${humanify_token(s)}`
		debug_vars.appendChild(d)
		variable_track[v] = d
	} else {
		variable_track[v].innerText = `${v}: ${humanify_token(s)}`
	}
	return ret
}


window.onload = e => {
	debug_vars = document.getElementById("variables")
	container = document.getElementById("container")
	output = document.getElementById("output") 
	editor = document.getElementById("editor")
	editor.addEventListener('keydown', function(e) {
		if (e.key == "Tab") {
			e.preventDefault()
			var s = this.selectionStart;
			var e = this.selectionEnd;
			this.value = this.value.substring(0, s) + "\t" + this.value.substring(e);
			this.selectionStart = this.selectionEnd = s + 1;
		}
	})
}
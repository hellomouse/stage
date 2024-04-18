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

function save() {
	localStorage.setItem("stage-debugger-autosave", editor.value)
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
var original_set = this.set_var
set_var = (variable, value) => {
	var ret = original_set(variable, value)
	if (variable == 'loop_max')
		loop_max = get_value(value, 'number')
	if (!variable_track[variable]) {
		var d = document.createElement("div")
		d.className = "variable"
		d.innerText = `${variable}: ${humanify_token(ret)}`
		debug_vars.appendChild(d)
		variable_track[variable] = d
	} else {
		variable_track[variable].innerText = `${variable}: ${humanify_token(ret)}`
	}
	return ret
}

window.onload = e => {
	debug_vars = document.getElementById("variables")
	container = document.getElementById("container")
	output = document.getElementById("output") 
	editor = document.getElementById("editor")
	editor.value = localStorage.getItem("stage-debugger-autosave") ?? ""
	editor.addEventListener('keydown', function(e) {
		if (e.key == "Tab") {
			e.preventDefault()
			var s = this.selectionStart;
			var e = this.selectionEnd;
			this.value = this.value.substring(0, s) + "\t" + this.value.substring(e);
			this.selectionStart = this.selectionEnd = s + 1;
		}
	})
	setInterval(() => {
		save()
	}, 1000 * 60) // every minute
}
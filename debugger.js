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


let editor_contents = {}
let scene_element = {}

let code_area
let bottom_bar
let selected_file
let file_list

let scene_select
let debug_vars
let variable_track = {}

function run(scene) {
	if (!scene) scene = selected_file.attributes.scene.value
	for (var v in variable_track)
		variable_track[v].remove()
	variable_track = {}
	editor_contents[selected_file.attributes.scene.value] = code_area.value
	sources = editor_contents
	for (var s of Object.keys(editor_contents))
		scenes[s] = {source: s, index: 0}
	variables = {}
	action_depth = 0
	output.replaceChildren()
	scene_stack = []
	enter_scene(scenes[scene])
}

function save() {
	if (selected_file) {
		editor_contents[selected_file.attributes.scene.value] = code_area.value
		localStorage.setItem("stage-debugger-scene", selected_file.attributes.scene.value)
	} else {
		localStorage.setItem("stage-debugger-scene", null)
	}
	localStorage.setItem("stage-debugger-sources", JSON.stringify(editor_contents))
}

function change() {
	editor_sources[editor_scene] = editor.value
	editor_scene = scene_select.value
	editor.value = editor_sources[editor_scene] ?? ""
}

function clear_editor() {
	var o = confirm("This will clear everything, proceed?")
	if (o) {
		localStorage.setItem("stage-debugger-scene", "start")
		localStorage.setItem("stage-debugger-sources", "{}")
		location.reload()
	}
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
		loop_max = get_value(value, Type.number)
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

var original_set_ref = this.set_ref
set_ref = (ref, value) => {
	var ret = original_set_ref(ref, value)
	var variable = get_value(ref[1][0], Type.symbol)
	value = resolve_token(ref[1][0])
	if (!variable_track[variable]) {
		var d = document.createElement("div")
		d.className = "variable"
		d.innerText = `${variable}: ${humanify_token(value)}`
		debug_vars.appendChild(d)
		variable_track[variable] = d
	} else {
		variable_track[variable].innerText = `${variable}: ${humanify_token(value)}`
	}
	return ret
}

window.onload = e => {
	file_list = document.getElementById("file-list")
	code_area = document.getElementById("code-area")
	bottom_bar = document.getElementById("bottom-bar")
	scene_select = document.getElementById("scene-select")
	debug_vars = document.getElementById("variables")
	container = document.getElementById("right-pane-container")
	output = document.getElementById("output")
	code_area.value = ""
	code_area.disabled = true
	editor_contents = JSON.parse(localStorage.getItem("stage-debugger-sources")) || {}
	for (var k of Object.keys(editor_contents)) {
		new_scene(k)
	}
	var s_scene = localStorage.getItem("stage-debugger-scene") || "start"
	if (!scene_element[s_scene]) new_scene(s_scene)
	change_scene(s_scene)
	code_area.addEventListener('keydown', function(e) {
		if (e.key == "Tab") {
			e.preventDefault()
			var s = this.selectionStart;
			var e = this.selectionEnd;
			this.value = this.value.substring(0, s) + "\t" + this.value.substring(e);
			this.selectionStart = this.selectionEnd = s + 1;
		} else if (e.ctrlKey) {
			if (e.key >= 1 && e.key <= 4) {
				e.preventDefault()
				var n = 4 - e.key
				var b = bottom_bar.children[n]
				b?.click()
			}
		}
	})
	setInterval(() => {
		save()
	}, 1000 * 60) // every minute
}

function update_recents() {
	var s = selected_file.attributes.scene.value
	for (var i = 0; i < bottom_bar.children.length; i++) {
		var c = bottom_bar.children[i]
		if (c.attributes.scene.value == s) {
			bottom_bar.appendChild(c)
			return
		}
	}
	var l = bottom_bar.children.length
	if (l >= 5) bottom_bar.children[0].remove() // I HATE CHILDREN
	var e = document.createElement("span")
	e.innerText = s
	e.setAttribute("scene", s)
	e.onclick = () => change_scene(s)
	bottom_bar.appendChild(e) // NEVERMIND
}

function export_play() {
	var play_name = document.getElementById("play-name").value
	var play_author = document.getElementById("play-author").value
	if (!play_name || !play_author) {
		alert("Please fill in name and author in the info tab on the left pane.")
		return
	}
	save()
	var s_s = {}
	var data = ""
	Object.keys(editor_contents).forEach((k) => {
		s_s[k] = data.length
		data += editor_contents[k] + '\n.\n'
	})
	var out = `STAGE PLAY
STGE
Version:  ${stage_version}
EGTS
INFO
Name: ${play_name}
Author: ${play_author}
Date: ${new Date().toISOString().slice(0, 10)}
OFNI
SCNE
${Object.keys(s_s).map((k) => `${k}: ${s_s[k]}`).join("\n")}
ENCS
END
${data}`
	var element = document.createElement('a')
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(out))
	element.setAttribute('download', `${play_name}.play`)
	element.click()
}

function import_play() {
	var element = document.createElement('input')
	element.setAttribute('type', 'file')
	element.onchange = (e) => {
		var reader = new FileReader()
		reader.readAsText(e.target.files[0])
		reader.onload = readerEvent => {
			play = readerEvent.target.result
			var magic = play.substring(0, 10)
			var legacy = (magic != "STAGE PLAY")
			var lout = legacy
			if (!legacy) parse_play()
			else lout = parse_legacy_play()
			Object.keys(editor_contents).forEach(k => remove_file(k))
			var sts = {}
			Object.keys(sources).forEach(k => sts[k] = [])
			Object.keys(scenes).forEach(k => {
				new_scene(k)
				sts[scenes[k].source].push(k)
			})
			for (var k of Object.keys(sts)) {
				var sortable = []
				sts[k].forEach(k => sortable.push([k, scenes[k].index]))
				sortable.sort((a, b) => a[1] - b[1])
				var test = []
				for (var i = 0; i < sortable.length - 1; i++) {
					var start = sortable[i][1] + legacy // legacy has an extra newline at the start.
					var end = sortable[i + 1][1]
					if (legacy) end = sources[k].lastIndexOf('\n', end - 1)
					editor_contents[sortable[i][0]] = (sources[k].substring(start, end))
				}
				editor_contents[sortable[sortable.length - 1][0]] = (sources[k].substring(sortable[sortable.length - 1][1]))
			}
			if (lout) editor_contents["start"] = `!(scene-change "${sts["play"][0]}")`
		}
	}
	element.click()
}

function change_scene(name) {
	if (selected_file) {
		editor_contents[selected_file.attributes.scene.value] = code_area.value
		selected_file.classList.remove("file-active")
	} else {
		code_area.disabled = false
	}
	selected_file = scene_element[name]
	update_recents()
	selected_file.classList.add("file-active")
	code_area.value = editor_contents[name] ?? ""
}

function rename_file(s) {
	var n = prompt("new name:")
	if (!n) return
	for (var c of bottom_bar.children) {
		if (c.attributes.scene.value == s) {
			c.setAttribute("scene", n)
			c.innerText = n
		}
	}
	scene_element[n] = scene_element[s]
	scene_element[n].firstChild.textContent = n
	scene_element[n].setAttribute("scene", n)
	editor_contents[n] = editor_contents[s]
	delete editor_contents[s]
	delete scene_element[s]
}

function remove_file(s) {
	var e = scene_element[s]
	e.remove()
	for (var c of bottom_bar.children) {
		if (c.attributes.scene.value == s)
			c.remove()
	}
	delete editor_contents[s]
	if (selected_file == e) {
		selected_file = null
		if (Object.keys(editor_contents).length) {
			change_scene(Object.keys(editor_contents)[0]);
		} else {
			code_area.value = ""
			code_area.disabled = true
		}
	}
	delete scene_element[s]
}

function new_scene(s) {
	if (!s) return
	var e = document.createElement("div")
	e.classList.add("file")
	e.innerText = s
	e.setAttribute("scene", s)
	var r = document.createElement("span")
	r.classList.add("file-button")
	r.id = "remove-file"
	r.onclick = (e) => remove_file(e.target.parentNode.attributes.scene.value)
	r.innerText = '×'
	e.appendChild(r)
	r = document.createElement("span")
	r.classList.add("file-button")
	r.id = "rename-file"
	r.onclick = (e) => rename_file(e.target.parentNode.attributes.scene.value)
	r.innerText = 'R'
	e.appendChild(r)
	scene_element[s] = e
	file_list.appendChild(e)
}

function new_button() {
	var s = prompt("scene name")
	new_scene(s)
	change_scene(s)
}

function show_tab(event, id) {
	var e = event.target
	if (e.classList.contains("active")) return
	for (var c of e.parentElement.children)
		c.classList.remove("active")
	e.classList.add("active")
	var tab = document.getElementById(id)
	for (var c of tab.parentElement.children)
		c.style.display = "none"
	tab.style.display = ""
}

let resizing_side
let resizing_dir

document.onmouseup = (e) => {
	if (!resizing_side) return
	resizing_side = null
	// HACK
	document.getElementById("help-iframe").style.pointerEvents = "auto";
}

document.onmousemove = (e) => {
	if (!resizing_side) return
	var w
	switch (resizing_dir) {
		case -1:
			w = (e.clientX - 2); break
		case 1:
			w = document.body.clientWidth - (e.clientX + 4); break;
	}
	resizing_side.style.width = `${w}px`
}

document.onmousedown = (e) => {
	if (e.target.id != "divider") return
	switch (e.target.attributes.side.value) {
		case "left":
			resizing_dir = -1
			resizing_side = document.getElementById("left-pane")
			break
		case "right":
			resizing_dir = 1
			resizing_side = document.getElementById("right-pane")
			break
	}
	// HACK
	document.getElementById("help-iframe").style.pointerEvents = "none";
}

document.onclick = (e) => {
	if (e.target.className == "file") change_scene(e.target.attributes.scene.value)
}
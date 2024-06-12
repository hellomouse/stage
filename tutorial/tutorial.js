// Tutorial just injects itself into whatever, because it is fun.
let the_consumer_of_clicks = document.createElement("div")
the_consumer_of_clicks.style.position = "absolute"
the_consumer_of_clicks.style.width = "100vw"
the_consumer_of_clicks.style.height = "100vh"
the_consumer_of_clicks.style.display = "none"
the_consumer_of_clicks.onclick = (e) => {
	console.log("The consumer of clicks claims another victim")
}
the_consumer_of_clicks.toggle_consumption = (state) => {
	var d = state ?? the_consumer_of_clicks.style.display
	the_consumer_of_clicks.style.display = d ? "" : "none"
}

document.body.appendChild(the_consumer_of_clicks)
let highlight = document.createElement("div")
highlight.style.position = "absolute"
highlight.style.borderRadius = "4px"
highlight.style.backgroundColor = "#FFFF003F"
highlight.style.transition = "background-color ease 1s"
highlight.style.pointerEvents = "none"
highlight.highlit = null
highlight.highlight = (el) => {
	if (!el) {
		highlight.highlit = null
		highlight.style.display = "none"
		return
	}
	highlight.highlit = el
	highlight.style.display = ""
	highlight.style.width = el.offsetWidth + 'px'
	highlight.style.height = el.offsetHeight + 'px'
	highlight.style.top = el.offsetTop + 'px'
	highlight.style.left = el.offsetLeft + 'px'
}
document.body.appendChild(highlight)

let even = false
setInterval(() => {
	highlight.style.backgroundColor = even ? "#FFFF003F" : "#AFAF003F"
	even = !even
}, 600)

let textbox = document.createElement("div")
let textbox_text = document.createElement("div")
let textbox_continue = document.createElement("div")
textbox.style.position = "absolute"
textbox.style.backgroundColor = "#444"
textbox.style.border = "2px outset #FF0"
textbox.style.boxShadow = "#222 0px 0px 8px 4px"
textbox.style.textAlign = "center"
textbox.style.minWidth = "6em"
textbox.style.maxWidth = "33%"
textbox.style.whiteSpace = "wrap"
textbox.style.minHeight = "1.5em"
textbox.style.padding = "0.5em"
textbox.set_text = (s) => {
	textbox_text.innerHTML = s
	textbox.style.top = (window.innerHeight / 2 - textbox.offsetHeight / 2) + 'px'
	textbox.style.left = (window.innerWidth / 2 - textbox.offsetWidth / 2) + 'px'
}
textbox.set_text("Placeholder")
textbox_continue.style.marginTop = "0.5em";
textbox_continue.textContent = "Click here to continue."
textbox.click_continue = true
textbox.toggle_continue = (state) => {
	textbox.click_continue = state ?? !textbox.click_continue
	textbox_continue.style.display = textbox.click_continue ? "" : "none"
}
textbox.onclick = () => {
	if (!textbox.click_continue) return
	continue_tutorial()
}
textbox.appendChild(textbox_text)
textbox.appendChild(textbox_continue)
document.body.appendChild(textbox)
textbox.style.top = (window.innerHeight / 2 - textbox.offsetHeight / 2) + 'px'
textbox.style.left = (window.innerWidth / 2 - textbox.offsetWidth / 2) + 'px'
textbox.style.display = "none"

window.addEventListener("resize", (e) => {
	if (highlight.highlit) {
		var el = highlight.highlit
		highlight.style.width = el.offsetWidth + 'px'
		highlight.style.height = el.offsetHeight + 'px'
		highlight.style.top = el.offsetTop + 'px'
		highlight.style.left = el.offsetLeft + 'px'
	}
	textbox.style.top = (window.innerHeight / 2 - textbox.offsetHeight / 2) + 'px'
	textbox.style.left = (window.innerWidth / 2 - textbox.offsetWidth / 2) + 'px'
})

function begin_tutorial(category, name) {
	editor_autosave = false
	the_consumer_of_clicks.toggle_consumption(true)
	highlight.highlight(null)
	current_tutorial = {category: category, tutorial: name, index: 0};
	textbox.style.display = ""
	continue_tutorial()
}

function end_tutorial() {
	editor_autosave = true
	the_consumer_of_clicks.toggle_consumption(false)
	highlight.highlight(null)
	current_tutorial = null;
	textbox.style.display = "none"
	location.reload() // just in case, replace this with load save in future.
}

function continue_tutorial() {
	if (!current_tutorial) return
	var s = tutorials[current_tutorial.category][current_tutorial.tutorial][current_tutorial.index]
	if (s) s()
	else end_tutorial()
	current_tutorial.index++
}

function click_to_continue(el, h = false) {
	if (!current_tutorial) return
	el.addEventListener("click", () => {
		setTimeout(continue_tutorial, 1) // Non-zero delay to let Stage process.
	}, {once: true})
	if (h) highlight.highlight(el)
	else highlight.highlight(null)
	textbox.toggle_continue(false)
	the_consumer_of_clicks.toggle_consumption(false)
}

let tutorials = {
	"Getting Started": {
		"Editor": [
			   () => {
				fetch("tutorial/tut1.play", {cache: "no-cache"})
					.then(function(response) { return response.text() })
					.then(function(text) { import_play_from_text(text) })
				the_consumer_of_clicks.toggle_consumption(true)
				textbox.set_text("Let us start from basic editor usage.")
			}, () => {
				highlight.highlight(document.querySelector("#left-pane"))
				textbox.set_text("This is the left panel.")
			}, () => {
				highlight.highlight(document.querySelector("#left-pane > #top-bar"))
				textbox.set_text(`The left panel has three tabs: scenes, variables, and info.`)
			}, () => {
				document.querySelector("#left-pane > #top-bar > :nth-child(1)").click()
				highlight.highlight(document.querySelector("#file-list"))
				textbox.set_text("By default the 'Scenes' tab is selected, which shows all the scenes in your current play.")
			}, () => {
				highlight.highlight(document.querySelector("#middle-pane > #top-bar >:nth-child(1)"))
				textbox.set_text("You can add a new scene by pressing the 'New' button.")
			}, () => {
				var e =	document.querySelector("#left-pane > #top-bar > :nth-child(2)")
				e.click()
				highlight.highlight(e)
				textbox.set_text("The variables tab shows you the current variables and their value, it is currently empty.")
			}, () => {
				var e = document.querySelector("#left-pane > #top-bar > :nth-child(3)")
				e.click()
				highlight.highlight(e)
				textbox.set_text("The info tab is where you set your and your play's name when exporting.")
			}, () => {
				var e = document.querySelector("#left-pane > #top-bar > :nth-child(1)")
				e.click()
				highlight.highlight(e)
				textbox.set_text("Lets return to the scenes tab.")
			}, () => {
				var s = document.querySelector(".file[scene='start']")
				s.click()
				highlight.highlight(s)
				textbox.set_text("Stage starts plays from the 'start' scene, you should always have a start scene.")
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(1)"), true)
				textbox.set_text("Try creating a new scene by pressing the 'New' button, you may give the scene any name you want.")
			}, () => {
				textbox.toggle_continue(true)
				the_consumer_of_clicks.toggle_consumption(true)
				highlight.highlight(document.querySelector("#file-list>:last-child"))
				textbox.set_text("Your new scene is now in the scenes list and selected.")
			}, () => {
				highlight.highlight(document.querySelector("#code-area"))
				textbox.set_text("This is the editing area which shows the contents of the currently selected scene. As you just created this scene, it is empty.")
			}, () => {
				highlight.highlight(document.querySelector("#middle-pane > #bottom-bar"))
				textbox.set_text("Below the editing area you can see five most recently viewed scenes, these allow you to quickly switch to a previously viewed scene.")
			}, () => {
				the_consumer_of_clicks.toggle_consumption(false)
				highlight.highlight(null)
				textbox.toggle_continue(false)
				textbox.set_text("Try typing the character ']' and anything you want after it in the editing area, the tutorial will continue once you have stopped typing.")
				var tId = null
				var t = (e) => {
					console.log(e)
					if (tId) clearTimeout(tId)
					tId = setTimeout(() => {
						continue_tutorial()
						document.querySelector("#code-area").removeEventListener("keydown", t)
					}, 2000)
				}
				document.querySelector("#code-area").addEventListener("keydown", t)
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(2)"), true)
				textbox.set_text("Now lets see what happens when you run this scene, click the 'Run' button.")
			}, () => {
				document.querySelector("#right-pane > #top-bar >:nth-child(1)").click()
				textbox.toggle_continue(true)
				the_consumer_of_clicks.toggle_consumption(true)
				highlight.highlight(document.querySelector("#output"))
				textbox.set_text("You should now be able to see what you typed after the ']' character in the output tab.")
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(3)"), true)
				textbox.set_text("Now try clicking the 'Start' button.")
			}, () => {
				textbox.toggle_continue(true)
				the_consumer_of_clicks.toggle_consumption(true)
				highlight.highlight(document.querySelector("#output"))
				textbox.set_text("The 'Start' button runs the play starting from the 'start' scene.")
			}, () => {
				click_to_continue(document.querySelector(".file[scene='start']"), true)
				textbox.set_text("Switch to the start scene now.")
			}, () => {
				textbox.toggle_continue(true)
				the_consumer_of_clicks.toggle_consumption(true)
				highlight.highlight(document.querySelector("#code-area"))
				textbox.set_text("As you can see, the start scene contains the text what appeared in the output tab.")
			}, () => {
				highlight.highlight(document.querySelector("#middle-pane > #top-bar >:nth-child(4)"))
				textbox.set_text("The 'Save' button saves the play in your browser's memory, the editor does an automatic save every minute however it is disabled during tutorials.")
			}, () => {
				highlight.highlight(document.querySelector("#middle-pane > #top-bar >:nth-child(5)"))
				textbox.set_text("The 'Export' button exports the play as a .play file.")
			}, () => {
				highlight.highlight(document.querySelector("#middle-pane > #top-bar >:nth-child(6)"))
				textbox.set_text("The 'Import' button allows you to import a .play file for editing.")
			}, () => {
				var n = document.querySelector("#right-pane > #top-bar >:nth-child(2)")
				highlight.highlight(n)
				n.click()
				textbox.set_text("The 'Help' tab on the right panel shows a reference for Stage, you should check it out if you need information about some character or function.")
			}, () => {
				highlight.highlight(null)
				the_consumer_of_clicks.toggle_consumption(false)
				textbox.set_text("That wraps up the editor tutorial. You can try the other tutorials to learn about how to use Stage, or you could try to figure it yourself with the help of the reference.")
			}
		],
		"Text Output": [
			   () => {
				fetch("tutorial/tut1.play", {cache: "no-cache"})
					.then(function(response) { return response.text() })
					.then(function(text) { import_play_from_text(text) })
				the_consumer_of_clicks.toggle_consumption(true)
				textbox.set_text("The text output character ']' allows you to show text in the output.")
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(2)"), true)
				textbox.set_text("Currently the scene is set to output 'Hello, World!', press 'Run' to see the output.")
			}, () => {
				document.querySelector("#right-pane > #top-bar >:nth-child(1)").click()
				textbox.toggle_continue(true)
				highlight.highlight(document.querySelector("#output"))
				the_consumer_of_clicks.toggle_consumption(true)
				textbox.set_text("As you can see after running the scene, it output 'Hello, World!'")
			}, () => {
				var o = document.querySelector("#middle-pane > #top-bar >:nth-child(2)")
				var check_func = () => {
					var text = output.firstChild.textContent.toLowerCase()
					if (text.includes("tutorial")) {
						o.removeEventListener("click", check_func)
						continue_tutorial()
					} else if (text.includes("world")) {
						textbox.set_text("Change the existing ']' line to output 'Hello, Tutorial!'")
					} else if (!text) {
						textbox.set_text("You need to keep the ']' character, it is what instructs Stage to output text.")
					}
				}
				o.addEventListener("click", check_func)
				highlight.highlight(null)
				textbox.toggle_continue(false)
				the_consumer_of_clicks.toggle_consumption(false)
				textbox.set_text("Now, try changing it to say 'Hello, Tutorial!' and run it. The tutorial will continue afterwards.")
			}, () => {
				var o = document.querySelector("#middle-pane > #top-bar >:nth-child(2)")
				var check_func = () => {
					var c = output.children.length
					if (c >= 2) {
						o.removeEventListener("click", check_func)
						continue_tutorial()
					} else {
						textbox.set_text("Try adding a line starting with a ']' character.")
					}
				}
				o.addEventListener("click", check_func)
				textbox.set_text("Great, now try to output a second line of text. It does not matter what you type.")
			}, () => {
				textbox.toggle_continue(true)
				textbox.set_text("That is it, now you should understand how text output works. This is the end of this tutorial.")
			},
		],
		"Actions & Subscenes": [
			   () => {
				fetch("tutorial/tut2.play", {cache: "no-cache"})
					.then(function(response) { return response.text() })
					.then(function(text) { import_play_from_text(text) })
				the_consumer_of_clicks.toggle_consumption(true)
				textbox.set_text("The text output character '>' allows you to create 'actions' which can be clicked.")
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(2)"), true)
				textbox.set_text("Currently the scene is set to output 'Action was clicked!' after the action is clicked, press 'Run' to see the output.")
			}, () => {
				document.querySelector("#right-pane > #top-bar >:nth-child(1)").click()
				click_to_continue(document.querySelector("#output > .action"), true)
				textbox.set_text("Click the action to continue.")
			}, () => {
				textbox.toggle_continue(true)
				highlight.highlight(document.querySelector("#output>:last-child"))
				textbox.set_text("As you can see, after clicking the action the next line is shown.")
			}, () => {
				code_area.value = "]Action tutorial.\n>Action 1.\n]First.\n>Action 2.\n]Second."
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(2)"), true)
				textbox.set_text("The scene was changed, what do you think will happen when you run it? Press 'Run' to continue.")
			}, () => {
				the_consumer_of_clicks.toggle_consumption(false)
				highlight.highlight(null)
				textbox.toggle_continue(true)
				textbox.set_text("Try clicking the actions now and continue when you are ready.")
			}, () => {
				the_consumer_of_clicks.toggle_consumption(true)
				textbox.set_text("This type of action is called a 'blocking' action, it prevents the play from proceeding until it is clicked. Now, what if you want multiple actions?")
			}, () => {
				code_area.value = "{\n\t]This is a subscene\n}"
				textbox.set_text("This is where subscenes come in, subscenes are parts of a scene surrounded by the '{' and '}' characters. Do note that subscenes themselves do nothing and are skipped when running.")
			}, () => {
				code_area.value = "{\n\t]Action 1\n}\n>Action 1\n{\n\t]Action 2\n}\n>Action 2"
				textbox.set_text("However when an '>' action character is preceded by a subscene it becomes a 'non-blocking' action.")
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(2)"), true)
				textbox.set_text("Press 'Run' to see what happens.")
			}, () => {
				textbox.toggle_continue(true)
				highlight.highlight(null)
				textbox.set_text("Try clicking the actions, and you may also press 'Run' again to reset it.")
			}, () => {
				code_area.value = "{]Action 1\n}>Action 1\n{]Action 2\n}>Action 2"
				textbox.set_text("You may also write these more compactly like this, this is a completely up to preference and there is no functional difference. Only characters that take text, such as ']' and '>' that you have seen, require the line to end. For tutorials and examples a line per scene character is preferred, as it is more readable, this is just an example for how you can write scenes.")
			}, () => {
				code_area.value = "{\n\t{\n\t\t]Sub-subscene\n\t}\n\t>Action 2\n}\n>Action 1"
				textbox.set_text("You may also have subscenes within subscenes.")
			}, () => {
				click_to_continue(document.querySelector("#middle-pane > #top-bar >:nth-child(2)"), true)
				textbox.set_text("Press 'Run' to see what happens.")
			}, () => {
				textbox.toggle_continue(true)
				highlight.highlight(null)
				textbox.set_text("Try clicking the actions, and you may also press 'Run' again to reset it.")
			}, () => {
				textbox.set_text("End of tutorial.")
			}
		],
	}
}
let current_tutorial = null

var tutorial_tab = document.getElementById("tutorial")
for (var cat of Object.keys(tutorials)) {
	var el = document.createElement("h4")
	el.textContent = cat
	tutorial_tab.appendChild(el)
	el = document.createElement("ul")
	for (var tut of Object.keys(tutorials[cat])) {
		var li = document.createElement("li")
		var a = document.createElement("a")
		a.textContent = tut
		a.href = `javascript:begin_tutorial("${cat}", "${tut}")`
		li.appendChild(a)
		el.appendChild(li)
	}
	tutorial_tab.appendChild(el)
}
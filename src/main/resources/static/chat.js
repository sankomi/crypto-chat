import Socket from "/socket.js";

const chatLog = document.getElementById("chat-log");
function write({text, colour = null}) {
	let textNode = document.createTextNode(text);
	let div = document.createElement("div");
	if (colour) {
		div.style.color = colour;
	}
	div.appendChild(textNode);
	chatLog.insertBefore(div, chatLog.firstChild);
	chatLog.scroll(0, chatLog.scrollHeight);
}

let params = new URLSearchParams(window.location.search);
let username = params.get("username");
let socket = new Socket(username);
let user = null;
socket.addEventListener("text", event => write(event.detail));
socket.addEventListener("close", event => window.location = "/");
socket.addEventListener("usernames", event => updateUsernames(event.detail));

const chatForm = document.getElementById("chat-form");
const chatTo = document.getElementById("chat-to");
const chatTextInput = document.getElementById("chat-text");
chatTextInput.focus();
chatForm.addEventListener("submit", async event => {
	event.preventDefault();

	let username = user;
	let text = chatTextInput.value;
	chatTextInput.focus();
	if (!text || text.trim().length === 0) return;
	chatTextInput.value = "";

	await socket.send(text, username);
});

const usernameList = document.getElementById("username-list");
function updateUsernames({usernames}) {
	if (!usernames.includes(user)) {
		user = null;
		chatTo.textContent = "";
	}

	usernameList.innerHTML = "";
	usernames.forEach(username => {
		let li = document.createElement("li");
		let button = document.createElement("button");
		button.textContent = username;
		button.addEventListener("click", event => {
			chatTextInput.focus();

			if (!socket.requestPublicKey(username)) return;
			if (user === username) {
				user = null;
				chatTo.textContent = "";
				write({text: "using self public key!", colour: "teal"});
			} else {
				user = username;
				chatTo.textContent = username;
				write({text: "using " + username + "'s public key!", colour: "teal"});
			}

			document.querySelectorAll("#username-list button").forEach(button => {
				if (user !== null && button.textContent === user) {
					button.classList.add("selected");
				} else {
					button.classList.remove("selected");
				}
			});
		});
		li.appendChild(button);
		usernameList.appendChild(li);
	});
}

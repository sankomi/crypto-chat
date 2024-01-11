import Socket from "/socket.js";

function write({text, colour = null}) {
	let textNode = document.createTextNode(text + " ");
	let div = document.createElement("div");
	if (colour) {
		div.style.color = colour;
	}
	div.appendChild(textNode);
	document.body.appendChild(div);
	window.scroll(0, document.body.scrollHeight);
}

let params = new URLSearchParams(window.location.search);
let username = params.get("username");
let socket = new Socket(username);
socket.addEventListener("text", event => write(event.detail));
socket.addEventListener("close", event => window.location = "/");

const keyForm = document.getElementById("key-form");
const keyUsernameInput = document.getElementById("key-username");
keyForm.addEventListener("submit", async event => {
	event.preventDefault();

	let username = keyUsernameInput.value;
	if (!username || username.trim().length === 0) return;

	await socket.requestPublicKey(username);
});

const chatForm = document.getElementById("chat-form");
const chatUsernameInput = document.getElementById("chat-username");
const chatTextInput = document.getElementById("chat-text");
chatForm.addEventListener("submit", async event => {
	event.preventDefault();

	let username = chatUsernameInput.value;
	let text = chatTextInput.value;
	if (!text || text.trim().length === 0) return;
	chatTextInput.value = "";

	await socket.send(text, username);
});
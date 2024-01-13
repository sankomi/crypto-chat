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
socket.addEventListener("publickeys", event => updatePublicKeys(event.detail));
socket.addEventListener("usernames", event => updateUsernames(event.detail));

const chatForm = document.getElementById("chat-form");
const chatUsernameSelect = document.getElementById("chat-username");
const chatTextInput = document.getElementById("chat-text");
chatForm.addEventListener("submit", async event => {
	event.preventDefault();

	let username = chatUsernameSelect.value;
	let text = chatTextInput.value;
	if (!text || text.trim().length === 0) return;
	chatTextInput.value = "";

	await socket.send(text, username);
});

function updatePublicKeys({usernames}) {
	let current = chatUsernameSelect.value;

	chatUsernameSelect.innerHTML = "";
	let option = document.createElement("option");
	chatUsernameSelect.appendChild(option);
	usernames.forEach(username => {
		let option = document.createElement("option");
		option.value = username;
		option.textContent = username;
		chatUsernameSelect.appendChild(option);
	});

	chatUsernameSelect.value = current;
}

const usernameList = document.getElementById("username-list");
function updateUsernames({usernames}) {
	usernameList.innerHTML = "";
	usernames.forEach(username => {
		let li = document.createElement("li");
		let button = document.createElement("button");
		button.textContent = username;
		button.addEventListener("click", event => socket.requestPublicKey(username));
		li.appendChild(button);
		usernameList.appendChild(li);
	});
}

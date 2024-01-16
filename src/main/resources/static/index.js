const connectForm = document.getElementById("connect-form");
const usernameInput = document.getElementById("username");
usernameInput.focus();

const reasonDiv = document.getElementById("reason");
let params = new URLSearchParams(window.location.search);
let reason = decodeURI(params.get("reason") || "");
if (reason) {
	reasonDiv.textContent = reason;
}

let connecting = false;

connectForm.addEventListener("submit", onConnect => {
	event.preventDefault();

	if (connecting) return;

	let username = usernameInput.value;
	if (!username || username.trim().length === 0) return;

	connecting = true;
	window.location = `/chat.html?username=${username}`;
});

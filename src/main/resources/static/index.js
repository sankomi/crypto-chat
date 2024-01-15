const connectForm = document.getElementById("connect-form");
const usernameInput = document.getElementById("username");
usernameInput.focus();

let connecting = false;

connectForm.addEventListener("submit", onConnect => {
	event.preventDefault();

	if (connecting) return;

	let username = usernameInput.value;
	if (!username || username.trim().length === 0) return;

	connecting = true;
	window.location = `/chat.html?username=${username}`;
});

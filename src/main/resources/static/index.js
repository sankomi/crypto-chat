const connectForm = document.getElementById("connect-form");
const usernameInput = document.getElementById("username");

let connecting = false;

connectForm.addEventListener("submit", onConnect => {
	event.preventDefault();

	if (connecting) return;
	connecting = true;

	let username = usernameInput.value;
	if (!username || username.trim().length === 0) return;

	window.location = `/chat.html?username=${username}`;
});
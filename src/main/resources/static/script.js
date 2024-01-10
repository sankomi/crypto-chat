const SEND_PUBLIC_KEY = "sendpublickey";
const GET_PUBLIC_KEY = "getpublickey";
const MESSAGE = "message";

function write(text, colour = null) {
	let textNode = document.createTextNode(text + " ");
	let div = document.createElement("div");
	if (colour) {
		div.style.color = colour;
	}
	div.appendChild(textNode);
	document.body.appendChild(div);
	window.scroll(0, document.body.scrollHeight);
}

class Socket {

	constructor(username, privateKey, publicKey) {
		this.username = username;
		this.privateKey = privateKey;
		this.publicKey = publicKey;
		this.publicKeys = new Map();

		this.socket = new WebSocket(location.origin.replace(/^http/, "ws") + "/ws");
		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onclose = this.onClose;
		this.socket.onmessage = this.onMessage.bind(this);
		this.socket.onerror = this.onError;
	}

	async requestPublicKey(username) {
		let data = JSON.stringify({
			type: GET_PUBLIC_KEY,
			username,
		});
		this.socket.send(data);
	}

	async send(text, username) {
		if (!this.socket || this.socket.readyState !== 1) return;
		if (username && !this.publicKeys.has(username)) return;

		let publicKey = this.publicKeys.get(username) || this.publicKey;

		let {aesKey, string} = await generateAesKey();
		let {cipher, iv}  = await encryptAes(text, string);
		let key = await encryptRsa(string, publicKey);
		let data = JSON.stringify({
			type: MESSAGE,
			username: this.username,
			key,
			iv,
			text: cipher,
		});

		this.socket.send(data);
		write(this.username + ": " + text);
	}

	close() {
		if (!this.socket || this.socket.readyState !== 1) return;

		this.socket.close();
	}

	onOpen(event) {
		this.socket.send(JSON.stringify({
			type: SEND_PUBLIC_KEY,
			username: this.username,
			publicKey: this.publicKey,
		}));
		write("opened!", "royalblue");
		write("username is " + this.username, "royalblue");
	}

	onClose(event) {
		write("closed!", "royalblue");
	}

	async onMessage(event) {
		let json;
		try {
			json = JSON.parse(event.data);
		} catch (err) {
			if (err instanceof SyntaxError) {
				console.error("json parse fail");
				write("[json parse fail]", "#f00");
				return;
			}
		}

		switch (json.type) {
			case MESSAGE:
				try {
					let key = await decryptRsa(json.key, this.privateKey);
					let text = await decryptAes(json.text, key, json.iv);

					write(json.username + ": " + text);
				} catch (err) {
					if (err instanceof DOMException) {
						write(json.username + ": " + json.text, "#ccc");
					}
				}
				break;
			case GET_PUBLIC_KEY:
				this.publicKeys.set(json.username, json.publicKey);

				write("received " + json.username + "'s public key", "orangered");
				break;
		}
	}

	onError(event) {
		write("error!");
		console.error(event);
	}

}

const keyForm = document.createElement("form");
const keyUsernameInput = document.createElement("input");
keyUsernameInput.placeholder = "username";
const getKeyButton = document.createElement("button");
getKeyButton.textContent = "request public key";
document.body.appendChild(keyForm);
keyForm.appendChild(keyUsernameInput);
keyForm.appendChild(getKeyButton);

const form = document.createElement("form");
const usernameInput = document.createElement("input");
usernameInput.placeholder = "username";
const textInput = document.createElement("input");
textInput.placeholder = "message";
const sendButton = document.createElement("button");
sendButton.textContent = "send";
document.body.appendChild(form);
form.appendChild(usernameInput);
form.appendChild(textInput);
form.appendChild(sendButton);

(async () => {
	let texts = "lorem ipsum dolor sit amet".split(" ");
	let {privateKey, publicKey} = await generateRsaKeys();
	let username = Array.from(crypto.getRandomValues(new Uint8Array(2)), v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
	let socket = new Socket(username, privateKey, publicKey);

	keyForm.addEventListener("submit", async event => {
		event.preventDefault();
		let username = keyUsernameInput.value;
		if (!username || username.trim().length === 0) return;
		keyUsernameInput.value = "";
		await socket.requestPublicKey(username);
	});

	form.addEventListener("submit", async event => {
		event.preventDefault();
		let username = usernameInput.value;
		let text = textInput.value;
		if (!text || text.trim().length === 0) return;
		textInput.value = "";
		await socket.send(text, username);
	});
})();

async function generateRsaKeys() {
	let algorithm ={
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};
	let keyPair = await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]);

	let privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
		.then(key => [
			"-----BEGIN PRIVATE KEY-----",
			btoa(String.fromCharCode(...new Uint8Array(key))),
			"-----END PRIVATE KEY-----",
		].join("\n"));
	let publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey)
		.then(key => [
			"-----BEGIN PUBLIC KEY-----",
			btoa(String.fromCharCode(...new Uint8Array(key))),
			"-----END PUBLIC KEY-----",
		].join("\n"));

	return {privateKey, publicKey};
}

function getRsaKeyArrayBuffer(key) {
	let lines = key.split("\n");
	let base64 = "";
	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();
		if (line.length === 0) continue;
		if (line.match(/-----BEGIN (PRIVATE|PUBLIC) KEY-----/)) continue;
		if (line.match(/-----END (PRIVATE|PUBLIC) KEY-----/)) continue;
		base64 += line;
	}
	let string = atob(base64);
	let bytes = new Uint8Array(string.length);
	for (let i = 0; i < string.length; i++) {
		bytes[i] = string.charCodeAt(i);
	}
	return bytes.buffer;
}

async function encryptRsa(plain, key) {
	let algorithm ={
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};
	let arrayBuffer = getRsaKeyArrayBuffer(key);
	let importedKey = await crypto.subtle.importKey("spki", arrayBuffer, algorithm, true, ["encrypt"]);
	let encoded = new TextEncoder().encode(plain).buffer;
	let encrypted = await crypto.subtle.encrypt({name: "RSA-OAEP"}, importedKey, encoded);
	return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

async function decryptRsa(cipher, key) {
	let algorithm ={
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};
	let arrayBuffer = getRsaKeyArrayBuffer(key);
	let importedKey = await crypto.subtle.importKey("pkcs8", arrayBuffer, algorithm, true, ["decrypt"]);
	let string = atob(cipher);
	let bytes = new Uint8Array(string.length);
	for (let i = 0; i < string.length; i++) {
		bytes[i] = string.charCodeAt(i);
	}
	let decrypted = await crypto.subtle.decrypt({name: "RSA-OAEP"}, importedKey, bytes.buffer);
	return String.fromCharCode(...new Uint8Array(decrypted));
}

// generateRsaKeys()
// 	.then(async ({privateKey, publicKey}) => {
// 		let text = "dragons!";
// 		let cipher = await encryptRsa(text, publicKey);
// 		let decipher = await decryptRsa(cipher, privateKey);
//
// 		console.log(text, cipher, decipher);
// 	})
// 	.catch(console.error);


async function generateAesKey() {
	let algorithm = {
		name: "AES-GCM",
		length: 128,
	};
	let key = await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]);

	let string = await crypto.subtle.exportKey("raw", key)
		.then(key => btoa(String.fromCharCode(...new Uint8Array(key))));

	return {key, string};
}

function getAesKeyArrayBuffer(key) {
	let string = atob(key);
	let bytes = new Uint8Array(string.length);
	for (let i = 0; i < string.length; i++) {
		bytes[i] = string.charCodeAt(i);
	}
	return bytes.buffer;
}

async function encryptAes(plain, key) {
	let algorithm = {name: "AES-GCM"};
	let arrayBuffer = getAesKeyArrayBuffer(key);
	let importedKey = await crypto.subtle.importKey("raw", arrayBuffer, algorithm, true, ["encrypt"]);
	let encoded = new TextEncoder().encode(plain).buffer;
	let iv = crypto.getRandomValues(new Uint8Array(12));
	let encrypted = await crypto.subtle.encrypt({...algorithm, iv}, importedKey, encoded);
	let cipher = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
	return {cipher, iv: btoa(String.fromCharCode(...iv))};
}

async function decryptAes(cipher, key, iv) {
	let algorithm = {name: "AES-GCM"};
	let arrayBuffer = getAesKeyArrayBuffer(key);
	let importedKey = await crypto.subtle.importKey("raw", arrayBuffer, algorithm, true, ["decrypt"]);
	let ivString = atob(iv);
	let ivBytes = new Uint8Array(ivString.length);
	for (let i = 0; i < ivString.length; i++) {
		ivBytes[i] = ivString.charCodeAt(i);
	}
	let string = atob(cipher);
	let bytes = new Uint8Array(string.length);
	for (let i = 0; i < string.length; i++) {
		bytes[i] = string.charCodeAt(i);
	}
	let decrypted = await crypto.subtle.decrypt({...algorithm, iv: ivBytes.buffer}, importedKey, bytes.buffer);
	return String.fromCharCode(...new Uint8Array(decrypted));
}

// generateAesKey()
// 	.then(async ({key, string}) => {
// 		let text = "dragons!";
// 		let {cipher, iv} = await encryptAes(text, string);
// 		let decipher = await decryptAes(cipher, string, iv);
//
// 		console.log(text, iv, cipher, decipher);
// 	});

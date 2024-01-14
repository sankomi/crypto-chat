import crypto from "/crypto.js";

const USERNAMES = "usernames";
const CONNECT = "connect";
const CLOSE = "close";
const SEND_PUBLIC_KEY = "sendpublickey";
const GET_PUBLIC_KEY = "getpublickey";
const MESSAGE = "message";


export default class Socket extends EventTarget {

	constructor(username) {
		super();
		this.username = username;
		this.usernames = [];
		this.publicKeys = new Map();
		this.generateKeys();
	}

	async generateKeys() {
		let {privateKey, publicKey} = await crypto.generateRsaKeys();
		this.privateKey = privateKey;
		this.publicKey = publicKey;

		this.connect();
	}

	connect() {
		this.socket = new WebSocket(location.origin.replace(/^http/, "ws") + "/ws");
		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onclose = this.onClose.bind(this);
		this.socket.onmessage = this.onMessage.bind(this);
		this.socket.onerror = this.onError.bind(this);
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
		let {key: aesKey} = await crypto.generateAesKey();
		let {cipher, iv}  = await crypto.encryptAes(text, aesKey);
		let {cipher: key} = await crypto.encryptRsa(aesKey, publicKey);
		let data = JSON.stringify({
			type: MESSAGE,
			username: this.username,
			key,
			iv,
			text: cipher,
		});

		this.socket.send(data);
		this.write(this.username + ": " + text);
	}

	write(text, colour) {
		this.dispatchEvent(new CustomEvent("text", {detail: {text, colour}}));
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
		this.write("opened!", "royalblue");
	}

	onClose(event) {
		this.write("closed!", "royalblue");
		this.dispatchEvent(new CustomEvent("close" ));
	}

	async onMessage(event) {
		let json;
		try {
			json = JSON.parse(event.data);
		} catch (err) {
			if (err instanceof SyntaxError) {
				console.error("json parse fail");
				this.write("[json parse fail]", "#f00");
				return;
			}
		}

		switch (json.type) {
			case MESSAGE:
				try {
					let key = await crypto.decryptRsa(json.key, this.privateKey);
					let text = await crypto.decryptAes(json.text, key, json.iv);

					this.write(json.username + ": " + text);
				} catch (err) {
					if (err instanceof DOMException) {
						this.write(json.username + ": " + json.text, "#ccc");
					}
				}
				break;
			case GET_PUBLIC_KEY:
				this.publicKeys.set(json.username, json.publicKey);

				this.dispatchEvent(new CustomEvent("publickeys", {detail: {
					usernames: Array.from(this.publicKeys.keys()),
				}}));
				this.write("received " + json.username + "'s public key", "orangered");
				break;
			case USERNAMES:
				this.usernames = json.usernames;
				this.dispatchEvent(new CustomEvent("usernames", {detail: {usernames: this.usernames}}));
				break;
			case CONNECT:
				this.usernames.push(json.username);
				this.dispatchEvent(new CustomEvent("usernames", {detail: {usernames: this.usernames}}));
				break;
			case CLOSE:
				let index = this.usernames.indexOf(json.username);
				if (~index) {
					this.usernames.splice(index, 1);
				}
				this.dispatchEvent(new CustomEvent("usernames", {detail: {usernames: this.usernames}}));
				break;
		}
	}

	onError(event) {
		this.write("error!");
		console.error(event);
	}

}

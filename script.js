async function generateKeys() {
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

function getKeyArrayBuffer(key) {
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

async function encrypt(plain, key) {
	let algorithm ={
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};
	let arrayBuffer = getKeyArrayBuffer(key);
	let importedKey = await crypto.subtle.importKey("spki", arrayBuffer, algorithm, true, ["encrypt"]);
	let encoded = new TextEncoder().encode(plain).buffer;
	let encrypted = await crypto.subtle.encrypt({name: "RSA-OAEP"}, importedKey, encoded);
	return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

async function decrypt(cipher, key) {
	let algorithm ={
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};
	let arrayBuffer = getKeyArrayBuffer(key);
	let importedKey = await crypto.subtle.importKey("pkcs8", arrayBuffer, algorithm, true, ["decrypt"]);
	let string = atob(cipher);
	let bytes = new Uint8Array(string.length);
	for (let i = 0; i < string.length; i++) {
		bytes[i] = string.charCodeAt(i);
	}
	let decrypted = await crypto.subtle.decrypt({name: "RSA-OAEP"}, importedKey, bytes.buffer);
	return String.fromCharCode(...new Uint8Array(decrypted));
}

generateKeys()
	.then(async ({privateKey, publicKey}) => {
		let text = "dragons!";
		let cipher = await encrypt(text, publicKey);
		let decipher = await decrypt(cipher, privateKey);

		console.log(text, cipher, decipher);
	})
	.catch(console.error);

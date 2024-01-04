(async () => {

	let subtle = crypto.subtle;
	let algorithm ={
		name: "RSA-OAEP",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};

	//generate keys
	let keyPair = await subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]);
	let privateKey = await subtle.exportKey("pkcs8", keyPair.privateKey)
	let privateKeyString = [
		"-----BEGIN PRIVATE KEY-----",
		btoa(String.fromCharCode(...new Uint8Array(privateKey))),
		"-----END PRIVATE KEY-----",
	].join("\n");
	let publicKey = await subtle.exportKey("spki", keyPair.publicKey)
	let publicKeyString = [
		"-----BEGIN PUBLIC KEY-----",
		btoa(String.fromCharCode(...new Uint8Array(publicKey))),
		"-----END PUBLIC KEY-----",
	].join("\n");

	//key arraybuffers
	let privateKeyArrayBuffer = (() => {
		let lines = privateKeyString.split("\n");
		let base64 = "";
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (line.length === 0) continue;
			if (line.includes("-----BEGIN PRIVATE KEY-----")) continue;
			if (line.includes("-----END PRIVATE KEY-----")) continue;
			base64 += line;
		}
		let string = atob(base64);
		let bytes = new Uint8Array(string.length);
		for (let i = 0; i < string.length; i++) {
			bytes[i] = string.charCodeAt(i);
		}
		return bytes.buffer;
	})();
	let publicKeyArrayBuffer = (() => {
		let lines = publicKeyString.split("\n");
		let base64 = "";
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (line.length === 0) continue;
			if (line.includes("-----BEGIN PUBLIC KEY-----")) continue;
			if (line.includes("-----END PUBLIC KEY-----")) continue;
			base64 += line;
		}
		let string = atob(base64);
		let bytes = new Uint8Array(string.length);
		for (let i = 0; i < string.length; i++) {
			bytes[i] = string.charCodeAt(i);
		}
		return bytes.buffer;
	})();

	//encrypt text
	let string = "dragons!";
	let importedPublicKey = await subtle.importKey("spki", publicKeyArrayBuffer, algorithm, true, ["encrypt"]);
	let encoded = new TextEncoder().encode(string).buffer;
	let encrypted = await subtle.encrypt({name: "RSA-OAEP"}, importedPublicKey, encoded);
	let encryptedString = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

	//decrypt text
	let importedPrivateKey = await subtle.importKey("pkcs8", privateKeyArrayBuffer, algorithm, true, ["decrypt"]);
	let encryptedArrayBuffer = (() => {
		let string = atob(encryptedString);
		let bytes = new Uint8Array(string.length);
		for (let i = 0; i < string.length; i++) {
			bytes[i] = string.charCodeAt(i);
		}
		return bytes.buffer;
	})();
	let decrypted = await subtle.decrypt({name: "RSA-OAEP"}, importedPrivateKey, encryptedArrayBuffer);
	let decryptedString = String.fromCharCode(...new Uint8Array(decrypted));

	//print
	console.log(`private key: ${privateKeyString}`);
	console.log(`public key: ${publicKeyString}`);
	console.log(`text: ${string}`);
	console.log(`encrypted: ${encryptedString}`);
	console.log(`decrypted: ${decryptedString}`);

})();

package sanko.cryptochat.socket;

import java.util.*; //Map, List
import java.util.stream.Collectors;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*; //CloseStatus, TextMessage, WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.boot.json.*; //JsonParser, JsonParserFactory
import org.springframework.web.socket.CloseStatus;

@Component
public class SocketHandler extends TextWebSocketHandler {

	private static final ConcurrentHashMap<String, WebSocketSession> sockets = new ConcurrentHashMap<>();
	private static final ConcurrentHashMap<String, String> usernames = new ConcurrentHashMap<>();
	private static final ConcurrentHashMap<String, String> publicKeys = new ConcurrentHashMap<>();

	private static final String PING = "ping";
	private static final String USERNAMES = "usernames";
	private static final String CONNECT = "connect";
	private static final String CLOSE = "close";
	private static final String SEND_PUBLIC_KEY = "sendpublickey";
	private static final String GET_PUBLIC_KEY = "getpublickey";
	private static final String MESSAGE = "message";

	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		sockets.put(session.getId(), session);
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		String sessionId = session.getId();
		String username = usernames.get(sessionId);

		if (username != null) {
			synchronized(sockets) {
				sockets.entrySet().forEach(socket -> {
					if (socket.getValue().getId().equals(sessionId)) return;

					String closeString = String.format(
						"{'type': '%s', 'username': '%s'}".replaceAll("'", "\""),
						CLOSE, username
					);

					try {
						socket.getValue().sendMessage(new TextMessage(closeString));
					} catch (IOException e) {
						e.printStackTrace();
					}
				});
			}
		}

		sockets.remove(sessionId);
		usernames.remove(sessionId);
		publicKeys.remove(sessionId);
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		String sessionId = session.getId();
		JsonParser parser = JsonParserFactory.getJsonParser();
		Map<String, Object> json = parser.parseMap(message.getPayload());

		String username = (String) json.get("username");

		switch ((String) json.get("type")) {
			case PING:
				String pingString = String.format(
					"{'type': '%s'}".replaceAll("'", "\""),
					PING
				);

				try {
					session.sendMessage(new TextMessage(pingString));
				} catch (IOException e) {
					e.printStackTrace();
				}
				break;
			case SEND_PUBLIC_KEY:
				String duplicateUsername = usernames.entrySet()
					.stream()
					.map(u -> u.getValue())
					.filter(u -> u.equals(username))
					.findAny()
					.orElse(null);

				if (duplicateUsername != null) {
					CloseStatus status = CloseStatus.NORMAL.withReason("duplicate username");
					session.close(status);
				} else {
					usernames.put(sessionId, username);
					publicKeys.put(sessionId, (String) json.get("publicKey"));

					synchronized(sockets) {
						sockets.entrySet().forEach(socket -> {
							if (socket.getValue().getId().equals(sessionId)) return;

							String connectString = String.format(
								"{'type': '%s', 'username': '%s'}".replaceAll("'", "\""),
								CONNECT, username
							);

							try {
								socket.getValue().sendMessage(new TextMessage(connectString));
							} catch (IOException e) {
								e.printStackTrace();
							}
						});
					}

					List<String> names = usernames.entrySet()
						.stream()
						.filter(e -> !e.getKey().equals(sessionId))
						.map(e -> String.format("\"%s\"", e.getValue()))
						.collect(Collectors.toList());
					String usernameString = String.format(
						"{'type': '%s', 'usernames': [%s]}".replaceAll("'", "\""),
						USERNAMES, String.join(",", names)
					);
					TextMessage usernameMessage = new TextMessage(usernameString);
					session.sendMessage(usernameMessage);
				}
				break;
			case GET_PUBLIC_KEY:
				String id = usernames.entrySet()
					.stream()
					.filter(e -> e.getValue().equals(username))
					.map(e -> e.getKey())
					.findAny()
					.orElse(null);

				if (id != null && publicKeys.containsKey(id)) {
					String publicKey = publicKeys.get(id)
						.replaceAll("\n", "\\\\n");
					String string = String.format(
						"{'type': '%s', 'username': '%s', 'publicKey': '%s'}".replaceAll("'", "\""),
						GET_PUBLIC_KEY, username, publicKey
					);
					TextMessage keyMessage = new TextMessage(string);
					session.sendMessage(keyMessage);
				}
				break;
			case MESSAGE:
				synchronized(sockets) {
					sockets.entrySet().forEach(socket -> {
						if (socket.getValue().getId().equals(sessionId)) return;

						try {
							socket.getValue().sendMessage(message);
						} catch (IOException e) {
							e.printStackTrace();
						}
					});
				}
				break;
		}
	}

}

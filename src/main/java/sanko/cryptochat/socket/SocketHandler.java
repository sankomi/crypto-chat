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
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
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
		String sessionId = session.getId();
		sockets.put(session.getId(), session);
		log.info(sessionId + " connect");
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		String sessionId = session.getId();
		log.info(sessionId + " close");
		String username = usernames.get(sessionId);

		if (username != null) {
			synchronized(sockets) {
				sockets.entrySet().forEach(socket -> {
					if (socket.getValue().getId().equals(sessionId)) return;

					String closeString = String.format(
						"{'type': '%s', 'username': '%s'}".replaceAll("'", "\""),
						CLOSE, username
					);

					send(socket.getValue(), new TextMessage(closeString));
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

				send(session, new TextMessage(pingString));
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
					log.info(sessionId + " duplicate username = " + username);
					session.close(status);
					sockets.remove(sessionId);
				} else {
					usernames.put(sessionId, username);
					publicKeys.put(sessionId, (String) json.get("publicKey"));
					log.info(sessionId + " set username = " + username);

					synchronized(sockets) {
						sockets.entrySet().forEach(socket -> {
							if (socket.getValue().getId().equals(sessionId)) return;

							String connectString = String.format(
								"{'type': '%s', 'username': '%s'}".replaceAll("'", "\""),
								CONNECT, username
							);

							send(socket.getValue(), new TextMessage(connectString));
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
					send(session, usernameMessage);
				}
				break;
			case GET_PUBLIC_KEY:
				log.info(sessionId + " request key for username = " + username);

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
					send(session, keyMessage);
				}
				break;
			case MESSAGE:
				log.info(sessionId + " send message");
				synchronized(sockets) {
					sockets.entrySet().forEach(socket -> {
						if (socket.getValue().getId().equals(sessionId)) return;

						send(socket.getValue(), message);
					});
				}
				break;
		}
	}

	private void send(WebSocketSession session, TextMessage message) {
		try {
			if (session.isOpen()) {
				session.sendMessage(message);
			}
		} catch (Exception e) {
			log.error(session.getId() + " send message fail");
		}
	}

}

package sanko.cryptochat.socket;

import java.util.*; //Map, List
import java.util.stream.Collectors;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*; //CloseStatus, TextMessage, WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.boot.json.*; //JsonParser, JsonParserFactory

@Component
public class SocketHandler extends TextWebSocketHandler {

	private static final ConcurrentHashMap<String, WebSocketSession> sockets = new ConcurrentHashMap<>();
	private static final ConcurrentHashMap<String, String> usernames = new ConcurrentHashMap<>();
	private static final ConcurrentHashMap<String, String> publicKeys = new ConcurrentHashMap<>();

	private static final String GET_USERNAMES = "getusernames";
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
		sockets.remove(sessionId);
		usernames.remove(sessionId);
		publicKeys.remove(sessionId);
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		String sessionId = session.getId();
		JsonParser parser = JsonParserFactory.getJsonParser();
		Map<String, Object> json = parser.parseMap(message.getPayload());

		switch ((String) json.get("type")) {
			case GET_USERNAMES:
				List<String> names = usernames.entrySet()
					.stream()
					.filter(e -> !e.getKey().equals(sessionId))
					.map(e -> String.format("\"%s\"", e.getValue()))
					.collect(Collectors.toList());
				String usernameString = String.format(
					"{'type': '%s', 'usernames': [%s]}".replaceAll("'", "\""),
					GET_USERNAMES, String.join(",", names)
				);
				TextMessage usernameMessage = new TextMessage(usernameString);
				session.sendMessage(usernameMessage);
				break;
			case SEND_PUBLIC_KEY:
				usernames.put(sessionId, (String) json.get("username"));
				publicKeys.put(sessionId, (String) json.get("publicKey"));
				break;
			case GET_PUBLIC_KEY:
				String username = (String) json.get("username");
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

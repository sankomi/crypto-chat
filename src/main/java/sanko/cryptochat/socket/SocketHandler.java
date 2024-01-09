package sanko.cryptochat.socket;

import java.util.Map;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*; //CloseStatus, TextMessage, WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.boot.json.*; //JsonParser, JsonParserFactory

@Component
public class SocketHandler extends TextWebSocketHandler {

	private static final ConcurrentHashMap<String, WebSocketSession> sockets = new ConcurrentHashMap<>();
	private static final ConcurrentHashMap<String, String> publicKeys = new ConcurrentHashMap<>();

	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		sockets.put(session.getId(), session);
		for (String username : publicKeys.keySet()) {
			String string = "{\"type\": \"PUBLIC_KEY\", \"username\": \"" + username + "\", \"publicKey\": \"" + publicKeys.get(username).replaceAll("\n", "\\\\n") + "\"}";
			TextMessage keyMessage = new TextMessage(string);
			session.sendMessage(keyMessage);
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		sockets.remove(session.getId());
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		JsonParser parser = JsonParserFactory.getJsonParser();
		Map<String, Object> json = parser.parseMap(message.getPayload());
		if (json.get("type").equals("PUBLIC_KEY")) {
			publicKeys.put((String) json.get("username"), (String) json.get("publicKey"));
		}

		String senderId = session.getId();

		synchronized(sockets) {
			sockets.entrySet().forEach(socket -> {
				if (socket.getValue().getId().equals(senderId)) return;

				try {
					socket.getValue().sendMessage(message);
				} catch (IOException e) {
					e.printStackTrace();
				}
			});
		}
	}

}

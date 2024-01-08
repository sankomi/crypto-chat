package sanko.cryptochat.socket;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*; //CloseStatus, TextMessage, WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class SocketHandler extends TextWebSocketHandler {

	private static final ConcurrentHashMap<String, WebSocketSession> sockets = new ConcurrentHashMap<>();

	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		sockets.put(session.getId(), session);
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		sockets.remove(session.getId());
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
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

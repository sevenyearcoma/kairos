package com.qurttastar.kairos.chat;

import com.qurttastar.kairos.exception.ResourceNotFoundException;
import com.qurttastar.kairos.security.User;
import com.qurttastar.kairos.security.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;

    public List<ChatDto.SessionResponse> getSessions(UserDetails userDetails) {
        User user = getUser(userDetails);
        return sessionRepository.findByUserOrderByUpdatedAtDesc(user)
                .stream().map(ChatDto.SessionResponse::from).toList();
    }

    @Transactional
    public ChatDto.SessionResponse createSession(UserDetails userDetails, ChatDto.SessionRequest request) {
        User user = getUser(userDetails);
        ChatSessionEntity session = new ChatSessionEntity();
        session.setUser(user);
        session.setTitle(request.getTitle() != null ? request.getTitle() : "New Chat");
        return ChatDto.SessionResponse.from(sessionRepository.save(session));
    }

    public ChatDto.SessionResponse getSession(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        ChatSessionEntity session = sessionRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + id));
        return ChatDto.SessionResponse.from(session);
    }

    @Transactional
    public void deleteSession(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        ChatSessionEntity session = sessionRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + id));
        sessionRepository.delete(session);
    }

    @Transactional
    public ChatDto.MessageResponse addMessage(UserDetails userDetails, Long sessionId,
                                              ChatDto.MessageRequest request) {
        User user = getUser(userDetails);
        ChatSessionEntity session = sessionRepository.findByIdAndUser(sessionId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + sessionId));

        ChatMessageEntity message = new ChatMessageEntity();
        message.setSession(session);
        message.setRole(request.getRole());
        message.setContent(request.getContent());

        ChatMessageEntity saved = messageRepository.save(message);
        sessionRepository.save(session);
        return ChatDto.MessageResponse.from(saved);
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

package com.qurttastar.kairos.chat;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public class ChatDto {

    @Data
    public static class SessionRequest {
        private String title;
    }

    @Data
    public static class MessageRequest {
        @NotBlank
        private String role;
        @NotBlank
        private String content;
    }

    @Data
    public static class MessageResponse {
        private Long id;
        private String role;
        private String content;
        private LocalDateTime createdAt;

        public static MessageResponse from(ChatMessageEntity m) {
            MessageResponse r = new MessageResponse();
            r.id = m.getId();
            r.role = m.getRole();
            r.content = m.getContent();
            r.createdAt = m.getCreatedAt();
            return r;
        }
    }

    @Data
    public static class SessionResponse {
        private Long id;
        private String title;
        private List<MessageResponse> messages;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static SessionResponse from(ChatSessionEntity s) {
            SessionResponse r = new SessionResponse();
            r.id = s.getId();
            r.title = s.getTitle();
            r.createdAt = s.getCreatedAt();
            r.updatedAt = s.getUpdatedAt();
            if (s.getMessages() != null) {
                r.messages = s.getMessages().stream().map(MessageResponse::from).toList();
            } else {
                r.messages = List.of();
            }
            return r;
        }
    }
}

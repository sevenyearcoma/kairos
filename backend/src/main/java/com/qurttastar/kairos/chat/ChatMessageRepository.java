package com.qurttastar.kairos.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findBySessionOrderByCreatedAtAsc(ChatSessionEntity session);
}

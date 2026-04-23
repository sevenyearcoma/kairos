package com.qurttastar.kairos.chat;

import com.qurttastar.kairos.security.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, Long> {
    List<ChatSessionEntity> findByUserOrderByUpdatedAtDesc(User user);
    Optional<ChatSessionEntity> findByIdAndUser(Long id, User user);
}

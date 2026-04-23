package com.qurttastar.kairos.knowledge;

import com.qurttastar.kairos.security.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBase, Long> {
    Optional<KnowledgeBase> findByUser(User user);
}

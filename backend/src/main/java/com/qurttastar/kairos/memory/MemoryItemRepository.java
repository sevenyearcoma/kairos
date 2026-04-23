package com.qurttastar.kairos.memory;

import com.qurttastar.kairos.security.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemoryItemRepository extends JpaRepository<MemoryItem, Long> {
    List<MemoryItem> findByUserOrderByCreatedAtDesc(User user);
    Optional<MemoryItem> findByIdAndUser(Long id, User user);
}

package com.qurttastar.kairos.event;

import com.qurttastar.kairos.security.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<EventEntity, Long> {
    List<EventEntity> findByUserOrderByStartTimeAsc(User user);
    Optional<EventEntity> findByIdAndUser(Long id, User user);
}

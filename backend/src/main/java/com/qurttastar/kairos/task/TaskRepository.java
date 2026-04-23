package com.qurttastar.kairos.task;

import com.qurttastar.kairos.security.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {
    List<TaskEntity> findByUserOrderByCreatedAtDesc(User user);
    Optional<TaskEntity> findByIdAndUser(Long id, User user);
}

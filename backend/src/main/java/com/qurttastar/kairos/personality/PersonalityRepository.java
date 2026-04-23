package com.qurttastar.kairos.personality;

import com.qurttastar.kairos.security.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PersonalityRepository extends JpaRepository<Personality, Long> {
    Optional<Personality> findByUser(User user);
}

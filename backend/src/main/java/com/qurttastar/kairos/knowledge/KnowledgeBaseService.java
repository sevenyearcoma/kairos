package com.qurttastar.kairos.knowledge;

import com.qurttastar.kairos.exception.ResourceNotFoundException;
import com.qurttastar.kairos.security.User;
import com.qurttastar.kairos.security.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class KnowledgeBaseService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final UserRepository userRepository;

    public KnowledgeBase get(UserDetails userDetails) {
        User user = getUser(userDetails);
        return knowledgeBaseRepository.findByUser(user)
                .orElseThrow(() -> new ResourceNotFoundException("Knowledge base not found"));
    }

    @Transactional
    public KnowledgeBase update(UserDetails userDetails, Map<String, Object> body) {
        User user = getUser(userDetails);
        KnowledgeBase kb = knowledgeBaseRepository.findByUser(user)
                .orElseThrow(() -> new ResourceNotFoundException("Knowledge base not found"));

        if (body.containsKey("content")) kb.setContent((String) body.get("content"));
        if (body.containsKey("topics")) {
            @SuppressWarnings("unchecked")
            List<String> topics = (List<String>) body.get("topics");
            kb.setTopics(topics);
        }
        if (body.containsKey("skills")) {
            @SuppressWarnings("unchecked")
            List<String> skills = (List<String>) body.get("skills");
            kb.setSkills(skills);
        }

        return knowledgeBaseRepository.save(kb);
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

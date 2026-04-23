package com.qurttastar.kairos.personality;

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
public class PersonalityService {

    private final PersonalityRepository personalityRepository;
    private final UserRepository userRepository;

    public Personality get(UserDetails userDetails) {
        User user = getUser(userDetails);
        return personalityRepository.findByUser(user)
                .orElseThrow(() -> new ResourceNotFoundException("Personality not found"));
    }

    @Transactional
    public Personality update(UserDetails userDetails, Map<String, Object> body) {
        User user = getUser(userDetails);
        Personality personality = personalityRepository.findByUser(user)
                .orElseThrow(() -> new ResourceNotFoundException("Personality not found"));

        if (body.containsKey("name")) personality.setName((String) body.get("name"));
        if (body.containsKey("bio")) personality.setBio((String) body.get("bio"));
        if (body.containsKey("tone")) personality.setTone((String) body.get("tone"));
        if (body.containsKey("traits")) {
            @SuppressWarnings("unchecked")
            List<String> traits = (List<String>) body.get("traits");
            personality.setTraits(traits);
        }
        if (body.containsKey("interests")) {
            @SuppressWarnings("unchecked")
            List<String> interests = (List<String>) body.get("interests");
            personality.setInterests(interests);
        }

        return personalityRepository.save(personality);
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

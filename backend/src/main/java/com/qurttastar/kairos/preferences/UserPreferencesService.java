package com.qurttastar.kairos.preferences;

import com.qurttastar.kairos.exception.ResourceNotFoundException;
import com.qurttastar.kairos.security.User;
import com.qurttastar.kairos.security.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserPreferencesService {

    private final UserPreferencesRepository preferencesRepository;
    private final UserRepository userRepository;

    public UserPreferences get(UserDetails userDetails) {
        User user = getUser(userDetails);
        return preferencesRepository.findByUser(user)
                .orElseThrow(() -> new ResourceNotFoundException("Preferences not found"));
    }

    @Transactional
    public UserPreferences update(UserDetails userDetails, Map<String, Object> body) {
        User user = getUser(userDetails);
        UserPreferences prefs = preferencesRepository.findByUser(user)
                .orElseThrow(() -> new ResourceNotFoundException("Preferences not found"));

        if (body.containsKey("theme")) prefs.setTheme((String) body.get("theme"));
        if (body.containsKey("language")) prefs.setLanguage((String) body.get("language"));
        if (body.containsKey("timezone")) prefs.setTimezone((String) body.get("timezone"));
        if (body.containsKey("notifications")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> notifications = (Map<String, Object>) body.get("notifications");
            prefs.setNotifications(notifications);
        }
        if (body.containsKey("extra")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) body.get("extra");
            prefs.setExtra(extra);
        }

        return preferencesRepository.save(prefs);
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

package com.qurttastar.kairos.preferences;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/preferences")
@RequiredArgsConstructor
public class UserPreferencesController {

    private final UserPreferencesService preferencesService;

    @GetMapping
    public ResponseEntity<UserPreferences> get(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(preferencesService.get(user));
    }

    @PutMapping
    public ResponseEntity<UserPreferences> update(@AuthenticationPrincipal UserDetails user,
                                                  @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(preferencesService.update(user, body));
    }
}

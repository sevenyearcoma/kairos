package com.qurttastar.kairos.personality;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/personality")
@RequiredArgsConstructor
public class PersonalityController {

    private final PersonalityService personalityService;

    @GetMapping
    public ResponseEntity<Personality> get(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(personalityService.get(user));
    }

    @PutMapping
    public ResponseEntity<Personality> update(@AuthenticationPrincipal UserDetails user,
                                              @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(personalityService.update(user, body));
    }
}

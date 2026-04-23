package com.qurttastar.kairos.knowledge;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/knowledge-base")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;

    @GetMapping
    public ResponseEntity<KnowledgeBase> get(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(knowledgeBaseService.get(user));
    }

    @PutMapping
    public ResponseEntity<KnowledgeBase> update(@AuthenticationPrincipal UserDetails user,
                                                @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(knowledgeBaseService.update(user, body));
    }
}

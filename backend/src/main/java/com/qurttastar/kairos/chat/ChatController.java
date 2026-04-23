package com.qurttastar.kairos.chat;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping
    public List<ChatDto.SessionResponse> getSessions(@AuthenticationPrincipal UserDetails user) {
        return chatService.getSessions(user);
    }

    @PostMapping
    public ResponseEntity<ChatDto.SessionResponse> createSession(
            @AuthenticationPrincipal UserDetails user,
            @RequestBody ChatDto.SessionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.createSession(user, request));
    }

    @GetMapping("/{id}")
    public ChatDto.SessionResponse getSession(@AuthenticationPrincipal UserDetails user,
                                              @PathVariable Long id) {
        return chatService.getSession(user, id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSession(@AuthenticationPrincipal UserDetails user,
                                              @PathVariable Long id) {
        chatService.deleteSession(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<ChatDto.MessageResponse> addMessage(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody ChatDto.MessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.addMessage(user, id, request));
    }
}

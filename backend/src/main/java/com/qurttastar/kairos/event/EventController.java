package com.qurttastar.kairos.event;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public List<EventResponse> getAll(@AuthenticationPrincipal UserDetails user) {
        return eventService.getAll(user);
    }

    @PostMapping
    public ResponseEntity<EventResponse> create(@AuthenticationPrincipal UserDetails user,
                                                @Valid @RequestBody EventRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(eventService.create(user, request));
    }

    @GetMapping("/{id}")
    public EventResponse getById(@AuthenticationPrincipal UserDetails user, @PathVariable Long id) {
        return eventService.getById(user, id);
    }

    @PutMapping("/{id}")
    public EventResponse update(@AuthenticationPrincipal UserDetails user,
                                @PathVariable Long id,
                                @Valid @RequestBody EventRequest request) {
        return eventService.update(user, id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserDetails user, @PathVariable Long id) {
        eventService.delete(user, id);
        return ResponseEntity.noContent().build();
    }
}

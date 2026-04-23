package com.qurttastar.kairos.memory;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/memory")
@RequiredArgsConstructor
public class MemoryItemController {

    private final MemoryItemService memoryItemService;

    @GetMapping
    public List<MemoryItem> getAll(@AuthenticationPrincipal UserDetails user) {
        return memoryItemService.getAll(user);
    }

    @PostMapping
    public ResponseEntity<MemoryItem> create(@AuthenticationPrincipal UserDetails user,
                                             @Valid @RequestBody MemoryItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(memoryItemService.create(user, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserDetails user, @PathVariable Long id) {
        memoryItemService.delete(user, id);
        return ResponseEntity.noContent().build();
    }
}

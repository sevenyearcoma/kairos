package com.qurttastar.kairos.task;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public List<TaskResponse> getAll(@AuthenticationPrincipal UserDetails user) {
        return taskService.getAll(user);
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal UserDetails user,
                                               @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.create(user, request));
    }

    @GetMapping("/{id}")
    public TaskResponse getById(@AuthenticationPrincipal UserDetails user, @PathVariable Long id) {
        return taskService.getById(user, id);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@AuthenticationPrincipal UserDetails user,
                               @PathVariable Long id,
                               @Valid @RequestBody TaskRequest request) {
        return taskService.update(user, id, request);
    }

    @PatchMapping("/{id}/complete")
    public TaskResponse complete(@AuthenticationPrincipal UserDetails user, @PathVariable Long id) {
        return taskService.complete(user, id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserDetails user, @PathVariable Long id) {
        taskService.delete(user, id);
        return ResponseEntity.noContent().build();
    }
}

package com.qurttastar.kairos.task;

import com.qurttastar.kairos.exception.ResourceNotFoundException;
import com.qurttastar.kairos.security.User;
import com.qurttastar.kairos.security.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public List<TaskResponse> getAll(UserDetails userDetails) {
        User user = getUser(userDetails);
        return taskRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(TaskResponse::from).toList();
    }

    @Transactional
    public TaskResponse create(UserDetails userDetails, TaskRequest request) {
        User user = getUser(userDetails);
        TaskEntity task = new TaskEntity();
        task.setUser(user);
        applyRequest(task, request);
        return TaskResponse.from(taskRepository.save(task));
    }

    public TaskResponse getById(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        TaskEntity task = taskRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        return TaskResponse.from(task);
    }

    @Transactional
    public TaskResponse update(UserDetails userDetails, Long id, TaskRequest request) {
        User user = getUser(userDetails);
        TaskEntity task = taskRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        applyRequest(task, request);
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse complete(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        TaskEntity task = taskRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        task.setStatus("completed");
        task.setCompletedAt(LocalDateTime.now());
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public void delete(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        TaskEntity task = taskRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        taskRepository.delete(task);
    }

    private void applyRequest(TaskEntity task, TaskRequest request) {
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setPriority(request.getPriority());
        task.setStatus(request.getStatus());
        task.setDueDate(request.getDueDate());
        task.setTags(request.getTags());
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

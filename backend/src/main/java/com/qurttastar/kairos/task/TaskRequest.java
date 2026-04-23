package com.qurttastar.kairos.task;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskRequest {

    @NotBlank
    private String title;

    private String description;
    private String priority;
    private String status;
    private LocalDateTime dueDate;
    private List<String> tags;
}

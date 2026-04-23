package com.qurttastar.kairos.memory;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class MemoryItemRequest {

    @NotBlank
    private String content;

    private String category;

    private List<String> tags;
}

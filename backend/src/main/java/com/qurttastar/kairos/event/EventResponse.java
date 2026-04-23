package com.qurttastar.kairos.event;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class EventResponse {
    private Long id;
    private String title;
    private String description;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String location;
    private String color;
    private List<String> tags;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static EventResponse from(EventEntity e) {
        EventResponse r = new EventResponse();
        r.id = e.getId();
        r.title = e.getTitle();
        r.description = e.getDescription();
        r.startTime = e.getStartTime();
        r.endTime = e.getEndTime();
        r.location = e.getLocation();
        r.color = e.getColor();
        r.tags = e.getTags();
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }
}

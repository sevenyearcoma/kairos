package com.qurttastar.kairos.event;

import com.qurttastar.kairos.exception.ResourceNotFoundException;
import com.qurttastar.kairos.security.User;
import com.qurttastar.kairos.security.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    public List<EventResponse> getAll(UserDetails userDetails) {
        User user = getUser(userDetails);
        return eventRepository.findByUserOrderByStartTimeAsc(user)
                .stream().map(EventResponse::from).toList();
    }

    @Transactional
    public EventResponse create(UserDetails userDetails, EventRequest request) {
        User user = getUser(userDetails);
        EventEntity event = new EventEntity();
        event.setUser(user);
        applyRequest(event, request);
        return EventResponse.from(eventRepository.save(event));
    }

    public EventResponse getById(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        EventEntity event = eventRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + id));
        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse update(UserDetails userDetails, Long id, EventRequest request) {
        User user = getUser(userDetails);
        EventEntity event = eventRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + id));
        applyRequest(event, request);
        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void delete(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        EventEntity event = eventRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + id));
        eventRepository.delete(event);
    }

    private void applyRequest(EventEntity event, EventRequest request) {
        event.setTitle(request.getTitle());
        event.setDescription(request.getDescription());
        event.setStartTime(request.getStartTime());
        event.setEndTime(request.getEndTime());
        event.setLocation(request.getLocation());
        event.setColor(request.getColor());
        event.setTags(request.getTags());
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

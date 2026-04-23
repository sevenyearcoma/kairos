package com.qurttastar.kairos.memory;

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
public class MemoryItemService {

    private final MemoryItemRepository memoryItemRepository;
    private final UserRepository userRepository;

    public List<MemoryItem> getAll(UserDetails userDetails) {
        User user = getUser(userDetails);
        return memoryItemRepository.findByUserOrderByCreatedAtDesc(user);
    }

    @Transactional
    public MemoryItem create(UserDetails userDetails, MemoryItemRequest request) {
        User user = getUser(userDetails);
        MemoryItem item = new MemoryItem();
        item.setUser(user);
        item.setContent(request.getContent());
        item.setCategory(request.getCategory());
        item.setTags(request.getTags());
        return memoryItemRepository.save(item);
    }

    @Transactional
    public void delete(UserDetails userDetails, Long id) {
        User user = getUser(userDetails);
        MemoryItem item = memoryItemRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Memory item not found: " + id));
        memoryItemRepository.delete(item);
    }

    private User getUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

package com.qurttastar.kairos.auth;

import com.qurttastar.kairos.auth.dto.*;
import com.qurttastar.kairos.exception.DuplicateResourceException;
import com.qurttastar.kairos.exception.UnauthorizedException;
import com.qurttastar.kairos.knowledge.KnowledgeBase;
import com.qurttastar.kairos.knowledge.KnowledgeBaseRepository;
import com.qurttastar.kairos.memory.MemoryItem;
import com.qurttastar.kairos.memory.MemoryItemRepository;
import com.qurttastar.kairos.personality.Personality;
import com.qurttastar.kairos.personality.PersonalityRepository;
import com.qurttastar.kairos.preferences.UserPreferences;
import com.qurttastar.kairos.preferences.UserPreferencesRepository;
import com.qurttastar.kairos.security.JwtTokenProvider;
import com.qurttastar.kairos.security.User;
import com.qurttastar.kairos.security.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authManager;
    private final UserPreferencesRepository preferencesRepository;
    private final PersonalityRepository personalityRepository;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final MemoryItemRepository memoryItemRepository;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email already registered: " + request.getEmail());
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName() != null ? request.getDisplayName() : request.getEmail())
                .build();

        String accessToken = tokenProvider.generateAccessToken(user.getEmail());
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        createDefaultData(user);

        return new AuthResponse(accessToken, refreshToken, toUserResponse(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        String accessToken = tokenProvider.generateAccessToken(user.getEmail());
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        return new AuthResponse(accessToken, refreshToken, toUserResponse(user));
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        if (!tokenProvider.isValid(request.getRefreshToken())) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }

        User user = userRepository.findByRefreshToken(request.getRefreshToken())
                .orElseThrow(() -> new UnauthorizedException("Refresh token not found"));

        String accessToken = tokenProvider.generateAccessToken(user.getEmail());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);

        return new AuthResponse(accessToken, newRefreshToken, toUserResponse(user));
    }

    private void createDefaultData(User user) {
        UserPreferences prefs = new UserPreferences();
        prefs.setUser(user);
        preferencesRepository.save(prefs);

        Personality personality = new Personality();
        personality.setUser(user);
        personalityRepository.save(personality);

        KnowledgeBase kb = new KnowledgeBase();
        kb.setUser(user);
        knowledgeBaseRepository.save(kb);
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt());
    }
}

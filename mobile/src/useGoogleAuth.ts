import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { googleScopes } from './googleSync';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'kairos.google.accessToken';
const PLACEHOLDER_CLIENT_ID = 'missing-client-id.apps.googleusercontent.com';

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connected' | 'missing-client-id' | 'error'>('idle');

  const envClientIds = useMemo(
    () => ({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    }),
    [],
  );

  const clientConfig = useMemo(
    () => ({
      webClientId: envClientIds.webClientId || PLACEHOLDER_CLIENT_ID,
      iosClientId: envClientIds.iosClientId || PLACEHOLDER_CLIENT_ID,
      androidClientId: envClientIds.androidClientId || PLACEHOLDER_CLIENT_ID,
      scopes: googleScopes,
    }),
    [envClientIds],
  );

  const hasPlatformClientId = Platform.select({
    android: Boolean(envClientIds.androidClientId),
    ios: Boolean(envClientIds.iosClientId),
    web: Boolean(envClientIds.webClientId),
    default: Boolean(envClientIds.webClientId || envClientIds.iosClientId || envClientIds.androidClientId),
  });

  const [, response, promptAsync] = Google.useAuthRequest(clientConfig);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
      if (token) {
        setAccessToken(token);
        setStatus('connected');
      } else if (!hasPlatformClientId) {
        setStatus('missing-client-id');
      }
    });
  }, [hasPlatformClientId]);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const token = response.authentication?.accessToken;
    if (!token) {
      setStatus('error');
      return;
    }
    SecureStore.setItemAsync(TOKEN_KEY, token).then(() => {
      setAccessToken(token);
      setStatus('connected');
    });
  }, [response]);

  const connect = useCallback(async () => {
    if (!hasPlatformClientId) {
      setStatus('missing-client-id');
      return;
    }
    const result = await promptAsync();
    if (result.type !== 'success') setStatus('error');
  }, [hasPlatformClientId, promptAsync]);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAccessToken(null);
    setStatus(hasPlatformClientId ? 'idle' : 'missing-client-id');
  }, [hasPlatformClientId]);

  return { accessToken, status, isConfigured: hasPlatformClientId, connect, disconnect };
}

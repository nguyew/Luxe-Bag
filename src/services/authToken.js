import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@luxebag/auth-token';
let token = null;

export async function setAuthToken(value) {
  token = value || null;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getAuthToken() {
  if (token) return token;
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

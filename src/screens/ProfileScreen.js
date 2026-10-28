import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import PhotoActionSheet from '../components/PhotoActionSheet';
import useFavorites from '../hooks/useFavorites';
import {
  NAME_MAX_LENGTH,
  getAvatarUri,
  loadProfile,
  removeAvatar,
  setAvatarFromUri,
} from '../services/profileService';

// Ảnh vuông, nén nhẹ: đủ nét cho ảnh đại diện mà không tốn dung lượng
const PICKER_OPTIONS = {
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
};

export default function ProfileScreen({ navigation }) {
  const { favorites } = useFavorites();
  const { user, isLoggedIn, updateAccount, logout } = useAuth();

  const [profile, setProfile] = useState(null); // null = đang tải
  const [nameDraft, setNameDraft] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  const pendingAction = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Ảnh đại diện lưu riêng theo từng tài khoản: đọc lại mỗi khi đổi tài khoản
  const userId = user?.id;
  useEffect(() => {
    setProfile(null);
    if (!userId) return undefined;

    let cancelled = false;
    loadProfile().then((saved) => {
      if (!cancelled && mountedRef.current) setProfile(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Tên hiển thị lấy từ tài khoản (lưu trên API)
  useEffect(() => {
    setNameDraft(user?.name || '');
  }, [user?.name]);

  // Lưu ảnh người dùng vừa chọn/chụp
  const applyPickedAsset = useCallback(async (asset) => {
    setSaving(true);
    try {
      const next = await setAvatarFromUri(asset.uri);
      if (mountedRef.current) setProfile(next);
    } catch {
      Alert.alert('Profile photo', 'Could not save your photo. Please try again.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  // Android có thể đóng Activity trong lúc đang mở thư viện ảnh/camera;
  // lấy lại kết quả bị mất (nếu có) khi app mở lại.
  useEffect(() => {
    ImagePicker.getPendingResultAsync()
      .then((pending) => {
        if (pending && pending.canceled === false && pending.assets?.length) {
          return applyPickedAsset(pending.assets[0]);
        }
        return undefined;
      })
      .catch(() => {});
  }, [applyPickedAsset]);

  const chooseFromLibrary = useCallback(async () => {
    try {
      // Chọn ảnh từ thư viện không cần xin quyền
      const result = await ImagePicker.launchImageLibraryAsync({
        ...PICKER_OPTIONS,
        mediaTypes: ['images'],
      });
      if (!result.canceled && result.assets?.length) {
        await applyPickedAsset(result.assets[0]);
      }
    } catch {
      Alert.alert('Profile photo', 'Could not open your photo library.');
    }
  }, [applyPickedAsset]);

  const takePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access to take a profile photo.',
          permission.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open settings', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        ...PICKER_OPTIONS,
        cameraType: ImagePicker.CameraType.front,
      });
      if (!result.canceled && result.assets?.length) {
        await applyPickedAsset(result.assets[0]);
      }
    } catch {
      // Ví dụ: máy ảo iOS không có camera
      Alert.alert('Profile photo', 'The camera is not available on this device.');
    }
  }, [applyPickedAsset]);

  const deletePhoto = useCallback(async () => {
    setSaving(true);
    try {
      const next = await removeAvatar();
      if (mountedRef.current) setProfile(next);
    } catch {
      Alert.alert('Profile photo', 'Could not remove your photo. Please try again.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  // Đóng bảng chọn rồi mới chạy hành động. Trên iOS không thể mở picker
  // khi Modal còn đang đóng, nên đợi sự kiện onDismiss của Modal.
  const runAfterSheet = useCallback((action) => {
    setSheetVisible(false);
    if (Platform.OS === 'ios') {
      pendingAction.current = action;
    } else {
      action();
    }
  }, []);

  const onSheetDismiss = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) action();
  }, []);

  const saveName = useCallback(async () => {
    if (!user) return;
    const trimmed = nameDraft.trim();

    // Không cho để trống tên: trả về tên hiện tại
    if (!trimmed || trimmed === user.name) {
      setNameDraft(user.name);
      return;
    }

    try {
      await updateAccount({ name: trimmed });
    } catch {
      setNameDraft(user.name);
      Alert.alert('Profile', 'Could not save your name. Please try again.');
    }
  }, [nameDraft, user, updateAccount]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      Alert.alert('Unable to sign out', 'Please try again.');
    }
  };

  // Khách chưa đăng nhập
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />
        <SignInPrompt
          icon="person-outline"
          title="Your profile"
          message="Sign in to manage your account, favorites and orders."
        />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return <SafeAreaView style={styles.safeArea} edges={['top']} />;
  }

  const avatarUri = getAvatarUri(profile);
  const initial = user.name ? user.name.charAt(0).toUpperCase() : '';

  const sheetOptions = [
    {
      key: 'camera',
      label: 'Take a photo',
      icon: 'camera-outline',
      onPress: () => runAfterSheet(takePhoto),
    },
    {
      key: 'library',
      label: 'Choose from library',
      icon: 'images-outline',
      onPress: () => runAfterSheet(chooseFromLibrary),
    },
  ];
  if (avatarUri) {
    sheetOptions.push({
      key: 'remove',
      label: 'Remove photo',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => runAfterSheet(deletePhoto),
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title}>Profile</Text>

        {/* Ảnh đại diện */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={() => setSheetVisible(true)}
            disabled={saving}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} />
              ) : initial ? (
                <Text style={styles.initial}>{initial}</Text>
              ) : (
                <Ionicons name="person" size={52} color="#FFFFFF" />
              )}

              {saving && (
                <View style={styles.savingOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </Pressable>

          <Text style={styles.avatarHint}>
            {avatarUri ? 'Tap to change your photo' : 'Add a profile photo'}
          </Text>
        </View>

        {/* Tên hiển thị */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            onEndEditing={saveName}
            placeholder="Your name"
            placeholderTextColor="#9A948D"
            maxLength={NAME_MAX_LENGTH}
            returnKeyType="done"
            autoCapitalize="words"
            style={styles.input}
            accessibilityLabel="Display name"
          />
        </View>

        {/* Email đăng nhập (chỉ đọc) */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.readonlyValue} numberOfLines={1}>
            {user.email}
          </Text>
        </View>

        {/* Lối tắt tới danh sách yêu thích */}
        <Pressable
          onPress={() => navigation.navigate('Favorites')}
          style={[styles.card, styles.favoritesRow]}
          accessibilityRole="button"
        >
          <View style={styles.favoritesIcon}>
            <Ionicons name="heart" size={18} color="#FF4D5E" />
          </View>
          <View style={styles.favoritesText}>
            <Text style={styles.favoritesTitle}>Favorites</Text>
            <Text style={styles.favoritesCount}>
              {favorites.length} saved {favorites.length === 1 ? 'handbag' : 'handbags'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9A948D" />
        </Pressable>

        {/* Đơn hàng & các túi đã mua */}
        <Pressable
          onPress={() => navigation.navigate('Orders')}
          style={[styles.card, styles.favoritesRow]}
          accessibilityRole="button"
          accessibilityLabel="My orders"
        >
          <View style={[styles.favoritesIcon, styles.menuIcon]}>
            <Ionicons name="receipt-outline" size={18} color="#1A1A1A" />
          </View>
          <View style={styles.favoritesText}>
            <Text style={styles.favoritesTitle}>My orders</Text>
            <Text style={styles.favoritesCount}>Track, cancel or return an order</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9A948D" />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('PurchasedBags')}
          style={[styles.card, styles.favoritesRow]}
          accessibilityRole="button"
          accessibilityLabel="Purchased bags"
        >
          <View style={[styles.favoritesIcon, styles.menuIcon]}>
            <Ionicons name="bag-check-outline" size={18} color="#1A1A1A" />
          </View>
          <View style={styles.favoritesText}>
            <Text style={styles.favoritesTitle}>Purchased bags</Text>
            <Text style={styles.favoritesCount}>Bags you have received</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9A948D" />
        </Pressable>

        <Pressable
          onPress={handleLogout}
          style={styles.logoutButton}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color="#B3261E" />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <PhotoActionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onDismiss={onSheetDismiss}
        title="Profile photo"
        options={sheetOptions}
      />
    </SafeAreaView>
  );
}

const AVATAR = 124;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F1F1',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 110, // chừa chỗ cho tab bar nổi
  },
  title: {
    paddingTop: 24,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: '#0D0D0D',
  },

  // Ảnh đại diện
  avatarSection: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 28,
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#050505',
    borderWidth: 3,
    borderColor: '#F3F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    marginTop: 14,
    fontSize: 13,
    color: '#77716A',
  },

  // Thẻ thông tin
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#77716A',
  },
  input: {
    marginTop: 4,
    paddingVertical: 6,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Lối tắt Favorites
  favoritesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  favoritesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDE9EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    backgroundColor: '#EFEBE7',
  },
  favoritesText: {
    flex: 1,
  },
  favoritesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  favoritesCount: {
    marginTop: 2,
    fontSize: 12,
    color: '#77716A',
  },

  // Email chỉ đọc
  readonlyValue: {
    fontSize: 16,
    color: '#55514C',
  },

  // Đăng xuất
  logoutButton: {
    alignSelf: 'center',
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    backgroundColor: '#FBE3E1',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B3261E',
  },
});
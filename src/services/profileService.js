import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

/**
 * profileService – lưu hồ sơ người dùng (tên + ảnh đại diện) trên thiết bị.
 *
 * - Tên và TÊN FILE ảnh được lưu bằng AsyncStorage.
 * - Ảnh do ImagePicker trả về nằm trong thư mục cache (hệ điều hành có thể
 *   xóa bất cứ lúc nào), nên được sao chép sang thư mục document.
 * - Chỉ lưu tên file chứ không lưu đường dẫn đầy đủ, vì đường dẫn thư mục
 *   của app trên iOS có thể đổi sau khi cập nhật app.
 */

const STORAGE_KEY = '@luxebag/profile';
const FILE_NAME_PATTERN = /^[\w.-]+$/;

export const NAME_MAX_LENGTH = 30;

const DEFAULT_PROFILE = { name: '', avatarFile: null };

// Đảm bảo dữ liệu đọc ra luôn đúng dạng, kể cả khi bị hỏng
function sanitize(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const name =
    typeof source.name === 'string'
      ? source.name.trim().slice(0, NAME_MAX_LENGTH)
      : '';

  const avatarFile =
    typeof source.avatarFile === 'string' &&
    FILE_NAME_PATTERN.test(source.avatarFile)
      ? source.avatarFile
      : null;

  return { name, avatarFile };
}

export async function loadProfile() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

/** Gộp `patch` vào hồ sơ hiện tại, lưu lại và trả về hồ sơ mới. */
export async function updateProfile(patch) {
  const current = await loadProfile();
  const next = sanitize({ ...current, ...patch });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function deleteAvatarFile(fileName) {
  if (!fileName) return;
  try {
    const file = new File(Paths.document, fileName);
    if (file.exists) file.delete();
  } catch {
    // không xóa được thì bỏ qua, không ảnh hưởng người dùng
  }
}

/** Đường dẫn ảnh đại diện để hiển thị; null nếu chưa có hoặc file đã mất. */
export function getAvatarUri(profile) {
  if (!profile || !profile.avatarFile) return null;
  try {
    const file = new File(Paths.document, profile.avatarFile);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/**
 * Đặt ảnh đại diện từ đường dẫn mà ImagePicker trả về.
 * Dùng tên file mới mỗi lần để <Image> không hiện ảnh cũ từ bộ nhớ đệm,
 * rồi xóa ảnh cũ. Trả về hồ sơ mới.
 */
export async function setAvatarFromUri(sourceUri) {
  const source = new File(sourceUri);
  const ext = /^\.[a-z0-9]{2,5}$/i.test(source.extension || '')
    ? source.extension
    : '.jpg';

  const destination = new File(Paths.document, `avatar-${Date.now()}${ext}`);
  await source.copy(destination);

  const previous = (await loadProfile()).avatarFile;

  try {
    const next = await updateProfile({ avatarFile: destination.name });
    deleteAvatarFile(previous);
    return next;
  } catch (error) {
    deleteAvatarFile(destination.name); // không để lại file mồ côi
    throw error;
  }
}

/** Xóa ảnh đại diện. Trả về hồ sơ mới. */
export async function removeAvatar() {
  const previous = (await loadProfile()).avatarFile;
  const next = await updateProfile({ avatarFile: null });
  deleteAvatarFile(previous);
  return next;
}

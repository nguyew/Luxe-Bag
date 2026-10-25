import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AddressCard from '../components/AddressCard';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import { MAX_ADDRESSES } from '../services/userService';

/** Quản lý địa chỉ giao hàng đã lưu: thêm, sửa, xóa, đặt mặc định. */
export default function AddressesScreen({ navigation }) {
  const { user, isLoggedIn, saveAddresses } = useAuth();
  const [busy, setBusy] = useState(false);

  const addresses = user?.addresses || [];

  const persist = useCallback(
    async (next) => {
      setBusy(true);
      try {
        await saveAddresses(next);
      } catch {
        Alert.alert('Addresses', 'Could not save your changes. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [saveAddresses]
  );

  const setDefault = (id) =>
    persist(addresses.map((item) => ({ ...item, isDefault: item.id === id })));

  const remove = (address) => {
    Alert.alert('Delete address?', `${address.label} – ${address.line1}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => persist(addresses.filter((item) => item.id !== address.id)),
      },
    ]);
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.screen}>
        <SignInPrompt
          icon="location-outline"
          title="Delivery addresses"
          message="Sign in to save your delivery addresses."
        />
      </View>
    );
  }

  const canAdd = addresses.length < MAX_ADDRESSES;

  return (
    <View style={styles.screen}>
      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={44} color="#77716A" />
            <Text style={styles.emptyTitle}>No saved addresses</Text>
            <Text style={styles.emptyText}>Add one to check out faster.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AddressCard address={item}>
            <View style={styles.actions}>
              {!item.isDefault && (
                <Pressable
                  onPress={() => setDefault(item.id)}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.action}>Set as default</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => navigation.navigate('AddressForm', { addressId: item.id })}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.action}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => remove(item)}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.action, styles.danger]}>Delete</Text>
              </Pressable>
            </View>
          </AddressCard>
        )}
        ListFooterComponent={
          canAdd ? (
            <Pressable
              onPress={() => navigation.navigate('AddressForm')}
              style={styles.add}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addText}>Add new address</Text>
            </Pressable>
          ) : (
            <Text style={styles.limit}>You can save up to {MAX_ADDRESSES} addresses.</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#0D0D0D' },
  emptyText: { marginTop: 4, fontSize: 13, color: '#77716A' },
  actions: { flexDirection: 'row', gap: 20, marginTop: 14 },
  action: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  danger: { color: '#B3261E' },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    marginTop: 8,
    borderRadius: 25,
    backgroundColor: '#050505',
  },
  addText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  limit: { marginTop: 8, textAlign: 'center', fontSize: 12, color: '#77716A' },
});

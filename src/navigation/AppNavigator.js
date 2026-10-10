import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import DetailScreen from '../screens/DetailScreen';
import FavoritesScreen from '../screens/FavouritesScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 4 tab theo ảnh mẫu: home, heart, bag, user
const TAB_ICONS = {
  Home: 'home-outline',
  Favorites: 'heart-outline',
  Cart: 'bag-handle-outline',
  Profile: 'person-outline',
};

// Kích thước gọn của thanh tab
const BAR_WIDTH = 248;
const BAR_HEIGHT = 52;
const CIRCLE = 38;

/**
 * Một tab: vòng tròn trắng luôn được vẽ sẵn (bo tròn cố định) và chỉ
 * đổi độ mờ + phóng to/thu nhỏ khi chọn, nên luôn tròn và chuyển mượt.
 */
function TabItem({ name, focused, onPress, onLongPress }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  const circleScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const darkOpacity = progress;
  const lightOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <View style={styles.circleSlot}>
        <Animated.View
          style={[
            styles.circle,
            { opacity: progress, transform: [{ scale: circleScale }] },
          ]}
        />
        <Animated.View style={[styles.iconLayer, { opacity: lightOpacity }]}>
          <Ionicons name={TAB_ICONS[name]} size={19} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, { opacity: darkOpacity }]}>
          <Ionicons name={TAB_ICONS[name]} size={19} color="#1E1E1E" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/**
 * Thanh tab tự vẽ: viên thuốc đen nhỏ, căn giữa, nổi phía trên
 * thanh điều hướng của hệ thống.
 */
function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: insets.bottom + 14 }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              name={route.name}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          headerTintColor: '#1A1A1A',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F3F1F1' },
        }}
      />

      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          title: 'Handbag Details',
          headerTintColor: '#1A1A1A',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: '#1E1E1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 7,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSlot: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE,
    backgroundColor: '#FFFFFF',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
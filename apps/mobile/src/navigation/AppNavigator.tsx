import React from 'react'
import { Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

// Auth
import LoginScreen from '@/screens/auth/LoginScreen'

// Parent
import ParentDashboard  from '@/screens/parent/DashboardScreen'
import LiveMapScreen    from '@/screens/parent/LiveMapScreen'
import TripHistoryScreen from '@/screens/parent/TripHistoryScreen'
import NotificationsScreen from '@/screens/parent/NotificationsScreen'
import ProfileScreen    from '@/screens/parent/ProfileScreen'

// Driver
import DriverHomeScreen from '@/screens/driver/HomeScreen'
import DriverRouteScreen from '@/screens/driver/RouteScreen'
import InspectionScreen from '@/screens/driver/InspectionScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

// ===== Onglets parent =====
function ParentTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16C7B8',
        tabBarInactiveTintColor: '#9BB0CE',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F0F4F8',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#072B57',
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_500Medium',
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={ParentDashboard}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={TripHistoryScreen}
        options={{
          tabBarLabel: 'Historique',
          tabBarIcon: ({ color }) => <HistoryIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ color }) => <BellIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <UserIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}

// ===== Navigation principale =====
export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F5F7FA' },
        }}
      >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />

        {/* Parent */}
        <Stack.Screen name="ParentTabs" component={ParentTabs} />
        <Stack.Screen
          name="LiveMap"
          component={LiveMapScreen}
          options={{ animation: 'slide_from_bottom' }}
        />

        {/* Driver */}
        <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
        <Stack.Screen name="DriverRoute" component={DriverRouteScreen} />
        <Stack.Screen name="Inspection" component={InspectionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

// Icônes de navigation (remplacer par @expo/vector-icons en prod)
const HomeIcon    = ({ color }: { color: string }) => null
const HistoryIcon = ({ color }: { color: string }) => null
const BellIcon    = ({ color }: { color: string }) => null
const UserIcon    = ({ color }: { color: string }) => null

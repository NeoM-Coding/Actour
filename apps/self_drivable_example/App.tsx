import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ActourProvider,
  AgentExecutionOverlay,
  reactNativeGuideAdapter,
} from "@actour/react-native";
import { GuideProvider } from "@actour/guide";
import { AgentPanel } from "./src/AgentPanel";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LeaveFormScreen } from "./src/screens/LeaveFormScreen";
import { LeaveSuccessScreen } from "./src/screens/LeaveSuccessScreen";

export type RootStackParamList = {
  Home: undefined;
  LeaveForm: undefined;
  LeaveSuccess: {
    requestId: string;
    date: string;
    daypart: string;
    reason: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Application() {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#0B1020" },
            headerTintColor: "#F7F8FF",
            contentStyle: { backgroundColor: "#090C17" },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "Actour" }}
          />
          <Stack.Screen
            name="LeaveForm"
            component={LeaveFormScreen}
            options={{ title: "请假申请" }}
          />
          <Stack.Screen
            name="LeaveSuccess"
            component={LeaveSuccessScreen}
            options={{ title: "申请结果", headerBackVisible: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <AgentPanel />
    </>
  );
}

export default function App() {
  const debug = process.env.EXPO_PUBLIC_ACTOUR_DEBUG === "true";
  return (
    <SafeAreaProvider>
      <ActourProvider debug={debug}>
        <GuideProvider adapter={reactNativeGuideAdapter}>
          <Application />
          <AgentExecutionOverlay />
        </GuideProvider>
      </ActourProvider>
    </SafeAreaProvider>
  );
}

import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActourProvider } from "@actour/react-native";
import { GuideProvider } from "@actour/guide";
import { ClockScreen } from "./src/ClockScreen";

export default function App() {
  return (
    // SafeAreaProvider 在根部读取设备安全区域；GuideProvider 则依赖
    // ActourProvider 提供的 registry，因此这两个 Actour Provider 不能交换位置。
    <SafeAreaProvider>
      <ActourProvider>
        <GuideProvider>
          <ClockScreen />
        </GuideProvider>
      </ActourProvider>
    </SafeAreaProvider>
  );
}

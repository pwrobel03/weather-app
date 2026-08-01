import "./global.css";

import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-ziemia">
      <Text className="text-2xl font-light text-tekst">Weather App</Text>
      <Text className="mt-1 text-tekst-muted">Sprawdź prognozę</Text>
      <StatusBar style="light" />
    </View>
  );
}

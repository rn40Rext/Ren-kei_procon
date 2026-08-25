import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { auth } from "./firebase/firebaseConfig";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      console.log("認証状態:", currentUser);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <AppNavigator user={user}/>
    </NavigationContainer>
  );
}
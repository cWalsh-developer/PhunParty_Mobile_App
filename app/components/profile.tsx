import { UserContext } from "@/assets/authentication-storage/authContext";
import React, { useContext } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";

interface ProfileScreenProps {
  onEditProfile: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({
  onEditProfile,
  onLogout,
}: ProfileScreenProps) {
  const { user } = useContext(UserContext)!;

  return (
    <View style={styles.container}>
      <Text style={styles.heading} variant="headlineLarge">
        Profile
      </Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{user.UserName || "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user.UserEmail || "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mobile:</Text>
          <Text style={styles.value}>{user.UserPhone || "-"}</Text>
        </View>
      </Card>
      <Button
        mode="contained"
        style={styles.editButton}
        onPress={onEditProfile}
      >
        Edit Profile
      </Button>
      <Button mode="outlined" style={styles.logoutButton} onPress={onLogout}>
        <Text style={{ color: "#020202ff" }}>Logout</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    padding: 24,
    alignItems: "center",
  },
  heading: {
    marginTop: 32,
    marginBottom: 32,
    fontWeight: "bold",
    color: "#201e23ff",
    alignSelf: "center",
  },
  card: {
    width: "100%",
    padding: 20,
    marginBottom: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  label: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#201e23ff",
  },
  value: {
    fontSize: 16,
    color: "#333",
    flexShrink: 1,
    textAlign: "right",
  },
  editButton: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#201e23ff",
  },
  logoutButton: {
    width: "100%",
    borderColor: "#201e23ff",
  },
});

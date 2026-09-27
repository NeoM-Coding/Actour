import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 22,
    paddingBottom: 190,
    backgroundColor: "#090C17",
  },
  eyebrow: {
    color: "#7180A8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: { marginTop: 8, color: "#F7F8FF", fontSize: 30, fontWeight: "700" },
  copy: { marginTop: 10, color: "#8E97B2", fontSize: 15, lineHeight: 22 },
  card: {
    marginTop: 24,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#151B2E",
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
    color: "#8E97B2",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#101526",
    color: "#F7F8FF",
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 10 },
  option: {
    flex: 1,
    alignItems: "center",
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#101526",
  },
  optionSelected: { backgroundColor: "#33447D" },
  optionText: { color: "#ABB5D2", fontWeight: "600" },
  button: {
    marginTop: 22,
    alignItems: "center",
    padding: 15,
    borderRadius: 16,
    backgroundColor: "#637EF2",
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  success: {
    marginTop: 50,
    color: "#80D8A5",
    fontSize: 56,
    textAlign: "center",
  },
  detail: { marginTop: 10, color: "#DCE2F7", fontSize: 16 },
});

import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useActour } from "@actour/react-native";

export function InteractionInspector() {
  const registry = useActour();
  const [nodes, setNodes] = useState(registry.snapshot());

  useEffect(() => registry.subscribe(() => setNodes(registry.snapshot())), [registry]);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Interaction Tree</Text>
      <ScrollView>
        {nodes.map((node) => (
          <View key={node.id} style={styles.node}>
            <Text style={styles.id}>{node.id}</Text>
            <Text style={styles.meta}>{node.role} · {node.actions.join(", ")}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { maxHeight: 280, padding: 16, backgroundColor: "#12172A", borderRadius: 18 },
  heading: { marginBottom: 10, color: "white", fontSize: 16, fontWeight: "700" },
  node: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#343A50" },
  id: { color: "#AFC0FF", fontWeight: "600" },
  meta: { marginTop: 3, color: "#8E96AD", fontSize: 12 },
});

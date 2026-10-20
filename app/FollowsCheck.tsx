import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { API_CONFIG } from "../constants/api";
import { decodeToken } from "../services/auth";

type FollowRow = { login: string; name: string; at?: string };

export default function FollowsCheck() {
  const router = useRouter();

  const [followings, setFollowings] = useState<FollowRow[]>([]);
  const [followers, setFollowers] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsScope, setNeedsScope] = useState(false);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<"sigo" | "fans" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token =
        Platform.OS === "web"
          ? localStorage.getItem("userToken")
          : await SecureStore.getItemAsync("userToken");
      if (!token) {
        router.replace("/");
        return;
      }

      const decoded = decodeToken(token);
      const scopes: string[] = Array.isArray(decoded?.scopes)
        ? decoded.scopes
        : typeof decoded?.scopes === "string"
          ? String(decoded.scopes).split(" ")
          : [];
      if (!scopes.includes("user:read:follows")) {
        if (alive) {
          setNeedsScope(true);
          setLoading(false);
        }
        return;
      }

      try {
        const [fRes, frRes] = await Promise.all([
          fetch(API_CONFIG.ENDPOINTS.FOLLOWINGS, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(API_CONFIG.ENDPOINTS.FOLLOWERS_MY, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!alive) return;

        if (fRes.status === 403 || frRes.status === 403) {
          setNeedsScope(true);
          return;
        }
        if (!fRes.ok || !frRes.ok) {
          setError("Error cargando las listas de Twitch");
          return;
        }

        const fData = await fRes.json();
        const frData = await frRes.json();
        if (!alive) return;

        setFollowings(
          (fData.followings || []).map((r: any) => ({
            login: String(r.login || "").toLowerCase(),
            name: r.name || r.login,
          })),
        );
        setFollowers(
          (frData.followers || []).map((r: any) => ({
            login: String(r.login || "").toLowerCase(),
            name: r.name || r.login,
            at: r.at,
          })),
        );
      } catch {
        if (alive) setError("No se pudo conectar con el servidor");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const followingsSet = useMemo(
    () => new Set(followings.map((f) => f.login)),
    [followings],
  );
  const followersSet = useMemo(
    () => new Set(followers.map((f) => f.login)),
    [followers],
  );

  const notFollowedBack = useMemo(
    () =>
      followers
        .filter((f) => !followingsSet.has(f.login))
        .sort((a, b) => a.login.localeCompare(b.login)),
    [followers, followingsSet],
  );

  const sortedFollowings = useMemo(
    () => [...followings].sort((a, b) => a.login.localeCompare(b.login)),
    [followings],
  );

  const query = search.trim().toLowerCase();
  const filterRows = (rows: FollowRow[]) =>
    query
      ? rows.filter(
          (r) => r.login.includes(query) || r.name.toLowerCase().includes(query),
        )
      : rows;

  const copyList = async (rows: FollowRow[], key: "sigo" | "fans") => {
    if (Platform.OS !== "web") return;
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.login).join("\n"));
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const relogin = () => {
    if (Platform.OS === "web") {
      window.location.assign(API_CONFIG.ENDPOINTS.AUTH_TWITCH);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Siguiendo y fans</Text>

        {needsScope && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Twitch añadió un permiso nuevo para esta pantalla. Cierra sesión y
              vuelve a entrar con Twitch para concederlo.
            </Text>
            <TouchableOpacity style={styles.loginButton} onPress={relogin}>
              <Text style={styles.buttonText}>Volver a entrar con Twitch</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading && !needsScope && (
          <ActivityIndicator size="large" color="#C5A582" style={{ marginTop: 40 }} />
        )}

        {!loading && !needsScope && !error && (
          <>
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Text style={styles.chipNum}>{followings.length}</Text>
                <Text style={styles.chipLabel}>Siguiendo</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipNum}>
                  {followings.filter((f) => followersSet.has(f.login)).length}
                </Text>
                <Text style={styles.chipLabel}>Te siguen</Text>
              </View>
              <View style={styles.chip}>
                <Text style={[styles.chipNum, { color: "#C94B4B" }]}>
                  {notFollowedBack.length}
                </Text>
                <Text style={styles.chipLabel}>Fans sin seguir</Text>
              </View>
            </View>

            <TextInput
              placeholder="Buscar usuario..."
              value={search}
              onChangeText={setSearch}
              style={styles.input}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                A los que sigo ({followings.length})
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyList(filterRows(sortedFollowings), "sigo")}
              >
                <Text style={styles.copyText}>
                  {copied === "sigo" ? "COPIADO ✓" : "COPIAR"}
                </Text>
              </TouchableOpacity>
            </View>
            {filterRows(sortedFollowings).map((f) => {
              const followsMe = followersSet.has(f.login);
              return (
                <View key={f.login} style={styles.row}>
                  <View style={styles.rowNames}>
                    <Text style={styles.rowName}>{f.name}</Text>
                    <Text style={styles.rowLogin}>@{f.login}</Text>
                  </View>
                  <Text
                    style={[
                      styles.badge,
                      followsMe ? styles.badgeFollowed : styles.badgeNot,
                    ]}
                  >
                    {followsMe ? "ME SIGUE" : "NO ME SIGUE"}
                  </Text>
                </View>
              );
            })}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Te siguen y no los sigo ({notFollowedBack.length})
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyList(filterRows(notFollowedBack), "fans")}
              >
                <Text style={styles.copyText}>
                  {copied === "fans" ? "COPIADO ✓" : "COPIAR"}
                </Text>
              </TouchableOpacity>
            </View>
            {filterRows(notFollowedBack).map((f) => (
              <View key={f.login} style={styles.row}>
                <View style={styles.rowNames}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowLogin}>@{f.login}</Text>
                </View>
                {f.at ? (
                  <Text style={styles.rowDate}>
                    {new Date(f.at).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            ))}

            {filterRows(notFollowedBack).length === 0 && (
              <Text style={styles.empty}>
                {query ? "Sin coincidencias" : "Sigues a todo el que te sigue 🎉"}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ECE7E1",
  },
  content: {
    padding: 24,
    paddingBottom: 60,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2A2A2A",
    marginBottom: 16,
    textAlign: "center",
  },
  banner: {
    backgroundColor: "#FFF3CD",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  bannerText: {
    color: "#6B543F",
    fontSize: 14,
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: "#C5A582",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: "#C94B4B",
    textAlign: "center",
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  chipNum: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6B543F",
  },
  chipLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8CDBE",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2A2A2A",
  },
  copyButton: {
    backgroundColor: "#E8DDCE",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  copyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B543F",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 5,
  },
  rowNames: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2A2A2A",
  },
  rowLogin: {
    fontSize: 12,
    color: "#999",
  },
  rowDate: {
    fontSize: 11,
    color: "#999",
  },
  badge: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  badgeFollowed: {
    backgroundColor: "#E85D9C",
  },
  badgeNot: {
    backgroundColor: "#C94B4B",
  },
  empty: {
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
});

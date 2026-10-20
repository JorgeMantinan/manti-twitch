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
type SortMode = "az" | "meSigue" | "noMeSigue";

const SORT_CYCLE: Record<SortMode, SortMode> = {
  az: "meSigue",
  meSigue: "noMeSigue",
  noMeSigue: "az",
};

const SORT_LABEL: Record<SortMode, string> = {
  az: "ORDEN: A-Z",
  meSigue: "ORDEN: ME SIGUE",
  noMeSigue: "ORDEN: NO ME SIGUE",
};

export default function FollowsCheck() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [followings, setFollowings] = useState<FollowRow[]>([]);
  const [followers, setFollowers] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsScope, setNeedsScope] = useState(false);
  const [needsUnfollowScope, setNeedsUnfollowScope] = useState(false);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<"sigo" | "fans" | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const t =
        Platform.OS === "web"
          ? localStorage.getItem("userToken")
          : await SecureStore.getItemAsync("userToken");
      if (!t) {
        router.replace("/");
        return;
      }
      setToken(t);

      const decoded = decodeToken(t);
      const scopes: string[] = Array.isArray(decoded?.scopes)
        ? decoded.scopes
        : typeof decoded?.scopes === "string"
          ? String(decoded.scopes).split(" ")
          : [];

      const canUnfollow = scopes.includes("user:edit:follows");
      if (alive) setNeedsUnfollowScope(!canUnfollow);

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
            headers: { Authorization: `Bearer ${t}` },
          }),
          fetch(API_CONFIG.ENDPOINTS.FOLLOWERS_MY, {
            headers: { Authorization: `Bearer ${t}` },
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

  const sortedFollowings = useMemo(() => {
    const rows = [...followings];
    if (sortMode === "az") {
      rows.sort((a, b) => a.login.localeCompare(b.login));
    } else if (sortMode === "meSigue") {
      rows.sort((a, b) => {
        const d = Number(followersSet.has(b.login)) - Number(followersSet.has(a.login));
        return d !== 0 ? d : a.login.localeCompare(b.login);
      });
    } else {
      rows.sort((a, b) => {
        const d = Number(followersSet.has(a.login)) - Number(followersSet.has(b.login));
        return d !== 0 ? d : a.login.localeCompare(b.login);
      });
    }
    return rows;
  }, [followings, followersSet, sortMode]);

  const noFollowBackInView = useMemo(
    () => sortedFollowings.filter((f) => !followersSet.has(f.login)),
    [sortedFollowings, followersSet],
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

  const confirmAsk = (msg: string) =>
    Platform.OS === "web" ? window.confirm(msg) : true;

  const unfollowRequest = async (login: string): Promise<boolean> => {
    if (!token) return false;
    const res = await fetch(API_CONFIG.ENDPOINTS.UNFOLLOW, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login }),
    });
    if (res.ok) {
      setFollowings((prev) => prev.filter((f) => f.login !== login));
      return true;
    }
    const data = await res.json().catch(() => ({} as any));
    const msg =
      res.status === 403
        ? "Falta el permiso para dejar de seguir — vuelve a entrar con Twitch"
        : data.error || "No se pudo dejar de seguir";
    setError(msg);
    return false;
  };

  const unfollowOne = async (login: string) => {
    if (busy) return;
    if (!confirmAsk(`¿Dejar de seguir a @${login}?`)) return;
    setBusy(true);
    setInfo("");
    setError("");
    try {
      await unfollowRequest(login);
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (login: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  };

  const selectAllNoFollowBack = () => {
    setSelected(new Set(noFollowBackInView.map((f) => f.login)));
  };

  const unfollowSelected = async () => {
    if (busy || selected.size === 0) return;
    const logins = [...selected];
    if (!confirmAsk(`¿Dejar de seguir a ${logins.length} personas?`)) return;

    setBusy(true);
    setError("");
    setInfo("");
    let done = 0;
    let failed = 0;

    for (const login of logins) {
      try {
        const ok = await unfollowRequest(login);
        if (ok) done++;
        else {
          failed++;
          // stop early on hard errors (scope / rate limit)
          if (failed >= 2) break;
        }
      } catch {
        failed++;
      }
      setProgress(`${Math.min(done + failed, logins.length)}/${logins.length}`);
      await new Promise((r) => setTimeout(r, 400));
    }

    setSelected(new Set());
    setProgress("");
    setBusy(false);
    setInfo(`Hechos: ${done}${failed ? ` · Fallidos: ${failed}` : ""}`);
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

        {!needsScope && needsUnfollowScope && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Para dejar de seguir desde esta pantalla falta un permiso de
              Twitch. Cierra sesión y vuelve a entrar con Twitch para concederlo.
            </Text>
            <TouchableOpacity style={styles.loginButton} onPress={relogin}>
              <Text style={styles.buttonText}>Volver a entrar con Twitch</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!info && <Text style={styles.info}>{info}</Text>}

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
                  {noFollowBackInView.length}
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
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => setSortMode((m) => SORT_CYCLE[m])}
                >
                  <Text style={styles.copyText}>{SORT_LABEL[sortMode]}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyList(filterRows(sortedFollowings), "sigo")}
                >
                  <Text style={styles.copyText}>
                    {copied === "sigo" ? "COPIADO ✓" : "COPIAR"}
                  </Text>
                </TouchableOpacity>
                {!needsUnfollowScope && (
                  <TouchableOpacity
                    style={[styles.copyButton, selectionMode && styles.copyButtonActive]}
                    onPress={() => {
                      setSelectionMode((v) => !v);
                      setSelected(new Set());
                    }}
                  >
                    <Text
                      style={[styles.copyText, selectionMode && styles.copyTextActive]}
                    >
                      {selectionMode ? "SALIR" : "SELECCIÓN"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {selectionMode && (
              <View style={styles.bulkBar}>
                <TouchableOpacity style={styles.copyButton} onPress={selectAllNoFollowBack}>
                  <Text style={styles.copyText}>
                    TODOS ({noFollowBackInView.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => setSelected(new Set())}
                >
                  <Text style={styles.copyText}>NINGUNO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.bulkUnfollowButton,
                    (busy || selected.size === 0) && { opacity: 0.5 },
                  ]}
                  disabled={busy || selected.size === 0}
                  onPress={unfollowSelected}
                >
                  <Text style={styles.bulkUnfollowText}>
                    {busy && progress
                      ? `DEJANDO ${progress}…`
                      : `DEJAR DE SEGUIR (${selected.size})`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {filterRows(sortedFollowings).map((f) => {
              const followsMe = followersSet.has(f.login);
              const isSelectable = selectionMode && !followsMe;
              return (
                <View key={f.login} style={styles.row}>
                  {isSelectable && (
                    <TouchableOpacity onPress={() => toggleSelect(f.login)}>
                      <Text style={styles.checkbox}>
                        {selected.has(f.login) ? "☑️" : "⬜"}
                      </Text>
                    </TouchableOpacity>
                  )}
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
                  {!followsMe && !selectionMode && !needsUnfollowScope && (
                    <TouchableOpacity
                      style={[styles.rowUnfollow, busy && { opacity: 0.5 }]}
                      disabled={busy}
                      onPress={() => unfollowOne(f.login)}
                    >
                      <Text style={styles.rowUnfollowText}>DEJAR</Text>
                    </TouchableOpacity>
                  )}
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
    marginBottom: 8,
  },
  info: {
    color: "#4CAF50",
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "600",
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
    flexWrap: "wrap",
    gap: 6,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
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
  copyButtonActive: {
    backgroundColor: "#C5A582",
  },
  copyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B543F",
  },
  copyTextActive: {
    color: "#fff",
  },
  bulkBar: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  bulkUnfollowButton: {
    backgroundColor: "#C94B4B",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flex: 1,
    minWidth: 160,
    alignItems: "center",
  },
  bulkUnfollowText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
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
    gap: 8,
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
  rowUnfollow: {
    backgroundColor: "#C94B4B",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rowUnfollowText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  checkbox: {
    fontSize: 16,
  },
  empty: {
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
});

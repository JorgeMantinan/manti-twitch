import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { apiFetch, decodeToken } from "../services/auth";

type FollowRow = { login: string; name: string; at?: string };

const FOLLOW_CACHE_KEY = "followscheck_cache_v1";
const FOLLOW_CACHE_TTL = 5 * 60 * 1000;
const RENDER_CAP = 300;

type FollowCache = {
  at: number;
  followings: FollowRow[];
  followers: FollowRow[];
  truncatedFollowings?: boolean;
  truncatedFollowers?: boolean;
  totalFollowings?: number | null;
  totalFollowers?: number | null;
};

function readFollowCache(): FollowCache | null {
  if (Platform.OS !== "web") return null;
  try {
    const raw = localStorage.getItem(FOLLOW_CACHE_KEY);
    return raw ? (JSON.parse(raw) as FollowCache) : null;
  } catch {
    return null;
  }
}

export default function FollowsCheck() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [followings, setFollowings] = useState<FollowRow[]>([]);
  const [followers, setFollowers] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState("");
  const [needsScope, setNeedsScope] = useState(false);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<"sigoNo" | "fans" | "mutuos" | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [truncated, setTruncated] = useState<{
    followings: boolean;
    followers: boolean;
    totalFollowings: number | null;
    totalFollowers: number | null;
  }>({ followings: false, followers: false, totalFollowings: null, totalFollowers: null });

  const applyData = (cache: FollowCache) => {
    setFollowings(cache.followings || []);
    setFollowers(cache.followers || []);
    setTruncated({
      followings: !!cache.truncatedFollowings,
      followers: !!cache.truncatedFollowers,
      totalFollowings: cache.totalFollowings ?? null,
      totalFollowers: cache.totalFollowers ?? null,
    });
    setLastapiFetch(cache.at);
  };

  const loadFromApi = async (token: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setLoading(true);
    setSlowHint(false);
    setError("");

    const slowTimer = setTimeout(() => setSlowHint(true), 4000);

    let scopeProblem = false;
    let fData: any = null;
    let frData: any = null;
    const problems: string[] = [];

    const parseJson = async (r: Response) => {
      try {
        return await r.json();
      } catch {
        return null;
      }
    };

    // Each list loads independently: one failing must not hide the other
    const loadFollowings = apiFetch(API_CONFIG.ENDPOINTS.FOLLOWINGS)
      .then(async (r) => {
        if (r.status === 403) {
          scopeProblem = true;
          return;
        }
        if (!r.ok) {
          problems.push("siguiendo");
          return;
        }
        const d = await parseJson(r);
        if (!d || !Array.isArray(d.followings)) {
          problems.push("siguiendo (respuesta vacía)");
          return;
        }
        fData = d;
      })
      .catch(() => problems.push("siguiendo (sin conexión)"));

    const loadFollowers = apiFetch(API_CONFIG.ENDPOINTS.FOLLOWERS_MY)
      .then(async (r) => {
        if (r.status === 403) {
          scopeProblem = true;
          return;
        }
        if (!r.ok) {
          problems.push("seguidores");
          return;
        }
        const d = await parseJson(r);
        if (!d || !Array.isArray(d.followers)) {
          problems.push("seguidores (respuesta vacía)");
          return;
        }
        frData = d;
      })
      .catch(() => problems.push("seguidores (sin conexión)"));

    await Promise.all([loadFollowings, loadFollowers]);
    clearTimeout(slowTimer);
    setSlowHint(false);

    try {
      if (scopeProblem) {
        setNeedsScope(true);
        return;
      }

      if (fData && frData) {
        const cache: FollowCache = {
          at: Date.now(),
          followings: fData.followings.map((r: any) => ({
            login: String(r.login || "").toLowerCase(),
            name: r.name || r.login,
          })),
          followers: frData.followers.map((r: any) => ({
            login: String(r.login || "").toLowerCase(),
            name: r.name || r.login,
            at: r.at,
          })),
          truncatedFollowings: !!fData.truncated,
          truncatedFollowers: !!frData.truncated,
          totalFollowings: typeof fData.total === "number" ? fData.total : null,
          totalFollowers: typeof frData.total === "number" ? frData.total : null,
        };
        applyData(cache);
        if (Platform.OS === "web") {
          try {
            localStorage.setItem(FOLLOW_CACHE_KEY, JSON.stringify(cache));
          } catch {}
        }
      } else if (fData || frData) {
        // Partial success: show whatever loaded
        if (fData) {
          setFollowings(
            fData.followings.map((r: any) => ({
              login: String(r.login || "").toLowerCase(),
              name: r.name || r.login,
            })),
          );
        }
        if (frData) {
          setFollowers(
            frData.followers.map((r: any) => ({
              login: String(r.login || "").toLowerCase(),
              name: r.name || r.login,
              at: r.at,
            })),
          );
        }
        setTruncated({
          followings: !!fData?.truncated,
          followers: !!frData?.truncated,
          totalFollowings: typeof fData?.total === "number" ? fData.total : null,
          totalFollowers: typeof frData?.total === "number" ? frData.total : null,
        });
        setLastFetch(Date.now());
        setError(
          `No se pudo cargar: ${[...new Set(problems)].join(" · ")} — prueba a REFRESCAR en unos segundos`,
        );
      } else {
        const stale = readFollowCache();
        if (stale) {
          applyData(stale);
          setError("No se pudo actualizar — mostrando datos guardados");
        } else {
          setError(
            `Error cargando las listas (${[...new Set(problems)].join(" · ")}) — si continúa, cierra sesión y vuelve a entrar con Twitch`,
          );
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
        setNeedsScope(true);
        setLoading(false);
        return;
      }

      // Fresh cache → instant paint, no network
      const cache = readFollowCache();
      if (cache && Date.now() - cache.at < FOLLOW_CACHE_TTL) {
        applyData(cache);
        setLoading(false);
        return;
      }

      if (!alive) return;
      await loadFromApi(token);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = async () => {
    const token =
      Platform.OS === "web"
        ? localStorage.getItem("userToken")
        : await SecureStore.getItemAsync("userToken");
    if (token) await loadFromApi(token, true);
  };

  const jumpTo = (id: string) => {
    if (Platform.OS === "web") {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const followingsSet = useMemo(
    () => new Set(followings.map((f) => f.login)),
    [followings],
  );
  const followersSet = useMemo(
    () => new Set(followers.map((f) => f.login)),
    [followers],
  );

  const sortedFollowings = useMemo(
    () => [...followings].sort((a, b) => a.login.localeCompare(b.login)),
    [followings],
  );

  // 1) I follow them, they don't follow me back
  const sigoNoMeSiguen = useMemo(
    () => sortedFollowings.filter((f) => !followersSet.has(f.login)),
    [sortedFollowings, followersSet],
  );

  // 3) Mutual follows
  const mutualsList = useMemo(
    () => sortedFollowings.filter((f) => followersSet.has(f.login)),
    [sortedFollowings, followersSet],
  );

  // 2) They follow me, I don't follow them back
  const fansSinSeguir = useMemo(
    () =>
      followers
        .filter((f) => !followingsSet.has(f.login))
        .sort((a, b) => a.login.localeCompare(b.login)),
    [followers, followingsSet],
  );

  const query = search.trim().toLowerCase();
  const filterRows = (rows: FollowRow[]) =>
    query
      ? rows.filter(
          (r) => r.login.includes(query) || r.name.toLowerCase().includes(query),
        )
      : rows;

  const capRows = (rows: FollowRow[]) => rows.slice(0, RENDER_CAP);

  const copyList = async (
    rows: FollowRow[],
    key: "sigoNo" | "fans" | "mutuos",
  ) => {
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
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
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

        {!!truncated.followings || !!truncated.followers ? (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>
              ⚠️ Listas parciales (límite de Twitch):{" "}
              {truncated.followings && truncated.totalFollowings != null
                ? `siguiendo ${followings.length} de ${truncated.totalFollowings}. `
                : ""}
              {truncated.followers && truncated.totalFollowers != null
                ? `seguidores ${followers.length} de ${truncated.totalFollowers}. `
                : ""}
              La sección «no los sigo» puede ser inexacta con estas cifras.
            </Text>
          </View>
        ) : null}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading && !needsScope && (
          <View style={{ marginTop: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#C5A582" />
            {slowHint && (
              <Text style={styles.slowHint}>
                Tardando… es normal si sigues/siguen a mucha gente (Twitch
                entrega la lista de 100 en 100).
              </Text>
            )}
          </View>
        )}

        {!loading && !needsScope && (
          <>
            <View style={styles.toolbar}>
              {lastFetch ? (
                <Text style={styles.fetchedAt}>
                  Datos de {new Date(lastFetch).toLocaleTimeString()}
                </Text>
              ) : null}
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Text style={styles.copyText}>
                  {refreshing ? "ACTUALIZANDO…" : "REFRESCAR"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chipsRow}>
              <TouchableOpacity style={styles.chip} onPress={() => jumpTo("sec-sigo-no")}>
                <Text style={[styles.chipNum, { color: "#C94B4B" }]}>
                  {sigoNoMeSiguen.length}
                </Text>
                <Text style={styles.chipLabel}>Sigo, no me siguen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => jumpTo("sec-fans")}>
                <Text style={[styles.chipNum, { color: "#C94B4B" }]}>
                  {fansSinSeguir.length}
                </Text>
                <Text style={styles.chipLabel}>Me siguen, no los sigo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => jumpTo("sec-mutuos")}>
                <Text style={[styles.chipNum, { color: "#E85D9C" }]}>
                  {mutualsList.length}
                </Text>
                <Text style={styles.chipLabel}>Mutuos</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.badgeHint}>
              Las3 listas son exclusivas entre sí. Totales: sigues a{" "}
              {followings.length} · te siguen {followers.length}.
            </Text>

            <View style={styles.navRow}>
              {(["sec-sigo-no", "sec-fans", "sec-mutuos"] as const).map((id, i) => (
                <TouchableOpacity
                  key={id}
                  style={styles.navBtn}
                  onPress={() => jumpTo(id)}
                >
                  <Text style={styles.navBtnText}>
                    {
                      [
                        "IR A: SIGO SIN QUE ME SIGAN",
                        "IR A: ME SIGUEN SIN QUE LOS SIGA",
                        "IR A: MUTUOS",
                      ][i]
                    }
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.navBtn} onPress={() => jumpTo("sec-top")}>
                <Text style={styles.navBtnText}>⬆ ARRIBA</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Buscar usuario..."
              value={search}
              onChangeText={setSearch}
              style={styles.input}
            />

            {/* SECTION 1: sigo y no me siguen */}
            <View nativeID="sec-sigo-no" style={styles.sectionAnchor}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  A los que sigo y no me siguen ({sigoNoMeSiguen.length})
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyList(filterRows(sigoNoMeSiguen), "sigoNo")}
                >
                  <Text style={styles.copyText}>
                    {copied === "sigoNo" ? "COPIADO ✓" : "COPIAR"}
                  </Text>
                </TouchableOpacity>
              </View>

              {capRows(filterRows(sigoNoMeSiguen)).map((f) => (
                <View key={f.login} style={styles.row}>
                  <View style={styles.rowNames}>
                    <Text style={styles.rowName}>{f.name}</Text>
                    <Text style={styles.rowLogin}>@{f.login}</Text>
                  </View>
                  <Text style={[styles.badge, styles.badgeNot]}>NO ME SIGUE</Text>
                </View>
              ))}
              {filterRows(sigoNoMeSiguen).length === 0 && (
                <Text style={styles.empty}>
                  {query ? "Sin coincidencias" : "Te siguen todos los que sigues 🎉"}
                </Text>
              )}
              {filterRows(sigoNoMeSiguen).length > RENDER_CAP && (
                <Text style={styles.capNote}>
                  Mostrando los primeros {RENDER_CAP} — usa la búsqueda o COPIAR
                  para el resto
                </Text>
              )}
            </View>

            {/* SECTION 2: me siguen y no los sigo */}
            <View nativeID="sec-fans" style={styles.sectionAnchor}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Te siguen y no los sigo ({fansSinSeguir.length})
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyList(filterRows(fansSinSeguir), "fans")}
                >
                  <Text style={styles.copyText}>
                    {copied === "fans" ? "COPIADO ✓" : "COPIAR"}
                  </Text>
                </TouchableOpacity>
              </View>

              {capRows(filterRows(fansSinSeguir)).map((f) => (
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
              {filterRows(fansSinSeguir).length === 0 && (
                <Text style={styles.empty}>
                  {query ? "Sin coincidencias" : "Sigues a todo el que te sigue 🎉"}
                </Text>
              )}
              {filterRows(fansSinSeguir).length > RENDER_CAP && (
                <Text style={styles.capNote}>
                  Mostrando los primeros {RENDER_CAP} — usa la búsqueda o COPIAR
                  para el resto
                </Text>
              )}
            </View>

            {/* SECTION 3: mutuos */}
            <View nativeID="sec-mutuos" style={styles.sectionAnchor}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Nos seguimos mutuamente ({mutualsList.length})
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyList(filterRows(mutualsList), "mutuos")}
                >
                  <Text style={styles.copyText}>
                    {copied === "mutuos" ? "COPIADO ✓" : "COPIAR"}
                  </Text>
                </TouchableOpacity>
              </View>

              {capRows(filterRows(mutualsList)).map((f) => (
                <View key={f.login} style={styles.row}>
                  <View style={styles.rowNames}>
                    <Text style={styles.rowName}>{f.name}</Text>
                    <Text style={styles.rowLogin}>@{f.login}</Text>
                  </View>
                  <Text style={[styles.badge, styles.badgeFollowed]}>MUTUO</Text>
                </View>
              ))}
              {filterRows(mutualsList).length === 0 && (
                <Text style={styles.empty}>
                  {query ? "Sin coincidencias" : "Todavía no hay seguimientos mutuos"}
                </Text>
              )}
              {filterRows(mutualsList).length > RENDER_CAP && (
                <Text style={styles.capNote}>
                  Mostrando los primeros {RENDER_CAP} — usa la búsqueda o COPIAR
                  para el resto
                </Text>
              )}
            </View>

            <View style={styles.sectionAnchor} nativeID="sec-top" />
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => jumpTo("sec-top")}>
        <Text style={styles.fabText}>⬆</Text>
      </TouchableOpacity>
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
    paddingBottom: 100,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  sectionAnchor: {
    marginTop: 10,
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
  warnBanner: {
    backgroundColor: "#F8D7DA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warnText: {
    color: "#842029",
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: "#C94B4B",
    textAlign: "center",
    marginBottom: 8,
  },
  slowHint: {
    color: "#999",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 20,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  fetchedAt: {
    fontSize: 11,
    color: "#999",
  },
  refreshBtn: {
    backgroundColor: "#E8DDCE",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
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
  badgeHint: {
    fontSize: 12,
    color: "#8A7A66",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 17,
  },
  navRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  navBtn: {
    backgroundColor: "#6B543F",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
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
  empty: {
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  capNote: {
    color: "#999",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 6,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    backgroundColor: "#C5A582",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
  },
  fabText: {
    fontSize: 20,
    color: "#fff",
  },
});

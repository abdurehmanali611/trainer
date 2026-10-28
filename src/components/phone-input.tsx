import type { Country } from "@chafian/phone-input-react-native";
import { getAllCountries, getCountryByCode } from "@chafian/phone-input-react-native";
import { ChevronDownIcon, SearchIcon } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

const light = {
  foreground: "#0f172a",
  muted: "#64748b",
  placeholder: "#94a3b8",
  border: "#e2e8f0",
  card: "#ffffff",
  surface: "#f1f5f9",
};

const dark = {
  foreground: "#f1f5f9",
  muted: "#94a3b8",
  placeholder: "#64748b",
  border: "#2b3746",
  card: "#121a2b",
  surface: "#1a2436",
};

const FAVOURITES = ["ET", "KE", "US", "GB", "AE"];

const FALLBACK_COUNTRY: Country = {
  code: "ET",
  name: "Ethiopia",
  dialCode: "+251",
};

function flagEmojiOf(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function allCountries(): Country[] {
  try {
    return getAllCountries("en");
  } catch {
    return [];
  }
}

/** Countries sorted: selected first, then favourites, then alphabetical. */
function sortCountries(selected: Country, list: Country[]): Country[] {
  if (list.length === 0) return [selected];
  return [...list].sort((a, b) => {
    if (a.code === selected.code) return -1;
    if (b.code === selected.code) return 1;
    const fa = FAVOURITES.indexOf(a.code);
    const fb = FAVOURITES.indexOf(b.code);
    if (fa !== -1 || fb !== -1) {
      if (fa === -1) return 1;
      if (fb === -1) return -1;
      return fa - fb;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Keep only phone characters so the stored value stays a plain number. */
function sanitizePhone(text: string) {
  return text.replace(/[^\d+]/g, "");
}

/**
 * Phone number input with a country **combobox**: the flag button opens a
 * panel with a search field that filters the country list as you type.
 * The number itself is a plain controlled TextInput.
 */
export function PhoneNumberInput({
  value,
  onChange,
  placeholder = "9XX XXX XXX",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? dark : light;

  const [country, setCountry] = useState<Country>(() => {
    try {
      return getCountryByCode("ET") ?? FALLBACK_COUNTRY;
    } catch {
      return FALLBACK_COUNTRY;
    }
  });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allCountries().filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.dialCode.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      );
    });
    return sortCountries(country, list);
  }, [query, country]);

  function openCombobox() {
    setQuery("");
    setOpen(true);
  }

  const panelRef = useRef<ElementRef<typeof View>>(null);

  // Inside a dialog the country list used to hand wheel events to the dialog's
  // scroll container. While the picker is open we keep scrolling scoped to the
  // panel itself on web.
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const doc = typeof document === "undefined" ? null : document;
    if (!doc) return;
    const panel = panelRef.current as unknown as HTMLElement | null;
    const handler = (event: Event) => {
      if (panel && event.target instanceof Node && panel.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    doc.addEventListener("wheel", handler, { passive: false });
    return () => doc.removeEventListener("wheel", handler);
  }, [open]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 12,
        backgroundColor: theme.card,
      }}
    >
      <Pressable
        onPress={openCombobox}
        accessibilityRole="button"
        accessibilityLabel={`Country, currently ${country.name}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginRight: 8,
          paddingVertical: 6,
          paddingHorizontal: 2,
        }}
      >
        <Text style={{ fontSize: 18 }}>{flagEmojiOf(country.code)}</Text>
        <Text
          style={{
            fontSize: 16,
            color: theme.foreground,
            fontWeight: "500",
            marginLeft: 6,
          }}
        >
          {country.dialCode}
        </Text>
        <ChevronDownIcon color={theme.muted} size={14} style={{ marginLeft: 2 }} />
      </Pressable>

      <TextInput
        value={value}
        onChangeText={(text) => onChange(sanitizePhone(text))}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        keyboardType="phone-pad"
        returnKeyType="done"
        style={{
          flex: 1,
          minHeight: 42,
          paddingVertical: 0,
          fontSize: 16,
          color: theme.foreground,
        }}
      />

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(15,23,44,0.35)" }}
            onPress={() => setOpen(false)}
          />

          <View
            ref={panelRef}
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              top: "18%",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.card,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            {/* Combobox search field */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <SearchIcon color={theme.muted} size={16} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search country, code or number"
                placeholderTextColor={theme.placeholder}
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: 0,
                  fontSize: 15,
                  color: theme.foreground,
                }}
              />
            </View>

            <ScrollView
              style={{ maxHeight: 280 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
            >
              {results.length === 0 ? (
                <Text
                  style={{
                    paddingVertical: 18,
                    paddingHorizontal: 14,
                    fontSize: 14,
                    color: theme.muted,
                    textAlign: "center",
                  }}
                >
                  No country matches “{query.trim()}”.
                </Text>
              ) : (
                results.map((item) => {
                  const isSelected = item.code === country.code;
                  return (
                    <Pressable
                      key={item.code}
                      onPress={() => {
                        setCountry(item);
                        setOpen(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        minHeight: 44,
                        paddingHorizontal: 12,
                        backgroundColor: isSelected ? theme.surface : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{flagEmojiOf(item.code)}</Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          marginLeft: 10,
                          fontSize: 15,
                          color: theme.foreground,
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: theme.muted,
                          marginLeft: 8,
                          fontWeight: "500",
                        }}
                      >
                        {item.dialCode}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

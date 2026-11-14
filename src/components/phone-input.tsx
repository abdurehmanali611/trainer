import type { Country } from "@chafian/phone-input-react-native";
import { getAllCountries, getCountryByCode } from "@chafian/phone-input-react-native";
import { ChevronDownIcon, SearchIcon } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import type { ViewStyle } from "react-native";
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

// Computed once: filtering re-runs on every keystroke, so re-calling
// getAllCountries on each render would rebuild ~250 entries repeatedly.
const COUNTRIES: Country[] = (() => {
  try {
    return getAllCountries("en");
  } catch {
    return [];
  }
})();

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

/** National part of a stored number: drop a leading dial code if present. */
function nationalPart(value: string, dialCode: string) {
  const normalized = value.replace(/\s/g, "");
  if (dialCode && normalized.startsWith(dialCode)) return normalized.slice(dialCode.length);
  return value.replace(/^\+/, "");
}

/** Swap the dial-code prefix of a stored number (country change). */
function rebaseDialCode(value: string, fromDial: string, toDial: string) {
  if (fromDial && value.replace(/\s/g, "").startsWith(fromDial)) {
    return toDial + value.replace(/\s/g, "").slice(fromDial.length);
  }
  return value;
}

function flagEmojiOf(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
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

  const wrapperRef = useRef<ElementRef<typeof View>>(null);
  const panelRef = useRef<ElementRef<typeof View>>(null);

  // Close when the page scrolls/re-layouts while the panel is open — a fixed
  // panel would otherwise drift away from its trigger.
  // Note: no auto-focus on the search input for web. The dialog's focus
  // scope reacts to focus changes by scrolling the content, which used to
  // jump the dialog to the top (and any scroll-based close logic then killed
  // the panel). Wheel/tap guards below keep the dialog still instead.

  // While the picker is open, wheel events anywhere except inside the panel
  // are blocked so the dialog beneath can't scroll on web.
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const doc = typeof document === "undefined" ? null : document;
    if (!doc) return;
    const panel = panelRef.current as unknown as HTMLElement | null;
    const handler = (event: Event) => {
      const target = event.target instanceof Node ? event.target : null;
      if (panel && target && panel.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    doc.addEventListener("wheel", handler, { passive: false });
    return () => doc.removeEventListener("wheel", handler);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = COUNTRIES.filter((item) => {
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

  // Search field + filtered country list, shared between the web panel and
  // the native modal.
  const pickerContent = (
    <>
      {/* Combobox search field */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          minHeight: 48,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <SearchIcon color={theme.muted} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
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
                  // Keep the number's digits, but re-tag them with the newly
                  // selected country's dial code.
                  onChange(rebaseDialCode(value, country.dialCode, item.dialCode));
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
    </>
  );

  // On web a transparent full-screen backdrop sits behind the panel and
  // swallows taps/wheel events, so the dialog beneath neither scrolls nor
  // triggers its Cancel/Create buttons while the picker is open.
  const panel =
    open && Platform.OS === "web" ? (
      <>
        {/* Capture-style backdrop: any pointer-down outside the panel
            dismisses it immediately, before other handlers can act. */}
        <Pressable
          onPress={() => setOpen(false)}
          onStartShouldSetResponderCapture={() => {
            setOpen(false);
            return true;
          }}
          pointerEvents="auto"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
          } as unknown as ViewStyle}
        />
        {/* Rendered in normal flow inside the dialog's tree — same approach
            as ui/combobox.tsx, which works reliably inside dialogs on web.
            It pushes the rows below it down instead of floating. */}
        <View
          ref={panelRef}
          pointerEvents="auto"
          style={{
            alignSelf: "stretch",
            marginTop: 6,
            zIndex: 9999,
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
          {pickerContent}
        </View>
      </>
    ) : null;

  return (
    <View
      ref={wrapperRef}
      style={{
        // Own stacking context above everything else in the dialog while
        // open, so the backdrop covers later siblings (e.g. the Cancel /
        // Create footer) and they can't be clicked or scrolled. Same trick
        // as ui/combobox.tsx.
        ...(open && Platform.OS === "web" ? { zIndex: 60 } : null),
      }}
    >
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
        onPress={() => (open ? setOpen(false) : openCombobox())}
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
        value={nationalPart(value, country.dialCode)}
        onChangeText={(text) => {
          const digits = text.replace(/[^\d]/g, "");
          // Clearing the field clears the whole stored number — never leave a
          // lone dial code behind.
          onChange(digits ? country.dialCode + digits : "");
        }}
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
      </View>

      {panel}

      {/* Native keeps the real full-screen modal, which floats above the
          dialog's native overlay with no stacking or wheel-scroll conflicts. */}
      <Modal
        visible={open && Platform.OS !== "web"}
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
            {pickerContent}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

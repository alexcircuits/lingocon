"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Search, Loader2, Globe, Save, Check } from "lucide-react";
import enMessages from "@/messages/en.json";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface FlatMessage {
  key: string;
  enValue: string;
  section: string;
}

export default function TranslatePage({ params }: { params: { slug: string } }) {
  const t = useTranslations("i18n");
  const router = useRouter();
  const [languageId, setLanguageId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "untranslated">("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");

  // Flatten en.json
  const flatEnMessages = useMemo(() => {
    const flat: FlatMessage[] = [];
    const flatten = (obj: any, prefix = "") => {
      for (const key in obj) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          flatten(obj[key], prefix + key + ".");
        } else {
          flat.push({
            key: prefix + key,
            enValue: obj[key],
            section: prefix ? prefix.split(".")[0] : "common",
          });
        }
      }
    };
    flatten(enMessages);
    return flat;
  }, []);

  const sections = useMemo(() => {
    const s = new Set<string>();
    flatEnMessages.forEach((m) => s.add(m.section));
    return Array.from(s).sort();
  }, [flatEnMessages]);

  useEffect(() => {
    // 1. Fetch language details by slug to get ID
    fetch(`/api/internal/language-by-slug/${params.slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((lang) => {
        setLanguageId(lang.id);
        // 2. Fetch existing translations
        return fetch(`/api/translations/${lang.id}`);
      })
      .then((res) => res.json())
      .then((data) => {
        setTranslations(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("loadFailed"));
        setLoading(false);
      });
  }, [params.slug]);

  const handleSave = async () => {
    if (!languageId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/translations/${languageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translations }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("saveTranslation"));
      router.refresh(); // Refresh to update language switcher progress if they are using it
    } catch (error) {
      console.error(error);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const filteredMessages = useMemo(() => {
    return flatEnMessages.filter((m) => {
      if (selectedSection !== "all" && m.section !== selectedSection) return false;
      if (filter === "untranslated" && translations[m.key]) return false;
      if (search) {
        const q = search.toLowerCase();
        return m.key.toLowerCase().includes(q) || m.enValue.toLowerCase().includes(q);
      }
      return true;
    });
  }, [flatEnMessages, translations, search, filter, selectedSection]);

  const totalKeys = flatEnMessages.length;
  const translatedKeys = Object.keys(translations).length;
  const progressPercent = totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("translationEditor")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("editorSubtitle")}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t("saveTranslation")}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t("progress")}</span>
          <span className="text-sm font-medium">{progressPercent}% ({translatedKeys}/{totalKeys})</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 space-y-4">
          <div className="space-y-1">
            <Button
              variant={selectedSection === "all" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedSection("all")}
            >
              {t("allSections")}
            </Button>
            {sections.map((section) => {
              const sectionTotal = flatEnMessages.filter((m) => m.section === section).length;
              const sectionTranslated = flatEnMessages.filter((m) => m.section === section && translations[m.key]).length;
              return (
                <Button
                  key={section}
                  variant={selectedSection === section ? "secondary" : "ghost"}
                  className="w-full justify-start flex justify-between"
                  onClick={() => setSelectedSection(section)}
                >
                  <span className="truncate">{section}</span>
                  <span className="text-xs text-muted-foreground">
                    {sectionTranslated}/{sectionTotal}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchStrings")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-md border p-1 bg-muted/50 w-full sm:w-auto">
              <Button
                variant={filter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setFilter("all")}
              >
                {t("allStrings")}
              </Button>
              <Button
                variant={filter === "untranslated" ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setFilter("untranslated")}
              >
                {t("untranslated")}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredMessages.map((msg) => (
              <div key={msg.key} className="rounded-lg border bg-card p-4 transition-all hover:border-primary/50">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono text-xs">{msg.key}</Badge>
                  {translations[msg.key] ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className="text-xs text-muted-foreground uppercase">{t("untranslated")}</span>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{t("original")}</label>
                    <div className="rounded-md bg-muted p-3 text-sm">{msg.enValue}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{t("translation")}</label>
                    <Textarea
                      value={translations[msg.key] || ""}
                      onChange={(e) => setTranslations((prev) => ({ ...prev, [msg.key]: e.target.value }))}
                      placeholder={msg.enValue}
                      className="min-h-[80px] text-sm resize-y"
                    />
                  </div>
                </div>
              </div>
            ))}
            {filteredMessages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {t("noStringsFound")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

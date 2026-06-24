"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { LOCALE_COOKIE, naturalLocales } from "@/lib/i18n/config";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ConlangTranslation {
  id: string;
  name: string;
  flagUrl: string | null;
  ownerName: string;
  percentage: number;
  isOwnerPreview?: boolean;
}

export function LanguageSwitcher({ variant = "dropdown" }: { variant?: "dropdown" | "list" }) {
  const t = useTranslations("i18n");
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState("en");
  const [translations, setTranslations] = useState<ConlangTranslation[]>([]);

  const fetchTranslations = useCallback(() => {
    fetch("/api/translations/available", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTranslations(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Read current locale from cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift() || "en";
      return "en";
    };
    setCurrentLocale(getCookie(LOCALE_COOKIE));

    fetchTranslations();
  }, [fetchTranslations]);

  const switchLocale = (locale: string) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000`;
    setCurrentLocale(locale);
    router.refresh();
  };

  const Content = () => (
    <>
      <DropdownMenuGroup>
        {naturalLocales.map((loc) => (
          <DropdownMenuItem key={loc.code} onClick={() => switchLocale(loc.code)} className="cursor-pointer">
            <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{t(loc.labelKey)}</span>
            <span className="text-xs text-muted-foreground ml-2">100%</span>
            {currentLocale === loc.code && <Check className="ml-2 h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>

      {translations.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            {t("conlangTranslations")}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {translations.map((lang) => (
              <DropdownMenuItem
                key={lang.id}
                onClick={() => switchLocale(`conlang:${lang.id}`)}
                className="cursor-pointer flex flex-col items-start py-2"
              >
                <div className="flex items-center w-full mb-1">
                  {lang.flagUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lang.flagUrl} alt="" className="w-4 h-4 rounded-sm object-cover mr-2" />
                  ) : (
                    <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">{lang.name}</span>
                  {lang.isOwnerPreview && (
                    <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("previewBadge")}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">{lang.percentage}%</span>
                  {currentLocale === `conlang:${lang.id}` && <Check className="ml-2 h-4 w-4" />}
                </div>
                <Progress value={lang.percentage} className="h-1 w-full mt-1" />
                <span className="text-[10px] text-muted-foreground mt-1">by @{lang.ownerName}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </>
      )}

      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/dashboard/translate-ui" className="cursor-pointer text-primary">
          <Plus className="mr-2 h-4 w-4" />
          {t("addConlang")}
        </Link>
      </DropdownMenuItem>
    </>
  );

  if (variant === "list") {
    return (
      <div className="w-full border rounded-md bg-card">
        <div className="p-2 flex flex-col gap-1">
          {naturalLocales.map((loc) => (
            <div key={loc.code} onClick={() => switchLocale(loc.code)} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
              <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{t(loc.labelKey)}</span>
              <span className="text-xs text-muted-foreground ml-2">100%</span>
              {currentLocale === loc.code && <Check className="ml-2 h-4 w-4" />}
            </div>
          ))}

          {translations.length > 0 && (
            <>
              <div className="-mx-1 my-1 h-px bg-muted" />
              <div className="px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {t("conlangTranslations")}
              </div>
              <div className="flex flex-col">
                {translations.map((lang) => (
                  <div
                    key={lang.id}
                    onClick={() => switchLocale(`conlang:${lang.id}`)}
                    className="relative flex cursor-pointer select-none flex-col items-start rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center w-full mb-1">
                      {lang.flagUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={lang.flagUrl} alt="" className="w-4 h-4 rounded-sm object-cover mr-2" />
                      ) : (
                        <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{lang.name}</span>
                      {lang.isOwnerPreview && (
                        <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("previewBadge")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">{lang.percentage}%</span>
                      {currentLocale === `conlang:${lang.id}` && <Check className="ml-2 h-4 w-4" />}
                    </div>
                    <Progress value={lang.percentage} className="h-1 w-full mt-1" />
                    <span className="text-[10px] text-muted-foreground mt-1">by @{lang.ownerName}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="-mx-1 my-1 h-px bg-muted" />
          <Link href="/dashboard/translate-ui" className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-primary hover:bg-accent hover:text-primary">
            <Plus className="mr-2 h-4 w-4" />
            {t("addConlang")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) fetchTranslations(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("switcherLabel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel>{t("switcherLabel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Content />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

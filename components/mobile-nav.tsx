"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { SearchBar } from "@/components/search/search-bar"
import { signOutAction } from "@/app/actions/auth"

interface MobileNavProps {
  session: any
  isDevMode: boolean
}

export function MobileNav({ session, isDevMode }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navigate through the platform</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="md:hidden">
            <SearchBar />
          </div>
          <Link href="/browse" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-start">
              Browse Languages
            </Button>
          </Link>
          {session || isDevMode ? (
            <>
              <Link href="/favorites" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Favorites
                </Button>
              </Link>
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Dashboard
                </Button>
              </Link>
              {session && (
                <form action={signOutAction} className="w-full">
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setOpen(false)}
                  >
                    Sign out
                  </Button>
                </form>
              )}
              {isDevMode && !session && (
                <Badge variant="secondary">Dev Mode</Badge>
              )}
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button className="w-full">Sign in</Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}


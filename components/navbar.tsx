"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Languages,
  Globe,
  Heart,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  Menu,
  Home,
  Search,
  Plus,
  Shield
} from "lucide-react"
import { SearchBar } from "@/components/search/search-bar"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useState } from "react"
import { NotificationCenter } from "@/components/notification-center"
import { ThemeToggle } from "@/components/theme-toggle"

interface NavbarProps {
  user?: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    isAdmin?: boolean
  } | null
  isDevMode?: boolean
}

const mainNavItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Browse", href: "/browse", icon: Globe },
  { name: "Favorites", href: "/favorites", icon: Heart, requiresAuth: true },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiresAuth: true },
]

export function Navbar({ user, isDevMode = false }: NavbarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAuthenticated = !!user || isDevMode

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <Languages className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight hidden sm:block">LingoCon</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 mx-4">
          {mainNavItems.map((item) => {
            if (item.requiresAuth && !isAuthenticated) return null
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 font-medium",
                    isActive
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>

        {/* Search */}
        <div className="hidden lg:flex flex-1 max-w-md mx-4">
          <SearchBar />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Create button - desktop */}
          {isAuthenticated && (
            <Link href="/dashboard/new-language" className="hidden sm:block">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">Create</span>
              </Button>
            </Link>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <NotificationCenter />

          {/* User menu or sign in */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.image || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block max-w-[100px] truncate text-sm">
                    {user?.name || "User"}
                  </span>
                  {isDevMode && !user && (
                    <Badge variant="secondary" className="text-xs">Dev</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name || "Developer"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || "dev@localhost"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                {user?.isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/favorites" className="cursor-pointer">
                    <Heart className="mr-2 h-4 w-4" />
                    Favorites
                  </Link>
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${user.id}`} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user && (
                  <form
                    action={async () => {
                      const { handleSignOut } = await import("@/app/actions/user-auth")
                      await handleSignOut()
                    }}
                  >
                    <DropdownMenuItem asChild>
                      <button type="submit" className="w-full cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </button>
                    </DropdownMenuItem>
                  </form>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />
                  Navigation
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                {/* Mobile search */}
                <div className="mb-4">
                  <SearchBar />
                </div>

                {/* Nav links */}
                {mainNavItems.map((item) => {
                  if (item.requiresAuth && !isAuthenticated) return null
                  const Icon = item.icon
                  const isActive = pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3",
                          isActive && "bg-primary/10 text-primary"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Button>
                    </Link>
                  )
                })}

                {/* Create button - mobile */}
                {isAuthenticated && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Link
                      href="/dashboard/new-language"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Button className="w-full gap-2">
                        <Plus className="h-4 w-4" />
                        Create Language
                      </Button>
                    </Link>
                  </>
                )}

                {/* Sign in - mobile */}
                {!isAuthenticated && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full">Sign in</Button>
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}


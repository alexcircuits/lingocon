"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/user"
import { updateUser, deleteAccount } from "@/app/actions/user"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useSession } from "next-auth/react"
import { Loader2, ArrowLeft, User, Mail, Shield, Bell, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function SettingsPage() {
    const { data: session, update } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDeleteAccount = async () => {
        setDeleting(true)
        try {
            const result = await deleteAccount()
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Account deleted")
                router.push("/")
            }
        } catch {
            toast.error("Failed to delete account")
        } finally {
            setDeleting(false)
        }
    }

    const form = useForm<UpdateUserInput>({
        resolver: zodResolver(updateUserSchema),
        defaultValues: {
            name: session?.user?.name || "",
            image: session?.user?.image || "",
        },
    })

    useEffect(() => {
        if (session?.user) {
            form.reset({
                name: session.user.name || "",
                image: session.user.image || "",
            })
        }
    }, [session, form])

    const onSubmit = async (values: UpdateUserInput) => {
        setLoading(true)
        try {
            const result = await updateUser({
                name: values.name,
                image: values.image || "",
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Profile updated successfully")
                await update()
                router.refresh()
            }
        } catch (error) {
            toast.error("Failed to save changes")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-muted/20">
            <div className="container max-w-4xl py-10 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                        <p className="text-muted-foreground">Manage your account and preferences</p>
                    </div>
                </div>

                <Tabs defaultValue="profile" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="notifications" disabled className="opacity-50">Notifications</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Public Profile</CardTitle>
                                <CardDescription>
                                    This information will be displayed publicly on your profile page.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                        <div className="flex flex-col gap-6 md:flex-row md:items-start">
                                            {/* Avatar Preview */}
                                            <div className="flex flex-col items-center gap-3">
                                                <Avatar className="h-24 w-24 border mb-2">
                                                    <AvatarImage src={form.watch("image") || session?.user?.image || undefined} />
                                                    <AvatarFallback className="text-2xl">{session?.user?.name?.[0] || "U"}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs text-muted-foreground">Preview</span>
                                            </div>

                                            {/* Form Fields */}
                                            <div className="flex-1 space-y-4 w-full">
                                                <FormField
                                                    control={form.control}
                                                    name="name"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Display Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Your name" {...field} />
                                                            </FormControl>
                                                            <FormDescription>
                                                                Visible to other users.
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="image"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Avatar URL</FormLabel>
                                                            <FormControl>
                                                                <div className="flex gap-2">
                                                                    <Input placeholder="https://..." {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription>
                                                                Link to an image for your profile picture.
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={loading} className="min-w-[120px]">
                                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="account" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Account Details</CardTitle>
                                <CardDescription>View your account information.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email Address</label>
                                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                                        <Mail className="mr-2 h-4 w-4" />
                                        {session?.user?.email}
                                    </div>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Managed by your authentication provider.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Account ID</label>
                                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono text-muted-foreground">
                                        {session?.user?.id}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-destructive/50">
                            <CardHeader>
                                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                                <CardDescription>
                                    Permanently delete your account and all associated data. This action cannot be undone.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={deleting}>
                                            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            Delete Account
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete your account, all your languages, and all associated data. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteAccount}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete Account
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

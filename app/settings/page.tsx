"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/user"
import { updateUser } from "@/app/actions/user"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
    const { data: session, update } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const form = useForm<UpdateUserInput>({
        resolver: zodResolver(updateUserSchema),
        defaultValues: {
            name: session?.user?.name || "",
            image: session?.user?.image || "",
        },
    })

    // Update form default values when session loads
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
        const result = await updateUser(values)
        setLoading(false)

        if (result.error) {
            toast.error("Error", {
                description: result.error,
            })
        } else {
            toast.success("Profile updated", {
                description: "Your settings have been saved successfully.",
            })
            update() // Update client-side session
            router.refresh()
        }
    }

    return (
        <div className="container max-w-4xl py-10 space-y-8">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                    <p className="text-muted-foreground">
                        Manage your account settings and profile preferences.
                    </p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[200px_1fr]">
                <nav className="flex flex-col space-y-1">
                    <Button variant="ghost" className="justify-start font-semibold bg-muted/50 hover:bg-muted/70">Profile</Button>
                    <Button variant="ghost" className="justify-start text-muted-foreground" disabled>Account</Button>
                    <Button variant="ghost" className="justify-start text-muted-foreground" disabled>Notifications</Button>
                </nav>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile</CardTitle>
                            <CardDescription>
                                This is how others will see you on the site.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    <div className="space-y-4">
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
                                                        This is your public display name. It can be your real name or a pseudonym.
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
                                                        <Input placeholder="https://example.com/avatar.jpg" {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Enter a URL for your profile picture.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="flex justify-start">
                                        <Button type="submit" disabled={loading}>
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

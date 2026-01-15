"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Server, Trash2, Loader2, CheckCircle } from "lucide-react"
import { pruneSessions } from "@/app/actions/admin-mutations"
import { Badge } from "@/components/ui/badge"

export function SystemMaintenanceCard({
    systemInfo
}: {
    systemInfo: {
        nodeVersion: string
        platform: string
        env: string
    }
}) {
    const [pruning, setPruning] = useState(false)
    const [pruneResult, setPruneResult] = useState<string | null>(null)

    const handlePrune = async () => {
        setPruning(true)
        setPruneResult(null)
        try {
            const result = await pruneSessions()
            setPruneResult(`Cleared ${result.count} expired items`)
            setTimeout(() => setPruneResult(null), 3000)
        } catch (error) {
            console.error(error)
        } finally {
            setPruning(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    System Maintenance
                </CardTitle>
                <CardDescription>Runtime environment and cleanup</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Environment Info */}
                    <div className="space-y-2 pb-4 border-b border-border/50">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Node.js Version</span>
                            <span className="font-mono text-xs">{systemInfo.nodeVersion}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Environment</span>
                            <Badge variant={systemInfo.env === "production" ? "default" : "secondary"}>
                                {systemInfo.env}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Platform</span>
                            <span className="font-mono text-xs">{systemInfo.platform}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">Prune Sessions</div>
                            <div className="text-xs text-muted-foreground">
                                Remove expired sessions & tokens
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrune}
                            disabled={pruning}
                        >
                            {pruning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : pruneResult ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            <span className="ml-2">{pruneResult || "Clean"}</span>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

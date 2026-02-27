"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    MessageCircle,
    Reply,
    Trash2,
    EyeOff,
    CornerDownRight,
    Send,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { createComment, deleteComment, hideComment } from "@/app/actions/comment"

interface User {
    id: string
    name: string | null
    image: string | null
}

interface CommentWithReplies {
    id: string
    content: string
    createdAt: Date
    userId: string
    languageId: string
    user: User
    replies: Array<{
        id: string
        content: string
        createdAt: Date
        userId: string
        user: User
    }>
}

interface CommentSectionProps {
    comments: CommentWithReplies[]
    languageId: string
    currentUserId?: string | null
    isOwner?: boolean
}

export function CommentSection({
    comments,
    languageId,
    currentUserId,
    isOwner = false,
}: CommentSectionProps) {
    const [newComment, setNewComment] = useState("")
    const [replyingTo, setReplyingTo] = useState<string | null>(null)
    const [replyContent, setReplyContent] = useState("")
    const [isPending, startTransition] = useTransition()

    const handleSubmit = () => {
        if (!newComment.trim()) return

        startTransition(async () => {
            const result = await createComment({
                content: newComment.trim(),
                languageId,
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                setNewComment("")
                toast.success("Comment posted")
            }
        })
    }

    const handleReply = (parentId: string) => {
        if (!replyContent.trim()) return

        startTransition(async () => {
            const result = await createComment({
                content: replyContent.trim(),
                languageId,
                parentId,
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                setReplyContent("")
                setReplyingTo(null)
                toast.success("Reply posted")
            }
        })
    }

    const handleDelete = (commentId: string) => {
        startTransition(async () => {
            const result = await deleteComment(commentId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Comment deleted")
            }
        })
    }

    const handleHide = (commentId: string) => {
        startTransition(async () => {
            const result = await hideComment(commentId, languageId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Comment hidden")
            }
        })
    }

    const getInitials = (name: string | null) => {
        if (!name) return "?"
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }

    const renderComment = (
        comment: { id: string; content: string; createdAt: Date; userId: string; user: User },
        isReply = false
    ) => (
        <div key={comment.id} className={`group flex gap-3 ${isReply ? "ml-10 mt-3" : ""}`}>
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.user.image || undefined} />
                <AvatarFallback className="text-xs">{getInitials(comment.user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{comment.user.name || "Anonymous"}</span>
                    <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {comment.content}
                </p>
                <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {currentUserId && !isReply && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            onClick={() => {
                                setReplyingTo(replyingTo === comment.id ? null : comment.id)
                                setReplyContent("")
                            }}
                        >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                        </Button>
                    )}
                    {(currentUserId === comment.userId) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(comment.id)}
                            disabled={isPending}
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                        </Button>
                    )}
                    {isOwner && currentUserId !== comment.userId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            onClick={() => handleHide(comment.id)}
                            disabled={isPending}
                        >
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hide
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-serif">
                    Comments
                    {comments.length > 0 && (
                        <span className="text-sm font-sans text-muted-foreground ml-2">
                            ({comments.length})
                        </span>
                    )}
                </h3>
            </div>

            {/* New comment form */}
            {currentUserId ? (
                <div className="flex gap-3">
                    <div className="flex-1 space-y-2">
                        <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Share your thoughts on this language..."
                            className="min-h-[80px] resize-none"
                            disabled={isPending}
                        />
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={isPending || !newComment.trim()}
                            >
                                <Send className="h-3.5 w-3.5 mr-1.5" />
                                {isPending ? "Posting..." : "Post Comment"}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        <a href="/login" className="text-primary hover:underline font-medium">Sign in</a> to leave a comment
                    </p>
                </div>
            )}

            {/* Comments list */}
            {comments.length === 0 ? (
                <div className="text-center py-8">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {comments.map((comment) => (
                        <div key={comment.id}>
                            {renderComment(comment)}

                            {/* Reply form */}
                            {replyingTo === comment.id && (
                                <div className="ml-10 mt-3 flex gap-2 items-start">
                                    <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Textarea
                                            value={replyContent}
                                            onChange={(e) => setReplyContent(e.target.value)}
                                            placeholder="Write a reply..."
                                            className="min-h-[60px] resize-none text-sm"
                                            disabled={isPending}
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setReplyingTo(null)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleReply(comment.id)}
                                                disabled={isPending || !replyContent.trim()}
                                            >
                                                {isPending ? "Posting..." : "Reply"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Existing replies */}
                            {comment.replies.map((reply) => renderComment(reply, true))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

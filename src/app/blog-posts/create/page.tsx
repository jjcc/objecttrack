"use client"

import * as React from "react"
import { useCreate, useNavigation } from "@refinedev/core"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function BlogPostCreate() {
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [status, setStatus] = React.useState("draft")
  const [isLoading, setIsLoading] = React.useState(false)

  const { mutate: createPost } = useCreate()
  const { list } = useNavigation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    createPost({
      resource: "blog_posts",
      values: {
        title,
        content,
        status,
      },
    }, {
      onSuccess: () => {
        list("blog_posts")
      },
    })
    
    setIsLoading(false)
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create Blog Post</CardTitle>
          <CardDescription>
            Create a new blog post.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter post content"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Post"}
              </Button>
              <Button type="button" variant="outline" onClick={() => list("blog_posts")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
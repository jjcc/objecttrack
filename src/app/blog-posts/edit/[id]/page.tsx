"use client"

import * as React from "react"
import { useOne, useUpdate, useNavigation } from "@refinedev/core"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function BlogPostEdit({ params }: { params: { id: string } }) {
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [status, setStatus] = React.useState("draft")
  const [isLoading, setIsLoading] = React.useState(false)

  const { data: postData, isLoading: isLoadingPost } = useOne({
    resource: "blog_posts",
    id: params.id,
  })
  
  const { mutate: updatePost } = useUpdate()
  const { list } = useNavigation()

  React.useEffect(() => {
    if (postData?.data) {
      setTitle(postData.data.title || "")
      setContent(postData.data.content || "")
      setStatus(postData.data.status || "draft")
    }
  }, [postData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    updatePost({
      resource: "blog_posts",
      id: params.id,
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

  if (isLoadingPost) {
    return (
      <div className="container mx-auto py-10">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Edit Blog Post</CardTitle>
          <CardDescription>
            Update your blog post.
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
                {isLoading ? "Updating..." : "Update Post"}
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
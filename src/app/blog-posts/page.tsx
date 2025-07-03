"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useMany, useList, useDelete, useNavigation } from "@refinedev/core"
import { format } from "date-fns"

import { DataTable, createActionColumn } from "@/components/data-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type BlogPost = {
  id: number
  title: string
  content: string
  status: string
  createdAt: string
  categories?: {
    id: number
    title: string
  }
}

export default function BlogPostList() {
  const { edit, show, create } = useNavigation()
  const { mutate: deletePost } = useDelete()
  
  const { data: blogPostData, isLoading } = useList<BlogPost>({
    resource: "blog_posts",
    meta: {
      select: "*, categories(id,title)",
    },
  })

  const { data: categoryData, isLoading: categoryIsLoading } = useMany({
    resource: "categories",
    ids: blogPostData?.data?.map((item) => item?.categories?.id).filter((id): id is number => Boolean(id)) ?? [],
    queryOptions: {
      enabled: !!blogPostData?.data,
    },
  })

  const columns = React.useMemo<ColumnDef<BlogPost>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => (
          <div className="w-12">{row.getValue("id")}</div>
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("title")}</div>
        ),
      },
      {
        accessorKey: "content",
        header: "Content",
        cell: ({ row }) => {
          const content = row.getValue("content") as string
          return (
            <div className="max-w-xs truncate">
              {content || "-"}
            </div>
          )
        },
      },
      {
        accessorKey: "categories",
        header: "Category",
        cell: ({ row }) => {
          const category = row.getValue("categories") as any
          if (categoryIsLoading) return <div>Loading...</div>
          
          const categoryTitle = categoryData?.data?.find(
            (item) => item.id === category?.id
          )?.title
          
          return <div>{categoryTitle || "-"}</div>
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="capitalize">{row.getValue("status")}</div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ row }) => {
          const date = row.getValue("createdAt") as string
          return (
            <div className="text-sm text-muted-foreground">
              {format(Date(date), "MMM dd, yyyy")}
            </div>
          )
        },
      },
      createActionColumn<BlogPost>({
        onShow: (row) => show("blog_posts", row.id),
        onEdit: (row) => edit("blog_posts", row.id),
        onDelete: (row) => {
          if (window.confirm("Are you sure you want to delete this post?")) {
            deletePost({
              resource: "blog_posts",
              id: row.id,
            })
          }
        },
      }),
    ],
    [categoryData, categoryIsLoading, edit, show, deletePost]
  )

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 h-full">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Blog Posts</CardTitle>
          <CardDescription>
            Manage your blog posts here.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full">
          <DataTable 
            columns={columns} 
            data={blogPostData?.data ?? []} 
          />
        </CardContent>
      </Card>
    </div>
  )
}
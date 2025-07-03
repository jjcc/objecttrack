"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useList, useDelete, useNavigation } from "@refinedev/core"
import { format } from "date-fns"

import { DataTable, createActionColumn } from "@/components/data-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Category = {
  id: number
  title: string
  createdAt?: string
}

export default function CategoryList() {
  const { edit, show } = useNavigation()
  const { mutate: deleteCategory } = useDelete()
  
  const { data: categoryData, isLoading } = useList<Category>({
    resource: "categories",
  })

  const columns = React.useMemo<ColumnDef<Category>[]>(
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
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ row }) => {
          const date = row.getValue("createdAt") as string
          if (!date) return <div>-</div>
          return (
            <div className="text-sm text-muted-foreground">
              {format(new Date(date), "MMM dd, yyyy")}
            </div>
          )
        },
      },
      createActionColumn<Category>({
        onShow: (row) => show("categories", row.id),
        onEdit: (row) => edit("categories", row.id),
        onDelete: (row) => {
          if (window.confirm("Are you sure you want to delete this category?")) {
            deleteCategory({
              resource: "categories",
              id: row.id,
            })
          }
        },
      }),
    ],
    [edit, show, deleteCategory]
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
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Manage your blog categories here.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full">
          <DataTable 
            columns={columns} 
            data={categoryData?.data ?? []} 
          />
        </CardContent>
      </Card>
    </div>
  )
}
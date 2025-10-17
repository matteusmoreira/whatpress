import * as React from "react"
import {
  Dialog as AlertDialog,
  DialogTrigger as AlertDialogTrigger,
  DialogContent as AlertDialogContent,
  DialogHeader as AlertDialogHeader,
  DialogFooter as AlertDialogFooter,
  DialogTitle as AlertDialogTitle,
  DialogDescription as AlertDialogDescription,
  DialogClose,
} from "./dialog"
import { Button } from "./button"

// Provide a compatible API for AlertDialog using the existing Dialog primitives.
// This avoids adding a new dependency (@radix-ui/react-alert-dialog) while keeping
// the imports used across the codebase working.

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return <Button ref={ref} className={className} {...props} />
})
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  // Wrap Button with DialogClose so clicking Cancel will close the dialog.
  return (
    <DialogClose asChild>
      <Button ref={ref} variant="outline" className={className} {...props} />
    </DialogClose>
  )
})
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
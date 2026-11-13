"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, LoaderCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), remember: form.get("remember") === "on" }) })
    if (!response.ok) {
      const data = (await response.json()) as { message?: string }
      setError(data.message || "登录失败，请重试")
      setPending(false)
      return
    }
    router.push("/")
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-8">
      <div><h2 className="text-2xl font-semibold tracking-tight">欢迎回来</h2><p className="mt-2 text-sm text-muted-foreground">登录以访问团队原型库</p></div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field><FieldLabel htmlFor="email">邮箱</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
          <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="password">密码</FieldLabel><Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(error)} required />{error ? <FieldDescription className="text-destructive">{error}</FieldDescription> : null}</Field>
          <Field orientation="horizontal">
            <Checkbox id="remember" name="remember" />
            <FieldLabel htmlFor="remember" className="font-normal">记住密码</FieldLabel>
          </Field>
          <Button type="submit" size="lg" disabled={pending}>{pending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}登录{!pending ? <ArrowRightIcon data-icon="inline-end" /> : null}</Button>
        </FieldGroup>
      </form>
      <p className="text-xs leading-5 text-muted-foreground">使用管理员为你创建的团队账号登录。</p>
    </div>
  )
}

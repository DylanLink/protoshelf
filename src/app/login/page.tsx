import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import Topography from "@/components/react-bits/Topography"
import { getCurrentSession } from "@/lib/auth"

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/")
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden border-r bg-[#08070d] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0">
          <Topography
            lowColor="#24104f"
            midColor="#7c3aed"
            highColor="#f5d0fe"
            speed={0.22}
            morphAmount={2.6}
            morphSpeed={0.045}
            bands={2.4}
            thickness={0.012}
            scale={0.92}
            glow={0.32}
            contrast={2.8}
            brightness={0.9}
            opacity={0.82}
            grainIntensity={0.025}
            mouseStrength={0.3}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/80" />
        <div className="relative z-10"><Brand /></div>
        <div className="relative z-10 max-w-xl">
          <h1 className="text-balance text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">让每一个想法，<br />都能被团队直接体验。</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/65">集中管理、预览和分享团队的交互原型。无需本地环境，打开链接即可查看。</p>
        </div>
        <p className="relative z-10 text-sm text-white/45">ProtoShelf · Internal prototype library</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm"><div className="mb-12 lg:hidden"><Brand /></div><LoginForm /></div>
      </section>
    </main>
  )
}

function Brand() {
  return <div className="flex items-center gap-3 font-semibold tracking-tight"><span className="grid size-9 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">P</span><span>ProtoShelf</span></div>
}

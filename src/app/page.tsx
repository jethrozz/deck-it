import { Upload } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <p className="text-sm text-[var(--muted)]">AI 装修设计师 Agent</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight">
            上传户型图，整理出能发给设计师的装修 brief
          </h1>
        </div>

        <form
          action="/api/projects"
          method="post"
          className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6"
        >
          <label className="grid gap-2">
            <span className="text-sm font-medium">项目名称</span>
            <input
              name="name"
              required
              defaultValue="我的装修方案"
              className="rounded-md border border-[var(--line)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-white"
          >
            <Upload size={18} />
            创建项目
          </button>
        </form>
      </section>
    </main>
  );
}

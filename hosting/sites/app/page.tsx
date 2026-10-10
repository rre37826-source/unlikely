"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "available" | "paused" | "busy" | "limit" | "unavailable";

const copy: Record<Status, { title: string; detail: string; chinese: string }> = {
  checking: {
    title: "Checking the public trial…",
    detail: "You can keep exploring the example maps on Unlikely.",
    chinese: "正在检查公共试用服务。你仍可在 Unlikely 探索精选示例。",
  },
  available: {
    title: "The public trial is available.",
    detail: "Return to Unlikely to enter your task and explore a map of possibilities.",
    chinese: "公共试用现已开放。返回 Unlikely，输入你的任务，探索更多可能。",
  },
  paused: {
    title: "The public trial is paused.",
    detail: "The example maps on Unlikely are still available to explore.",
    chinese: "公共试用暂未开放，Unlikely 的精选示例仍可自由探索。",
  },
  busy: {
    title: "The public trial is busy.",
    detail: "Please try again shortly. The example maps remain available.",
    chinese: "公共试用当前繁忙，请稍后重试。精选示例仍可使用。",
  },
  limit: {
    title: "The trial allowance is used up.",
    detail: "You can continue with the example maps on Unlikely.",
    chinese: "本轮试用额度已用完，你可以继续探索 Unlikely 的精选示例。",
  },
  unavailable: {
    title: "We could not check the trial.",
    detail: "Try refreshing the status, or return to Unlikely to explore its examples.",
    chinese: "暂时无法获取服务状态，请刷新重试，或返回 Unlikely 探索示例。",
  },
};

function readStatus(payload: unknown): Status {
  if (!payload || typeof payload !== "object" || !("available" in payload)) return "unavailable";
  if (payload.available === true) return "available";
  if (payload.available !== false) return "unavailable";
  const reason = "reason" in payload ? payload.reason : undefined;
  if (reason === "TRIAL_DISABLED" || reason === "TRIAL_CONFIG") return "paused";
  if (reason === "TRIAL_BUSY") return "busy";
  if (reason === "TRIAL_QUOTA" || reason === "TRIAL_BUDGET" || reason === "TRIAL_RATE_LIMIT") return "limit";
  return "unavailable";
}

export default function Home() {
  const [status, setStatus] = useState<Status>("checking");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setStatus("checking");
    fetch("/api/trial/status", {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? readStatus(await response.json()) : "unavailable" as const)
      .then((nextStatus) => { if (current) setStatus(nextStatus); })
      .catch(() => { if (current) setStatus("unavailable"); })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      current = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [revision]);

  const message = copy[status];
  return (
    <main className="status-page">
      <a className="wordmark" href="https://rre37826-source.github.io/unlikely/">Unlikely<span aria-hidden="true">↗</span></a>
      <section className="status-card" aria-labelledby="page-title">
        <p className="eyebrow">Public trial status</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          <span className={`status-dot status-${status}`} aria-hidden="true" />
          <h1 id="page-title">{message.title}</h1>
          <p className="detail">{message.detail}</p>
          <p className="chinese" lang="zh-CN">{message.chinese}</p>
        </div>
        <div className="actions">
          <a className="return-link" href="https://rre37826-source.github.io/unlikely/">Return to Unlikely <span aria-hidden="true">↗</span></a>
          <button type="button" disabled={status === "checking"} onClick={() => setRevision((value) => value + 1)}>Refresh status</button>
        </div>
      </section>
      <p className="footer-note">One starting point. More than one way forward.</p>
    </main>
  );
}
